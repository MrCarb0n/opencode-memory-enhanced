import { getOne, getAll, execSingle, now, getDb, saveDb } from "./db"
import { cosineSimilarity, truncate } from "./utils"
import { sameBucket } from "./helpers"
import { precomputeVector } from "./memory"
import { embeddingStatus } from "./embeddings"
import { detectEntityPatterns } from "./entities"
import { getConfig } from "./config"

const YIELD_INTERVAL = 50

interface OptimizeResult {
  staleRemoved: number
  duplicatesMerged: number
  embeddingsBackfilled: number
  patternsDetected: number
}

export async function runOptimize(
  projectPath: string,
  isFull: boolean,
  onMessage?: (msg: string) => void
): Promise<OptimizeResult> {
  applyMemoryDecay()
  const staleRemoved = execSingle("DELETE FROM memories WHERE importance < 3 AND timestamp < datetime('now', '-60 days')") as unknown as number || 0

  let duplicatesMerged = 0
  let embeddingsBackfilled = 0
  let patternsDetected = 0

  if (isFull) {
    const projectMemories = getAll<{ id: number; content: string; type: string; importance: number }>("SELECT id, content, type, importance FROM memories WHERE scope = 'project' ORDER BY id")
    for (let i = 0; i < projectMemories.length; i++) {
      if (i > 0 && i % YIELD_INTERVAL === 0) await new Promise((r) => setTimeout(r, 0))
      for (let j = i + 1; j < projectMemories.length; j++) {
        if (!sameBucket(projectMemories[i].content, projectMemories[j].content)) continue
        if (cosineSimilarity(projectMemories[i].content, projectMemories[j].content) > 0.85) {
          execSingle("UPDATE memories SET access_count = access_count + 1, importance = MAX(importance, ?) WHERE id = ?", [projectMemories[j].importance, projectMemories[i].id])
          execSingle("DELETE FROM memories WHERE id = ?", [projectMemories[j].id])
          duplicatesMerged++
        }
      }
    }

    if (duplicatesMerged > 0 && onMessage) onMessage(`Merged ${duplicatesMerged} duplicates`)

    const noEmbedding = getAll<{ id: number; content: string }>("SELECT id, content FROM memories WHERE (embedding IS NULL OR embedding = '') AND scope = 'project' LIMIT 2000")
    if (noEmbedding.length > 0) {
      const status = embeddingStatus()
      if (status.loaded) {
        for (let idx = 0; idx < noEmbedding.length; idx++) {
          if (idx > 0 && idx % YIELD_INTERVAL === 0) await new Promise((r) => setTimeout(r, 0))
          const mem = noEmbedding[idx]
          const emb = await precomputeVector(mem.content)
          if (emb) {
            execSingle("UPDATE memories SET embedding = ? WHERE id = ?", [emb, mem.id])
            embeddingsBackfilled++
          }
        }
        if (embeddingsBackfilled > 0 && onMessage) onMessage(`Backfilled ${embeddingsBackfilled} embeddings`)
      }
    }

    patternsDetected = detectEntityPatterns(projectPath)
    if (patternsDetected > 0 && onMessage) onMessage(`Detected ${patternsDetected} entity patterns`)

    getDb().exec("VACUUM")
  }

  execSingle("DELETE FROM conversation_arcs WHERE message_count < 2 AND start_time < datetime('now', '-30 days')")
  execSingle("DELETE FROM learning_patterns WHERE confidence < 0.3 AND last_seen < datetime('now', '-90 days')")
  saveDb()

  return { staleRemoved, duplicatesMerged, embeddingsBackfilled, patternsDetected }
}

export function applyMemoryDecay(): void {
  const cfg = getConfig()
  const decayRate = cfg.decay_rate
  const accessBoost = cfg.access_boost

  execSingle(
    `UPDATE memories SET relevance_score = MAX(0.1, relevance_score - ?)
     WHERE last_accessed IS NULL
     AND timestamp < datetime('now', '-7 days')
     AND scope = 'project'`,
    [decayRate]
  )
  execSingle(
    `UPDATE memories SET relevance_score = MAX(0.1, relevance_score - ?)
     WHERE last_accessed < datetime('now', '-30 days')
     AND scope = 'project'`,
    [decayRate * 0.5]
  )
  execSingle(
    `UPDATE memories SET relevance_score = MIN(1.0, relevance_score + ?)
     WHERE last_accessed > datetime('now', '-1 day')`,
    [accessBoost]
  )
  execSingle(
    `UPDATE memories SET importance = MIN(importance + access_count * 0.05, 10)
     WHERE access_count > 5 AND importance < 8 AND last_accessed > datetime('now', '-7 days')`
  )
}
