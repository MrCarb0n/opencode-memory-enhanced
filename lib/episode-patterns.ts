import { getAll, getOne, runInsert, execSingle, now } from "./db"
import { Tables } from "./constants"
import { getConfig } from "./config"
import { embed, serializeEmbedding, deserializeEmbedding, vectorCosineSimilarity } from "./embeddings"

const EP = Tables.episodes
const M = Tables.memories
const LP = Tables.learningPatterns

export async function clusterEpisodes(projectPath?: string): Promise<number> {
  const cfg = getConfig()
  if (!cfg.global_pattern_learning) return 0

  const where = projectPath && cfg.cross_project_sharing
    ? `WHERE (project_path = ? OR project_path = 'global')`
    : projectPath
      ? `WHERE project_path = ?`
      : `WHERE project_path = 'global'`

  const params = projectPath ? [projectPath] : []

  const episodes: any[] = getAll(
    `SELECT id, intent, intent_embedding, success_score, step_count, patterns_json, anti_patterns_json, decisions_json, outcome_summary
     FROM "${EP}" ${where} AND status = 'completed' AND intent IS NOT NULL AND success_score >= 0.6
     ORDER BY importance DESC LIMIT 500`,
    params
  )

  if (episodes.length < 3) return 0

  const vectors: Array<{ id: number; vec: number[]; episode: any }> = []
  for (const e of episodes) {
    const vec = deserializeEmbedding(e.intent_embedding || "")
    if (vec.length > 0) {
      vectors.push({ id: e.id as number, vec, episode: e })
    }
  }

  if (vectors.length < 3) return 0

  const clusters = simpleCluster(vectors, 5)
  let metaCount = 0

  for (const cluster of clusters) {
    if (cluster.length < 3) continue

    const patternText = `Meta-pattern (${cluster.length} episodes): ${cluster.map(c => c.episode.intent).join(" | ")}`
    const existing = getOne(`SELECT id FROM "${LP}" WHERE pattern_text = ?`, [patternText])

    if (existing) {
      execSingle(
        `UPDATE "${LP}" SET occurrences = occurrences + 1, last_seen = ?, confidence = MIN(1.0, confidence + 0.1) WHERE id = ?`,
        [now(), existing.id]
      )
    } else {
      const avgIntent = averageVector(cluster.map(c => c.vec))
      const serialized = serializeEmbedding(avgIntent)

      runInsert(
        `INSERT INTO "${LP}" (pattern_text, pattern_type, confidence, occurrences, project_path)
         VALUES (?, 'meta_pattern', ?, ?, ?)`,
        [patternText, Math.min(0.9, 0.3 + cluster.length * 0.1), cluster.length, projectPath || 'global']
      )

      const content = `[Meta-Pattern] ${cluster.length} episodes share similar intent.`
      execSingle(
        `INSERT INTO "${M}" (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path, embedding)
         VALUES (?, 'reference', 'project', 8, ?, 0.9, ?, 'meta-pattern', 'global', ?)`,
        [content, `cluster-${Date.now()}`, patternText, serialized]
      )
      metaCount++
    }
  }

  return metaCount
}

function simpleCluster(
  vectors: Array<{ id: number; vec: number[]; episode: any }>,
  maxClusters: number
): Array<Array<{ id: number; vec: number[]; episode: any }>> {
  if (vectors.length === 0) return []

  const clusters: Array<Array<typeof vectors[0]>> = []
  const assigned = new Set<number>()

  for (let seed = 0; seed < vectors.length && clusters.length < maxClusters; seed++) {
    if (assigned.has(seed)) continue

    const centroid = vectors[seed]
    const cluster: typeof vectors = [centroid]
    assigned.add(seed)

    for (let j = seed + 1; j < vectors.length; j++) {
      if (assigned.has(j)) continue
      const sim = vectorCosineSimilarity(centroid.vec, vectors[j].vec)
      if (sim > 0.7) {
        cluster.push(vectors[j])
        assigned.add(j)
      }
    }

    if (cluster.length >= 2) clusters.push(cluster)
  }

  return clusters
}

function averageVector(vecs: number[][]): number[] {
  if (vecs.length === 0) return []
  const dims = vecs[0].length
  const avg = new Array(dims).fill(0)
  for (const v of vecs) {
    for (let i = 0; i < Math.min(dims, v.length); i++) {
      avg[i] += v[i]
    }
  }
  const norm = Math.sqrt(avg.reduce((s, x) => s + x * x, 0))
  if (norm > 0) {
    for (let i = 0; i < dims; i++) avg[i] /= norm
  }
  return avg
}
