CREATE TABLE IF NOT EXISTS memories (
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
  project_path TEXT
);

CREATE TABLE IF NOT EXISTS entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT DEFAULT 'concept',
  description TEXT,
  project_path TEXT,
  first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  mention_count INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS concept_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id INTEGER REFERENCES memories(id) ON DELETE CASCADE,
  entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  content, type, tags, keywords,
  content='memories',
  content_rowid='id',
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS memories_fts_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, content, type, tags, keywords)
  VALUES (new.id, new.content, new.type, new.tags, new.keywords);
END;

CREATE TRIGGER IF NOT EXISTS memories_fts_ad AFTER DELETE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, content, type, tags, keywords)
  VALUES('delete', old.id, old.content, old.type, old.tags, old.keywords);
END;

CREATE TRIGGER IF NOT EXISTS memories_fts_au AFTER UPDATE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, content, type, tags, keywords)
  VALUES('delete', old.id, old.content, old.type, old.tags, old.keywords);
  INSERT INTO memories_fts(rowid, content, type, tags, keywords)
  VALUES (new.id, new.content, new.type, new.tags, new.keywords);
END;

CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_memories_relevance ON memories(relevance_score);
CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp);
CREATE INDEX IF NOT EXISTS idx_memories_accessed ON memories(last_accessed);
CREATE INDEX IF NOT EXISTS idx_memories_composite_scope ON memories(scope, importance, relevance_score);
CREATE INDEX IF NOT EXISTS idx_memories_composite_type ON memories(type, scope, importance);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);