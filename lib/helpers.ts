import { existsSync, writeFileSync, readFileSync } from "fs"
import { getAll, execSingle, now } from "./db"
import { extractEntities } from "./entities"
import { semanticSearch } from "./memory"
import { Paths } from "./constants"

export function showToast(client: any, message: string, variant: "info" | "success" | "warning" | "error" = "info", duration = 3000) {
  try { client.tui?.showToast?.({ body: { title: "Memory", message, variant, duration } }) } catch (e) { console.debug("[memory-enhanced] showToast failed:", e) }
}

export function appendPrompt(client: any, text: string) {
  try { client.tui?.appendPrompt?.({ body: { text } }) } catch (e) { console.debug("[memory-enhanced] appendPrompt failed:", e) }
}

function sizeBucketKey(content: string): number {
  return Math.floor(content.length / 20) * 20
}

export function sameBucket(a: string, b: string): boolean {
  return sizeBucketKey(a) === sizeBucketKey(b)
}

export function updateAgentsMd(): void {
  try {
    if (!existsSync(Paths.agentsMd())) return
    const mems = getAll("SELECT content, type, importance, relevance_score FROM memories WHERE scope = 'project' AND importance >= 5 ORDER BY importance DESC, relevance_score DESC LIMIT 5")
    if (mems.length === 0) return

    const block = mems.map((m: any) => `  - [${m.type}|i:${m.importance}] ${m.content.trim().substring(0, 120)}`).join("\n")
    let content = readFileSync(Paths.agentsMd(), "utf8")
    const marker = "<!-- current-memories -->"
    const replacement = `${marker}\n\n## Current Memories\n\n${block}\n`
    const markerIdx = content.indexOf(marker)
    if (markerIdx !== -1) {
      const endOfLine = content.indexOf("\n", markerIdx)
      content = content.substring(0, markerIdx) + replacement + content.substring(endOfLine + 1)
    } else {
      const endMarker = "<!-- memory-enhanced:end -->"
      const endIdx = content.indexOf(endMarker)
      if (endIdx === -1) return
      content = content.substring(0, endIdx) + replacement + "\n" + content.substring(endIdx)
    }
    writeFileSync(Paths.agentsMd(), content, "utf8")
  } catch (e) { console.error("[memory-enhanced] updateAgentsMd error:", e) }
}

export async function buildMemoryContext(userText: string, sessionId: string): Promise<string[]> {
  const parts: string[] = []

  const bm25results = await semanticSearch(userText, 5)
  if (bm25results.length > 0) {
    const items = bm25results.map((r: any) =>
      `  - ${r.content} | ${r.type} | i:${r.importance} | score:${(r.score ?? 0).toFixed(3)} | acc:${r.access_count ?? 0}`
    )
    parts.push(`## Relevant Context\n${items.join("\n")}\n`)

    for (const mem of bm25results) {
      try {
        execSingle("UPDATE memories SET access_count = access_count + 1, last_accessed = ?, relevance_score = MIN(1.0, relevance_score + 0.05) WHERE id = ?", [now(), mem.id])
      } catch {}
    }
  }

  const extracted = extractEntities(userText)
  if (extracted.length > 0) {
    const past = getAll(
      `SELECT DISTINCT e.name, e.description, e.mention_count FROM entities e
       WHERE LOWER(e.name) IN (${extracted.map(() => "?").join(",")})
       AND e.mention_count >= 2 ORDER BY e.mention_count DESC LIMIT 5`,
      extracted.map((e: string) => e.toLowerCase())
    )
    if (past.length > 0) {
      parts.push(`## Previous Context\n${past.map((r: any) => `  - ${r.name}: ${r.description || `mentioned ${r.mention_count}x before`}`).join("\n")}\n`)
    }
  }
  return parts
}


