---
name: cluster-14
description: "Skill for the Cluster_14 area of opencode-memory-enhanced. 5 symbols across 4 files."
---

# Cluster_14

5 symbols | 4 files | Cohesion: 32%

## When to Use

- Working with code in `lib/`
- Understanding how scheduleSave, updateAgentsMd, applyMemoryDecay work
- Modifying cluster_14-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `memory-enhanced.ts` | maybeConsolidate, event |
| `lib/db.ts` | scheduleSave |
| `lib/helpers.ts` | updateAgentsMd |
| `lib/optimize.ts` | applyMemoryDecay |

## Entry Points

Start here when exploring this area:

- **`scheduleSave`** (Function) — `lib/db.ts:121`
- **`updateAgentsMd`** (Function) — `lib/helpers.ts:16`
- **`applyMemoryDecay`** (Function) — `lib/optimize.ts:79`
- **`maybeConsolidate`** (Function) — `memory-enhanced.ts:72`
- **`event`** (Function) — `memory-enhanced.ts:87`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `scheduleSave` | Function | `lib/db.ts` | 121 |
| `updateAgentsMd` | Function | `lib/helpers.ts` | 16 |
| `applyMemoryDecay` | Function | `lib/optimize.ts` | 79 |
| `maybeConsolidate` | Function | `memory-enhanced.ts` | 72 |
| `event` | Function | `memory-enhanced.ts` | 87 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Event → GetAll` | cross_community | 6 |
| `RunOptimize → LoadConfig` | cross_community | 4 |
| `Event → LoadConfig` | cross_community | 3 |
| `RunOptimize → ExecSingle` | cross_community | 3 |
| `MaybeConsolidate → LoadConfig` | cross_community | 3 |
| `MaybeConsolidate → GetAll` | cross_community | 3 |
| `MaybeConsolidate → GetOne` | cross_community | 3 |
| `MaybeConsolidate → ExecSingle` | cross_community | 3 |
| `MaybeConsolidate → Now` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Tools | 11 calls |
| Cluster_4 | 3 calls |
| Cluster_16 | 1 calls |
| Cluster_18 | 1 calls |

## How to Explore

1. `context({name: "scheduleSave"})` — see callers and callees
2. `query({search_query: "cluster_14"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
