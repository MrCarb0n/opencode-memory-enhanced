import { Tables } from "./constants"

const M = Tables.memories
const E = Tables.entities
const R = Tables.relationships
const CA = Tables.conversationArcs
const CT = Tables.conceptTags
const LP = Tables.learningPatterns
const ML = Tables.memoryLinks
const SS = Tables.scannedSessions
const CS = Tables.curatedStore
const PM = Tables.pendingMemories
const PK = Tables.proceduralKnowledge
const EP = Tables.episodes
const ES = Tables.episodeSteps

export const SCHEMA_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "${EP}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    project_path TEXT DEFAULT 'global',
    intent TEXT,
    intent_embedding TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','failed','abandoned')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    duration_ms INTEGER,
    step_count INTEGER DEFAULT 0,
    tool_calls_json TEXT,
    files_touched_json TEXT,
    entities_json TEXT,
    decisions_json TEXT,
    patterns_json TEXT,
    anti_patterns_json TEXT,
    outcome_summary TEXT,
    success_score REAL,
    importance INTEGER DEFAULT 5,
    relevance_score REAL DEFAULT 0.5,
    access_count INTEGER DEFAULT 0,
    last_accessed DATETIME,
    is_global INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "${ES}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL REFERENCES "${EP}"(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    tool_name TEXT NOT NULL,
    args_json TEXT,
    result_summary TEXT,
    success INTEGER DEFAULT 1,
    duration_ms INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "${M}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'conversation',
    scope TEXT DEFAULT 'project',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    tags TEXT,
    last_accessed DATETIME,
    importance INTEGER DEFAULT 5,
    relevance_score REAL DEFAULT 0.0,
    access_count INTEGER DEFAULT 0,
    keywords TEXT,
    session_id TEXT,
    project_path TEXT,
    embedding TEXT DEFAULT ''
  )`,

  `CREATE TABLE IF NOT EXISTS "${CS}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store TEXT NOT NULL CHECK(store IN ('agent_note','user_profile')),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "${PM}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL CHECK(action IN ('add','replace','remove')),
    store TEXT NOT NULL CHECK(store IN ('agent_note','user_profile')),
    content TEXT NOT NULL DEFAULT '',
    old_text TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected'))
  )`,

  `CREATE TABLE IF NOT EXISTS "${PK}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'general',
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    use_count INTEGER DEFAULT 0,
    embedding TEXT DEFAULT ''
  )`,

  `CREATE TABLE IF NOT EXISTS "${E}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT DEFAULT 'concept',
    description TEXT,
    project_path TEXT,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    mention_count INTEGER DEFAULT 1
  )`,

  `CREATE TABLE IF NOT EXISTS "${R}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_entity_id INTEGER NOT NULL REFERENCES "${E}"(id),
    target_entity_id INTEGER NOT NULL REFERENCES "${E}"(id),
    relationship_type TEXT NOT NULL,
    description TEXT,
    confidence REAL DEFAULT 1.0,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "${CA}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    intent TEXT,
    topics TEXT,
    summary TEXT,
    message_count INTEGER DEFAULT 0,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    importance REAL DEFAULT 0.0,
    project_path TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS "${CT}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id INTEGER REFERENCES "${M}"(id) ON DELETE CASCADE,
    entity_id INTEGER REFERENCES "${E}"(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "${LP}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_text TEXT NOT NULL,
    pattern_type TEXT DEFAULT 'general',
    confidence REAL DEFAULT 0.5,
    occurrences INTEGER DEFAULT 1,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    project_path TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS "${ML}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_memory_id INTEGER NOT NULL REFERENCES "${M}"(id) ON DELETE CASCADE,
    target_memory_id INTEGER NOT NULL REFERENCES "${M}"(id) ON DELETE CASCADE,
    link_type TEXT DEFAULT 'related',
    strength REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "${SS}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    message_count INTEGER DEFAULT 0,
    stored_count INTEGER DEFAULT 0,
    scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
]

export const INDEX_DDL: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_${M}_importance ON "${M}"(importance)`,
  `CREATE INDEX IF NOT EXISTS idx_${M}_session ON "${M}"(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_${M}_relevance ON "${M}"(relevance_score)`,
  `CREATE INDEX IF NOT EXISTS idx_${E}_name ON "${E}"(name)`,
  `CREATE INDEX IF NOT EXISTS idx_${CA}_session ON "${CA}"(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_${LP}_type ON "${LP}"(pattern_type)`,
  `CREATE INDEX IF NOT EXISTS idx_${M}_timestamp ON "${M}"(timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_${M}_accessed ON "${M}"(last_accessed)`,
  `CREATE INDEX IF NOT EXISTS idx_${M}_composite_scope ON "${M}"(scope, importance, relevance_score)`,
  `CREATE INDEX IF NOT EXISTS idx_${M}_composite_type ON "${M}"(type, scope, importance)`,
  `CREATE INDEX IF NOT EXISTS idx_${M}_tag_scope ON "${M}"(scope, timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_${M}_content ON "${M}"(content)`,
  `CREATE INDEX IF NOT EXISTS idx_${CS}_store ON "${CS}"(store)`,
  `CREATE INDEX IF NOT EXISTS idx_${PM}_status ON "${PM}"(status)`,
  `CREATE INDEX IF NOT EXISTS idx_${PK}_category ON "${PK}"(category)`,
  `CREATE INDEX IF NOT EXISTS idx_${PK}_name ON "${PK}"(name)`,
  `CREATE INDEX IF NOT EXISTS idx_${EP}_session ON "${EP}"(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_${EP}_intent_embedding ON "${EP}"(intent_embedding)`,
  `CREATE INDEX IF NOT EXISTS idx_${EP}_importance ON "${EP}"(importance)`,
  `CREATE INDEX IF NOT EXISTS idx_${EP}_project ON "${EP}"(project_path)`,
  `CREATE INDEX IF NOT EXISTS idx_${EP}_completed ON "${EP}"(completed_at)`,
  `CREATE INDEX IF NOT EXISTS idx_${EP}_global ON "${EP}"(is_global, importance DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_${ES}_episode ON "${ES}"(episode_id)`,
  `CREATE INDEX IF NOT EXISTS idx_${ES}_timestamp ON "${ES}"(timestamp)`,
]

export function ensureSchema(db: any): void {
  for (const ddl of SCHEMA_DDL) db.exec(ddl)
  for (const idx of INDEX_DDL) db.exec(idx)
}
