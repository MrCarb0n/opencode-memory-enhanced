---
name: cluster-11
description: "Skill for the Cluster_11 area of opencode-memory-enhanced. 8 symbols across 4 files."
---

# Cluster_11

8 symbols | 4 files | Cohesion: 40%

## When to Use

- Working with code in `lib/`
- Understanding how execSingle, scheduleSave, cleanupOrphanEntities work
- Modifying cluster_11-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `memory-enhanced.ts` | maybeConsolidate, closeArc, event |
| `lib/db.ts` | execSingle, scheduleSave |
| `lib/entities.ts` | cleanupOrphanEntities, detectEntityPatterns |
| `lib/optimize.ts` | applyMemoryDecay |

## Entry Points

Start here when exploring this area:

- **`execSingle`** (Function) — `lib/db.ts:70`
- **`scheduleSave`** (Function) — `lib/db.ts:98`
- **`cleanupOrphanEntities`** (Function) — `lib/entities.ts:179`
- **`detectEntityPatterns`** (Function) — `lib/entities.ts:187`
- **`applyMemoryDecay`** (Function) — `lib/optimize.ts:75`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `execSingle` | Function | `lib/db.ts` | 70 |
| `scheduleSave` | Function | `lib/db.ts` | 98 |
| `cleanupOrphanEntities` | Function | `lib/entities.ts` | 179 |
| `detectEntityPatterns` | Function | `lib/entities.ts` | 187 |
| `applyMemoryDecay` | Function | `lib/optimize.ts` | 75 |
| `maybeConsolidate` | Function | `memory-enhanced.ts` | 51 |
| `closeArc` | Function | `memory-enhanced.ts` | 61 |
| `event` | Function | `memory-enhanced.ts` | 66 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Event → GetAll` | cross_community | 6 |
| `RunOptimize → LoadConfig` | cross_community | 4 |
| `Event → LoadConfig` | cross_community | 3 |
| `Execute → ExecSingle` | cross_community | 3 |
| `RunOptimize → ExecSingle` | cross_community | 3 |
| `InsertRecords → ExecSingle` | cross_community | 3 |
| `MaybeConsolidate → LoadConfig` | cross_community | 3 |
| `MaybeConsolidate → GetAll` | cross_community | 3 |
| `MaybeConsolidate → GetOne` | cross_community | 3 |
| `MaybeConsolidate → ExecSingle` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Tools | 8 calls |
| Cluster_13 | 4 calls |
| Cluster_4 | 3 calls |

## How to Explore

1. `context({name: "execSingle"})` — see callers and callees
2. `query({search_query: "cluster_11"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
