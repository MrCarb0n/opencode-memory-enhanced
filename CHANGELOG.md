# Changelog

## 1.2.0 (2026-06-24)

- **Self-Learning Episodic Memory** — fully automatic episode capture, LLM synthesis, predictive retrieval, and background pattern learning
  - Auto-captures tool executions into session-scoped episodes
  - Auto-detects episode boundaries via heuristic scoring (completion words, topic shifts, step count)
  - LLM synthesis extracts: intent, outcome summary, success score, decisions, patterns, anti-patterns, key entities
  - Successful patterns (score ≥ 0.7) promoted to cross-project reference memory
  - Vector search over completed episodes with cosine similarity + importance ranking
  - Predictive context injection: relevant episodes injected into compacting + system prompt
  - Background clustering of similar episodes into meta-patterns for knowledge transfer
  - All-local LLM via ONNX-session; zero external API calls
- **New Database Tables**: `episodes` (24 columns) + `episode_steps` (9 columns) with full FTS/vector support
- **8 New Config Keys** (all default-on): `episode_capture`, `episode_boundary_threshold`, `pattern_promotion_threshold`, `synthesis_enabled`, `predictive_retrieval`, `predictive_top_k`, `global_pattern_learning`, `cross_project_sharing`
- **New Modules**: `lib/episodes.ts`, `lib/episode-synthesis.ts`, `lib/episode-retrieval.ts`, `lib/episode-patterns.ts`
- **TypeScript Build**: passes with zero errors

## 1.1.0 (2026-06-23)

- **better-sqlite3** native SQLite dependency — handles large DBs (700MB+) without loading into memory
- **Configurable context budget** — `context_budget` replaces hardcoded `MAX_BUDGET=2000`
- **Debounced auto-save** — 500ms trailing debounce instead of fixed 10s interval, saves on events
- **Immutable config** — `getConfig()` returns a shallow copy, preventing accidental singleton mutation
- **Security scan on store** — `memory-store` tool now also blocks secrets/exfiltration before persisting
- **Clean context injection** — uses `client.app.log()` for all tools; `_memory_context` arg reserved for read/edit/grep/glob only
- **Async consolidation** — `detectEntityPatterns()` yields to event loop via `setTimeout(0)` to avoid blocking
- **Cross-session dedup** — dedup keys match on `content` alone (no `session_id`), preventing duplicate memories across sessions
- **memory-scan auto-fallback** — default source changed from `db` to `auto`; falls back to API scan when DB is unreachable
- **install.js fix** — now checks for `opencode.json` (not just `opencode.jsonc`) to find the correct config directory
- **Rich plugin.json** — added `repository`, `keywords`, `engines`, `permissions`
- **Suppressed prebuild-install deprecation** — `.npmrc` with `loglevel=error`

## 1.0.0 (2026-06-22)

- Initial release
- Plugin lifecycle hooks: session.created, session.updated, session.idle, session.compacted, session.deleted, session.error
- autoRemember: pattern-matched context capture from conversation
- hybridSearch: FTS5 + local neural embedding similarity search
- knowledge graph: entity extraction, relationship discovery, concept tagging
- session scanning: reconstruct memories from past conversation logs
- curated memory: agent_note and user_profile stores with write-approval workflow
- procedural knowledge: recall and apply learned procedures
- memory decay: configurable relevance decay and access boost
- background entity consolidation with orphan cleanup
- predictive context injection into tool execution and system prompt
- toast notifications for memory events
- config management with schema validation
- export tools: JSON export, knowledge graph SVG/DOT/JSON
- security scanning for secrets in stored memories
- AGENTS.md updates on session start
- FTS5 full-text search across all memories
