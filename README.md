# opencode-memory-enhanced

Advanced autonomous memory plugin for [OpenCode](https://opencode.ai). Persistent, local, zero-cloud memory with hybrid search, knowledge graphs, session scanning, curated memory, procedural skills, and **self-learning episodic memory**.

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
- **Self-Learning Episodic Memory** — auto-captures tool executions into episodes, LLM-synthesizes decisions/patterns/outcomes, promotes successful patterns to reference memory, and retrieves relevant episodes predictively
- **Background Pattern Learning** — clusters similar episodes into meta-patterns for cross-project knowledge transfer
- **Toast Notifications** — non-intrusive in-app notifications for memory count, search matches, and system events
- **All-Local** — SQLite via better-sqlite3 (native, large-DB safe) + local ONNX-session embeddings; zero data leaves your machine

## Installation

```bash
git clone https://github.com/MrCarb0n/opencode-memory-enhanced
cd opencode-memory-enhanced
npm install
```

The `preinstall` hook copies plugin files to `~/.config/opencode/plugins/` and installs dependencies. Restart OpenCode to load.

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
| `memory-scan` | Scan past sessions into memories (DB direct or API fallback) |

*Episodic memory is fully automatic — no user-facing tools needed. It captures, synthesizes, and retrieves episodes in the background.*

## Configuration

Config stored at `~/.config/opencode/memory-config.json`. View/edit via `memory-info {mode: config}`.

Key settings:

| Key | Default | Description |
|-----|---------|-------------|
| `auto_remember` | `true` | Auto-capture important conversation context |
| `decay_rate` | `0.01` | Per-day relevance decay (0-1) |
| `access_boost` | `0.05` | Relevance boost on access (0-1) |
| `context_budget` | `2000` | Max token budget for injected context window |
| `toast_enabled` | `true` | Show in-app notifications |
| `scan_on_start` | `true` | Scan past sessions on startup |
| `enable_vectors` | `true` | Enable neural embeddings |
| `background_consolidate` | `true` | Background entity detection |
| `security_scan` | `true` | Scan for secrets in stored memories |
| `episode_capture` | `true` | Auto-capture tool executions into episodes |
| `episode_boundary_threshold` | `0.5` | Heuristic score threshold to auto-detect episode boundaries |
| `pattern_promotion_threshold` | `0.7` | Success score threshold to promote patterns to reference memory |
| `synthesis_enabled` | `true` | Enable LLM synthesis of completed episodes |
| `predictive_retrieval` | `true` | Enable predictive episode retrieval during context injection |
| `predictive_top_k` | `3` | Max episodes to inject per query |
| `global_pattern_learning` | `true` | Enable background clustering into cross-project meta-patterns |
| `cross_project_sharing` | `true` | Share promoted patterns across all projects |

## Database

- **Location:** `~/.config/opencode/memory-enhanced.db`
- **Engine:** SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (native) with FTS5; falls back to [sql.js](https://github.com/sql-js/sql.js/) if unavailable
- **Session scanner:** reads OpenCode's `opencode.db` directly via better-sqlite3 — handles 700MB+ databases without issue
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
  episodes.ts              — Episode state manager, boundary detection, tool capture
  episode-synthesis.ts     — LLM synthesis: decisions, patterns, outcome, anti-patterns
  episode-retrieval.ts     — Vector search + predictive context injection
  episode-patterns.ts      — Background clustering into meta-patterns
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

### Database Schema (Episodes)

| Table | Purpose |
|-------|---------|
| `episodes` | Session-scoped tool execution traces with synthesized intent, outcome, decisions, patterns |
| `episode_steps` | Individual tool calls with args, results, success/failure, duration |

## License

MIT
