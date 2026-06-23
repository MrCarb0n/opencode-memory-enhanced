import { getOne, runInsert, transaction, execSingle } from "./db"
import { extractSessionMemories, type MemoryRecord } from "./extractor"
import { linkEntity, discoverRelationships, autoLinkMemories } from "./entities"
import { join } from "path"
import { readFileSync, existsSync } from "fs"
import { homedir, cpus } from "os"
import { showToast } from "./helpers"
import { IS_WIN } from "./constants"

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
    _sqlJsPromise = import("sql.js").then((m: any) => (m.default || m)())
  }
  return _sqlJsPromise
}

async function queryOpenCodeDB(sql: string, params: any[] = []): Promise<any[]> {
  const dbPath = getOpenCodeDBPath()
  if (!dbPath) return []
  try {
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

const BATCH_SIZE = 5
const CONCURRENCY = Math.min(cpus().length, 8) || 4

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

  showToast(client, `Scanning ${unScannedIds.length} sessions across ${Math.min(CONCURRENCY, Math.ceil(unScannedIds.length / BATCH_SIZE))} workers...`, "info", 3000)

  const batches: string[][] = []
  for (let i = 0; i < unScannedIds.length; i += BATCH_SIZE) {
    batches.push(unScannedIds.slice(i, i + BATCH_SIZE))
  }

  const numWorkers = Math.min(CONCURRENCY, batches.length)
  const workerBatches: string[][][] = []
  for (let i = 0; i < numWorkers; i++) workerBatches.push([])
  for (let i = 0; i < batches.length; i++) workerBatches[i % numWorkers].push(batches[i])

  const workerUrl = new URL("./worker.ts", import.meta.url).href
  const workerProgress = new Array(numWorkers).fill(0)
  let lastToast = 0
  const allRecords: MemoryRecord[] = []
  let workerErrors = 0

  const promises = workerBatches.map((batchGroup, wi) => {
    if (batchGroup.length === 0) return Promise.resolve(0)
    return new Promise<number>((resolve) => {
      const worker = new Worker(workerUrl, { type: "module" })
      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data
        if (msg.type === "progress") {
          workerProgress[wi] = msg.done
          if (msg.error) workerErrors++
          const totalDone = workerProgress.reduce((a, b) => a + b, 0)
          if (totalDone - lastToast >= 10 || totalDone === unScannedIds.length) {
            showToast(client, `Scan: ${totalDone}/${unScannedIds.length} sessions`, "info", 1500)
            lastToast = totalDone
          }
        } else if (msg.type === "done") {
          allRecords.push(...(msg.memories || []))
          worker.terminate()
          resolve(1)
        }
      }
      worker.onerror = () => {
        workerErrors++
        worker.terminate()
        resolve(0)
      }
      worker.postMessage({
        dbPath,
        sessionIds: batchGroup.flat(),
        projectPath,
      })
    })
  })

  await Promise.allSettled(promises)

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

  if (workerErrors > 0) showToast(client, `${workerErrors} session(s) had errors`, "warning", 3000)
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
    let totalScanned = 0
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

      for (const sess of allSessions) {
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

        const records = extractSessionMemories(messages, {
          sid,
          title: sess.title,
          model: sess.model ?? sess.modelID,
          agent: sess.agent ?? sess.mode,
        }, dir || projectPath)

        transaction(() => {
          const storedNow = insertRecords(records, dir || projectPath)
          stored += storedNow
          execSingle(
            "INSERT OR IGNORE INTO scanned_sessions (session_id, message_count, stored_count) VALUES (?, ?, ?)",
            [sid, messages.length, storedNow]
          )
        })

        totalScanned++
        if (totalScanned % 10 === 0) showToast(client, `Scan (API): ${totalScanned} sessions`, "info", 1500)
      }
    }

    return stored
  } catch (e) { console.error("[memory-enhanced] scanPastSessions error:", e); return 0 }
}
