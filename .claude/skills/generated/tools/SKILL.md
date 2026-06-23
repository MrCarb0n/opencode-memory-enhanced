---
name: tools
description: "Skill for the Tools area of opencode-memory-enhanced. 71 symbols across 21 files."
---

# Tools

71 symbols | 21 files | Cohesion: 65%

## When to Use

- Working with code in `lib/`
- Understanding how execSingle, getOne, runInsert work
- Modifying tools-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/db.ts` | execSingle, getOne, runInsert, now, initFts5 (+3) |
| `lib/curated.ts` | getCuratedEntries, getCuratedContent, getCuratedUsage, addCuratedEntry, replaceCuratedEntry (+2) |
| `lib/entities.ts` | extractEntities, linkEntity, getEntityOrCreate, discoverRelationships, autoLinkMemories (+1) |
| `lib/scan.ts` | insertRecords, getOpenCodeDBPath, getSqlJs, queryOpenCodeDB, scanFromOpenCodeDB (+1) |
| `lib/utils.ts` | simhash, hash32, hammingDistance, freqMap, cosineSimilarity (+1) |
| `lib/memory.ts` | autoRemember, vectorSearch, hybridSearch, scoreMemories, semanticSearch |
| `lib/tools/info.ts` | createInfoTool, execute, validate, count |
| `lib/config.ts` | deepEqual, configDiff, atomicWrite, saveConfig |
| `memory-enhanced.ts` | closeArc, tool.execute.before, config |
| `lib/embeddings.ts` | vectorCosineSimilarity, deserializeEmbedding, embeddingStatus |

## Entry Points

Start here when exploring this area:

- **`execSingle`** (Function) — `lib/db.ts:78`
- **`getOne`** (Function) — `lib/db.ts:83`
- **`runInsert`** (Function) — `lib/db.ts:114`
- **`now`** (Function) — `lib/db.ts:133`
- **`initFts5`** (Function) — `lib/db.ts:154`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `execSingle` | Function | `lib/db.ts` | 78 |
| `getOne` | Function | `lib/db.ts` | 83 |
| `runInsert` | Function | `lib/db.ts` | 114 |
| `now` | Function | `lib/db.ts` | 133 |
| `initFts5` | Function | `lib/db.ts` | 154 |
| `extractEntities` | Function | `lib/entities.ts` | 12 |
| `linkEntity` | Function | `lib/entities.ts` | 72 |
| `getEntityOrCreate` | Function | `lib/entities.ts` | 88 |
| `discoverRelationships` | Function | `lib/entities.ts` | 102 |
| `autoLinkMemories` | Function | `lib/entities.ts` | 139 |
| `autoRemember` | Function | `lib/memory.ts` | 117 |
| `closeArc` | Function | `memory-enhanced.ts` | 65 |
| `buildFtsQuery` | Function | `lib/db.ts` | 195 |
| `searchFts5` | Function | `lib/db.ts` | 240 |
| `vectorCosineSimilarity` | Function | `lib/embeddings.ts` | 94 |
| `deserializeEmbedding` | Function | `lib/embeddings.ts` | 111 |
| `embeddingStatus` | Function | `lib/embeddings.ts` | 123 |
| `cleanupOrphanEntities` | Function | `lib/entities.ts` | 179 |
| `hybridSearch` | Function | `lib/memory.ts` | 75 |
| `scoreMemories` | Function | `lib/memory.ts` | 174 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Event → GetAll` | cross_community | 6 |
| `Execute → Tokenize` | cross_community | 6 |
| `Execute → Mulberry32` | cross_community | 6 |
| `Chat.message → GetAll` | cross_community | 6 |
| `Chat.message → LoadConfig` | cross_community | 6 |
| `Experimental.session.compacting → GetAll` | cross_community | 6 |
| `Experimental.chat.system.transform → GetAll` | cross_community | 6 |
| `Chat.message → ParsePattern` | cross_community | 5 |
| `Execute → ParsePattern` | cross_community | 5 |
| `SemanticSearch → Tokenize` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_11 | 13 calls |
| Cluster_4 | 12 calls |
| Cluster_15 | 8 calls |
| Cluster_9 | 7 calls |

## How to Explore

1. `context({name: "execSingle"})` — see callers and callees
2. `query({search_query: "tools"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
