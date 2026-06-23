import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import Database from "better-sqlite3"

const __dirname = dirname(fileURLToPath(import.meta.url))

let tmpDir
let dbPath
let db

function loadMigrationSql() {
  const migDir = join(__dirname, "..", "migrations")
  const files = existsSync(migDir) ? readdirSync(migDir).filter(f => f.endsWith(".sql")).sort() : []
  return files.map(f => readFileSync(join(migDir, f), "utf8")).join("\n")
}

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "mem-test-"))
  dbPath = join(tmpDir, "test.db")
  process.env.MEMORY_ENHANCED_DATA_DIR = tmpDir

  db = new Database(dbPath)
  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")

  // Run migration SQL
  const migSql = loadMigrationSql()
  if (migSql) db.exec(migSql)
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)")
  db.exec("INSERT INTO schema_version VALUES (1)")

  // Run ensureSchema (Tables from schema.ts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL, type TEXT DEFAULT 'conversation',
      scope TEXT DEFAULT 'project', timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, tags TEXT,
      last_accessed DATETIME, importance INTEGER DEFAULT 5, relevance_score REAL DEFAULT 0.0,
      access_count INTEGER DEFAULT 0, keywords TEXT, session_id TEXT, project_path TEXT, embedding TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS curated_store (
      id INTEGER PRIMARY KEY AUTOINCREMENT, store TEXT NOT NULL CHECK(store IN ('agent_note','user_profile')),
      content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS pending_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL CHECK(action IN ('add','replace','remove')),
      store TEXT NOT NULL CHECK(store IN ('agent_note','user_profile')), content TEXT NOT NULL DEFAULT '',
      old_text TEXT NOT NULL DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected'))
    );
    CREATE TABLE IF NOT EXISTS procedural_knowledge (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'general', content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME, use_count INTEGER DEFAULT 0, embedding TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, type TEXT DEFAULT 'concept',
      description TEXT, project_path TEXT, first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP, mention_count INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT, source_entity_id INTEGER NOT NULL REFERENCES entities(id),
      target_entity_id INTEGER NOT NULL REFERENCES entities(id), relationship_type TEXT NOT NULL,
      description TEXT, confidence REAL DEFAULT 1.0, first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS conversation_arcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, intent TEXT, topics TEXT, summary TEXT,
      message_count INTEGER DEFAULT 0, start_time DATETIME DEFAULT CURRENT_TIMESTAMP, end_time DATETIME,
      importance REAL DEFAULT 0.0, project_path TEXT
    );
    CREATE TABLE IF NOT EXISTS concept_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT, memory_id INTEGER REFERENCES memories(id) ON DELETE CASCADE,
      entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS learning_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT, pattern_text TEXT NOT NULL, pattern_type TEXT DEFAULT 'general',
      confidence REAL DEFAULT 0.5, occurrences INTEGER DEFAULT 1, first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP, project_path TEXT
    );
    CREATE TABLE IF NOT EXISTS memory_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT, source_memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
      target_memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE, link_type TEXT DEFAULT 'related',
      strength REAL DEFAULT 1.0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS scanned_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL UNIQUE, message_count INTEGER DEFAULT 0,
      stored_count INTEGER DEFAULT 0, scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content, type, tags, keywords, content='memories', content_rowid='id', tokenize='porter unicode61'
    );
    CREATE TRIGGER IF NOT EXISTS memories_fts_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, type, tags, keywords) VALUES (new.id, new.content, new.type, new.tags, new.keywords);
    END;
    CREATE TRIGGER IF NOT EXISTS memories_fts_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, type, tags, keywords) VALUES('delete', old.id, old.content, old.type, old.tags, old.keywords);
    END;
    CREATE TRIGGER IF NOT EXISTS memories_fts_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, type, tags, keywords) VALUES('delete', old.id, old.content, old.type, old.tags, old.keywords);
      INSERT INTO memories_fts(rowid, content, type, tags, keywords) VALUES (new.id, new.content, new.type, new.tags, new.keywords);
    END;
  `)
})

after(() => {
  if (db) db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("DB initialization", () => {
  it("creates all tables", () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    const names = tables.map(t => t.name)

    assert.ok(names.includes("memories"))
    assert.ok(names.includes("entities"))
    assert.ok(names.includes("memories_fts"))
    assert.ok(names.includes("relationships"))
    assert.ok(names.includes("conversation_arcs"))
    assert.ok(names.includes("curated_store"))
    assert.ok(names.includes("pending_memories"))
    assert.ok(names.includes("procedural_knowledge"))
    assert.ok(names.includes("learning_patterns"))
    assert.ok(names.includes("memory_links"))
    assert.ok(names.includes("scanned_sessions"))
    assert.ok(names.includes("concept_tags"))
  })
})

describe("CRUD operations", () => {
  it("inserts and retrieves a memory", () => {
    const info = db.prepare(
      "INSERT INTO memories (content, type, scope, importance, session_id, keywords) VALUES (?, ?, 'project', ?, 'test-session', 'test,integration')"
    ).run("Hello from integration test", "test", 7)
    const id = info.lastInsertRowid
    assert.ok(id > 0)

    const row = db.prepare("SELECT content, importance FROM memories WHERE id = ?").get(id)
    assert.ok(row)
    assert.strictEqual(row.content, "Hello from integration test")
    assert.strictEqual(row.importance, 7)
  })

  it("lists memories ordered by id", () => {
    const rows = db.prepare("SELECT content FROM memories ORDER BY id DESC").all()
    assert.ok(rows.length >= 1)
  })
})

describe("FTS5 search", () => {
  it("finds memories by keyword", () => {
    const rows = db.prepare(
      "SELECT m.content FROM memories m JOIN memories_fts fts ON m.id = fts.rowid WHERE memories_fts MATCH ? ORDER BY rank"
    ).all('"integration"*')
    assert.ok(rows.length >= 1)
  })

  it("returns empty for non-matching query", () => {
    const rows = db.prepare(
      "SELECT m.content FROM memories m JOIN memories_fts fts ON m.id = fts.rowid WHERE memories_fts MATCH ? ORDER BY rank"
    ).all('"xyznonexistent12345"*')
    assert.strictEqual(rows.length, 0)
  })
})
