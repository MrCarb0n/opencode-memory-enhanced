---
name: cluster-17
description: "Skill for the Cluster_17 area of opencode-memory-enhanced. 5 symbols across 2 files."
---

# Cluster_17

5 symbols | 2 files | Cohesion: 57%

## When to Use

- Working with code in `lib/`
- Understanding how synthesizeEpisode, getEpisode, updateEpisode work
- Modifying cluster_17-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/episode-synthesis.ts` | buildPrompt, parseJSON, synthesizeEpisode |
| `lib/episodes.ts` | getEpisode, updateEpisode |

## Entry Points

Start here when exploring this area:

- **`synthesizeEpisode`** (Function) — `lib/episode-synthesis.ts:76`
- **`getEpisode`** (Function) — `lib/episodes.ts:165`
- **`updateEpisode`** (Function) — `lib/episodes.ts:176`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `synthesizeEpisode` | Function | `lib/episode-synthesis.ts` | 76 |
| `getEpisode` | Function | `lib/episodes.ts` | 165 |
| `updateEpisode` | Function | `lib/episodes.ts` | 176 |
| `buildPrompt` | Function | `lib/episode-synthesis.ts` | 10 |
| `parseJSON` | Function | `lib/episode-synthesis.ts` | 68 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `SynthesizeEpisode → GetOne` | cross_community | 3 |
| `SynthesizeEpisode → ExecSingle` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Tools | 5 calls |

## How to Explore

1. `context({name: "synthesizeEpisode"})` — see callers and callees
2. `query({search_query: "cluster_17"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
