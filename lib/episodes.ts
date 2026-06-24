import { getOne, getAll, runInsert, execSingle, now } from "./db"
import { Tables } from "./constants"
import { getConfig } from "./config"
import { type EpisodeState, type EpisodeStepInput } from "./types"
import { embed, serializeEmbedding } from "./embeddings"

const EP = Tables.episodes
const ES = Tables.episodeSteps

const SANITIZE_RE = /\b(key|secret|token|password|api_key|apikey|auth|credential|private_key)\b.*?(['"][^'"]+['"]|\S+)/gi

const activeEpisodes = new Map<string, EpisodeState>()

function sanitize(value: unknown): string {
  if (!value) return ""
  return String(value).replace(SANITIZE_RE, "$1: ***")
}

function sanitizeArgs(args: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(args)) {
    out[k] = sanitize(v)
  }
  return out
}

export function onToolStart(sessionId: string, tool: string, args: any): void {
  const cfg = getConfig()
  if (!cfg.tracked_tools.includes(tool)) return

  let state = activeEpisodes.get(sessionId)
  if (!state) {
    state = {
      id: null,
      sessionId,
      projectPath: args.project_path || args.workdir || "global",
      intent: null,
      steps: [],
      startTime: Date.now(),
      filesTouched: new Set(),
      entities: new Set(),
    }
    activeEpisodes.set(sessionId, state)
  }

  if (args.filePath) state.filesTouched.add(args.filePath)
  if (args.pattern) state.filesTouched.add(args.pattern)
  if (args.command && args.command.length > 5) {
    const cmds = args.command.match(/\b\w{4,}\b/g) || []
    for (const c of cmds) state.entities.add(c)
  }
  if (args.filePath) {
    const parts = args.filePath.split(/[/\\]/)
    for (const p of parts) {
      if (p.length >= 3 && /^[A-Z]/.test(p)) state.entities.add(p)
    }
  }
}

export function onToolEnd(sessionId: string, tool: string, args: any, result: any, error?: Error): void {
  const cfg = getConfig()
  if (!cfg.tracked_tools.includes(tool)) return

  const state = activeEpisodes.get(sessionId)
  if (!state) return

  const step: EpisodeStepInput = {
    tool,
    args: sanitizeArgs(args || {}),
    result: error ? `ERROR: ${error.message}` : summarizeResult(result),
    success: !error,
    durationMs: Date.now() - state.startTime,
    timestamp: now(),
  }
  state.steps.push(step)

  if (error) {
    state.entities.add("error")
    state.entities.add(tool)
  }
}

function summarizeResult(result: any): string {
  if (!result) return "ok"
  const s = String(result).trim()
  if (s.length <= 200) return s
  return s.substring(0, 200) + "..."
}

export async function detectBoundary(sessionId: string, userText: string): Promise<number> {

  const state = activeEpisodes.get(sessionId)
  if (!state || state.steps.length === 0) return 0

  let score = 0

  const doneWords = /\b(done|finished|complete|completed|ready|that's? it|all set|good)\b/i
  if (doneWords.test(userText)) score += 0.4

  const newTaskWords = /\b(now |next |let's |i want |i need |start |create |add |fix |change |implement)\b/i
  if (newTaskWords.test(userText) && state.steps.length > 3) score += 0.3

  const topicShift = state.steps.length > 5 && userText.length > 20
  if (topicShift) score += 0.15

  if (score >= 0.5) return score

  const lastMsg = state.intent
  if (lastMsg && lastMsg.length > 10 && userText.length > 10) {
    const overlap = tokens(lastMsg).filter(t => tokens(userText).includes(t)).length
    const maxLen = Math.max(tokens(lastMsg).length, tokens(userText).length)
    if (maxLen > 0 && overlap / maxLen < 0.15 && state.steps.length >= 3) {
      score += 0.2
    }
  }

  state.intent = userText
  return score
}

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean)
}

export function abortEpisode(sessionId: string): void {
  const state = activeEpisodes.get(sessionId)
  if (!state) return
  if (state.id) {
    execSingle(`UPDATE "${EP}" SET status = 'abandoned', completed_at = ? WHERE id = ?`, [now(), state.id])
  }
  activeEpisodes.delete(sessionId)
}

export async function finalizeEpisode(sessionId: string, projectPath: string): Promise<number | null> {
  const state = activeEpisodes.get(sessionId)
  if (!state || state.steps.length === 0) return null

  const stepCount = state.steps.length
  const duration = Date.now() - state.startTime
  const filesJson = JSON.stringify(Array.from(state.filesTouched))
  const entitiesJson = JSON.stringify(Array.from(state.entities))

  const episodeId = runInsert(
    `INSERT INTO "${EP}" (session_id, project_path, status, started_at, completed_at, duration_ms, step_count, files_touched_json, entities_json)
     VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?)`,
    [sessionId, projectPath || "global", new Date(state.startTime).toISOString(), now(), duration, stepCount, filesJson, entitiesJson]
  )

  for (let i = 0; i < state.steps.length; i++) {
    const s = state.steps[i]
    runInsert(
      `INSERT INTO "${ES}" (episode_id, step_index, tool_name, args_json, result_summary, success, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [episodeId, i, s.tool, JSON.stringify(s.args), s.result, s.success ? 1 : 0, s.durationMs]
    )
  }

  activeEpisodes.delete(sessionId)
  return episodeId
}

export function getActiveEpisode(sessionId: string): EpisodeState | null {
  return activeEpisodes.get(sessionId) ?? null
}

export function getEpisode(id: number): any {
  return getOne(`SELECT * FROM "${EP}" WHERE id = ?`, [id])
}

export async function updateEpisodeEmbedding(id: number, intent: string): Promise<void> {
  const vec = await embed(intent)
  if (vec.length > 0) {
    execSingle(`UPDATE "${EP}" SET intent_embedding = ? WHERE id = ?`, [serializeEmbedding(vec), id])
  }
}

export function updateEpisode(episodeId: number, data: Record<string, any>): void {
  const keys = Object.keys(data)
  if (keys.length === 0) return
  const setClause = keys.map(k => {
    if (k === 'intent_embedding') return `${k} = ?`
    return `${k} = ?`
  }).join(", ")
  const values = keys.map(k => data[k])
  execSingle(`UPDATE "${EP}" SET ${setClause} WHERE id = ?`, [...values, episodeId])
}

export function getRecentEpisodes(limit = 10, projectPath?: string): any[] {
  const where = projectPath ? `WHERE project_path = ? OR project_path = 'global'` : `WHERE project_path = 'global'`
  const params = projectPath ? [projectPath] : []
  return getAll(
    `SELECT id, session_id, project_path, intent, status, outcome_summary, success_score, importance, step_count, duration_ms, completed_at, patterns_json, anti_patterns_json, decisions_json
     FROM "${EP}" ${where} AND status = 'completed' AND intent IS NOT NULL
     ORDER BY importance DESC, completed_at DESC LIMIT ?`,
    [...params, limit]
  )
}

export function getEpisodeCount(): number {
  return (getOne<{ c: number }>(`SELECT COUNT(*) as c FROM "${EP}"`)?.c) ?? 0
}
