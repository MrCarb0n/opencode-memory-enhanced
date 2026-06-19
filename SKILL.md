---
name: memory-enhanced
description: "Use for persistent local memory management — storing, recalling, injecting, learning, and consolidating memories across sessions. Examples: 'Remember this', 'What did I learn about X?', 'Recall my preferences', 'Entity search for React'"
---

# Enhanced Memory Plugin

Local-only SQLite-based memory system with knowledge graph (auto-relationships, auto-memory-links, auto-pattern detection), conversation arcs, TUI toasts, memory decay, lifetime session scanning, hybrid FTS5+vector search, enhanced entity extraction, conflict detection, SVG graph export, interactive browse, health monitoring, versioned migrations, and offline installer (v1.0.0). Features agent-curated memory with dual stores (agent_notes + user_profile), char-limit enforcement, substring matching, write approval gate, security scanning, frozen-snapshot injection, procedural skills, background self-improvement, atomic DB writes, external DB merge, and degraded-mode init.

## Install

```bash
git clone https://github.com/MrCarb0n/opencode-memory-enhanced.git
cd opencode-memory-enhanced
node install.js
```

No native deps needed — fts5-sql-bundle is pure WASM. Cross-platform (Windows/macOS/Linux).

For offline/air-gapped install, use `node install.js --offline` with vendored tarballs in `vendor/`.

## ✅ Agent Tool Access

The `memory-*` tools below are registered as **OpenCode plugin tools** — you CAN call them directly just like any other tool.

### Quick Reference

| Task | Tool Call |
|------|-----------|
| Store knowledge | `memory-store {content: "The API uses port 8080", type: "project"}` |
| Recall relevant memories | `memory-query {query: "authentication flow", limit: 5}` |
| Inject context for a task | `memory-query {mode: inject, task: "implementing OAuth2", limit: 5}` |
| Learn structured fact | `memory-learn {subject: "React", fact: "Uses virtual DOM", relatesTo: "JavaScript", relation: "built_with"}` |
| Search knowledge graph | `memory-query {mode: entity, query: "database"}` |
| Track conversation intent | `memory-learn {mode: arc, intent: "debugging login redirect", topics: "auth, sessions"}` |
| Browse all memories | `memory-query {mode: browse}` |
| View memory details | `memory-query {mode: browse, detail: 42}` |
| Export full database | `memory-export` |
| Check system health | `memory-info` |
| Scan past sessions | `memory-scan` |
| Add curated note | `memory-curated {action: "add", store: "agent_note", content: "..."}` |
| Full session scan | `memory-scan {full: true}` |

### Agent Pattern: Always Inject Context First

When starting a new task, always inject relevant memories to inform your responses:

```
memory-query {mode: inject, task: "task description here"}
```

### Agent Pattern: Learn Before You Forget

When you discover important project knowledge, store it immediately:

```
memory-learn {subject: "subject", fact: "what you learned", subjectType: "concept"}
```

### Direct SQL Access (Advanced)

For bulk operations or custom queries, you can still query SQLite directly via a `.mjs` script:

```mjs
import { readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import initSqlJs from "fts5-sql-bundle"

const SQL = await initSqlJs()
const db = new SQL.Database(new Uint8Array(readFileSync(join(homedir(), ".opencode", "memory-enhanced.db"))))
const rows = db.exec("SELECT content, type, importance FROM memories WHERE scope = 'project' ORDER BY importance DESC LIMIT 10")
rows.forEach(r => console.log(r.values))
db.close()
```

## Tools

| Tool | Purpose | Agent-callable |
|------|---------|----------------|
| `memory-query` | Search with hybrid FTS5+vector (recall), inject task context (inject), paginated browse with detail/delete (browse), entity graph traversal (entity) | ✅ |
| `memory-store` | Store with auto-tags/entity extraction/dedup (store), bulk JSON import (import), manage procedural skills (skill) | ✅ |
| `memory-learn` | Structured entity facts with relationship tracking (learn), conversation intent/topic tracking (arc) | ✅ |
| `memory-info` | System stats/health (status), view/update config (config), activity timeline (timeline) | ✅ |
| `memory-curated` | Manage curated stores agent_note/user_profile: add, replace, remove, list; handle approval queue: approve, reject | ✅ |
| `memory-maintain` | Prune stale/dedup/vacuum (optimize), merge duplicates (dedup), detect contradictions (conflicts) | ✅ |
| `memory-export` | Export as JSON (default), Markdown, inline SVG graph, Graphviz DOT | ✅ |
| `memory-scan` | Scan past sessions from OpenCode DB (fast) or API (fallback) | ✅ |

## Helpful SQL Queries

```sql
-- Top project memories
SELECT content, type, importance, relevance_score, timestamp
FROM memories WHERE scope = 'project' ORDER BY importance DESC LIMIT 10;

-- Search by keyword
SELECT content, type, importance FROM memories
WHERE content LIKE '%keyword%' AND scope = 'project';

-- Entities with mention count
SELECT name, type, description, mention_count FROM entities
ORDER BY mention_count DESC;

-- Recent activity timeline
SELECT DATE(timestamp) as day, COUNT(*) as cnt, AVG(importance) as avg_imp
FROM memories GROUP BY day ORDER BY day DESC LIMIT 7;

-- Relationships (knowledge graph edges)
SELECT s.name AS source, r.relationship_type, t.name AS target, r.confidence
FROM relationships r
JOIN entities s ON r.source_entity_id = s.id
JOIN entities t ON r.target_entity_id = t.id
ORDER BY r.confidence DESC;

-- Entity co-occurrence patterns
SELECT pattern_text, occurrences, confidence
FROM learning_patterns
WHERE pattern_type = 'entity_cooccurrence'
ORDER BY occurrences DESC;

-- Memory links (entity-shared memories)
SELECT m1.content AS source, m2.content AS target, ml.strength
FROM memory_links ml
JOIN memories m1 ON ml.source_memory_id = m1.id
JOIN memories m2 ON ml.target_memory_id = m2.id
ORDER BY ml.strength DESC
LIMIT 20;
```

## Configuration

View or update via `memory-info {mode: config}` tool. Set permanently in `opencode.jsonc`.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `auto_remember` | bool | `true` | Auto-detect and save important messages |
| `decay_rate` | number | `0.01` | Weekly relevance score decay multiplier |
| `access_boost` | number | `0.05` | Relevance boost per access |
| `toast_enabled` | bool | `true` | TUI toast notifications |
| `scan_on_start` | bool | `true` | Scan recent sessions on startup |
| `max_memory_length` | number | `300` | Max content length stored |
| `importance_threshold` | number | `3` | Minimum importance for auto-save |
| `hide_types` | string[] | `[]` | Memory types to hide from recall |
| `tracked_tools` | string[] | `["bash","read","write","edit","grep","glob"]` | Tools logged as tool-execution memories |
| `dont_save_patterns` | string[] | *5 skip patterns* | Regex patterns for messages NOT to save |
| `auto_remember_patterns` | string[] | *10 trigger patterns* | Regex patterns that trigger auto-save |
| `noise_commands` | string[] | `["npx ","npm ","bun ","deno "]` | Bash prefixes to ignore in tool logging |
| `auto_allow_keywords` | string[] | `["auto-allow","auto-approve"]` | Matched against feedback memories to auto-allow permission prompts |
| `auto_deny_keywords` | string[] | `["deny"]` | Matched against feedback memories to auto-deny permission prompts |
| `tech_stack` | string[] | *33 tech names* | Tech names used for auto-tagging (React, Docker, AWS, etc.) |
| `tag_patterns` | [string,string][] | *15 tag pairs* | Auto-tag categories: `[tag_name, regex_pattern]` pairs |
| `memory_type_patterns` | object | *4 types×14 patterns* | Memory type classification: `{ type: [pattern, ...] }` |
| `importance_patterns` | object[] | *3 score tiers* | Importance scoring: `{ pattern, score }` — first match wins |
| `graph_type_colors` | object | *4 type colors* | Entity type → hex color for graph visualization |
| `write_approval` | bool | `false` | Gate agent-curated memory writes for user approval |
| `agent_note_limit` | int | `2200` | Max chars for agent_note curated store |
| `user_profile_limit` | int | `1375` | Max chars for user_profile curated store |
| `security_scan` | bool | `true` | Scan curated memory writes for injection/exfiltration |
| `background_consolidate` | bool | `true` | Auto-consolidate stale memories and notify of pending writes |

**Example** — update via tool:
```
memory-info {mode: config, key: "noise_commands", value: "npx , npm , bun , deno , cargo "}
```

**Example** — via opencode.jsonc:
```json
{
  "memory-enhanced": {
    "auto_remember": false,
    "tech_stack": ["react", "vue", "svelte"]
  }
}
```

## Data

All data stored locally at `~/.opencode/memory-enhanced.db` — no external calls. Auto-save every 10s. Atomic writes via temp file + renameSync. Versioned migrations via `_migrations` table.
