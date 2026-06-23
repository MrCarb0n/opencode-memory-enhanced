---
name: cluster-9
description: "Skill for the Cluster_9 area of opencode-memory-enhanced. 9 symbols across 4 files."
---

# Cluster_9

9 symbols | 4 files | Cohesion: 47%

## When to Use

- Working with code in `lib/`
- Understanding how saveDb, getDb, stopAutoSave work
- Modifying cluster_9-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/db.ts` | saveDb, getDb, stopAutoSave |
| `lib/optimize.ts` | yieldToEventLoop, runOptimize, applyMemoryDecay |
| `lib/helpers.ts` | sizeBucketKey, sameBucket |
| `memory-enhanced.ts` | dispose |

## Entry Points

Start here when exploring this area:

- **`saveDb`** (Function) — `lib/db.ts:25`
- **`getDb`** (Function) — `lib/db.ts:73`
- **`stopAutoSave`** (Function) — `lib/db.ts:143`
- **`sameBucket`** (Function) — `lib/helpers.ts:16`
- **`runOptimize`** (Function) — `lib/optimize.ts:21`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `saveDb` | Function | `lib/db.ts` | 25 |
| `getDb` | Function | `lib/db.ts` | 73 |
| `stopAutoSave` | Function | `lib/db.ts` | 143 |
| `sameBucket` | Function | `lib/helpers.ts` | 16 |
| `runOptimize` | Function | `lib/optimize.ts` | 21 |
| `applyMemoryDecay` | Function | `lib/optimize.ts` | 79 |
| `dispose` | Function | `memory-enhanced.ts` | 266 |
| `sizeBucketKey` | Function | `lib/helpers.ts` | 12 |
| `yieldToEventLoop` | Function | `lib/optimize.ts` | 10 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RunOptimize → LoadConfig` | cross_community | 4 |
| `Execute → Now` | cross_community | 3 |
| `Execute → Now` | cross_community | 3 |
| `Execute → Now` | cross_community | 3 |
| `RunOptimize → ExecSingle` | cross_community | 3 |
| `Dispose → Now` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Tools | 5 calls |
| Cluster_11 | 2 calls |
| Cluster_15 | 1 calls |
| Cluster_4 | 1 calls |

## How to Explore

1. `context({name: "saveDb"})` — see callers and callees
2. `query({search_query: "cluster_9"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
