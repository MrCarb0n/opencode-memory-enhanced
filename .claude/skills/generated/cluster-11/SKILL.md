---
name: cluster-11
description: "Skill for the Cluster_11 area of opencode-memory-enhanced. 10 symbols across 4 files."
---

# Cluster_11

10 symbols | 4 files | Cohesion: 45%

## When to Use

- Working with code in `lib/`
- Understanding how getAll, detectEntityPatterns, updateAgentsMd work
- Modifying cluster_11-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `memory-enhanced.ts` | track, captureFrozenSnapshot, maybeConsolidate, event, chat.message (+2) |
| `lib/db.ts` | getAll |
| `lib/entities.ts` | detectEntityPatterns |
| `lib/helpers.ts` | updateAgentsMd |

## Entry Points

Start here when exploring this area:

- **`getAll`** (Function) — `lib/db.ts:98`
- **`detectEntityPatterns`** (Function) — `lib/entities.ts:187`
- **`updateAgentsMd`** (Function) — `lib/helpers.ts:20`
- **`captureFrozenSnapshot`** (Function) — `memory-enhanced.ts:46`
- **`maybeConsolidate`** (Function) — `memory-enhanced.ts:53`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getAll` | Function | `lib/db.ts` | 98 |
| `detectEntityPatterns` | Function | `lib/entities.ts` | 187 |
| `updateAgentsMd` | Function | `lib/helpers.ts` | 20 |
| `captureFrozenSnapshot` | Function | `memory-enhanced.ts` | 46 |
| `maybeConsolidate` | Function | `memory-enhanced.ts` | 53 |
| `event` | Function | `memory-enhanced.ts` | 70 |
| `chat.message` | Function | `memory-enhanced.ts` | 120 |
| `experimental.session.compacting` | Function | `memory-enhanced.ts` | 142 |
| `experimental.chat.system.transform` | Function | `memory-enhanced.ts` | 218 |
| `track` | Function | `memory-enhanced.ts` | 16 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Event → GetAll` | cross_community | 6 |
| `Chat.message → GetAll` | cross_community | 6 |
| `Chat.message → LoadConfig` | cross_community | 6 |
| `Experimental.session.compacting → GetAll` | cross_community | 6 |
| `Experimental.chat.system.transform → GetAll` | cross_community | 6 |
| `Chat.message → ParsePattern` | cross_community | 5 |
| `Execute → GetAll` | cross_community | 4 |
| `ScanPastSessions → GetAll` | cross_community | 4 |
| `AddCuratedEntry → GetAll` | cross_community | 4 |
| `ReplaceCuratedEntry → GetAll` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Tools | 13 calls |
| Cluster_4 | 3 calls |
| Cluster_9 | 2 calls |

## How to Explore

1. `context({name: "getAll"})` — see callers and callees
2. `query({search_query: "cluster_11"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
