import initSqlJs from "fts5-sql-bundle"
import type { Database as SqlJsDatabase } from "fts5-sql-bundle"
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from "fs"
import { Paths, Tables } from "./constants"

// SQLite rows are inherently dynamic — values can be string, number, or null
interface DbRow {
  [key: string]: any
}

let db: SqlJsDatabase
let _dbPath: string
let _saveInterval: ReturnType<typeof setInterval> | null = null
let _dataDirEnsured = false

// ─── Data directory ──────────────────────────────────────────────
function ensureDataDir() {
  if (_dataDirEnsured) return
  _dataDirEnsured = true
  if (!existsSync(Paths.dataRoot())) {
    mkdirSync(Paths.dataRoot(), { recursive: true })
  }
}

// ─── Persistence ─────────────────────────────────────────────────
export function saveDb() {
  if (!db) return
  try {
    const data = db.export()
    const buf = Buffer.from(data)
    // don't nuke a non-empty file with an empty db (crash recovery)
    if (existsSync(_dbPath) && readFileSync(_dbPath).length > 4096) {
      try { if (db.exec("SELECT 1 FROM memories LIMIT 1").length === 0) return } catch {}
    }
    const tmp = _dbPath + ".tmp." + Date.now()
    writeFileSync(tmp, buf)
    renameSync(tmp, _dbPath)
  } catch (e) {
    console.error("[memory-enhanced] Failed to save database:", e)
  }
}

// ─── Init ─────────────────────────────────────────────────────────
export async function initDb(dbPath?: string): Promise<void> {
  ensureDataDir()
  const SQL = await initSqlJs()
  _dbPath = dbPath || Paths.db()
  let existingData: Uint8Array | undefined

  if (existsSync(_dbPath)) {
    try {
      const buf = readFileSync(_dbPath)
      existingData = new Uint8Array(buf)
    } catch (e) { console.debug("[memory-enhanced] corrupt db file, starting fresh:", e) }
  }

  db = existingData ? new SQL.Database(existingData) : new SQL.Database()
  db.run("PRAGMA foreign_keys = ON")

  if (existingData) {
    try {
      const check = db.exec("PRAGMA integrity_check")
      const result = check?.[0]?.values?.[0]?.[0]
      if (result !== "ok") throw Error(`integrity_check: ${result}`)
    } catch (e) {
      console.error("[memory-enhanced] DB corrupt, deleting and starting fresh:", e)
      db.close()
      writeFileSync(_dbPath, new Uint8Array(0))
      db = new SQL.Database()
    }
  }
}

export function getDb(): SqlJsDatabase {
  return db
}

// ─── Query Helpers ────────────────────────────────────────────────
export function execSingle(sql: string, params: unknown[] = []): void {
  if (!db) return
  db.run(sql, params)
}

export function getOne(sql: string, params: unknown[] = []): DbRow | undefined {
  if (!db) return
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const cols = stmt.getColumnNames()
    const vals = stmt.get() as unknown[]
    stmt.free()
    const row: DbRow = {}
    cols.forEach((c, i) => { row[c] = vals[i] })
    return row
  }
  stmt.free()
}

export function getAll(sql: string, params: unknown[] = []): DbRow[] {
  if (!db) return []
  const results: DbRow[] = []
  const stmt = db.prepare(sql)
  stmt.bind(params)
  while (stmt.step()) {
    const cols = stmt.getColumnNames()
    const vals = stmt.get() as unknown[]
    const row: DbRow = {}
    cols.forEach((c, i) => { row[c] = vals[i] })
    results.push(row)
  }
  stmt.free()
  return results
}

export function runInsert(sql: string, params: unknown[] = []): number {
  if (!db) return 0
  db.run(sql, params)
  const idRow = getOne("SELECT last_insert_rowid() as id")
  return (idRow?.id as number) ?? 0
}

export function transaction<T>(fn: () => T): T {
  db.run("BEGIN")
  try {
    const result = fn()
    db.run("COMMIT")
    return result
  } catch (e) {
    db.run("ROLLBACK")
    throw e
  }
}

export function now(): string {
  return new Date().toISOString().replace("T", " ").replace("Z", "+00:00")
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleSave() {
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(saveDb, 500)
}

export function stopAutoSave() {
  if (_saveTimer) {
    clearTimeout(_saveTimer)
    _saveTimer = null
  }
  if (_saveInterval) {
    clearInterval(_saveInterval)
    _saveInterval = null
  }
}

// ─── FTS5 ─────────────────────────────────────────────────────────
const FTS_TABLE = Tables.memoriesFts
const CONTENT_TABLE = Tables.memories

export function initFts5() {
  const tableExists = getOne(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [FTS_TABLE]
  )

  db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS "${FTS_TABLE}" USING fts5(
    content, type, tags, keywords,
    content='${CONTENT_TABLE}',
    content_rowid='id',
    tokenize='porter unicode61'
  )`)
  db.run(`CREATE TRIGGER IF NOT EXISTS "${FTS_TABLE}_ai" AFTER INSERT ON "${CONTENT_TABLE}" BEGIN
    INSERT INTO "${FTS_TABLE}"(rowid, content, type, tags, keywords)
    VALUES (new.id, new.content, new.type, new.tags, new.keywords);
  END`)
  db.run(`CREATE TRIGGER IF NOT EXISTS "${FTS_TABLE}_ad" AFTER DELETE ON "${CONTENT_TABLE}" BEGIN
    INSERT INTO "${FTS_TABLE}"("${FTS_TABLE}", rowid, content, type, tags, keywords)
    VALUES('delete', old.id, old.content, old.type, old.tags, old.keywords);
  END`)
  db.run(`CREATE TRIGGER IF NOT EXISTS "${FTS_TABLE}_au" AFTER UPDATE ON "${CONTENT_TABLE}" BEGIN
    INSERT INTO "${FTS_TABLE}"("${FTS_TABLE}", rowid, content, type, tags, keywords)
    VALUES('delete', old.id, old.content, old.type, old.tags, old.keywords);
    INSERT INTO "${FTS_TABLE}"(rowid, content, type, tags, keywords)
    VALUES (new.id, new.content, new.type, new.tags, new.keywords);
  END`)

  if (!tableExists) {
    const memCount = getOne(`SELECT COUNT(*) as c FROM "${CONTENT_TABLE}"`)?.c as number ?? 0
    if (memCount > 0) {
      db.run(`INSERT INTO "${FTS_TABLE}"("${FTS_TABLE}") VALUES('rebuild')`)
    }
  }
}

// ─── FTS Query ────────────────────────────────────────────────────
// Supports:
//   "phrase query"  → exact phrase match
//   term1 OR term2  → OR between terms
//   term1 NOT term2 → exclusion
//   term            → AND prefix match (default)
export function buildFtsQuery(raw: string): string {
  // Extract quoted phrases and preserve them
  const phrases: string[] = []
  let cleaned = raw.replace(/"([^"]+)"/g, (match) => {
    phrases.push(match)
    return " ___PHRASE___ "
  })
  // Split remaining text into tokens
  const tokens = cleaned
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\s_-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && w !== "___PHRASE___")

  const parts: string[] = []
  let i = 0
  while (i < tokens.length) {
    const upper = tokens[i].toUpperCase()
    if ((upper === "OR" || upper === "NOT") && i > 0) {
      i++
      continue
    }
    // Check if next token is OR or NOT
    if (i + 1 < tokens.length && tokens[i + 1].toUpperCase() === "OR" && i + 2 < tokens.length) {
      parts.push(`"${tokens[i].replace(/"/g, '""')}"* OR "${tokens[i + 2].replace(/"/g, '""')}"*`)
      i += 3
      continue
    }
    if (i + 1 < tokens.length && tokens[i + 1].toUpperCase() === "NOT" && i + 2 < tokens.length) {
      parts.push(`"${tokens[i].replace(/"/g, '""')}"* NOT "${tokens[i + 2].replace(/"/g, '""')}"*`)
      i += 3
      continue
    }
    parts.push(`"${tokens[i].replace(/"/g, '""')}"*`)
    i++
  }
  // Add phrases as-is (already quoted, with doubled inner quotes)
  for (const p of phrases) {
    const inner = p.slice(1, -1).replace(/"/g, '""')
    parts.push(`"${inner}"`)
  }
  return parts.filter(Boolean).join(" AND ") || ""
}

export function searchFts5(query: string, limit = 10, whereExtra = "", params: unknown[] = []): DbRow[] {
  const ftsQ = buildFtsQuery(query)
  if (!ftsQ) return []
  const extraJoin = whereExtra ? ` AND ${whereExtra}` : ""
  return getAll(
    `SELECT m.* FROM "${CONTENT_TABLE}" m JOIN "${FTS_TABLE}" fts ON m.id = fts.rowid
     WHERE "${FTS_TABLE}" MATCH ?${extraJoin}
     ORDER BY rank LIMIT ?`,
    [ftsQ, ...params, limit]
  )
}


