---
name: cluster-9
description: "Skill for the Cluster_9 area of opencode-memory-enhanced. 6 symbols across 2 files."
---

# Cluster_9

6 symbols | 2 files | Cohesion: 100%

## When to Use

- Working with code in `lib/`
- Understanding how initDb, ensureSchema work
- Modifying cluster_9-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/db.ts` | ensureDataDir, getDbPath, initDb, runMigrations, runPendingMigrations |
| `lib/schema.ts` | ensureSchema |

## Entry Points

Start here when exploring this area:

- **`initDb`** (Function) — `lib/db.ts:22`
- **`ensureSchema`** (Function) — `lib/schema.ts:201`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `initDb` | Function | `lib/db.ts` | 22 |
| `ensureSchema` | Function | `lib/schema.ts` | 201 |
| `ensureDataDir` | Function | `lib/db.ts` | 12 |
| `getDbPath` | Function | `lib/db.ts` | 18 |
| `runMigrations` | Function | `lib/db.ts` | 58 |
| `runPendingMigrations` | Function | `lib/db.ts` | 71 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `InitDb → RunMigrations` | intra_community | 3 |

## How to Explore

1. `context({name: "initDb"})` — see callers and callees
2. `query({search_query: "cluster_9"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
