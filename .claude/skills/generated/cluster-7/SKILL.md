---
name: cluster-7
description: "Skill for the Cluster_7 area of opencode-memory-enhanced. 7 symbols across 1 files."
---

# Cluster_7

7 symbols | 1 files | Cohesion: 100%

## When to Use

- Working with code in `lib/`
- Understanding how agentsMd, pluginEntry, pluginDir work
- Modifying cluster_7-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/constants.ts` | opencodeConfigDir, agentsMd, pluginEntry, pluginDir, libDir (+2) |

## Entry Points

Start here when exploring this area:

- **`agentsMd`** (Function) — `lib/constants.ts:39`
- **`pluginEntry`** (Function) — `lib/constants.ts:40`
- **`pluginDir`** (Function) — `lib/constants.ts:41`
- **`libDir`** (Function) — `lib/constants.ts:42`
- **`configJsonc`** (Function) — `lib/constants.ts:43`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `agentsMd` | Function | `lib/constants.ts` | 39 |
| `pluginEntry` | Function | `lib/constants.ts` | 40 |
| `pluginDir` | Function | `lib/constants.ts` | 41 |
| `libDir` | Function | `lib/constants.ts` | 42 |
| `configJsonc` | Function | `lib/constants.ts` | 43 |
| `packageJson` | Function | `lib/constants.ts` | 44 |
| `opencodeConfigDir` | Function | `lib/constants.ts` | 26 |

## How to Explore

1. `context({name: "agentsMd"})` — see callers and callees
2. `query({search_query: "cluster_7"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
