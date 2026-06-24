import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { initDb, getDb, execSingle, getOne, getAll, runInsert, now, saveDb, scheduleSave, stopAutoSave, initFts5, searchFts5 } from "./lib/db"
import { autoRemember, applyMemoryDecay, hybridSearch, pendingEmbeds } from "./lib/memory"
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

export default (async ({ client, project, directory }: PluginInput) => {
  try {
    loadConfig()
    await initDb(getConfig().db_path ?? undefined)

    ensureSchema(getDb())

    initFts5()

    applyMemoryDecay()
    saveDb()

    _dbReady = true


  } catch (e) {
    console.error("[memory-enhanced] Init failed, running in degraded mode:", e)
    try { client.app.log({ body: { service: "memory-enhanced", level: "error", message: `Init failed: ${e}` } }) } catch (_) { }
  }

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
            maybeConsolidate()
            scheduleSave()
            break
          }
          case "session.deleted": {
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
      try {
        captureFrozenSnapshot()
        const userText = output.parts?.filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ") ?? ""
        if (!userText) return
        const cfg = getConfig()

        if (cfg.auto_remember) {
          autoRemember(client, userText, input.sessionID, projectPath)
        }

        if (userText.length > 3) {
          track(hybridSearch(userText, 3, "m.scope = 'project' AND m.importance >= 5").then((results) => {
            if (results.length > 0 && cfg.toast_enabled) {
              showToast(client, `Context: ${results.length} related memories`, "info", 2000)
            }
          }).catch(() => {}))
        }

        track(detectBoundary(input.sessionID, userText).then(async (score) => {
          if (score >= cfg.episode_boundary_threshold) {
            const episodeId = await finalizeEpisode(input.sessionID, projectPath)
            if (episodeId) {
              track(synthesizeEpisode(episodeId, callLLM))
              if (getEpisodeCount() % 5 === 0) {
                track(clusterEpisodes(projectPath))
              }
            }
          }
        }).catch(() => {}))
      } catch (e) { console.error("[memory-enhanced] chat.message error:", e) }
    },

    "experimental.session.compacting": async (input: any, output: any) => {
      if (!_dbReady) return
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
        const userText = input?.sessionID ? (getActiveEpisode(input.sessionID)?.intent || "") : ""
        if (userText.length > 3) {
          const epBlock = await injectEpisodeContext(userText, budget, projectPath)
          if (epBlock) { output.context.push(epBlock); budget -= epBlock.length }
        }
      } catch (e) { console.error("[memory-enhanced] compacting error:", e) }
    },

    "tool.execute.before": async (input: any, output: any) => {
      if (!_dbReady) return
      try {
        const toolName = String(input?.tool ?? "")
        onToolStart(input.sessionID, toolName, output?.args || {})

        const query = output?.args?.command
          ? (output.args.command.match(/\b\w{4,}\b/g) || []).slice(0, 5).join(" ")
          : (output?.args?.filePath ?? output?.args?.pattern ?? "")
        if (query && query.length > 2) {
          const results = searchFts5(query, 1, "m.scope = 'project' AND m.importance >= 5") as Array<{ content: string }>
          if (results.length > 0) {
            const ctx = results[0].content.substring(0, toolName === "bash" ? 60 : 120)
            client.app.log({ body: { service: "memory-enhanced", level: "debug", message: `Context for ${toolName}: ${ctx}` } })
            if (toolName === "read" || toolName === "edit" || toolName === "grep" || toolName === "glob") {
              if (output.args) output.args._memory_context = `Relevant: ${ctx}`
            }
          }
        }
      } catch (e) { console.error("[memory-enhanced] tool.execute.before error:", e) }
    },

    "tool.execute.after": async (input: any) => {
      if (!_dbReady) return
      try {
        const toolName = String(input?.tool ?? "")
        onToolEnd(input.sessionID, toolName, input?.args || {}, input?.result, input?.error)

        if (!getConfig().tracked_tools.includes(toolName)) return
        const cmd = String(input?.args?.command ?? input?.args?.filePath ?? input?.args?.pattern ?? "")
        if (!cmd || cmd.length <= 5) return
        if (toolName === "bash" && getConfig().noise_commands.some((nc: string) => cmd.toLowerCase().includes(nc))) return
        runInsert("INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords) VALUES (?, 'tool-execution', 'project', 3, ?, 0.3, ?)", [cmd.substring(0, 200), input.sessionID, toolName])
      } catch (e) { console.error("[memory-enhanced] tool.execute.after error:", e) }
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
        const userText = input?.sessionID ? (getActiveEpisode(input.sessionID)?.intent || "") : ""
        if (userText.length > 3) {
          const epBlock = await injectEpisodeContext(userText, budget, projectPath)
          if (epBlock) { output.system.push(epBlock); budget -= epBlock.length }
        }
      } catch (e) { console.error("[memory-enhanced] system.transform error:", e) }
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
          "context_budget", "episode_capture", "episode_boundary_threshold", "pattern_promotion_threshold", "synthesis_enabled",
          "predictive_retrieval", "cross_project_sharing"
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
