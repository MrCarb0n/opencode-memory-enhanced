-- Episode tables for self-learning memory system
CREATE TABLE IF NOT EXISTS episodes (
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
);

CREATE INDEX IF NOT EXISTS idx_episodes_session ON episodes(session_id);
CREATE INDEX IF NOT EXISTS idx_episodes_intent_embedding ON episodes(intent_embedding);
CREATE INDEX IF NOT EXISTS idx_episodes_importance ON episodes(importance);
CREATE INDEX IF NOT EXISTS idx_episodes_project ON episodes(project_path);
CREATE INDEX IF NOT EXISTS idx_episodes_completed ON episodes(completed_at);
CREATE INDEX IF NOT EXISTS idx_episodes_global ON episodes(is_global, importance DESC);

CREATE TABLE IF NOT EXISTS episode_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  args_json TEXT,
  result_summary TEXT,
  success INTEGER DEFAULT 1,
  duration_ms INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_episode_steps_episode ON episode_steps(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_steps_timestamp ON episode_steps(timestamp);