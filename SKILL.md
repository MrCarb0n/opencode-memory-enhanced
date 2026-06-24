# opencode-memory-enhanced skill

Use for persistent local memory management — storing, recalling, injecting, learning, and consolidating memories across sessions. Includes **self-learning episodic memory** that runs fully automatically.

## When to use

- "Remember this" / "Save this for later"
- "What did I learn about X?"
- "Recall my preferences"
- "Entity search for React"
- "What decisions did we make?"
- "What tools does this project use?"
- "What patterns worked in similar tasks?"

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
| `memory-scan` | Re-scan past sessions into memory (source=auto/db/api) |

*Episodic memory is fully automatic — no user-facing tools needed.*

## Memory types

- `user` — personal preferences, background, role
- `feedback` — corrections, approvals, strong opinions
- `project` — decisions, config, architecture, tech stack (default)
- `reference` — external links, tools, dashboards, docs

## Episodic Memory (Automatic)

- **Capture:** every tool execution recorded into session-scoped episodes
- **Boundary detection:** auto-detects task completion via heuristic scoring
- **Synthesis:** LLM extracts intent, outcome, decisions, patterns, anti-patterns, entities
- **Promotion:** successful patterns (score ≥ 0.7) → cross-project reference memory
- **Retrieval:** vector search injects relevant episodes during compacting + system prompt
- **Clustering:** background job groups similar episodes into meta-patterns

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

Episodic memory keys (all default-on):

| Key | Default | Description |
|-----|---------|-------------|
| `episode_capture` | `true` | Auto-capture tool executions |
| `episode_boundary_threshold` | `0.5` | Boundary detection sensitivity |
| `pattern_promotion_threshold` | `0.7` | Score to promote patterns to reference |
| `synthesis_enabled` | `true` | LLM synthesis of episodes |
| `predictive_retrieval` | `true` | Predictive episode injection |
| `predictive_top_k` | `3` | Max episodes per injection |
| `global_pattern_learning` | `true` | Cross-project pattern clustering |
| `cross_project_sharing` | `true` | Share promoted patterns globally |
