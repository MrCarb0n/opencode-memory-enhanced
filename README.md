# opencode-memory-enhanced

Advanced autonomous memory plugin for [OpenCode](https://opencode.ai). Persistent, local, zero-cloud memory with hybrid search, knowledge graphs, session scanning, curated memory, and procedural skills.

## Features

- **Auto-Remember** — silently captures important context from conversation (preferences, decisions, config, tech stack, API details) using pattern-matched importance scoring
- **Hybrid Search** — FTS5 full-text search + neural vector embeddings (all-local, no API calls) for semantic recall
- **Knowledge Graph** — entity extraction, relationship discovery, concept tagging, and graph export (SVG/DOT/JSON)
- **Session Scan** — reconstructs memories from past conversation logs on startup; learns tool usage, files touched, and decisions made
- **Curated Memory** — persistent `agent_note` and `user_profile` stores with write-approval workflow for high-signal, editable reference blocks
- **Predictive Context Injection** — before tool execution and on each message, relevant memories are injected into context for zero-shot awareness
- **Procedural Knowledge** — recall and apply learned procedures and workflows from past sessions
- **Memory Decay** — configurable relevance decay and access boost so stale memories fade and active ones stay fresh
- **Automatic Entity Consolidation** — background entity pattern detection, relationship mining, and orphan cleanup
- **Toast Notifications** — non-intrusive in-app notifications for memory count, search matches, and system events
- **All-Local** — SQLite (via sql.js) + local ONNX-session embeddings; zero data leaves your machine

## Installation

```bash
npx opencode-memory-enhanced
# or
npm install @mrcarb0n/opencode-memory-enhanced
```

The plugin auto-installs to `~/.config/opencode/plugins/` and is loaded on OpenCode startup.

## Quick Start

Once installed, the plugin works silently:

1. **Auto-remember:** conversations are scanned for important data (preferences, decisions, tech config) and stored automatically
2. **Search:** use `memory-recall` tool to query past context
3. **Store explicitly:** use `memory-store` to save specific information
4. **View status:** use `memory-info` to see memory count, health, and configuration
5. **Curate:** use `memory-curated` to create persistent notes (`agent_note`/`user_profile`)
6. **Learn:** use `memory-learn` to record facts, preferences, and relationships
7. **Entity search:** use `memory-query {mode: entity, query: "..."}` to explore the knowledge graph

## Tools

| Tool | Description |
|------|-------------|
| `memory-query` | Search, browse, and explore memories + entities (recall/inject/browse/entity modes) |
| `memory-store` | Explicitly save a memory with importance, tags, type, and scope |
| `memory-learn` | Store structured facts with entity tracking, relationships, and pattern detection |
| `memory-info` | System status, config editor, and activity timeline |
| `memory-curated` | Persistent agent_note/user_profile with write-approval workflow |
| `memory-maintain` | Optimize, consolidate, prune stale memories, deduplicate, and health check |
| `memory-export` | Export memories (JSON) and knowledge graph (SVG/DOT/JSON) with entity expansion |
| `memory-scan` | Scan past sessions into memories with dry-run mode |

## Configuration

Config stored at `~/.opencode/memory-config.json` (or `%APPDATA%/.opencode/memory-config.json` on Windows). View/edit via `memory-info {mode: config}`.

Key settings:

| Key | Default | Description |
|-----|---------|-------------|
| `auto_remember` | `true` | Auto-capture important conversation context |
| `decay_rate` | `0.01` | Per-day relevance decay (0-1) |
| `access_boost` | `0.05` | Relevance boost on access (0-1) |
| `toast_enabled` | `true` | Show in-app notifications |
| `scan_on_start` | `true` | Scan past sessions on startup |
| `enable_vectors` | `true` | Enable neural embeddings |
| `background_consolidate` | `true` | Background entity detection |
| `security_scan` | `true` | Scan for secrets in stored memories |

## Database

- **Location:** `~/.opencode/memory-enhanced.db`
- **Engine:** SQLite via [sql.js](https://github.com/sql-js/sql.js/) with FTS5
- **Embeddings:** Local ONNX-session (no external API)
- **Tables:** memories, entities, relationships, conversation_arcs, concept_tags, learning_patterns, memory_links, scanned_sessions, curated_store, pending_memories, procedural_knowledge

## Architecture

```
memory-enhanced.ts         — Plugin entry point, lifecycle hooks
lib/
  config.ts                — Config load/save with schema validation
  constants.ts             — Paths, tables, version
  curated.ts               — Curated memory builder
  db.ts                    — SQLite/FTS5 wrapper with auto-save
  embeddings.ts            — Local neural embeddings (ONNX)
  entities.ts              — Entity extraction, relationship discovery
  helpers.ts               — Toast, prompt injection, AGENTS.md
  memory.ts                — Auto-remember, hybrid search, decay
  optimize.ts              — Consolidation, pruning, dedup
  scan.ts                  — Session log scanner
  schema.ts                — DDL and index definitions
  security.ts              — Secret scanning
  types.ts                 — Type definitions, pattern matching
  utils.ts                 — Tokenization, cosine similarity
  tools/
    query.ts               — memory-query tool
    store.ts               — memory-store tool
    learn.ts               — memory-learn tool
    info.ts                — memory-info tool
    curated.ts             — memory-curated tool
    maintain.ts            — memory-maintain tool
    export.ts              — memory-export tool
    scan.ts                — memory-scan tool
    _shared.ts             — Shared tool utilities
```

## License

MIT
