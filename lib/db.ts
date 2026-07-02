import { mkdirSync, existsSync, readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { Paths } from "./constants"
import { ensureSchema } from "./schema"

declare var Bun: any | undefined

const __dirname = dirname(fileURLToPath(import.meta.url))

let db: any

function ensureDataDir() {
  if (!existsSync(Paths.dataRoot())) {
    mkdirSync(Paths.dataRoot(), { recursive: true })
  }
}

function getDbPath(override?: string): string {
  return override || Paths.db()
}

export async function initDb(overridePath?: string): Promise<void> {
  ensureDataDir()
  const dbPath = getDbPath(overridePath)
  const isNew = !existsSync(dbPath)

  let Database: any
  if (typeof Bun !== "undefined") {
    // @ts-expect-error runtime-only
    const mod = await import("bun:sqlite")
    Database = mod.Database
  } else {
    const mod = await import("better-sqlite3")
    Database = mod.default || mod
  }

  db = new Database(dbPath)
  try {
    db.pragma("journal_mode = WAL")
    db.pragma("foreign_keys = ON")
    db.pragma("busy_timeout = 5000")
  } catch {
    // bun:sqlite doesn't support pragma() - use exec instead
    db.exec("PRAGMA journal_mode = WAL")
    db.exec("PRAGMA foreign_keys = ON")
    db.exec("PRAGMA busy_timeout = 5000")
  }

  if (isNew) {
    runMigrations()
  } else {
    runPendingMigrations()
  }

  ensureSchema(db)
}

function runMigrations() {
  const migDir = join(__dirname, "..", "migrations")
  if (!existsSync(migDir)) return
  
  const files = readdirSync(migDir).filter(f => f.endsWith(".sql")).sort()
  for (const file of files) {
    const sql = readFileSync(join(migDir, file), "utf8")
    db.exec(sql)
  }
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)")
  db.exec(`INSERT INTO schema_version VALUES (${files.length})`)
}

function runPendingMigrations() {
  const hasSchemaVersion = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'").get()
  if (!hasSchemaVersion) {
    runMigrations()
    return
  }
  const current = (db.prepare("SELECT version FROM schema_version").get() as { version: number } | undefined)?.version ?? 0
  const migDir = join(__dirname, "..", "migrations")
  if (!existsSync(migDir)) return
  
  const files = readdirSync(migDir).filter(f => f.endsWith(".sql")).sort()
  for (let i = current; i < files.length; i++) {
    const sql = readFileSync(join(migDir, files[i]), "utf8")
    db.exec(sql)
    db.exec(`UPDATE schema_version SET version = ${i + 1}`)
  }
}

export function getDb(): any {
  return db
}

export function execSingle(sql: string, params: unknown[] = []): void {
  db.prepare(sql).run(params)
}

export function getOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  return db.prepare(sql).get(params) as T | undefined
}

export function getAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return db.prepare(sql).all(params) as T[]
}

export function runInsert(sql: string, params: unknown[] = []): number {
  const result = db.prepare(sql).run(params)
  return result.lastInsertRowid as number
}

export function transaction<T>(fn: () => T): T {
  const tx = db.transaction(fn)
  return tx()
}

export function now(): string {
  return new Date().toISOString().replace("T", " ").replace("Z", "+00:00")
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleSave(): void {
  if (_saveTimer) return // already scheduled
  _saveTimer = setTimeout(() => {
    _saveTimer = null
    saveDb()
  }, 500)
}

export function stopAutoSave(): void {
  if (_saveTimer) {
    clearTimeout(_saveTimer)
    _saveTimer = null
  }
}

export function saveDb(): void {
  // WAL handles durability; explicit checkpoint if needed
  try {
    db.pragma("wal_checkpoint(TRUNCATE)")
  } catch {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)")
  }
}

export function buildFtsQuery(raw: string): string {
  const parts: string[] = []
  const phrases: string[] = []
  
  let cleaned = raw.replace(/"([^"]+)"/g, (match) => {
    phrases.push(match.slice(1, -1).replace(/"/g, '""'))
    return ""
  })
  
  const tokens = cleaned
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 2)
  
  for (const t of tokens) {
    const upper = t.toUpperCase()
    if ((upper === "OR" || upper === "NOT") && parts.length > 0) continue
    parts.push(`"${t.replace(/"/g, '""')}"*`)
  }
  
  for (const p of phrases) {
    parts.push(`"${p}"`)
  }
  
  return parts.join(" AND ") || ""
}

export function searchFts5(query: string, limit = 10, whereExtra = "", params: unknown[] = []): Record<string, unknown>[] {
  const ftsQ = buildFtsQuery(query)
  if (!ftsQ) return []
  const extraJoin = whereExtra ? ` AND ${whereExtra}` : ""
  return getAll(
    `SELECT m.* FROM memories m JOIN memories_fts fts ON m.id = fts.rowid
     WHERE memories_fts MATCH ?${extraJoin}
     ORDER BY rank LIMIT ?`,
    [ftsQ, ...params, limit]
  )
}

export function initFts5(): void {
  // FTS5 table + triggers are created in ensureSchema (schema.ts)
}