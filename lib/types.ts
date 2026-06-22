import { getConfig } from "./config"

export type MemoryType = "user" | "feedback" | "project" | "reference"

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
