---
name: cluster-13
description: "Skill for the Cluster_13 area of opencode-memory-enhanced. 8 symbols across 3 files."
---

# Cluster_13

8 symbols | 3 files | Cohesion: 39%

## When to Use

- Working with code in `lib/`
- Understanding how getAll, updateAgentsMd, captureFrozenSnapshot work
- Modifying cluster_13-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `memory-enhanced.ts` | track, captureFrozenSnapshot, chat.message, experimental.session.compacting, permission.ask (+1) |
| `lib/db.ts` | getAll |
| `lib/helpers.ts` | updateAgentsMd |

## Entry Points

Start here when exploring this area:

- **`getAll`** (Function) — `lib/db.ts:78`
- **`updateAgentsMd`** (Function) — `lib/helpers.ts:16`
- **`captureFrozenSnapshot`** (Function) — `memory-enhanced.ts:44`
- **`chat.message`** (Function) — `memory-enhanced.ts:116`
- **`experimental.session.compacting`** (Function) — `memory-enhanced.ts:138`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getAll` | Function | `lib/db.ts` | 78 |
| `updateAgentsMd` | Function | `lib/helpers.ts` | 16 |
| `captureFrozenSnapshot` | Function | `memory-enhanced.ts` | 44 |
| `chat.message` | Function | `memory-enhanced.ts` | 116 |
| `experimental.session.compacting` | Function | `memory-enhanced.ts` | 138 |
| `permission.ask` | Function | `memory-enhanced.ts` | 189 |
| `experimental.chat.system.transform` | Function | `memory-enhanced.ts` | 212 |
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
| `AddCuratedEntry → GetAll` | cross_community | 4 |
| `ReplaceCuratedEntry → GetAll` | cross_community | 4 |
| `Experimental.session.compacting → LoadConfig` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Tools | 4 calls |
| Cluster_4 | 4 calls |

## How to Explore

1. `context({name: "getAll"})` — see callers and callees
2. `query({search_query: "cluster_13"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
