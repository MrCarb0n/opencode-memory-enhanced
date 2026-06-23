---
name: tools
description: "Skill for the Tools area of opencode-memory-enhanced. 71 symbols across 21 files."
---

# Tools

71 symbols | 21 files | Cohesion: 60%

## When to Use

- Working with code in `lib/`
- Understanding how buildFtsQuery, searchFts5, embed work
- Modifying tools-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/db.ts` | buildFtsQuery, searchFts5, getDb, stopAutoSave, saveDb (+4) |
| `lib/embeddings.ts` | mulberry32, getProjectionMatrix, embed, vectorCosineSimilarity, deserializeEmbedding (+3) |
| `lib/curated.ts` | getCuratedEntries, getCuratedUsage, addCuratedEntry, replaceCuratedEntry, removeCuratedEntry (+1) |
| `lib/memory.ts` | vectorSearch, hybridSearch, scoreMemories, autoRemember, precomputeVector |
| `lib/entities.ts` | extractEntities, linkEntity, discoverRelationships, autoLinkMemories, getEntityOrCreate |
| `lib/utils.ts` | freqMap, cosineSimilarity, tokenize, truncate |
| `lib/scan.ts` | insertRecords, getOpenCodeDBPath, queryOpenCodeDB, scanFromOpenCodeDB |
| `lib/tools/info.ts` | createInfoTool, execute, validate, count |
| `memory-enhanced.ts` | tool.execute.before, dispose, config |
| `lib/helpers.ts` | sizeBucketKey, sameBucket, showToast |

## Entry Points

Start here when exploring this area:

- **`buildFtsQuery`** (Function) — `lib/db.ts:114`
- **`searchFts5`** (Function) — `lib/db.ts:141`
- **`embed`** (Function) — `lib/embeddings.ts:57`
- **`vectorCosineSimilarity`** (Function) — `lib/embeddings.ts:94`
- **`deserializeEmbedding`** (Function) — `lib/embeddings.ts:111`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `buildFtsQuery` | Function | `lib/db.ts` | 114 |
| `searchFts5` | Function | `lib/db.ts` | 141 |
| `embed` | Function | `lib/embeddings.ts` | 57 |
| `vectorCosineSimilarity` | Function | `lib/embeddings.ts` | 94 |
| `deserializeEmbedding` | Function | `lib/embeddings.ts` | 111 |
| `embeddingStatus` | Function | `lib/embeddings.ts` | 123 |
| `hybridSearch` | Function | `lib/memory.ts` | 75 |
| `scoreMemories` | Function | `lib/memory.ts` | 174 |
| `tool.execute.before` | Function | `memory-enhanced.ts` | 157 |
| `getDb` | Function | `lib/db.ts` | 66 |
| `stopAutoSave` | Function | `lib/db.ts` | 102 |
| `saveDb` | Function | `lib/db.ts` | 109 |
| `sameBucket` | Function | `lib/helpers.ts` | 12 |
| `runOptimize` | Function | `lib/optimize.ts` | 17 |
| `dedupLoop` | Function | `lib/tools/maintain.ts` | 27 |
| `freqMap` | Function | `lib/utils.ts` | 8 |
| `cosineSimilarity` | Function | `lib/utils.ts` | 14 |
| `dispose` | Function | `memory-enhanced.ts` | 249 |
| `getOne` | Function | `lib/db.ts` | 74 |
| `runInsert` | Function | `lib/db.ts` | 82 |

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
| `Execute → BuildFtsQuery` | intra_community | 4 |
| `Execute → GetAll` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_11 | 15 calls |
| Cluster_4 | 14 calls |
| Cluster_13 | 13 calls |

## How to Explore

1. `context({name: "buildFtsQuery"})` — see callers and callees
2. `query({search_query: "tools"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
