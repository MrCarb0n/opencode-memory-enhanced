---
name: tools
description: "Skill for the Tools area of opencode-memory-enhanced. 84 symbols across 24 files."
---

# Tools

84 symbols | 24 files | Cohesion: 63%

## When to Use

- Working with code in `lib/`
- Understanding how getAll, buildFtsQuery, searchFts5 work
- Modifying tools-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/db.ts` | getAll, buildFtsQuery, searchFts5, execSingle, getOne (+6) |
| `lib/embeddings.ts` | mulberry32, getProjectionMatrix, embed, vectorCosineSimilarity, serializeEmbedding (+3) |
| `lib/entities.ts` | cleanupOrphanEntities, extractEntities, linkEntity, getEntityOrCreate, discoverRelationships (+2) |
| `lib/curated.ts` | getCuratedEntries, getCuratedUsage, addCuratedEntry, replaceCuratedEntry, removeCuratedEntry (+1) |
| `lib/memory.ts` | vectorSearch, hybridSearch, scoreMemories, autoRemember, precomputeVector |
| `lib/episodes.ts` | updateEpisodeEmbedding, getRecentEpisodes, abortEpisode, finalizeEpisode |
| `memory-enhanced.ts` | permission.ask, closeArc, dispose, config |
| `lib/scan.ts` | insertRecords, getOpenCodeDBPath, queryOpenCodeDB, scanFromOpenCodeDB |
| `lib/utils.ts` | tokenize, freqMap, cosineSimilarity, truncate |
| `lib/tools/info.ts` | createInfoTool, execute, validate, count |

## Entry Points

Start here when exploring this area:

- **`getAll`** (Function) — `lib/db.ts:101`
- **`buildFtsQuery`** (Function) — `lib/db.ts:141`
- **`searchFts5`** (Function) — `lib/db.ts:168`
- **`embed`** (Function) — `lib/embeddings.ts:57`
- **`vectorCosineSimilarity`** (Function) — `lib/embeddings.ts:94`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getAll` | Function | `lib/db.ts` | 101 |
| `buildFtsQuery` | Function | `lib/db.ts` | 141 |
| `searchFts5` | Function | `lib/db.ts` | 168 |
| `embed` | Function | `lib/embeddings.ts` | 57 |
| `vectorCosineSimilarity` | Function | `lib/embeddings.ts` | 94 |
| `serializeEmbedding` | Function | `lib/embeddings.ts` | 107 |
| `deserializeEmbedding` | Function | `lib/embeddings.ts` | 111 |
| `embeddingStatus` | Function | `lib/embeddings.ts` | 123 |
| `cleanupOrphanEntities` | Function | `lib/entities.ts` | 179 |
| `clusterEpisodes` | Function | `lib/episode-patterns.ts` | 9 |
| `searchEpisodes` | Function | `lib/episode-retrieval.ts` | 35 |
| `updateEpisodeEmbedding` | Function | `lib/episodes.ts` | 169 |
| `getRecentEpisodes` | Function | `lib/episodes.ts` | 187 |
| `hybridSearch` | Function | `lib/memory.ts` | 75 |
| `scoreMemories` | Function | `lib/memory.ts` | 174 |
| `permission.ask` | Function | `memory-enhanced.ts` | 233 |
| `execSingle` | Function | `lib/db.ts` | 93 |
| `getOne` | Function | `lib/db.ts` | 97 |
| `runInsert` | Function | `lib/db.ts` | 105 |
| `now` | Function | `lib/db.ts` | 115 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Event → GetAll` | cross_community | 6 |
| `Execute → Tokenize` | cross_community | 6 |
| `Execute → Mulberry32` | intra_community | 6 |
| `Chat.message → GetAll` | cross_community | 6 |
| `Chat.message → LoadConfig` | cross_community | 6 |
| `Experimental.session.compacting → GetAll` | cross_community | 6 |
| `Experimental.chat.system.transform → GetAll` | cross_community | 6 |
| `Chat.message → ParsePattern` | cross_community | 5 |
| `InjectEpisodeContext → Tokenize` | cross_community | 5 |
| `InjectEpisodeContext → Mulberry32` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_4 | 15 calls |
| Cluster_14 | 1 calls |

## How to Explore

1. `context({name: "getAll"})` — see callers and callees
2. `query({search_query: "tools"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
