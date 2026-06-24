import { getOne, runInsert, transaction, execSingle } from "./db"
import { extractSessionMemories, type MemoryRecord } from "./extractor"
import { linkEntity, discoverRelationships, autoLinkMemories } from "./entities"
import { join } from "path"
import { existsSync } from "fs"
import { homedir } from "os"
import { showToast } from "./helpers"
import { IS_WIN } from "./constants"
declare var Bun: any | undefined

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

async function queryOpenCodeDB(sql: string, params: any[] = []): Promise<any[]> {
  const dbPath = getOpenCodeDBPath()
  if (!dbPath) return []
  try {
    let Database: any
    if (typeof Bun !== "undefined") {
      // @ts-expect-error runtime-only
      const mod = await import("bun:sqlite")
      Database = mod.Database
    } else {
      const mod = await import("better-sqlite3")
      Database = mod.default || mod
    }
    const odb = new Database(dbPath, { readonly: true })
    const stmt = odb.prepare(sql)
    const result = params.length > 0 ? stmt.all(...params) : stmt.all()
    odb.close()
    return result
  } catch (e) {
    console.debug("[memory-enhanced] Cannot read OpenCode DB:", e)
    return []
  }
}

function insertRecords(records: MemoryRecord[], projectPath: string): number {
  let stored = 0
  for (const rec of records) {
    const existing = getOne("SELECT id FROM memories WHERE content = ?", [rec.content])
    if (existing) continue
    const memoryId = runInsert(
      "INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path) VALUES (?, ?, 'project', ?, ?, ?, ?, ?, ?)",
      [rec.content, rec.type, rec.importance, rec.session_id, rec.relevance_score, rec.keywords, rec.tags, rec.project_path || projectPath]
    )
    if (memoryId) {
      linkEntity(rec.content, memoryId, rec.project_path || projectPath)
      discoverRelationships(memoryId)
      autoLinkMemories(memoryId)
      stored++
    }
  }
  return stored
}

export async function scanFromOpenCodeDB(client: any, projectPath: string, limit = 50): Promise<number> {
  const dbPath = getOpenCodeDBPath()
  if (!dbPath) {
    console.debug("[memory-enhanced] OpenCode DB not found")
    return 0
  }

  const sessions = await queryOpenCodeDB(
    "SELECT id, title, model, cost, tokens_input, tokens_output, time_created FROM session ORDER BY time_created DESC LIMIT ?",
    [limit]
  )
  if (sessions.length === 0) return 0

  const unScannedIds: string[] = []
  for (const sess of sessions) {
    const sid = sess.id
    if (!sid) continue
    const already = getOne("SELECT id FROM scanned_sessions WHERE session_id = ?", [sid])
    if (!already) unScannedIds.push(sid)
  }
  if (unScannedIds.length === 0) return 0

  showToast(client, `Scanning ${unScannedIds.length} sessions...`, "info", 3000)

  const allRecords: MemoryRecord[] = []
  for (const sid of unScannedIds) {
    try {
      const rows = await queryOpenCodeDB(
        `SELECT data FROM part WHERE session_id = ? AND json_extract(data, '$.type') = 'text' ORDER BY time_created`,
        [sid]
      )
      for (const row of rows) {
        try {
          const part = JSON.parse(row.data)
          if (part.text) {
            const records = extractSessionMemories(
              [{ data: JSON.stringify({ role: part.role || "user", parts: [{ type: "text", text: part.text }] }) }],
              { sid, title: "", model: "", agent: "" },
              projectPath
            )
            allRecords.push(...records)
          }
        } catch (e) {
          console.debug("[memory-enhanced] failed to parse part:", e)
        }
      }
    } catch (e) {
      console.debug("[memory-enhanced] failed to read session parts:", e)
    }
  }

  let stored = 0
  if (allRecords.length > 0) {
    transaction(() => {
      stored = insertRecords(allRecords, projectPath)
      for (const sid of unScannedIds) {
        runInsert("INSERT OR IGNORE INTO scanned_sessions (session_id, stored_count) VALUES (?, ?)",
          [sid, allRecords.filter(r => r.session_id === sid).length])
      }
    })
  }

  return stored
}


