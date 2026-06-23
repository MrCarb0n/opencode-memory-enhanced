---
name: cluster-15
description: "Skill for the Cluster_15 area of opencode-memory-enhanced. 9 symbols across 3 files."
---

# Cluster_15

9 symbols | 3 files | Cohesion: 64%

## When to Use

- Working with code in `lib/`
- Understanding how embed, serializeEmbedding, preloadEmbeddings work
- Modifying cluster_15-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/embeddings.ts` | mulberry32, getProjectionMatrix, hashingVectorize, embed, serializeEmbedding (+1) |
| `lib/memory.ts` | precomputeVector, bm25 |
| `lib/utils.ts` | tokenize |

## Entry Points

Start here when exploring this area:

- **`embed`** (Function) — `lib/embeddings.ts:57`
- **`serializeEmbedding`** (Function) — `lib/embeddings.ts:107`
- **`preloadEmbeddings`** (Function) — `lib/embeddings.ts:128`
- **`precomputeVector`** (Function) — `lib/memory.ts:16`
- **`tokenize`** (Function) — `lib/utils.ts:90`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `embed` | Function | `lib/embeddings.ts` | 57 |
| `serializeEmbedding` | Function | `lib/embeddings.ts` | 107 |
| `preloadEmbeddings` | Function | `lib/embeddings.ts` | 128 |
| `precomputeVector` | Function | `lib/memory.ts` | 16 |
| `tokenize` | Function | `lib/utils.ts` | 90 |
| `mulberry32` | Function | `lib/embeddings.ts` | 11 |
| `getProjectionMatrix` | Function | `lib/embeddings.ts` | 20 |
| `hashingVectorize` | Function | `lib/embeddings.ts` | 38 |
| `bm25` | Function | `lib/memory.ts` | 208 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Execute → Tokenize` | cross_community | 6 |
| `Execute → Mulberry32` | cross_community | 6 |
| `SemanticSearch → Tokenize` | cross_community | 5 |
| `SemanticSearch → Mulberry32` | cross_community | 5 |
| `Execute → Tokenize` | cross_community | 4 |
| `PrecomputeVector → Tokenize` | intra_community | 4 |
| `PrecomputeVector → Mulberry32` | intra_community | 4 |
| `PrecomputeVector → LoadConfig` | cross_community | 3 |
| `PreloadEmbeddings → Mulberry32` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_4 | 1 calls |

## How to Explore

1. `context({name: "embed"})` — see callers and callees
2. `query({search_query: "cluster_15"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
