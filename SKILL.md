# opencode-memory-enhanced skill

Use for persistent local memory management — storing, recalling, injecting, learning, and consolidating memories across sessions.

## When to use

- "Remember this" / "Save this for later"
- "What did I learn about X?"
- "Recall my preferences"
- "Entity search for React"
- "What decisions did we make?"
- "What tools does this project use?"

## Tool reference

| Tool | When |
|------|------|
| `memory-query` | Search/browse/inject memories or explore entities |
| `memory-store` | Explicitly save a fact, preference, or note |
| `memory-learn` | Store structured fact with entity relationship |
| `memory-info` | Check memory count, health, config, or timeline |
| `memory-curated` | Persistent agent/user notes with approval |
| `memory-maintain` | Optimize, consolidate, prune, deduplicate |
| `memory-export` | Export knowledge graph or memories as JSON |
| `memory-scan` | Re-scan past sessions into memory |

## Memory types

- `user` — personal preferences, background, role
- `feedback` — corrections, approvals, strong opinions
- `project` — decisions, config, architecture, tech stack (default)
- `reference` — external links, tools, dashboards, docs

## Usage patterns

**Recall context:** `memory-query {query: "React component patterns", limit: 5}`

**Inject context:** `memory-query {mode: inject, task: "implementing auth middleware"}`

**Save important fact:** `memory-store {content: "...", importance: 8, type: "project"}`

**Curated notes:** `memory-curated {mode: get, store: agent_note}` → `memory-curated {mode: replace, store: agent_note, content: "..."}`

**Knowledge graph:** `memory-query {mode: entity, query: "PostgreSQL"}`

**Health check:** `memory-info {health: true}`

**Export graph:** `memory-export {mode: graph, format: svg}`

## Configuration

View/edit via `memory-info {mode: config}`. Key: `memory-info {mode: config, key: auto_remember, value: false}`.
