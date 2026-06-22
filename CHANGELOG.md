# Changelog

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
