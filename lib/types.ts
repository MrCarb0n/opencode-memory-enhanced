import { getConfig } from "./config"

export type MemoryType = "user" | "feedback" | "project" | "reference"
export type EpisodeStatus = "active" | "completed" | "failed" | "abandoned"

// ─── Data Types ──────────────────────────────────────────────────
export interface SearchResult {
  id: number
  content: string
  type: string
  scope: string
  importance: number
  relevance_score: number
  access_count: number
  tags: string
  keywords: string
  embedding: string
  score: number
  similarity?: number
  embedding_score?: number
}

export interface Episode {
  id: number
  session_id: string
  project_path: string
  intent: string | null
  intent_embedding: string | null
  status: EpisodeStatus
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  step_count: number
  tool_calls_json: string | null
  files_touched_json: string | null
  entities_json: string | null
  decisions_json: string | null
  patterns_json: string | null
  anti_patterns_json: string | null
  outcome_summary: string | null
  success_score: number | null
  importance: number
  relevance_score: number
  access_count: number
  last_accessed: string | null
  is_global: number
  created_at: string
}

export interface EpisodeStep {
  id: number
  episode_id: number
  step_index: number
  tool_name: string
  args_json: string | null
  result_summary: string | null
  success: number
  duration_ms: number | null
  timestamp: string
}

export interface EpisodeState {
  id: number | null
  sessionId: string
  projectPath: string
  intent: string | null
  steps: EpisodeStepInput[]
  startTime: number
  filesTouched: Set<string>
  entities: Set<string>
}

export interface EpisodeStepInput {
  tool: string
  args: Record<string, any>
  result: any
  success: boolean
  durationMs: number
  timestamp: string
}

export interface SynthesizedEpisode {
  intent: string
  decisions: Array<{decision: string; rationale: string; confidence: number}>
  patterns: Array<{pattern: string; type: 'success' | 'failure' | 'anti'; applicability: string}>
  anti_patterns: string[]
  outcome_summary: string
  success_score: number
  key_entities: string[]
  tags: string[]
}

export function parsePattern(expr: string): RegExp | null {
  try {
    const m = expr.match(/^\/(.+)\/([gimsu]*)$/)
    if (m) return new RegExp(m[1], m[2])
    return new RegExp(expr)
  } catch {
    return null
  }
}

export function shouldNotSave(text: string): boolean {
  return getConfig().dont_save_patterns.some((p) => parsePattern(p)?.test(text))
}

export function detectMemoryType(text: string): MemoryType {
  const cfg = getConfig()
  for (const [type, patterns] of Object.entries(cfg.memory_type_patterns)) {
    if (patterns.some((p) => parsePattern(p)?.test(text))) return type as MemoryType
  }
  return "project"
}

export function isImportantMessage(text: string): boolean {
  if (text.length < 10 || text.length > 500) return false
  if (shouldNotSave(text)) return false
  return getConfig().auto_remember_patterns.some((p) => parsePattern(p)?.test(text))
}

export function extractImportance(text: string): number {
  for (const { pattern, score } of getConfig().importance_patterns) {
    const re = parsePattern(pattern)
    if (re?.test(text)) return score
  }
  return 5
}
