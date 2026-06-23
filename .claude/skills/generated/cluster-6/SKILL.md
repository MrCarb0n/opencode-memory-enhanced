---
name: cluster-6
description: "Skill for the Cluster_6 area of opencode-memory-enhanced. 3 symbols across 1 files."
---

# Cluster_6

3 symbols | 1 files | Cohesion: 100%

## When to Use

- Working with code in `lib/`
- Understanding how db, userConfig work
- Modifying cluster_6-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/constants.ts` | dataRoot, db, userConfig |

## Entry Points

Start here when exploring this area:

- **`db`** (Function) — `lib/constants.ts:37`
- **`userConfig`** (Function) — `lib/constants.ts:38`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `db` | Function | `lib/constants.ts` | 37 |
| `userConfig` | Function | `lib/constants.ts` | 38 |
| `dataRoot` | Function | `lib/constants.ts` | 21 |

## How to Explore

1. `context({name: "db"})` — see callers and callees
2. `query({search_query: "cluster_6"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
