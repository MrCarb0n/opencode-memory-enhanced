import { existsSync, writeFileSync, readFileSync } from "fs"
import { getAll } from "./db"
import { Paths } from "./constants"

export function showToast(client: any, message: string, variant: "info" | "success" | "warning" | "error" = "info", duration = 3000, id?: string) {
  setTimeout(() => {
    try { client.tui?.showToast?.({ body: { title: "Memory", message, variant, duration, ...(id ? { id } : {}) } }) } catch (e) { console.debug("[memory-enhanced] showToast failed:", e) }
  }, 0)
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

