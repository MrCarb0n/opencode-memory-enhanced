---
name: cluster-4
description: "Skill for the Cluster_4 area of opencode-memory-enhanced. 11 symbols across 5 files."
---

# Cluster_4

11 symbols | 5 files | Cohesion: 61%

## When to Use

- Working with code in `lib/`
- Understanding how loadConfig, getConfig, generateAutoTags work
- Modifying cluster_4-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/types.ts` | parsePattern, shouldNotSave, detectMemoryType, isImportantMessage, extractImportance |
| `lib/config.ts` | loadConfig, getConfig |
| `lib/extractor.ts` | parseMessages, extractSessionMemories |
| `lib/entities.ts` | generateAutoTags |
| `memory-enhanced.ts` | tool.execute.after |

## Entry Points

Start here when exploring this area:

- **`loadConfig`** (Function) — `lib/config.ts:131`
- **`getConfig`** (Function) — `lib/config.ts:146`
- **`generateAutoTags`** (Function) — `lib/entities.ts:56`
- **`extractSessionMemories`** (Function) — `lib/extractor.ts:50`
- **`parsePattern`** (Function) — `lib/types.ts:21`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `loadConfig` | Function | `lib/config.ts` | 131 |
| `getConfig` | Function | `lib/config.ts` | 146 |
| `generateAutoTags` | Function | `lib/entities.ts` | 56 |
| `extractSessionMemories` | Function | `lib/extractor.ts` | 50 |
| `parsePattern` | Function | `lib/types.ts` | 21 |
| `shouldNotSave` | Function | `lib/types.ts` | 31 |
| `detectMemoryType` | Function | `lib/types.ts` | 35 |
| `isImportantMessage` | Function | `lib/types.ts` | 43 |
| `extractImportance` | Function | `lib/types.ts` | 49 |
| `tool.execute.after` | Function | `memory-enhanced.ts` | 177 |
| `parseMessages` | Function | `lib/extractor.ts` | 24 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Chat.message → LoadConfig` | cross_community | 6 |
| `Chat.message → ParsePattern` | cross_community | 5 |
| `RunOptimize → LoadConfig` | cross_community | 4 |
| `ExtractSessionMemories → LoadConfig` | intra_community | 4 |
| `Event → LoadConfig` | cross_community | 3 |
| `Execute → LoadConfig` | cross_community | 3 |
| `Execute → LoadConfig` | cross_community | 3 |
| `ExtractSessionMemories → ParsePattern` | intra_community | 3 |
| `Experimental.session.compacting → LoadConfig` | cross_community | 3 |
| `Experimental.chat.system.transform → LoadConfig` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Tools | 2 calls |

## How to Explore

1. `context({name: "loadConfig"})` — see callers and callees
2. `query({search_query: "cluster_4"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
