import { getOne, getAll, runInsert, execSingle, now, searchFts5 } from "./db"
import { cosineSimilarity as textCosSim, tokenize } from "./utils"
import { extractEntities, generateAutoTags, linkEntity, discoverRelationships, autoLinkMemories } from "./entities"
import { isImportantMessage, extractImportance, detectMemoryType, type SearchResult } from "./types"
import { getConfig } from "./config"
import { Tables } from "./constants"
import { embed, vectorCosineSimilarity, serializeEmbedding, deserializeEmbedding, embeddingStatus } from "./embeddings"
import { showToast } from "./helpers"

const M = Tables.memories

export const pendingEmbeds: Promise<unknown>[] = []
const PENDING_EMBEDS_MAX = 5

// ─── Embedding-backed precomputeVector ────────────────────────────
// Generates a semantic embedding via random projection of TF-IDF features.
// Falls back to TF-IDF frequency vector if model unavailable.
export async function precomputeVector(content: string, onProgress?: (pct: number) => void): Promise<string> {
  const cfg = getConfig()
  if (cfg.enable_vectors) {
    const vec = await embed(content, onProgress)
    if (vec.length > 0) return serializeEmbedding(vec)
  }
  // Fallback: TF-IDF frequency vector (legacy)
  const tokens = tokenize(content.toLowerCase())
  const freq: Record<string, number> = {}
  for (const t of tokens) freq[t] = (freq[t] ?? 0) + 1
  const words = Object.keys(freq)
  if (words.length === 0) return ""
  const norm = Math.sqrt(words.reduce((sum, w) => sum + freq[w] * freq[w], 0))
  for (const w of words) freq[w] /= norm
  return JSON.stringify(freq)
}

// ─── Vector Similarity Search ─────────────────────────────────────
async function vectorSearch(
  query: string,
  limit = 10,
  whereExtra = "",
  params: unknown[] = []
): Promise<SearchResult[]> {
  const status = embeddingStatus()
  if (!status.loaded) return []

  const queryVec = await embed(query)
  if (queryVec.length === 0) return []

  // Load all memories with embeddings
  // Strip table alias prefixes (e.g. "m.scope" -> "scope") — vector query has no alias
  const cleanExtra = whereExtra.replace(/\bm\.[a-zA-Z_]+/g, (match) => match.replace("m.", ""))
  const whereClause = cleanExtra ? `AND ${cleanExtra}` : ""
  const rows = getAll(
    `SELECT id, content, type, scope, importance, relevance_score, access_count, tags, keywords, embedding
     FROM "${M}" WHERE embedding != '' AND embedding IS NOT NULL ${whereClause} ORDER BY timestamp DESC LIMIT 2000`,
    params
  )

  const scored = rows
    .map((r) => {
      const memVec = deserializeEmbedding(r.embedding as string)
      if (memVec.length === 0) return null
      return {
        ...r,
        embedding_score: vectorCosineSimilarity(queryVec, memVec),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.embedding_score - a.embedding_score)
    .slice(0, limit)

  return scored as SearchResult[]
}

// ─── Hybrid Search (FTS5 + Vector) ────────────────────────────────
// Combines keyword FTS5 results with neural vector results.
// Uses Reciprocal Rank Fusion (RRF) to merge rankings.
export async function hybridSearch(
  query: string,
  limit = 10,
  whereExtra = "",
  params: unknown[] = []
): Promise<SearchResult[]> {
  const k = 60 // RRF constant

  // Run FTS5 + vector search in parallel
  const [ftsResults, vecResults] = await Promise.all([
    Promise.resolve(searchFts5(query, limit * 2, whereExtra, params)),
    vectorSearch(query, limit * 2, whereExtra, params),
  ])

  // Merge via RRF
  const rrfScores = new Map<number, { ftsRank: number; vecRank: number; row: SearchResult }>()

  for (let i = 0; i < ftsResults.length; i++) {
    const r = ftsResults[i] as unknown as SearchResult
    rrfScores.set(r.id, { ftsRank: i + 1, vecRank: Infinity, row: r })
  }

  for (let i = 0; i < vecResults.length; i++) {
    const r = vecResults[i]
    if (rrfScores.has(r.id)) {
      rrfScores.get(r.id)!.vecRank = i + 1
    } else {
      rrfScores.set(r.id, { ftsRank: Infinity, vecRank: i + 1, row: r })
    }
  }

  const merged = Array.from(rrfScores.values())
    .map(({ ftsRank, vecRank, row }) => ({
      ...row,
      score: 1 / (k + ftsRank) + 1 / (k + vecRank),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return merged
}

export function autoRemember(client: any, text: string, sessionId: string, projectPath: string): void {
  const cfg = getConfig()
  if (!cfg.auto_remember) return
  if (!isImportantMessage(text)) return

  const clean = text.substring(0, cfg.max_memory_length).trim()
  const importance = extractImportance(clean)
  const memoryType = detectMemoryType(clean)
  const keywords = extractEntities(clean).join(",").toLowerCase()
  const autoTags = generateAutoTags(clean).join(",")

  const existing = getOne(
    `SELECT id, importance, access_count FROM "${M}" WHERE content = ?`,
    [clean]
  )
  if (existing) {
    const boosted = Math.min((existing.importance as number) + 1, 10)
    execSingle(
      `UPDATE "${M}" SET importance = ?, access_count = access_count + 1, last_accessed = ? WHERE id = ?`,
      [boosted, now(), existing.id]
    )
    return
  }

  const duplicate = getOne(
    `SELECT id, content FROM "${M}" WHERE scope = 'project' AND type = ? ORDER BY id DESC LIMIT 1`,
    [memoryType]
  )
  if (duplicate && textCosSim(clean, duplicate.content as string) > 0.8) {
    const dupImportance = (getOne(`SELECT importance FROM "${M}" WHERE id = ?`, [duplicate.id])?.importance as number) || importance
    const boosted = Math.min(dupImportance + 1, 10)
    execSingle(
      `UPDATE "${M}" SET access_count = access_count + 1, last_accessed = ?, importance = MAX(importance, ?) WHERE id = ?`,
      [now(), boosted, duplicate.id]
    )
    return
  }

const memoryId = runInsert(
     `INSERT INTO "${M}" (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path) VALUES (?, ?, 'project', ?, ?, 0.5, ?, ?, ?)`,
     [clean, memoryType, importance, sessionId, keywords, autoTags, projectPath]
   )
  linkEntity(clean, memoryId, projectPath)
  discoverRelationships(memoryId)
  autoLinkMemories(memoryId)

  // Generate embedding async (non-blocking) with progress toast
  showToast(client, "Memory: indexing...", "info", 0)
  const p = precomputeVector(clean, (pct) => {
    showToast(client, `Memory: indexing ${pct}%`, "info", 2000)
  }).then((emb) => {
    if (memoryId > 0 && emb) execSingle(`UPDATE "${M}" SET embedding = ? WHERE id = ?`, [emb, memoryId])
    showToast(client, `Memory: ${clean.substring(0, 40)}`, "success", 2000)
  }).catch((e) => console.debug("[memory-enhanced] embedding failed:", e))

  // Cap pending embeddings to prevent unbounded growth
  if (pendingEmbeds.length >= PENDING_EMBEDS_MAX) {
    pendingEmbeds.shift() // FIFO eviction
  }
  pendingEmbeds.push(p)
  p.finally(() => { const i = pendingEmbeds.indexOf(p); if (i >= 0) pendingEmbeds.splice(i, 1) })
}

export { applyMemoryDecay } from "./optimize"

export async function scoreMemories(query: string, memories: any[], limit: number): Promise<SearchResult[]> {
  const status = embeddingStatus()
  let queryVec: number[] = []
  if (status.loaded) {
    queryVec = await embed(query)
  }

  const scored = memories
    .map((r) => {
      let similarity: number
      if (queryVec.length > 0) {
        const memVec = deserializeEmbedding(r.embedding)
        if (memVec.length > 0) {
          similarity = vectorCosineSimilarity(queryVec, memVec)
        } else {
          similarity = textCosSim(query, `${r.content} ${r.tags ?? ""} ${r.keywords ?? ""}`)
        }
      } else {
        similarity = textCosSim(query, `${r.content} ${r.tags ?? ""} ${r.keywords ?? ""}`)
      }
      return { ...r, similarity }
    })
    .sort(
      (a, b) =>
        (b.similarity * 0.6 + b.importance / 10 * 0.4) -
        (a.similarity * 0.6 + a.importance / 10 * 0.4)
    )
    .slice(0, limit)
  return scored as SearchResult[]
}
