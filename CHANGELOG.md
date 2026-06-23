# Changelog

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
