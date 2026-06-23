import { tool } from "@opencode-ai/plugin"
import { getOne, getAll, execSingle, runInsert, saveDb } from "../db"
import { truncate } from "../utils"
import { addCuratedEntry, replaceCuratedEntry, removeCuratedEntry, getCuratedEntries, getCuratedUsage } from "../curated"
import { scanMemoryContent } from "../security"
import { getConfig } from "../config"
import { showToast } from "../helpers"

export function createCuratedTool(client: any, _projectPath: string) {

  return {
    "memory-curated": tool({
      description: "Manage curated memory stores and approval queue. Modes: list (default) — show entries; add — add entry to agent_note/user_profile; replace — replace matching entry; remove — remove matching entry; approve — approve pending write; reject — reject pending write",
      args: {
        mode: tool.schema.string().optional().describe("Operation mode: list (default), add, replace, remove, approve, reject"),
        store: tool.schema.string().optional().describe("Store name: agent_note or user_profile"),
        content: tool.schema.string().optional().describe("Text content (add/replace modes)"),
        old_text: tool.schema.string().optional().describe("Existing text to match (replace/remove modes)"),
        id: tool.schema.number().optional().describe("Pending write ID (approve/reject modes)"),
      },
      async execute(args: any) {
        const mode = String(args.mode ?? "list").toLowerCase()
        const store = String(args.store ?? "agent_note")
        const content = String(args.content ?? "")
        const oldText = String(args.old_text ?? "")
        const submitId = (args.id as number) || 0

        if (store !== "agent_note" && store !== "user_profile") {
          showToast(client, "store must be 'agent_note' or 'user_profile'", "error")
          return JSON.stringify({ success: false, error: "store must be 'agent_note' or 'user_profile'" })
        }

        if (mode === "approve" || mode === "reject") {
          const action = mode === "approve" ? "approve" : "reject"
          if (!submitId) return JSON.stringify({ success: false, error: "id required" })

          if (action === "reject") {
            const row = getOne(`SELECT id FROM pending_memories WHERE id = ? AND status = 'pending'`, [submitId])
            if (!row) {
              showToast(client, "Pending write not found", "error")
              return JSON.stringify({ success: false, error: "not found" })
            }
            execSingle("UPDATE pending_memories SET status = 'rejected' WHERE id = ?", [submitId])
            saveDb()
            showToast(client, `Rejected #${submitId}`, "info")
            return JSON.stringify({ success: true })
          }

          const row = getOne(`SELECT id, action, store, content, old_text FROM pending_memories WHERE id = ? AND status = 'pending'`, [submitId])
          if (!row) {
            showToast(client, "Pending write not found", "error")
            return JSON.stringify({ success: false, error: "not found" })
          }
          const pStore = row.store as string
          const act = row.action as string
          if (act === "add") {
            const result = addCuratedEntry(pStore as "agent_note" | "user_profile", row.content as string)
            if (!result.success) {
              showToast(client, result.error || "approve failed", "error")
              return JSON.stringify({ success: false, error: result.error })
            }
          } else if (act === "replace") {
            const result = replaceCuratedEntry(pStore as "agent_note" | "user_profile", row.old_text as string, row.content as string)
            if (!result.success) {
              showToast(client, result.error || "approve failed", "error")
              return JSON.stringify({ success: false, error: result.error })
            }
          } else if (act === "remove") {
            const result = removeCuratedEntry(pStore as "agent_note" | "user_profile", row.old_text as string)
            if (!result.success) {
              showToast(client, result.error || "approve failed", "error")
              return JSON.stringify({ success: false, error: result.error })
            }
          }
          execSingle("UPDATE pending_memories SET status = 'approved' WHERE id = ?", [submitId])
          saveDb()
          showToast(client, `Approved ${act} in ${pStore}`, "success")
          return JSON.stringify({ success: true, action: row.action, store: row.store })
        }

        const cfg = getConfig()

        if (mode === "add") {
          if (!content.trim()) {
            showToast(client, "content required", "error")
            return JSON.stringify({ success: false, error: "content required" })
          }
          if (cfg.security_scan) {
            const scan = scanMemoryContent(content)
            if (!scan.safe) {
              showToast(client, `Blocked: ${scan.reason}`, "error", 5000)
              return JSON.stringify({ success: false, error: `Blocked by security scan: ${scan.reason}` })
            }
          }
          if (cfg.write_approval) {
            runInsert("INSERT INTO pending_memories (action, store, content) VALUES ('add', ?, ?)", [store, content])
            saveDb()
            showToast(client, "Staged for approval (write_approval is on)", "info", 5000)
            return JSON.stringify({ success: true, staged: true, message: 'Staged for approval. Use memory-curated {mode:"list"} to review.' })
          }
          const result = addCuratedEntry(store as "agent_note" | "user_profile", content)
          if (!result.success) {
            const usage = getCuratedUsage(store as "agent_note" | "user_profile")
            const entries = getCuratedEntries(store as "agent_note" | "user_profile")
            showToast(client, `Memory full: ${usage.used}/${usage.limit}`, "warning", 5000)
            return JSON.stringify({ success: false, error: result.error, usage: `${usage.used}/${usage.limit}`, current_entries: entries.map((e) => e.content) })
          }
          saveDb()
          showToast(client, `Added to ${store}: ${truncate(content, 40)}`, "success")
          return JSON.stringify({ success: true, id: result.id })
        }

        if (mode === "replace") {
          if (!oldText.trim() || !content.trim()) {
            return JSON.stringify({ success: false, error: "old_text and content required" })
          }
          if (cfg.security_scan) {
            const scan = scanMemoryContent(content)
            if (!scan.safe) {
              showToast(client, `Blocked: ${scan.reason}`, "error", 5000)
              return JSON.stringify({ success: false, error: `Blocked by security scan: ${scan.reason}` })
            }
          }
          if (cfg.write_approval) {
            runInsert("INSERT INTO pending_memories (action, store, content, old_text) VALUES ('replace', ?, ?, ?)", [store, content, oldText])
            saveDb()
            showToast(client, "Staged for approval (write_approval is on)", "info", 5000)
            return JSON.stringify({ success: true, staged: true })
          }
          const result = replaceCuratedEntry(store as "agent_note" | "user_profile", oldText, content)
          if (!result.success) {
            showToast(client, result.error || "replace failed", "error")
            return JSON.stringify({ success: false, error: result.error })
          }
          saveDb()
          showToast(client, `Replaced in ${store}`, "success")
          return JSON.stringify({ success: true })
        }

        if (mode === "remove") {
          if (!oldText.trim()) {
            return JSON.stringify({ success: false, error: "old_text required" })
          }
          if (cfg.write_approval) {
            runInsert("INSERT INTO pending_memories (action, store, old_text) VALUES ('remove', ?, ?)", [store, oldText])
            saveDb()
            showToast(client, "Staged for approval (write_approval is on)", "info", 5000)
            return JSON.stringify({ success: true, staged: true })
          }
          const result = removeCuratedEntry(store as "agent_note" | "user_profile", oldText)
          if (!result.success) {
            showToast(client, result.error || "remove failed", "error")
            return JSON.stringify({ success: false, error: result.error })
          }
          saveDb()
          showToast(client, `Removed from ${store}`, "success")
          return JSON.stringify({ success: true })
        }

        const pending = getAll<{ id: number; action: string; store: string; old_text: string; content: string; created_at: string }>(`SELECT id, action, store, old_text, content, created_at FROM pending_memories WHERE status = 'pending' ORDER BY created_at`)
        const entries = store ? getCuratedEntries(store as "agent_note" | "user_profile") : []
        if (pending.length === 0 && entries.length === 0) {
          showToast(client, "No curated entries or pending writes", "info")
          return "No curated entries or pending writes"
        }
        const parts: string[] = []
        if (entries.length > 0) {
          parts.push(`## ${store} (${entries.length} entries)`)
          for (const e of entries) parts.push(`  - ${e.content}`)
        }
        if (pending.length > 0) {
          parts.push(`\n## Pending (${pending.length} writes)`)
          for (const p of pending) {
            const summary = p.action === "add"
              ? `Add to ${p.store}: "${truncate(p.content, 80)}"`
              : p.action === "replace"
                ? `Replace in ${p.store}: "${truncate(p.old_text, 40)}" -> "${truncate(p.content, 40)}"`
                : `Remove from ${p.store}: "${truncate(p.old_text, 40)}"`
            parts.push(`  #${p.id} ${summary}`)
          }
          parts.push(`\n  memory-curated {mode: approve, id: <n>}  — approve`)
          parts.push(`  memory-curated {mode: reject, id: <n>}   — reject`)
        }
        showToast(client, `${entries.length} entries, ${pending.length} pending`, "info")
        return parts.join("\n")
      },
    }),
  }
}
