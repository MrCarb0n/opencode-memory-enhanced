import { appendFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { initDb, getDb, execSingle, getOne, getAll, runInsert, now, saveDb, scheduleSave, stopAutoSave, initFts5, searchFts5 } from "./lib/db"
import { autoRemember, applyMemoryDecay, hybridSearch, pendingEmbeds } from "./lib/memory"
import { warmProjection } from "./lib/embeddings"
import { loadConfig, getConfig, saveConfig } from "./lib/config"
import { showToast, updateAgentsMd } from "./lib/helpers"
import { scanFromOpenCodeDB } from "./lib/scan"
import { createTools } from "./lib/tools/index"
import { ensureSchema } from "./lib/schema"

import { buildCuratedBlock } from "./lib/curated"
import { detectEntityPatterns } from "./lib/entities"
import { onToolStart, onToolEnd, detectBoundary, finalizeEpisode, abortEpisode, getActiveEpisode, getEpisodeCount } from "./lib/episodes"
import { synthesizeEpisode } from "./lib/episode-synthesis"
import { injectEpisodeContext } from "./lib/episode-retrieval"
import { clusterEpisodes } from "./lib/episode-patterns"

let _curatedBlock: string | null = null
let _isConsolidating = false
let _dbReady = false
const _pending: Promise<unknown>[] = []
function track(p: Promise<unknown>) { _pending.push(p); p.finally(() => { const i = _pending.indexOf(p); if (i >= 0) _pending.splice(i, 1) }) }

// ─── Low-latency caches ────────────────────────────────────────────
// Episode context: keyed by sessionID, invalidated on session.compacted / session.deleted.
const _episodeCtxCache = new Map<string, { intent: string; block: string; ts: number }>()
const EPISODE_CTX_TTL_MS = 30_000

// Tool FTS5: keyed by (tool, query), LRU-bounded to keep memory predictable.
const _toolCtxCache = new Map<string, { context: string | null; ts: number }>()
const TOOL_CTX_TTL_MS = 60_000
const TOOL_CTX_MAX = 100

function getCachedEpisodeCtx(sid: string, intent: string): string | null {
  const hit = _episodeCtxCache.get(sid)
  if (!hit) return null
  if (Date.now() - hit.ts > EPISODE_CTX_TTL_MS) { _episodeCtxCache.delete(sid); return null }
  if (hit.intent !== intent) return null
  return hit.block
}

function setCachedEpisodeCtx(sid: string, intent: string, block: string): void {
  _episodeCtxCache.set(sid, { intent, block, ts: Date.now() })
}

function invalidateEpisodeCtx(sid: string): void {
  _episodeCtxCache.delete(sid)
}

function getCachedToolCtx(tool: string, query: string): { context: string | null; hit: true } | { hit: false } {
  const key = `${tool}${query}`
  const entry = _toolCtxCache.get(key)
  if (!entry) return { hit: false }
  if (Date.now() - entry.ts > TOOL_CTX_TTL_MS) {
    _toolCtxCache.delete(key)
    return { hit: false }
  }
  // LRU touch: re-insert to refresh position
  _toolCtxCache.delete(key)
  _toolCtxCache.set(key, entry)
  return { context: entry.context, hit: true }
}

function setCachedToolCtx(tool: string, query: string, context: string | null): void {
  const key = `${tool}${query}`
  if (_toolCtxCache.size >= TOOL_CTX_MAX) {
    const firstKey = _toolCtxCache.keys().next().value
    if (firstKey !== undefined) _toolCtxCache.delete(firstKey)
  }
  _toolCtxCache.set(key, { context, ts: Date.now() })
}

const _timingPath = join(homedir(), ".config", "opencode", "timing.log")
let _prevTs = Date.now()
try { mkdirSync(join(homedir(), ".config", "opencode"), { recursive: true }) } catch {}
function logTime(label: string) {
  const ts = Date.now()
  const delta = ts - _prevTs
  _prevTs = ts
  try {
    appendFileSync(_timingPath, `${ts} ${label} delta=${delta}ms\n`, "utf-8")
  } catch {}
}

export default (async ({ client, project, directory }: PluginInput) => {
  try {
    loadConfig()
    await initDb(getConfig().db_path ?? undefined)

    ensureSchema(getDb())

    initFts5()

    _dbReady = true


  } catch (e) {
    console.error("[memory-enhanced] Init failed, running in degraded mode:", e)
    try { client.app.log({ body: { service: "memory-enhanced", level: "error", message: `Init failed: ${e}` } }) } catch (_) { }
  }

  // Defer maintenance work (decay sweep, db flush, embedding warmup) off the
  // plugin-load hot path. Plugin becomes interactive immediately; bg work tracks
  // via _pending so dispose() can still wait for it.
  setTimeout(() => {
    track((async () => {
      try { applyMemoryDecay(); saveDb() } catch (e) { console.debug("[memory-enhanced] decay failed:", e) }
      try { warmProjection() } catch (e) { console.debug("[memory-enhanced] warmProjection failed:", e) }
    })())
  }, 0)

  const projectPath = project.worktree ?? directory

  async function callLLM(prompt: string): Promise<string> {
    const c = client as any
    try {
      if (typeof c.llm?.chat === "function") {
        const resp = await c.llm.chat({ messages: [{ role: "user", content: prompt }] })
        return resp?.message?.content || ""
      }
    } catch { }
    try {
      if (typeof c.chat?.complete === "function") {
        const resp = await c.chat.complete({ messages: [{ role: "user", content: prompt }] })
        return resp?.content || ""
      }
    } catch { }
    return ""
  }

  try {
    client.app.log({ body: { service: "memory-enhanced", level: "info", message: "Plugin initialized" } })
  } catch (_e) { /* app.log not available */ }

  function captureFrozenSnapshot() {
    if (!_curatedBlock) {
      const block = buildCuratedBlock()
      _curatedBlock = block || null
    }
  }

  function maybeConsolidate() {
    if (_isConsolidating) return
    const cfg = getConfig()
    if (!cfg.background_consolidate) return
    _isConsolidating = true
    setTimeout(() => {
      try { detectEntityPatterns(projectPath) } finally { _isConsolidating = false }
    }, 0)
  }

  function closeArc(sid: string) {
    execSingle("UPDATE conversation_arcs SET end_time = ? WHERE session_id = ? AND end_time IS NULL AND id = (SELECT id FROM conversation_arcs WHERE session_id = ? AND end_time IS NULL ORDER BY id DESC LIMIT 1)", [now(), sid, sid])
  }

  return {
    event: async ({ event }) => {
      if (!_dbReady) return
      try {
        switch (event.type) {
          case "session.created": {
            captureFrozenSnapshot()
            client.app.log({ body: { service: "memory-enhanced", level: "info", message: `Session started: ${event.properties.info.id}` } })
            const count = (getOne<{ c: number }>("SELECT COUNT(*) as c FROM memories")?.c) ?? 0
            const cfg = getConfig()
            if (cfg.toast_enabled && count > 0) showToast(client, `${count} memories · auto`, "info")
            if (cfg.auto_remember) {
              updateAgentsMd()
            }
            if (cfg.scan_on_start) {
              const sessionsScanned = (getOne<{ c: number }>("SELECT COUNT(*) as c FROM scanned_sessions")?.c) ?? 0
              track(scanFromOpenCodeDB(client, projectPath, sessionsScanned === 0 ? 99999 : 3).catch(() => {}))
            }
            break
          }
          case "session.updated": {
            closeArc(event.properties.info.id)
            break
          }
          case "session.idle": {
            applyMemoryDecay()
            closeArc(event.properties.sessionID)
            abortEpisode(event.properties.sessionID)
            setTimeout(() => detectEntityPatterns(projectPath), 0)
            setTimeout(() => track(clusterEpisodes(projectPath)), 100)
            scheduleSave()
            break
          }
          case "session.compacted": {
            _curatedBlock = null
            invalidateEpisodeCtx(event.properties.sessionID ?? "")
            maybeConsolidate()
            scheduleSave()
            break
          }
          case "session.deleted": {
            invalidateEpisodeCtx(event.properties.info?.id ?? "")
            scheduleSave()
            break
          }
          case "session.error": {
            const err = String(event.properties.error ?? "unknown").substring(0, 300)
            runInsert("INSERT INTO memories (content, type, scope, importance, session_id, keywords) VALUES (?, 'error', 'project', 4, ?, 'error')", [`Session error: ${err}`, event.properties.sessionID ?? "<unknown>"])
            scheduleSave()
            break
          }
        }
      } catch (e) { console.error("[memory-enhanced] event error:", e) }
    },

    "chat.message": async (input: any, output: any) => {
      if (!_dbReady) return
      logTime("chat.message")
      try {
        captureFrozenSnapshot()
        const userText = output.parts?.filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ") ?? ""
        if (!userText) { logTime("chat.message.end"); return }
        const cfg = getConfig()

        if (cfg.auto_remember) {
          // Background: autoRemember does dedup + entity extraction + sqlite work.
          // None of it is needed for the input pipeline to continue.
          setTimeout(() => track(
            Promise.resolve().then(() => autoRemember(client, userText, input.sessionID, projectPath))
              .catch((e) => console.debug("[memory-enhanced] autoRemember failed:", e))
          ), 0)
        }

        if (userText.length > 3) {
          const sid = input.sessionID
          setTimeout(() => {
            logTime("bg.hybridSearch")
            track(hybridSearch(userText, 3, "m.scope = 'project' AND m.importance >= 5").then((results) => {
              logTime("bg.hybridSearch.end")
              if (results.length > 0 && cfg.toast_enabled) {
                showToast(client, `Context: ${results.length} related memories`, "info", 2000)
              }
            }).catch(() => { logTime("bg.hybridSearch.err") }))
          }, 0)
        }

        if (userText.length > 3) {
          const sid = input.sessionID
          setTimeout(() => {
            logTime("bg.detectBoundary")
            track(detectBoundary(sid, userText).then(async (score) => {
              logTime("bg.detectBoundary.end")
              if (score >= 0.5) {
                const episodeId = await finalizeEpisode(sid, projectPath)
                if (episodeId) {
                  track(synthesizeEpisode(episodeId, callLLM))
                  if (getEpisodeCount() % 5 === 0) {
                    track(clusterEpisodes(projectPath))
                  }
                }
              }
            }).catch(() => { logTime("bg.detectBoundary.err") }))
          }, 0)
        }
      } catch (e) { console.error("[memory-enhanced] chat.message error:", e) }
      logTime("chat.message.end")
    },

    "experimental.session.compacting": async (input: any, output: any) => {
      if (!_dbReady) return
      logTime("compacting")
      try {
        captureFrozenSnapshot()
        let budget = getConfig().context_budget
        const memories = getAll<{ content: string; type: string; importance: number }>("SELECT content, type, importance FROM memories WHERE scope = 'project' AND importance >= 5 ORDER BY importance DESC, last_accessed DESC LIMIT 8")
        if (memories.length > 0) {
          const block = `\n# Persistent Memories\n\n${memories.map((r) => `[${r.type}|i:${r.importance}] ${r.content.trim().substring(0, 120)}`).join("\n")}\n`
          if (block.length <= budget) { output.context.push(block); budget -= block.length }
        }
        const ents = getAll<{ name: string; type: string; description: string | null }>("SELECT name, type, description FROM entities WHERE mention_count >= 2 ORDER BY mention_count DESC LIMIT 10")
        if (ents.length > 0) {
          const block = `\n# Known Concepts\n${ents.map((r) => `  - ${r.name} (${r.type}): ${(r.description ?? "no description").substring(0, 100)}`).join("\n")}\n`
          if (block.length <= budget) { output.context.push(block); budget -= block.length }
        }
        if (_curatedBlock && _curatedBlock.length <= budget) output.context.push(`\n# Curated Memory\n${_curatedBlock}\n`)

        // Episode context: cache-first during compaction, do not await.
        const sid = input?.sessionID
        const userText = sid ? (getActiveEpisode(sid)?.intent || "") : ""
        if (sid && userText.length > 3) {
          const cached = getCachedEpisodeCtx(sid, userText)
          if (cached && cached.length <= budget) {
            output.context.push(cached)
            budget -= cached.length
          } else {
            setTimeout(() => {
              track(Promise.resolve(injectEpisodeContext(userText, getConfig().context_budget, projectPath))
                .then((block) => {
                  if (block) setCachedEpisodeCtx(sid, userText, block)
                })
                .catch(() => {}))
            }, 0)
          }
        }
      } catch (e) { console.error("[memory-enhanced] compacting error:", e) }
      logTime("compacting.end")
    },

    "tool.execute.before": async (input: any, output: any) => {
      if (!_dbReady) return
      logTime(`tool.before:${String(input?.tool ?? "?")}`)
      try {
        const toolName = String(input?.tool ?? "")
        onToolStart(input.sessionID, toolName, output?.args || {})

        const query = output?.args?.command
          ? (output.args.command.match(/\b\w{4,}\b/g) || []).slice(0, 5).join(" ")
          : (output?.args?.filePath ?? output?.args?.pattern ?? "")
        if (query && query.length > 2) {
          // Cache lookup. Same (tool, query) within TTL → skip FTS5 entirely.
          let ctx: string | null = null
          const cached = getCachedToolCtx(toolName, query)
          if (cached.hit) {
            ctx = (cached as { context: string | null; hit: true }).context
          } else {
            const results = searchFts5(query, 1, "m.scope = 'project' AND m.importance >= 5") as Array<{ content: string }>
            ctx = results.length > 0 ? results[0].content.substring(0, toolName === "bash" ? 60 : 120) : null
            setCachedToolCtx(toolName, query, ctx)
          }
          if (ctx) {
            client.app.log({ body: { service: "memory-enhanced", level: "debug", message: `Context for ${toolName}: ${ctx}` } })
            if (toolName === "read" || toolName === "edit" || toolName === "grep" || toolName === "glob") {
              if (output.args) output.args._memory_context = `Relevant: ${ctx}`
            }
          }
        }
      } catch (e) { console.error("[memory-enhanced] tool.execute.before error:", e) }
      logTime(`tool.before.end:${String(input?.tool ?? "?")}`)
    },

    "tool.execute.after": async (input: any) => {
      if (!_dbReady) return
      logTime(`tool.after:${String(input?.tool ?? "?")}`)
      try {
        const toolName = String(input?.tool ?? "")
        onToolEnd(input.sessionID, toolName, input?.args || {}, input?.result, input?.error)

        if (!getConfig().tracked_tools.includes(toolName)) return
        const cmd = String(input?.args?.command ?? input?.args?.filePath ?? input?.args?.pattern ?? "")
        if (!cmd || cmd.length <= 5) return
        if (toolName === "bash" && getConfig().noise_commands.some((nc: string) => cmd.toLowerCase().includes(nc))) return
        runInsert("INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords) VALUES (?, 'tool-execution', 'project', 3, ?, 0.3, ?)", [cmd.substring(0, 200), input.sessionID, toolName])
      } catch (e) { console.error("[memory-enhanced] tool.execute.after error:", e) }
      logTime(`tool.after.end:${String(input?.tool ?? "?")}`)
    },

    "permission.ask": async (input: any, output: any) => {
      if (!_dbReady) return
      try {
        const permType = String(input?.type ?? "")
        if (permType === "write" || permType === "edit") {
          const allowKeywords = getConfig().auto_allow_keywords
          const allowPatterns = allowKeywords.flatMap((k: string) => [
            `% ${k} %`, `% ${k}`, `${k} %`
          ])
          const allow = getAll(`SELECT content FROM memories WHERE type = 'feedback' AND scope = 'project' AND (${allowPatterns.map(() => 'content LIKE ?').join(' OR ')}) ORDER BY importance DESC LIMIT 3`, allowPatterns)
          if (allow.length > 0) { output.status = "allow"; return }
        }
        if (permType === "bash" || permType === "run") {
          const denyKeywords = getConfig().auto_deny_keywords
          const denyPatterns = denyKeywords.flatMap((k: string) => [
            `% ${k} %`, `% ${k}`, `${k} %`
          ])
          const deny = getAll(`SELECT content FROM memories WHERE type = 'feedback' AND scope = 'project' AND (${denyPatterns.map(() => 'content LIKE ?').join(' OR ')}) ORDER BY importance DESC LIMIT 3`, denyPatterns)
          if (deny.length > 0) { output.status = "deny"; return }
        }
      } catch (e) { console.error("[memory-enhanced] permission.ask error:", e) }
    },

    "experimental.chat.system.transform": async (input: any, output: any) => {
      if (!_dbReady) return
      logTime("system.transform")
      try {
        captureFrozenSnapshot()
        let budget = getConfig().context_budget
        const mems = getAll("SELECT content, type FROM memories WHERE scope = 'project' AND importance >= 7 ORDER BY importance DESC, last_accessed DESC LIMIT 6")
        if (mems.length > 0) {
          const block = `\n## Persistent Memories\n${mems.map((r: any) => `  - [${r.type}] ${r.content.substring(0, 100)}`).join("\n")}\n`
          if (block.length <= budget) { output.system.push(block); budget -= block.length }
        }
        const ents = getAll("SELECT name, type, description FROM entities WHERE mention_count >= 3 ORDER BY mention_count DESC LIMIT 5")
        if (ents.length > 0) {
          const block = `\n## Known Concepts\n${ents.map((r: any) => `  - ${r.name} (${r.type}): ${(r.description || "known entity").substring(0, 60)}`).join("\n")}\n`
          if (block.length <= budget) { output.system.push(block); budget -= block.length }
        }
        if (_curatedBlock && _curatedBlock.length <= budget) output.system.push(`\n## Curated Memory (frozen at session start)\n${_curatedBlock}\n`)

        // Episode context: cache-first, never block input pathway. If we have a
        // fresh cache hit, push it; otherwise schedule a background refresh and
        // skip for this turn. The next system.transform for this session will
        // pick up the freshly-cached block once it lands.
        const sid = input?.sessionID
        const userText = sid ? (getActiveEpisode(sid)?.intent || "") : ""
        if (sid && userText.length > 3) {
          const cached = getCachedEpisodeCtx(sid, userText)
          if (cached && cached.length <= budget) {
            output.system.push(cached)
            budget -= cached.length
          } else if (!getCachedEpisodeCtx(sid, userText)) {
            // No usable cache. Kick off background fetch; next call will hit cache.
            setTimeout(() => {
              track(Promise.resolve(injectEpisodeContext(userText, getConfig().context_budget, projectPath))
                .then((block) => {
                  if (block) setCachedEpisodeCtx(sid, userText, block)
                })
                .catch(() => {}))
            }, 0)
          }
        }
      } catch (e) { console.error("[memory-enhanced] system.transform error:", e) }
      logTime("system.transform.end")
    },

    "config": async (input: any) => {
      try {
        const current = getConfig()
        const keys = [
          "auto_remember", "decay_rate", "access_boost", "toast_enabled", "scan_on_start",
          "tracked_tools", "dont_save_patterns", "auto_remember_patterns", "noise_commands",
          "auto_allow_keywords", "auto_deny_keywords", "tech_stack", "tag_patterns",
          "memory_type_patterns", "importance_patterns", "graph_type_colors", "write_approval",
          "agent_note_limit", "user_profile_limit", "security_scan", "background_consolidate",
           "context_budget"
        ] as const
        for (const k of keys) {
          if (input[k] !== undefined) (current as any)[k] = input[k]
        }
        saveConfig(current)
      } catch (e) { console.error("[memory-enhanced] config error:", e) }
    },

    "dispose": async () => {
      try {
        await Promise.allSettled([..._pending, ...pendingEmbeds])
        stopAutoSave()
        saveDb()
        client.app.log({ body: { service: "memory-enhanced", level: "info", message: "Plugin disposed" } })
      } catch (e) { console.error("[memory-enhanced] dispose error:", e) }
    },

    tool: createTools(client, projectPath),
  }
}) satisfies Plugin
