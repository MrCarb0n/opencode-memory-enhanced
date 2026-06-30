---
name: cluster-16
description: "Skill for the Cluster_16 area of opencode-memory-enhanced. 5 symbols across 3 files."
---

# Cluster_16

5 symbols | 3 files | Cohesion: 60%

## When to Use

- Working with code in `lib/`
- Understanding how injectEpisodeContext, getActiveEpisode, captureFrozenSnapshot work
- Modifying cluster_16-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `memory-enhanced.ts` | captureFrozenSnapshot, experimental.session.compacting, experimental.chat.system.transform |
| `lib/episode-retrieval.ts` | injectEpisodeContext |
| `lib/episodes.ts` | getActiveEpisode |

## Entry Points

Start here when exploring this area:

- **`injectEpisodeContext`** (Function) — `lib/episode-retrieval.ts:68`
- **`getActiveEpisode`** (Function) — `lib/episodes.ts:161`
- **`captureFrozenSnapshot`** (Function) — `memory-enhanced.ts:65`
- **`experimental.session.compacting`** (Function) — `memory-enhanced.ts:173`
- **`experimental.chat.system.transform`** (Function) — `memory-enhanced.ts:256`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `injectEpisodeContext` | Function | `lib/episode-retrieval.ts` | 68 |
| `getActiveEpisode` | Function | `lib/episodes.ts` | 161 |
| `captureFrozenSnapshot` | Function | `memory-enhanced.ts` | 65 |
| `experimental.session.compacting` | Function | `memory-enhanced.ts` | 173 |
| `experimental.chat.system.transform` | Function | `memory-enhanced.ts` | 256 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Event → GetAll` | cross_community | 6 |
| `Chat.message → GetAll` | cross_community | 6 |
| `Experimental.session.compacting → GetAll` | cross_community | 6 |
| `Experimental.chat.system.transform → GetAll` | cross_community | 6 |
| `InjectEpisodeContext → Tokenize` | cross_community | 5 |
| `InjectEpisodeContext → Mulberry32` | cross_community | 5 |
| `Experimental.session.compacting → LoadConfig` | cross_community | 3 |
| `Experimental.chat.system.transform → LoadConfig` | cross_community | 3 |
| `InjectEpisodeContext → GetAll` | cross_community | 3 |
| `InjectEpisodeContext → DeserializeEmbedding` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Tools | 4 calls |
| Cluster_4 | 2 calls |

## How to Explore

1. `context({name: "injectEpisodeContext"})` — see callers and callees
2. `query({search_query: "cluster_16"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
