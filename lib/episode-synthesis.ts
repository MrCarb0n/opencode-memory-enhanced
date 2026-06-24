import { getOne, execSingle } from "./db"
import { Tables } from "./constants"
import { getConfig } from "./config"
import { getEpisode, updateEpisode } from "./episodes"
import { embed, serializeEmbedding } from "./embeddings"
import { type SynthesizedEpisode } from "./types"

const EP = Tables.episodes
const M = Tables.memories

function buildPrompt(episode: any): string {
  let toolCalls = ""
  try {
    const calls = JSON.parse(episode.tool_calls_json || "[]")
    toolCalls = calls.map((c: any, i: number) =>
      `  ${i + 1}. ${c.tool}: ${JSON.stringify(c.args).substring(0, 150)} → ${String(c.result).substring(0, 100)}`
    ).join("\n")
  } catch { toolCalls = "(unavailable)" }

  let files = ""
  try {
    files = JSON.parse(episode.files_touched_json || "[]").join(", ")
  } catch { files = "(unavailable)" }

  let entities = ""
  try {
    entities = JSON.parse(episode.entities_json || "[]").join(", ")
  } catch { entities = "(unavailable)" }

  return `
Analyze this completed coding task and extract structured learnings.

## Episode Data
- Duration: ${episode.duration_ms || "?"}ms
- Steps: ${episode.step_count || 0}
- Files: ${files}
- Entities: ${entities}

## Tool Trace
${toolCalls}

## Instructions
Extract the following as JSON only (no other text):

{
  "intent": "one-line summary of what the user wanted to accomplish",
  "decisions": [
    {"decision": "specific choice made", "rationale": "why", "confidence": 0-1}
  ],
  "patterns": [
    {"pattern": "reusable approach", "type": "success|failure|anti", "applicability": "when to use"}
  ],
  "anti_patterns": ["things to avoid"],
  "outcome_summary": "1-2 sentence outcome",
  "success_score": 0.0-1.0,
  "key_entities": ["entity"],
  "tags": ["tag"]
}

Rules:
- Decisions: only explicit choices with rationale
- Patterns: generalizable approaches, not one-off steps
- Anti-patterns: specific mistakes or dead-ends
- Success: 1.0=fully achieved, 0.5=partial, 0.0=failed
- Max 5 per array, be concise
`.trim()
}

function parseJSON(text: string): SynthesizedEpisode | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    return JSON.parse(jsonMatch[0])
  } catch { return null }
}

export async function synthesizeEpisode(episodeId: number, callLLM: (prompt: string) => Promise<string>): Promise<void> {
  const cfg = getConfig()
  if (!cfg.synthesis_enabled) return

  const episode = getEpisode(episodeId)
  if (!episode || episode.intent) return

  try {
    const prompt = buildPrompt(episode)
    const response = await callLLM(prompt)
    const parsed = parseJSON(response)
    if (!parsed) return

    const updates: Record<string, any> = {
      intent: parsed.intent,
      outcome_summary: parsed.outcome_summary,
      success_score: parsed.success_score,
      decisions_json: JSON.stringify(parsed.decisions),
      patterns_json: JSON.stringify(parsed.patterns),
      anti_patterns_json: JSON.stringify(parsed.anti_patterns),
      entities_json: JSON.stringify(parsed.key_entities),
      importance: parsed.success_score > 0.7 ? 8 : 5,
    }

    updateEpisode(episodeId, updates)

    const vec = await embed(parsed.intent)
    if (vec.length > 0) {
      execSingle(`UPDATE "${EP}" SET intent_embedding = ? WHERE id = ?`, [serializeEmbedding(vec), episodeId])
    }

    if (parsed.success_score >= cfg.pattern_promotion_threshold) {
      for (const p of parsed.patterns) {
        if (p.type === "success") {
          const content = `[Pattern] ${p.pattern} — ${p.applicability}`
          execSingle(
            `INSERT INTO "${M}" (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path)
             VALUES (?, 'reference', 'project', 8, ?, 0.8, ?, 'pattern', 'global')`,
            [`ep-${episodeId}`, content, p.type]
          )
        }
      }
    }
  } catch { }
}
