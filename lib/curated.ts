import { getOne, getAll, execSingle, runInsert } from "./db"
import { Tables, CURATED_STORE_LIMITS, type CuratedStore } from "./constants"

const CS = Tables.curatedStore

export function getCuratedEntries(store: CuratedStore): { id: number; content: string }[] {
  const rows = getAll(`SELECT id, content FROM "${CS}" WHERE store = ? ORDER BY id`, [store])
  return rows.map((r) => ({ id: r.id as number, content: r.content as string }))
}

export function getCuratedUsage(store: CuratedStore): { used: number; limit: number; pct: number } {
  const entries = getCuratedEntries(store)
  const used = entries.reduce((sum, e) => sum + e.content.length + 3, 0) // +3 for "§\n" delimiters
  const limit = CURATED_STORE_LIMITS[store]
  return { used, limit, pct: Math.round((used / limit) * 100) }
}

export function addCuratedEntry(store: CuratedStore, content: string): { success: boolean; error?: string; id?: number } {
  const usage = getCuratedUsage(store)
  if (usage.used + content.length + 3 > usage.limit) {
    return { success: false, error: `${store} at ${usage.used}/${usage.limit} chars. Adding this entry would exceed the limit. Use memory-replace to consolidate.` }
  }
  const existing = getOne(`SELECT id FROM "${CS}" WHERE store = ? AND content = ?`, [store, content])
  if (existing) {
    return { success: true, id: existing.id as number }
  }
  const id = runInsert(`INSERT INTO "${CS}" (store, content) VALUES (?, ?)`, [store, content])
  return { success: true, id }
}

export function replaceCuratedEntry(store: CuratedStore, oldText: string, newContent: string): { success: boolean; error?: string } {
  const entries = getCuratedEntries(store)
  const matching = entries.filter((e) => e.content.includes(oldText))
  if (matching.length === 0) {
    return { success: false, error: `No entry in ${store} contains "${oldText.substring(0, 50)}"` }
  }
  if (matching.length > 1) {
    return { success: false, error: `"${oldText.substring(0, 50)}" matches ${matching.length} entries. Use more specific text.` }
  }
  const usage = getCuratedUsage(store)
  const existingTotal = usage.used
  const oldLen = matching[0].content.length
  const newTotal = existingTotal - oldLen + newContent.length
  const limit = CURATED_STORE_LIMITS[store]
  if (newTotal > limit) {
    return { success: false, error: `Replacement would exceed ${limit} char limit (${newTotal}/${limit}). Shorten the new content.` }
  }
  execSingle(`UPDATE "${CS}" SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newContent, matching[0].id])
  return { success: true }
}

export function removeCuratedEntry(store: CuratedStore, oldText: string): { success: boolean; error?: string } {
  const entries = getCuratedEntries(store)
  const matching = entries.filter((e) => e.content.includes(oldText))
  if (matching.length === 0) {
    return { success: false, error: `No entry in ${store} contains "${oldText.substring(0, 50)}"` }
  }
  if (matching.length > 1) {
    return { success: false, error: `"${oldText.substring(0, 50)}" matches ${matching.length} entries. Use more specific text.` }
  }
  execSingle(`DELETE FROM "${CS}" WHERE id = ?`, [matching[0].id])
  return { success: true }
}

export function buildCuratedBlock(): string {
  const parts: string[] = []
  const agentEntries = getCuratedEntries("agent_note")
  if (agentEntries.length > 0) {
    const usage = getCuratedUsage("agent_note")
    const content = agentEntries.map((e) => e.content).join("\n§\n")
    parts.push(`══════════════════ MEMORY (your personal notes) [${usage.pct}% — ${usage.used}/${usage.limit} chars] ══════════════════\n${content}`)
  }
  const userEntries = getCuratedEntries("user_profile")
  if (userEntries.length > 0) {
    const usage = getCuratedUsage("user_profile")
    const content = userEntries.map((e) => e.content).join("\n§\n")
    parts.push(`\n══════════════════ USER PROFILE [${usage.pct}% — ${usage.used}/${usage.limit} chars] ══════════════════\n${content}`)
  }
  return parts.join("\n\n")
}
