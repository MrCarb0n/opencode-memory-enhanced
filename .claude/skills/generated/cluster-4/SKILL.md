---
name: cluster-4
description: "Skill for the Cluster_4 area of opencode-memory-enhanced. 17 symbols across 6 files."
---

# Cluster_4

17 symbols | 6 files | Cohesion: 67%

## When to Use

- Working with code in `lib/`
- Understanding how loadConfig, getConfig, generateAutoTags work
- Modifying cluster_4-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/episodes.ts` | sanitize, sanitizeArgs, onToolStart, onToolEnd, summarizeResult |
| `lib/types.ts` | parsePattern, shouldNotSave, detectMemoryType, isImportantMessage, extractImportance |
| `lib/config.ts` | loadConfig, getConfig |
| `lib/extractor.ts` | parseMessages, extractSessionMemories |
| `memory-enhanced.ts` | tool.execute.before, tool.execute.after |
| `lib/entities.ts` | generateAutoTags |

## Entry Points

Start here when exploring this area:

- **`loadConfig`** (Function) — `lib/config.ts:147`
- **`getConfig`** (Function) — `lib/config.ts:162`
- **`generateAutoTags`** (Function) — `lib/entities.ts:56`
- **`onToolStart`** (Function) — `lib/episodes.ts:26`
- **`onToolEnd`** (Function) — `lib/episodes.ts:59`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `loadConfig` | Function | `lib/config.ts` | 147 |
| `getConfig` | Function | `lib/config.ts` | 162 |
| `generateAutoTags` | Function | `lib/entities.ts` | 56 |
| `onToolStart` | Function | `lib/episodes.ts` | 26 |
| `onToolEnd` | Function | `lib/episodes.ts` | 59 |
| `extractSessionMemories` | Function | `lib/extractor.ts` | 50 |
| `parsePattern` | Function | `lib/types.ts` | 92 |
| `shouldNotSave` | Function | `lib/types.ts` | 102 |
| `detectMemoryType` | Function | `lib/types.ts` | 106 |
| `isImportantMessage` | Function | `lib/types.ts` | 114 |
| `extractImportance` | Function | `lib/types.ts` | 120 |
| `tool.execute.before` | Function | `memory-enhanced.ts` | 197 |
| `tool.execute.after` | Function | `memory-enhanced.ts` | 219 |
| `sanitize` | Function | `lib/episodes.ts` | 13 |
| `sanitizeArgs` | Function | `lib/episodes.ts` | 18 |
| `summarizeResult` | Function | `lib/episodes.ts` | 82 |
| `parseMessages` | Function | `lib/extractor.ts` | 24 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Chat.message → LoadConfig` | cross_community | 6 |
| `Chat.message → ParsePattern` | cross_community | 5 |
| `RunOptimize → LoadConfig` | cross_community | 4 |
| `ExtractSessionMemories → LoadConfig` | intra_community | 4 |
| `Tool.execute.after → LoadConfig` | intra_community | 4 |
| `Tool.execute.after → Sanitize` | intra_community | 4 |
| `Tool.execute.before → LoadConfig` | intra_community | 4 |
| `Event → LoadConfig` | cross_community | 3 |
| `Execute → LoadConfig` | cross_community | 3 |
| `Execute → LoadConfig` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Tools | 4 calls |

## How to Explore

1. `context({name: "loadConfig"})` — see callers and callees
2. `query({search_query: "cluster_4"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
