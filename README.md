# Memory Enhanced — OpenCode Plugin

**Full-featured local memory plugin for OpenCode.** Knowledge graph with auto-relationship discovery, auto-memory-linking, auto-pattern detection, auto-remember, TUI notifications, lifetime session scanning, memory decay, priority boost, hybrid FTS5+vector search, conflict detection, graph visualization, export/import, offline installer, **agent-curated memory with dual stores, write approval gate, security scanning, procedural skills, frozen-snapshot injection, and external DB merge**.

> **Install:** `node install.js` — cross-platform, offline-capable.

---

## Features

### Memory Management (8 consolidated tools)
| Tool | Modes | Description |
|------|-------|-------------|
| `memory-query` | recall, inject, browse, entity | Search with hybrid FTS5+vector; inject task context; paginated browse with detail/delete; entity graph traversal |
| `memory-store` | store, import, skill | Save with auto-tags/entity extraction/dedup; bulk JSON import; manage procedural skills (add/apply/list) |
| `memory-learn` | learn, arc | Structured entity facts with relationship tracking + pattern detection; conversation intent/topic tracking |
| `memory-info` | status, config, timeline | System stats & health; view/update settings with schema validation; activity timeline |
| `memory-curated` | list, add, replace, remove, approve, reject | Dual curated stores (agent_note/user_profile) with char limits; pending write approval workflow |
| `memory-maintain` | optimize, dedup, conflicts | Prune stale, dedup, backfill embeddings, vacuum; merge duplicates; detect contradictory feedback |
| `memory-export` | json, md, svg, dot | Full export with entities/relationships/patterns as JSON, Markdown, inline SVG graph, or Graphviz DOT |
| `memory-scan` | — | Scan past sessions from OpenCode DB (fast) or API (fallback) |

### Auto-Remember
Captures important messages automatically:
- **Preferences** — "I prefer dark mode"
- **Tech stack** — "We're using React with TypeScript"
- **Decisions** — "Let's go with PostgreSQL"
- **Versions** — "v2.1.0 is stable"
- **Tech names** — React, Docker, AWS, etc.

Stored with automatic type detection (user/feedback/project/reference), entity extraction, and auto-tagging.

### Agent-Curated Memory Stores
Two dedicated stores for agent-to-agent knowledge transfer — separate from auto-captured memories:

| Store | Char Limit | Use Case |
|-------|-----------|----------|
| `agent_note` | 2200 (configurable) | Agent's own notes about codebase structure, unique patterns, rationale, workarounds |
| `user_profile` | 1375 (configurable) | User's preferences, goals, and requirements from explicit instructions |

- `memory-curated {action: add, store: "agent_note", content: "..."}` — add entry with char-limit enforcement
- `memory-curated {action: replace, store: "agent_note", old_text: "...", content: "..."}` — replace by unique substring
- `memory-curated {action: remove, store: "agent_note", old_text: "..."}` — remove by unique substring
- Frozen snapshot injected into system prompt at session start for consistent context

### Write Approval Gate
Staged-write workflow for security-critical environments — `memory-curated` actions stage writes when `write_approval` is enabled, review via `memory-curated {action: list/approve/reject}`.

### Procedural Skills System
Store and retrieve reusable procedural knowledge via `memory-store {mode: skill, action: add/apply/list}`. Skills stored in `procedural_knowledge` table, retrieved via LIKE search at injection time.

### Memory Types
| Type | Trigger Words | Use For |
|------|---------------|---------|
| `user` | "I'm", "my role", "I prefer" | User preferences, goals, background |
| `feedback` | "don't", "stop", "yes exactly" | Corrections AND confirmations |
| `project` | "we're using", "deadline", "deploy" | Work details, decisions, tech stack |
| `reference` | "check", "linear", "grafana", "docs" | External pointers (tools, docs, dashboards) |

### TUI Integration
Every tool execution triggers visual feedback in OpenCode's TUI:
- **Toast notifications** — success/info/warning/error variants
- **Auto-prompt** — suggests next commands (e.g., `memory-query` after store)
- **Auto-compact** — triggers `session.compact` after consolidation
- **Configurable** — `memory-info {mode: config, key: "toast_enabled", value: "false"}`

### Lifetime Session Scan
On first install, scans ALL past OpenCode sessions across all projects:
1. Enumerates projects via `client.project.list()`
2. For each project, fetches sessions via `client.session.list()` with **pagination** (handles 50+ sessions)
3. Extracts important user messages via `client.session.messages()`
4. Stores with type detection + entity linking
5. Triggers knowledge graph auto-relationship discovery
6. Tracks processed sessions in `scanned_sessions` table (no duplicates)

Each scan extracts user messages, assistant responses, tool usage, file references, shell commands, token counts, and cost metadata — stored with separate memory types (`tool-execution`, `file`, `shell`, `reference`).

Subsequent startups scan only the last 3 sessions.

### Memory Decay & Priority Boost
- Relevance scores decrease over time (`decay_rate`: configurable, default 0.01/week)
- Frequently accessed memories get priority boost (+1 importance on repeat, max 10)
- Memories accessed >5 times in 7 days get auto-importance boost
- Access boosts increase relevance score (+0.05/access)

### Configuration

All settings configurable via `memory-info {mode: config, key: "...", value: "..."}` or in `~/.opencode/memory-config.json`.

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
| `agent_note_limit` | number | `2200` | Max chars for agent_note curated store |
| `user_profile_limit` | number | `1375` | Max chars for user_profile curated store |
| `tech_stack` | string[] | *33 tech names* | Tech names used for auto-tagging (React, Docker, AWS, etc.) |
| `tag_patterns` | [string,string][] | *15 tag pairs* | Auto-tag categories: `[tag_name, regex_pattern]` pairs |
| `memory_type_patterns` | object | *4 types×14 patterns* | Memory type classification: `{ type: [pattern, ...] }` |
| `importance_patterns` | object[] | *3 score tiers* | Importance scoring: `{ pattern, score }` — first match wins |
| `graph_type_colors` | object | *4 type colors* | Entity type → hex color for graph visualization |

### Knowledge Graph Auto-Activation
Three automatic processes fire whenever a memory is stored:

- **Auto-relationships** — entities co-occurring in the same memory get a `co_occurs` edge in the `relationships` table; confidence strengthens with each co-occurrence
- **Auto-memory-links** — memories sharing ≥2 entities get linked in `memory_links` with a strength score
- **Entity pattern detection** — entity pairs co-occurring across ≥2 memories are recorded in `learning_patterns`

This fills the `relationships`, `memory_links`, and `learning_patterns` tables automatically — making entity search with relationship traversal and graph export useful immediately.

### Persistence & Reliability
- **Atomic DB writes** — temp file + renameSync prevents corruption
- **Auto-save every 10s** — less data loss on crash
- **Degraded-mode init** — per-statement try-catch + `_dbReady` guard
- **Promise tracking** — pending ops complete before dispose
- **Corrupt DB recovery** — renames corrupted files to `.corrupt.TIMESTAMP`
- **Versioned migrations** via `_migrations` table

### Hybrid FTS5+Vector Search
`memory-query` combines BM25 keyword ranking with neural embedding cosine similarity:
- **Phrase queries** — `"exact match"`
- **OR queries** — `react OR vue`
- **NOT queries** — `react NOT vue`
- Embedding models auto-load: 256d vectors, lazy initialization

### Config Schema Validation
`memory-info {mode: config}` validates key names, value types, and numeric ranges with error messages.

### External DB Merge
`memory-scan {full: true}` scans all past sessions; `{source: "api"}` uses the legacy API path instead of reading the OpenCode SQLite DB directly.

### Advanced Features
- **Hybrid FTS5+vector search** — combines BM25 keyword ranking with cosine similarity for best recall
- **TF-IDF search with stemming** — full-text search with Porter stemmer (matches "running" ↔ "run")
- **Conflict detection** — finds contradictory feedback memories (same topic, opposite polarity)
- **Graph visualization** — export knowledge graph as SVG (inline, no deps), DOT, or JSON
- **Enhanced entity extraction** — camelCase, snake_case, multi-word phrases, non-Latin scripts
- **Git-aware session linking** — auto-captures recent commits on session compaction
- **Size-bucket dedup** — O(n²) → O(bucket²) for consolidate/dedup/conflicts
- **Error boundaries** — every hook wrapped in try-catch, one failure won't crash the plugin
- **Composite indexes** — 3 composite indexes for fast queries at scale

---

## Hooks

| Hook | Behavior |
|------|----------|
| `chat.message` | Auto-remember + inject relevant memories via `message.system` |
| `session.created` | Show toast with memory count + auto-scan past sessions |
| `session.updated` | Update conversation arc |
| `session.idle` | Apply decay, prune low-importance, save |
| `session.compacted` | Promote top session memories to project scope + git commit capture |
| `session.deleted` | Clean up session-scoped memories |
| `session.error` | Log error as session memory |
| `experimental.session.compacting` | Inject persistent context into compaction |
| `experimental.chat.system.transform` | Inject memories + entities + curated block + skills into system prompt |
| `tool.execute.before` | Inject memory context before tool runs |
| `tool.execute.after` | Log tool executions as session memories |
| `permission.ask` | Auto-allow/deny based on feedback memories |
| `config` | Handle auto_remember toggle, decay_rate, agent_note_limit, user_profile_limit |
| `dispose` | Save DB on plugin unload (awaits pending promises) |

---

## Database

Single SQLite file at `~/.opencode/memory-enhanced.db`. Atomic writes via temp file + renameSync. Auto-save every 10s.

### Tables
| Table | Purpose |
|-------|---------|
| `memories` | Content, type, scope, importance, relevance, tags, keywords, timestamps |
| `entities` | Knowledge graph nodes: name, type, description, mention count |
| `relationships` | Edges: source → target, relationship type, confidence score |
| `conversation_arcs` | Session tracking: intent, topics, message count, importance |
| `concept_tags` | Many-to-many link between memories and entities |
| `learning_patterns` | Track repeated behaviors and patterns |
| `memory_links` | Explicit connections between related memories |
| `scanned_sessions` | Track which OpenCode sessions have been processed |
| `curated_store` | Agent-curated memory entries (`agent_note`/`user_profile`) with char-limit enforcement |
| `pending_memories` | Staged writes awaiting security approval |
| `procedural_knowledge` | Reusable procedural skills with LIKE search |

### Indexes
10 single-column + 3 composite indexes.

---

## Architecture

```
Startup
    │
    ├─▶ Load curated block (agent_note + user_profile) → freeze snapshot
    ├─▶ Inject curated block + relevant skills into system prompt
    └─▶ Check pending_memories → notify if any

User Message
    │
    ▼
chat.message hook
    │
    ├─▶ autoRemember(text)
    │       │
    │       ├─ check DONT_SAVE patterns
    │       ├─ detectMemoryType (user/feedback/project/reference)
    │       ├─ extractImportance (5-8)
    │       ├─ generateAutoTags (15 categories)
    │       ├─ extractEntities → knowledge graph
    │       └─ store → SQLite
    │
    └─▶ findRelevantMemories()
            │
            ├─ FTS5 full-text search (BM25 rank, porter stemmer)
            ├─ similarity ranking (cosine / hybrid vector)
            ├─ priority boost (access_count++, relevance_score +0.05)
            └─ inject via message.system

Tool Call (e.g., memory-query)
    │
    ├─▶ showToast (TUI)
    ├─▶ execute SQL query (FTS5 MATCH / hybrid vector search)
    ├─▶ priority boost (access_count++)
    └─▶ return results

Curated Memory Flow
    │
    ├─ memory-curated {action: add/replace/remove}
    │     ├─ (with approval) → pending_memories table → notify user
    │     └─ (without approval) → curated_store table → immediate effect
    │
    ├─ memory-curated {action: list} → staged writes
    ├─ memory-curated {action: approve, id} → execute staged action
    └─ memory-curated {action: reject, id} → discard staged action

Skills Flow (memory-store mode=skill)
    │
    ├─ skill {action: add, name, content} → procedural_knowledge table
    ├─ skill {action: apply, task} → LIKE search → return relevant skills
    └─ skill {action: list, category?} → list all skills
```

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

---

## License

MIT — free to use, modify, and share.
