---
name: cluster-18
description: "Skill for the Cluster_18 area of opencode-memory-enhanced. 5 symbols across 2 files."
---

# Cluster_18

5 symbols | 2 files | Cohesion: 44%

## When to Use

- Working with code in `lib/`
- Understanding how detectBoundary, getEpisodeCount, chat.message work
- Modifying cluster_18-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/episodes.ts` | detectBoundary, tokens, getEpisodeCount |
| `memory-enhanced.ts` | track, chat.message |

## Entry Points

Start here when exploring this area:

- **`detectBoundary`** (Function) — `lib/episodes.ts:89`
- **`getEpisodeCount`** (Function) — `lib/episodes.ts:198`
- **`chat.message`** (Function) — `memory-enhanced.ts:139`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `detectBoundary` | Function | `lib/episodes.ts` | 89 |
| `getEpisodeCount` | Function | `lib/episodes.ts` | 198 |
| `chat.message` | Function | `memory-enhanced.ts` | 139 |
| `tokens` | Function | `lib/episodes.ts` | 120 |
| `track` | Function | `memory-enhanced.ts` | 20 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Chat.message → GetAll` | cross_community | 6 |
| `Chat.message → LoadConfig` | cross_community | 6 |
| `Chat.message → ParsePattern` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Tools | 6 calls |
| Cluster_16 | 1 calls |
| Cluster_4 | 1 calls |
| Cluster_17 | 1 calls |

## How to Explore

1. `context({name: "detectBoundary"})` — see callers and callees
2. `query({search_query: "cluster_18"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
