import { getAll, getOne } from "./db"
import { Tables } from "./constants"
import { getConfig } from "./config"
import { embed, serializeEmbedding, deserializeEmbedding, vectorCosineSimilarity } from "./embeddings"

const EP = Tables.episodes

function formatEpisodeForContext(e: any): string {
  let patterns = ""
  try {
    const parsed = JSON.parse(e.patterns_json || "[]")
    if (parsed.length > 0) patterns = `  Pattern: ${parsed[0].pattern}`
  } catch { }

  let anti = ""
  try {
    const parsed = JSON.parse(e.anti_patterns_json || "[]")
    if (parsed.length > 0) anti = `  Avoid: ${parsed.slice(0, 2).join("; ")}`
  } catch { }

  let decisions = ""
  try {
    const parsed = JSON.parse(e.decisions_json || "[]")
    if (parsed.length > 0) decisions = `  Decision: ${parsed[0].decision}`
  } catch { }

  return [
    `[Episode|i:${e.importance}|score:${e.success_score ?? "?"}] ${e.intent ?? "(unknown intent)"}`,
    `  Outcome: ${e.outcome_summary ?? "N/A"}`,
    patterns,
    anti,
    decisions,
  ].filter(Boolean).join("\n")
}

export async function searchEpisodes(query: string, limit = 5, projectPath?: string): Promise<any[]> {
  const queryVec = await embed(query)
  if (queryVec.length === 0) return []

  const where = projectPath
    ? `(project_path = ? OR project_path = 'global')`
    : projectPath
      ? `project_path = ?`
      : `project_path = 'global'`

  const rows = getAll(
    `SELECT id, session_id, project_path, intent, intent_embedding, status, outcome_summary, success_score, importance, step_count, completed_at, patterns_json, anti_patterns_json, decisions_json
     FROM "${EP}"
     WHERE ${where} AND status = 'completed' AND intent_embedding IS NOT NULL AND intent_embedding != ''
     ORDER BY importance DESC
     LIMIT 200`,
    projectPath ? [projectPath] : []
  )

  const scored = rows
    .map((r: any) => {
      const vec = deserializeEmbedding(r.intent_embedding as string)
      if (vec.length === 0) return null
      const score = vectorCosineSimilarity(queryVec, vec) * 0.7 + (r.importance / 10) * 0.3
      return { ...r, similarity: score }
    })
    .filter((r: any): r is NonNullable<typeof r> => r !== null)
    .sort((a: any, b: any) => b.similarity - a.similarity)
    .slice(0, limit)

  return scored
}

export async function injectEpisodeContext(query: string, budget: number, projectPath?: string): Promise<string> {
  const episodes = await searchEpisodes(query, 3, projectPath)
  if (episodes.length === 0) return ""

  const blocks = episodes.map(formatEpisodeForContext)
  const block = `\n# Relevant Episodes\n${blocks.join("\n\n")}\n`
  return block.length <= budget ? block : ""
}


