import { getOne, runInsert, transaction, execSingle, getDb } from "./db"
import { extractImportance, detectMemoryType, shouldNotSave } from "./types"
import { extractEntities, generateAutoTags, linkEntity, discoverRelationships, autoLinkMemories, getEntityOrCreate } from "./entities"
import { join } from "path"
import { existsSync, readFileSync } from "fs"
import { homedir } from "os"
import { IS_WIN } from "./constants"

function extractToolUsage(parts: any[]): { tools: string[]; files: string[]; commands: string[] } {
  const tools: string[] = []
  const files: string[] = []
  const commands: string[] = []
  for (const p of parts) {
    if (p.type === "tool_use" || p.type === "tool_call") {
      const name = p.name || p.tool || ""
      if (name) tools.push(name)
      const args = p.input || p.arguments || {}
      if (args.filePath) files.push(args.filePath)
      if (args.command && name === "bash") commands.push(args.command)
    }
    if (p.type === "tool_result" || p.type === "tool_response") {
      const fn = p.function || p.tool || ""
      if (fn) tools.push(fn)
    }
  }
  return {
    tools: [...new Set(tools)],
    files: [...new Set(files)],
    commands: [...new Set(commands)],
  }
}

function extractFileParts(parts: any[]): string[] {
  const files: string[] = []
  for (const p of parts) {
    if (p.type === "file" && p.filePath) files.push(p.filePath)
    if (p.type === "resolved" && p.filePath) files.push(p.filePath)
  }
  return [...new Set(files)]
}

function extractCostTokens(msg: any): { cost: number; tokensIn: number; tokensOut: number } {
  const info = msg?.info ?? msg ?? {}
  return {
    cost: info.cost ?? info.totalCost ?? info.total_cost ?? 0,
    tokensIn: info.tokens?.input ?? info.tokensInput ?? info.tokens_input ?? 0,
    tokensOut: info.tokens?.output ?? info.tokensOutput ?? info.tokens_output ?? 0,
  }
}

function getOpenCodeDBPath(): string {
  const override = process.env.OPENCODE_DB_PATH
  if (override && existsSync(override)) return override
  const candidates = [
    join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "opencode", "opencode.db"),
    join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "opencode", "opencode.db"),
  ]
  if (IS_WIN) {
    candidates.unshift(join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "opencode", "opencode.db"))
  }
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return ""
}

let _sqlJsPromise: Promise<any> | null = null
async function getSqlJs(): Promise<any> {
  if (!_sqlJsPromise) {
    // @ts-ignore — optional runtime dep, installed in opencode config dir
    _sqlJsPromise = import("sql.js").then((m: any) => (m.default || m)())
  }
  return _sqlJsPromise
}

async function queryOpenCodeDB(sql: string, params: any[] = []): Promise<any[]> {
  const dbPath = getOpenCodeDBPath()
  if (!dbPath) return []
  try {
    // @ts-ignore — optional native dep, may not be installed
    const mod = await import("better-sqlite3")
    const Database = mod.default || mod
    const odb = new Database(dbPath, { readonly: true })
    const stmt = odb.prepare(sql)
    const result = params.length > 0 ? stmt.all(...params) : stmt.all()
    odb.close()
    return result
  } catch {
    try {
      const buf = readFileSync(dbPath)
      const SQL = await getSqlJs()
      const odb = new SQL.Database(buf)
      let stmt: any
      if (params.length > 0) {
        stmt = odb.prepare(sql)
        stmt.bind(params)
      } else {
        stmt = odb.prepare(sql)
      }
      const rows: any[] = []
      while (stmt.step()) rows.push(stmt.getAsObject())
      stmt.free()
      odb.close()
      return rows
    } catch (e2) {
      console.debug("[memory-enhanced] Cannot read OpenCode DB:", e2)
      return []
    }
  }
}

export async function scanFromOpenCodeDB(projectPath: string, limit = 100): Promise<number> {
  const dbPath = getOpenCodeDBPath()
  if (!dbPath) {
    console.debug("[memory-enhanced] OpenCode DB not found")
    return 0
  }

  let stored = 0

  const sessions = await queryOpenCodeDB(
    "SELECT id, title, model, cost, tokens_input, tokens_output, tokens_reasoning, time_created, project_id, agent FROM session ORDER BY time_created DESC LIMIT ?",
    [limit]
  )

  for (let si = 0; si < sessions.length; si++) {
    if (si > 0 && si % 10 === 0) await new Promise((r) => setTimeout(r, 0))
    const sess = sessions[si]
    const sid = sess.id
    if (!sid) continue

    const already = getOne("SELECT id FROM scanned_sessions WHERE session_id = ?", [sid])
    if (already) continue

    const messages = await queryOpenCodeDB(
      "SELECT id, data, time_created FROM message WHERE session_id = ? ORDER BY time_created",
      [sid]
    )

    if (messages.length === 0) continue

    const project = await queryOpenCodeDB("SELECT worktree FROM project WHERE id = ?", [sess.project_id])
    const dir = project.length > 0 ? project[0].worktree : projectPath

    transaction(() => {
      let sessionStored = 0
      const allToolsUsed = new Set<string>()
      const allFilesReferenced = new Set<string>()
      const allCommands = new Set<string>()
      const assistantTexts: string[] = []
      let userTexts: string[] = []

      for (const msg of messages) {
        let msgData: any
        try {
          msgData = typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data
        } catch { continue }

        const role = msgData.role ?? ""
        const parts = msgData.parts ?? []

        for (const p of parts) {
          if (p.type === "tool_use" || p.type === "tool_call") {
            const name = p.name || p.tool || ""
            if (name) allToolsUsed.add(name)
            const args = p.input || p.arguments || {}
            if (args.filePath) allFilesReferenced.add(args.filePath)
            if (args.command && name === "bash") allCommands.add(args.command)
          }
          if (p.type === "text" && !p.synthetic) {
            const text = (p.text || "").trim()
            if (text.length >= 20) {
              if (role === "assistant" || role === "model") assistantTexts.push(text)
              if (role === "user" || !role) userTexts.push(text)
            }
          }
        }
      }

      for (const text of userTexts) {
        if (text.length < 20) continue
        if (shouldNotSave(text.substring(0, 300))) continue

        const importance = extractImportance(text)
        const memoryType = detectMemoryType(text)
        const keywords = extractEntities(text).join(",").toLowerCase()
        const autoTags = generateAutoTags(text).join(",")
        const clean = text.substring(0, 300).trim()

        const existing = getOne("SELECT id, scope FROM memories WHERE content = ?", [clean])
        if (!existing) {
          const memoryId = runInsert(
            "INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path) VALUES (?, ?, 'project', ?, ?, 0.5, ?, ?, ?)",
            [clean, memoryType, importance, sid, keywords, autoTags, dir || projectPath]
          )
          linkEntity(clean, memoryId, dir || projectPath)
          discoverRelationships(memoryId)
          autoLinkMemories(memoryId)
          sessionStored++
          stored++
        }
      }

      const metaParts = [`Session: ${sess.title ?? sid.substring(0, 12)}`, `${messages.length} messages`]
      if (sess.model) metaParts.push(`Model: ${sess.model}`)
      if (sess.agent) metaParts.push(`Agent: ${sess.agent}`)
      if ((sess.cost ?? 0) > 0) metaParts.push(`Cost: $${sess.cost.toFixed(4)}`)
      if ((sess.tokens_input ?? 0) > 0 || (sess.tokens_output ?? 0) > 0) metaParts.push(`Tokens: ${sess.tokens_input} in / ${sess.tokens_output} out`)
      if (allToolsUsed.size > 0) metaParts.push(`Tools: ${[...allToolsUsed].join(", ")}`)
      if (allFilesReferenced.size > 0) metaParts.push(`Files: ${[...allFilesReferenced].slice(0, 8).join(", ")}`)

      const metaKeywords = [...allToolsUsed, ...allFilesReferenced].join(",").toLowerCase()
      const metaTags = ["session"]
      if (sess.agent) metaTags.push(sess.agent.toLowerCase())
      const metaContent = metaParts.join(" | ").substring(0, 300)

      const metaExisting = getOne("SELECT id FROM memories WHERE content = ? AND type = 'project'", [metaContent])
      if (!metaExisting && metaParts.length > 1) {
        const metaId = runInsert(
          "INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path) VALUES (?, 'project', 'project', 6, ?, 0.6, ?, ?, ?)",
          [metaContent, sid, metaKeywords, metaTags.join(","), dir || projectPath]
        )
        linkEntity(metaContent, metaId, dir || projectPath)
        sessionStored++
        stored++
      }

      if (allToolsUsed.size > 0) {
        const toolList = [...allToolsUsed].join(", ")
        const toolExisting = getOne("SELECT id FROM memories WHERE session_id = ? AND type = 'tool-execution' AND keywords LIKE ?", [sid, `%${toolList.substring(0, 30)}%`])
        if (!toolExisting) {
          runInsert(
            "INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path) VALUES (?, 'tool-execution', 'project', 4, ?, 0.5, ?, ?, ?)",
            [`Tools used: ${toolList}`, sid, toolList.toLowerCase(), "tools," + toolList.toLowerCase().slice(0, 60), dir || projectPath]
          )
          sessionStored++
          stored++
        }
      }

      if (allFilesReferenced.size > 0) {
        const fileList = [...allFilesReferenced].slice(0, 15).join(", ")
        const filesExisting = getOne("SELECT id FROM memories WHERE session_id = ? AND type = 'file' AND keywords LIKE ?", [sid, `%file%`])
        if (!filesExisting) {
          runInsert(
            "INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path) VALUES (?, 'file', 'project', 5, ?, 0.5, ?, ?, ?)",
            [`Files referenced: ${fileList}`, sid, "files," + [...allFilesReferenced].map(f => f.replace(/[^a-zA-Z0-9_\/.-]/g, "")).join(",").toLowerCase().substring(0, 100), "files", dir || projectPath]
          )
          sessionStored++
          stored++
        }
      }

      if (allCommands.size > 0) {
        const cmdList = [...allCommands].slice(0, 5).join(" | ")
        const cmdExisting = getOne("SELECT id FROM memories WHERE session_id = ? AND type = 'shell'", [sid])
        if (!cmdExisting) {
          runInsert(
            "INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path) VALUES (?, 'shell', 'project', 4, ?, 0.4, ?, ?, ?)",
            [`Shell commands: ${cmdList.substring(0, 250)}`, sid, "shell,commands,bash", "shell,commands", dir || projectPath]
          )
          sessionStored++
          stored++
        }
      }

      if (assistantTexts.length > 0) {
        const combined = assistantTexts.join(" ").substring(0, 300).trim()
        if (combined.length >= 30) {
          const asstExisting = getOne("SELECT id FROM memories WHERE session_id = ? AND type = 'reference' AND content = ?", [sid, combined])
          if (!asstExisting) {
            const importance = extractImportance(combined)
            const keywords = extractEntities(combined).join(",").toLowerCase()
            const autoTags = generateAutoTags(combined).join(",")
            runInsert(
              "INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path) VALUES (?, 'reference', 'project', ?, ?, 0.4, ?, ?, ?)",
              [combined, Math.max(3, importance - 1), sid, keywords, autoTags, dir || projectPath]
            )
            sessionStored++
            stored++
          }
        }
      }

      runInsert("INSERT INTO scanned_sessions (session_id, message_count, stored_count) VALUES (?, ?, ?)", [sid, messages.length, sessionStored])
    })
  }

  return stored
}

export async function scanPastSessions(client: any, projectPath: string, limit = 99999): Promise<number> {
  try {
    const projRes = await client.project?.list?.()
    const rawProjects = projRes?.data?.[200] ?? projRes?.data ?? []
    const projects: any[] = Array.isArray(rawProjects) ? rawProjects : []

    let allDirs: string[] = []
    for (const p of projects) {
      const dir = p?.worktree ?? ""
      if (dir && !allDirs.includes(dir)) allDirs.push(dir)
    }
    if (allDirs.length === 0) allDirs.push("")

    let stored = 0
    for (const dir of allDirs) {
      let page = 0
      const pageSize = 50
      let hasMore = true
      const allSessions: any[] = []

      while (hasMore && allSessions.length < limit) {
        const listRes = await client.session?.list?.(dir ? { query: { directory: dir, offset: page * pageSize, limit: pageSize } } : { query: { offset: page * pageSize, limit: pageSize } })
        const rawSessions = listRes?.data?.[200] ?? listRes?.data ?? []
        const sessions: any[] = Array.isArray(rawSessions) ? rawSessions : []
        if (sessions.length === 0) { hasMore = false; break }
        const remaining = limit - allSessions.length
        allSessions.push(...sessions.slice(0, remaining))
        if (sessions.length < pageSize || allSessions.length >= limit) hasMore = false
        page++
      }

      const recent = allSessions
      for (const sess of recent) {
        const sid = sess.id ?? sess.sessionID ?? ""
        if (!sid) continue

        const already = getOne("SELECT id FROM scanned_sessions WHERE session_id = ?", [sid])
        if (already) continue

        let messages: any[] = []
        try {
          const msgRes = await client.session?.messages?.({ path: { id: sid } })
          const rawMsgs = msgRes?.data?.[200] ?? msgRes?.data ?? []
          messages = Array.isArray(rawMsgs) ? rawMsgs : []
        } catch (e) { console.debug("[memory-enhanced] failed to fetch messages:", e) }

        if (messages.length === 0) continue

        transaction(() => {
          let sessionStored = 0
          let totalCost = 0
          let totalTokensIn = 0
          let totalTokensOut = 0
          const allToolsUsed = new Set<string>()
          const allFilesReferenced = new Set<string>()
          const allCommands = new Set<string>()
          const assistantTexts: string[] = []

          for (const msg of messages) {
            const msgInfo = msg?.info ?? msg ?? {}
            const parts = msgInfo?.parts ?? []
            const role = msgInfo?.role ?? ""

            const ct = extractCostTokens(msg)
            totalCost += ct.cost
            totalTokensIn += ct.tokensIn
            totalTokensOut += ct.tokensOut

            const { tools, files, commands } = extractToolUsage(parts)
            for (const t of tools) allToolsUsed.add(t)
            for (const f of files) allFilesReferenced.add(f)
            for (const c of commands) allCommands.add(c)

            for (const fp of extractFileParts(parts)) allFilesReferenced.add(fp)

            const text = parts
              .filter((p: any) => p.type === "text" && !p.synthetic)
              .map((p: any) => p.text)
              .join(" ")
              .trim()

            if (text) {
              if (role === "assistant" || role === "model") {
                assistantTexts.push(text)
              }

              if (text.length >= 20 && (role === "user" || !role)) {
                const importance = extractImportance(text)
                const memoryType = detectMemoryType(text)
                const keywords = extractEntities(text).join(",").toLowerCase()
                const autoTags = generateAutoTags(text).join(",")
                const clean = text.substring(0, 300).trim()

                if (!shouldNotSave(clean)) {
                  const existing = getOne("SELECT id, scope FROM memories WHERE content = ?", [clean])
                  if (!existing) {
                    const memoryId = runInsert(
                      "INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path) VALUES (?, ?, 'project', ?, ?, 0.5, ?, ?, ?)",
                      [clean, memoryType, importance, sid, keywords, autoTags, dir || projectPath]
                    )
                    linkEntity(clean, memoryId, dir || projectPath)
                    discoverRelationships(memoryId)
                    autoLinkMemories(memoryId)
                    sessionStored++
                    stored++
                  }
                }
              }
            }
          }

          const sessTitle = sess.title ?? `Session ${sid.substring(0, 12)}`
          const sessModel = sess.model ?? sess.modelID ?? ""
          const sessAgent = sess.agent ?? sess.mode ?? ""
          const msgCount = messages.length
          const metaParts = [`Session: ${sessTitle}`, `${msgCount} messages`]
          if (sessModel) metaParts.push(`Model: ${sessModel}`)
          if (sessAgent) metaParts.push(`Agent: ${sessAgent}`)
          if (totalCost > 0) metaParts.push(`Cost: $${totalCost.toFixed(4)}`)
          if (totalTokensIn > 0 || totalTokensOut > 0) metaParts.push(`Tokens: ${totalTokensIn} in / ${totalTokensOut} out`)
          if (allToolsUsed.size > 0) metaParts.push(`Tools: ${[...allToolsUsed].join(", ")}`)
          if (allFilesReferenced.size > 0) metaParts.push(`Files: ${[...allFilesReferenced].slice(0, 8).join(", ")}`)
          const metaKeywords = [...allToolsUsed, ...allFilesReferenced].join(",").toLowerCase()
          const metaTags = ["session"]
          if (sessAgent) metaTags.push(sessAgent.toLowerCase())
          const metaContent = metaParts.join(" | ").substring(0, 300)
          const metaExisting = getOne("SELECT id FROM memories WHERE content = ? AND type = 'project'", [metaContent])
          if (!metaExisting && metaParts.length > 1) {
            const metaId = runInsert(
              "INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path) VALUES (?, 'project', 'project', 6, ?, 0.6, ?, ?, ?)",
              [metaContent, sid, metaKeywords, metaTags.join(","), dir || projectPath]
            )
            linkEntity(metaContent, metaId, dir || projectPath)
            sessionStored++
            stored++
          }

          if (allToolsUsed.size > 0) {
            const toolList = [...allToolsUsed].join(", ")
            const toolExisting = getOne("SELECT id FROM memories WHERE session_id = ? AND type = 'tool-execution' AND keywords LIKE ?", [sid, `%${toolList.substring(0, 30)}%`])
            if (!toolExisting) {
              const toolMemId = runInsert(
                "INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path) VALUES (?, 'tool-execution', 'project', 4, ?, 0.5, ?, ?, ?)",
                [`Tools used: ${toolList}`, sid, toolList.toLowerCase(), "tools," + toolList.toLowerCase().slice(0, 60), dir || projectPath]
              )
              linkEntity(`Tools used: ${toolList}`, toolMemId, dir || projectPath)
              sessionStored++
              stored++
            }
          }

          if (allFilesReferenced.size > 0) {
            const fileList = [...allFilesReferenced].slice(0, 15).join(", ")
            const filesExisting = getOne("SELECT id FROM memories WHERE session_id = ? AND type = 'file' AND keywords LIKE ?", [sid, `%file%`])
            if (!filesExisting) {
              const fileMemId = runInsert(
                "INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path) VALUES (?, 'file', 'project', 5, ?, 0.5, ?, ?, ?)",
                [`Files referenced: ${fileList}`, sid, "files," + [...allFilesReferenced].map(f => f.replace(/[^a-zA-Z0-9_\/.-]/g, "")).join(",").toLowerCase().substring(0, 100), "files", dir || projectPath]
              )
              for (const fp of [...allFilesReferenced].slice(0, 5)) {
                const entName = fp.split(/[/\\]/).pop() || fp
                getEntityOrCreate(entName, dir || projectPath)
              }
              sessionStored++
              stored++
            }
          }

          if (allCommands.size > 0) {
            const cmdList = [...allCommands].slice(0, 5).join(" | ")
            const cmdExisting = getOne("SELECT id FROM memories WHERE session_id = ? AND type = 'shell'", [sid])
            if (!cmdExisting) {
              const cmdMemId = runInsert(
                "INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path) VALUES (?, 'shell', 'project', 4, ?, 0.4, ?, ?, ?)",
                [`Shell commands: ${cmdList.substring(0, 250)}`, sid, "shell,commands,bash", "shell,commands", dir || projectPath]
              )
              linkEntity(`Shell commands: ${cmdList.substring(0, 100)}`, cmdMemId, dir || projectPath)
              sessionStored++
              stored++
            }
          }

          if (assistantTexts.length > 0) {
            const combined = assistantTexts.join(" ").substring(0, 300).trim()
            if (combined.length >= 30) {
              const asstExisting = getOne("SELECT id FROM memories WHERE session_id = ? AND type = 'reference' AND content = ?", [sid, combined])
              if (!asstExisting) {
                const importance = extractImportance(combined)
                const keywords = extractEntities(combined).join(",").toLowerCase()
                const autoTags = generateAutoTags(combined).join(",")
                const asstId = runInsert(
                  "INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path) VALUES (?, 'reference', 'project', ?, ?, 0.4, ?, ?, ?)",
                  [combined, Math.max(3, importance - 1), sid, keywords, autoTags, dir || projectPath]
                )
                linkEntity(combined, asstId, dir || projectPath)
                sessionStored++
                stored++
              }
            }
          }

          runInsert("INSERT INTO scanned_sessions (session_id, message_count, stored_count) VALUES (?, ?, ?)", [sid, messages.length, sessionStored])
        })
      }
    }

    return stored
  } catch (e) { console.error("[memory-enhanced] scanPastSessions error:", e); return 0 }
}


