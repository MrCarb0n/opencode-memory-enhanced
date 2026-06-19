import { tool } from "@opencode-ai/plugin"
import { getOne, getAll, execSingle, now, saveDb, ftsQuery } from "../db"
import { truncate } from "../utils"
import { scoreMemories, hybridSearch } from "../memory"
import { cleanupOrphanEntities } from "../entities"
import { showToast } from "../helpers"
import { embeddingStatus } from "../embeddings"
import type { ToolContext } from "./_shared"

export function createQueryTool(ctx: ToolContext) {
  const { client, sessionId, projectPath } = ctx

  return {
    "memory-query": tool({
      description: "Search, browse, and explore memories and entities. Modes: recall (default) — FTS5+vector search; inject — context injection for a task; browse — paginated memory list with detail/delete; entity — knowledge graph entity search",
      args: {
        mode: tool.schema.string().optional().describe("Operation mode: recall (default), inject, browse, entity"),
        query: tool.schema.string().optional().describe("Search text (recall/inject/entity modes)"),
        task: tool.schema.string().optional().describe("Task description for context injection (inject mode)"),
        limit: tool.schema.number().optional().describe("Max results 1-50 (default 5)"),
        page: tool.schema.number().optional().describe("Page number (browse mode)"),
        type: tool.schema.string().optional().describe("Type filter: user/feedback/project/reference (browse mode)"),
        scope: tool.schema.string().optional().describe("Scope filter: project/global (browse/recall modes)"),
        includeRelationships: tool.schema.boolean().optional().describe("Show relationship edges (entity mode, default true)"),
        depth: tool.schema.number().optional().describe("Traversal depth (entity mode)"),
        detail: tool.schema.number().optional().describe("Memory ID to view full details (browse mode)"),
        delete: tool.schema.number().optional().describe("Memory ID to delete (browse mode)"),
      },
      async execute(args: any) {
        const mode = String(args.mode ?? "recall").toLowerCase()

        if (mode === "inject") {
          const query = String(args.task ?? args.query ?? "")
          if (!query) { showToast(client, "Task required", "warning"); return "(no task provided)" }
          const limit = Math.min(50, Math.max(1, (args.limit as number) || 5))
          const page = Math.max(1, (args.page as number) || 1)
          const offset = (page - 1) * limit
          const status = embeddingStatus()
          let scored: any[]
          if (status.loaded) {
            const hybridResults = await hybridSearch(query, limit + offset, "m.scope = 'project' AND m.relevance_score >= 0.2")
            scored = hybridResults.slice(offset, offset + limit).map((r) => ({ ...r, similarity: r.score }))
          } else {
            scored = await scoreMemories(query, getAll(
              `SELECT m.id, m.content, m.type, m.importance, m.relevance_score, m.tags, m.embedding FROM memories m JOIN memories_fts fts ON m.id = fts.rowid WHERE memories_fts MATCH ? AND m.scope = 'project' AND m.relevance_score >= 0.2 ORDER BY rank LIMIT ? OFFSET ?`,
              [ftsQuery(query), limit, offset]
            ), limit)
          }
          const entities = getAll(`SELECT e.name, e.type, e.description FROM entities e WHERE e.name LIKE ? LIMIT 8`, [`%${query}%`])
          for (const mem of scored) {
            execSingle("UPDATE memories SET access_count = access_count + 1, last_accessed = ?, relevance_score = MIN(1.0, relevance_score + 0.05) WHERE id = ?", [now(), mem.id])
          }
          const searchMode = status.loaded ? "hybrid" : "FTS5"
          if (scored.length > 0) showToast(client, `Injected ${scored.length} memories (${searchMode})`, "success")
          else showToast(client, "No relevant context found", "warning")
          const memStr = scored.length > 0 ? scored.map((r) => `  - [${r.type}|i:${r.importance}|sim:${(r.similarity ?? 0).toFixed(2)}] ${truncate(r.content, 120)}`).join("\n") : "  (none)"
          const entStr = entities.length > 0 ? entities.map((r) => `  - ${r.name} (${r.type})${r.description ? ": " + r.description : ""}`).join("\n") : "  (none)"
          return `Context for "${query}":\n\nMemories:\n${memStr}\n\nEntities:\n${entStr}`
        }

        if (mode === "browse") {
          const page = Math.max(1, (args.page as number) || 1)
          const pageSize = Math.min(50, Math.max(5, (args.limit as number) || 10))
          const typeFilter = String(args.type ?? "")
          const scopeFilter = String(args.scope ?? "")
          const deleteId = (args.delete as number) || 0
          const detailId = (args.detail as number) || 0

          if (deleteId > 0) {
            const mem = getOne("SELECT id, content FROM memories WHERE id = ?", [deleteId])
            if (!mem) { showToast(client, "Memory not found", "error"); return "(not found)" }
            execSingle("DELETE FROM memories WHERE id = ?", [deleteId])
            execSingle("DELETE FROM concept_tags WHERE memory_id = ?", [deleteId])
            cleanupOrphanEntities()
            saveDb()
            showToast(client, `Deleted: ${truncate(mem.content, 40)}`, "success")
            return `Deleted memory #${deleteId}: "${truncate(mem.content, 60)}"`
          }

          if (detailId > 0) {
            const mem = getOne("SELECT id, content, type, scope, importance, relevance_score, access_count, tags, keywords, timestamp, session_id FROM memories WHERE id = ?", [detailId])
            if (!mem) { showToast(client, "Memory not found", "error"); return "(not found)" }
            const entities = getAll("SELECT e.name, e.type FROM entities e JOIN concept_tags ct ON e.id = ct.entity_id WHERE ct.memory_id = ?", [detailId])
            execSingle("UPDATE memories SET access_count = access_count + 1, last_accessed = ? WHERE id = ?", [now(), detailId])
            const lines = [
              `## Memory #${mem.id}`,
              `  Content: ${mem.content}`,
              `  Type: ${mem.type} | Scope: ${mem.scope} | Importance: ${mem.importance}`,
              `  Relevance: ${(mem.relevance_score ?? 0).toFixed(2)} | Accessed: ${mem.access_count}x`,
              `  Tags: ${mem.tags || "(none)"} | Keywords: ${mem.keywords || "(none)"}`,
              `  Created: ${mem.timestamp}`,
            ]
            if (entities.length > 0) lines.push(`  Entities: ${entities.map((e) => `${e.name} (${e.type})`).join(", ")}`)
            lines.push(`\n  To delete: memory-query {mode: browse, delete: ${detailId}}`)
            showToast(client, `Detail: #${mem.id}`, "info")
            return lines.join("\n")
          }

          const searchQuery = String(args.query ?? "")
          let where = "WHERE 1=1"
          const params: any[] = []
          let useFts = false
          if (searchQuery) {
            useFts = true
          } else {
            if (typeFilter) { where += " AND type = ?"; params.push(typeFilter) }
            if (scopeFilter) { where += " AND scope = ?"; params.push(scopeFilter) }
          }
          const offset = (page - 1) * pageSize
          let memories: any[]
          let total: number
          if (useFts) {
            total = getOne(
              `SELECT COUNT(*) as c FROM memories m JOIN memories_fts fts ON m.id = fts.rowid WHERE memories_fts MATCH ?${scopeFilter ? " AND m.scope = ?" : ""}${typeFilter ? " AND m.type = ?" : ""}`,
              [ftsQuery(searchQuery), ...(scopeFilter ? [scopeFilter] : []), ...(typeFilter ? [typeFilter] : [])]
            )?.c ?? 0
            memories = getAll(
              `SELECT m.id, m.content, m.type, m.scope, m.importance, m.access_count FROM memories m JOIN memories_fts fts ON m.id = fts.rowid WHERE memories_fts MATCH ?${scopeFilter ? " AND m.scope = ?" : ""}${typeFilter ? " AND m.type = ?" : ""} ORDER BY rank LIMIT ? OFFSET ?`,
              [ftsQuery(searchQuery), ...(scopeFilter ? [scopeFilter] : []), ...(typeFilter ? [typeFilter] : []), pageSize, offset]
            )
          } else {
            total = getOne(`SELECT COUNT(*) as c FROM memories ${where}`, params)?.c ?? 0
            memories = getAll(`SELECT id, content, type, scope, importance, access_count FROM memories ${where} ORDER BY importance DESC, timestamp DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset])
          }
          const totalPages = Math.max(1, Math.ceil(total / pageSize))
          if (memories.length === 0) {
            showToast(client, "No memories match", "warning")
            return `(no memories) [page ${page}/${totalPages}, total: ${total}]`
          }
          const lines: string[] = []
          if (searchQuery) lines.push(`Search "${searchQuery}" (page ${page}/${totalPages}, total: ${total})`)
          else {
            const filterDesc = [typeFilter && `type=${typeFilter}`, scopeFilter && `scope=${scopeFilter}`].filter(Boolean).join(", ")
            lines.push(`Memories ${filterDesc ? `(${filterDesc}) ` : ""}(page ${page}/${totalPages}, total: ${total})`)
          }
          for (const m of memories) {
            lines.push(`  #${m.id} [${m.type}|${m.scope}|i:${m.importance}|acc:${m.access_count}] ${truncate(m.content, 80)}`)
          }
          lines.push(`\nCommands:`)
          if (page < totalPages) lines.push(`  memory-query {mode: browse, page: ${page + 1}, limit: ${pageSize}}`)
          if (page > 1) lines.push(`  memory-query {mode: browse, page: ${page - 1}, limit: ${pageSize}}`)
          if (searchQuery) lines.push(`  memory-query {mode: browse, query: "${searchQuery}", page: ${page + 1}}`)
          lines.push(`  memory-query {mode: browse, detail: <id>}  — view full details`)
          lines.push(`  memory-query {mode: browse, delete: <id>}  — delete a memory`)
          showToast(client, `Page ${page}/${totalPages}: ${memories.length} memories`, "info")
          return lines.join("\n")
        }

        if (mode === "entity") {
          const query = String(args.query ?? "")
          const includeRelationships = (args.includeRelationships as boolean) !== false
          const entities = getAll("SELECT id, name, type, description, mention_count FROM entities WHERE name LIKE ? ORDER BY mention_count DESC LIMIT 10", [`%${query}%`])
          if (entities.length === 0) return `No entities found for "${query}"`
          const lines: string[] = ["### Entities"]
          for (const entity of entities) {
            lines.push(`  - ${entity.name} (${entity.type}) — ${entity.description || "no description"} [${entity.mention_count} mentions]`)
            if (includeRelationships) {
              const rels = getAll(`SELECT COALESCE(s.name, '(unknown)') as source, r.relationship_type, COALESCE(t.name, '(unknown)') as target, r.confidence FROM relationships r LEFT JOIN entities s ON r.source_entity_id = s.id LEFT JOIN entities t ON r.target_entity_id = t.id WHERE r.source_entity_id = ? OR r.target_entity_id = ? ORDER BY r.confidence DESC LIMIT 10`, [entity.id, entity.id])
              for (const rel of rels) lines.push(`    ${rel.source} --[${rel.relationship_type}|conf:${rel.confidence.toFixed(2)}]--> ${rel.target}`)
            }
          }
          const linkedMemories = getAll(`SELECT m.content, m.type, m.importance FROM memories m JOIN concept_tags ct ON m.id = ct.memory_id WHERE ct.entity_id = ? ORDER BY m.importance DESC LIMIT 5`, [entities[0].id])
          if (linkedMemories.length > 0) {
            lines.push("\n### Linked Memories")
            for (const mem of linkedMemories) lines.push(`  - [${mem.type}|i:${mem.importance}] ${truncate(mem.content, 100)}`)
          }
          return lines.join("\n")
        }

        const query = String(args.query ?? "")
        if (!query) { showToast(client, "Query required", "warning"); return "(no query provided)" }
        const limit = Math.min(50, Math.max(1, (args.limit as number) || 5))
        const page = Math.max(1, (args.page as number) || 1)
        const scope = String(args.scope ?? "all")
        const type = String(args.type ?? "")
        let whereExtra = "m.scope != 'session'"
        if (scope !== "all" && scope !== "all-projects") whereExtra += " AND m.scope = ?"
        if (type) whereExtra += " AND m.type = ?"
        const params: any[] = []
        if (scope !== "all" && scope !== "all-projects") params.push(scope)
        if (type) params.push(type)
        const status = embeddingStatus()
        let scored: any[]
        let total: number
        if (status.loaded) {
          const offset = (page - 1) * limit
          const ftsCount = (getOne(
            `SELECT COUNT(*) as c FROM memories m JOIN memories_fts fts ON m.id = fts.rowid WHERE memories_fts MATCH ? AND ${whereExtra}`,
            [ftsQuery(query), ...params]
          )?.c ?? 0) as number
          const hybridResults = await hybridSearch(query, limit + offset, whereExtra, params)
          total = Math.max(ftsCount, hybridResults.length)
          scored = hybridResults.slice(offset, offset + limit).map((r) => ({ ...r, similarity: r.score }))
        } else {
          const totalRow = getOne(
            `SELECT COUNT(*) as c FROM memories m JOIN memories_fts fts ON m.id = fts.rowid WHERE memories_fts MATCH ? AND ${whereExtra}`,
            [ftsQuery(query), ...params]
          )
          total = totalRow?.c ?? 0
          const offset = (page - 1) * limit
          scored = await scoreMemories(query, getAll(
            `SELECT m.id, m.content, m.type, m.importance, m.relevance_score, m.access_count, m.tags, m.embedding FROM memories m JOIN memories_fts fts ON m.id = fts.rowid WHERE memories_fts MATCH ? AND ${whereExtra} ORDER BY rank LIMIT ? OFFSET ?`,
            [ftsQuery(query), ...params, limit, offset]
          ), limit)
        }
        for (const mem of scored) {
          execSingle("UPDATE memories SET access_count = access_count + 1, last_accessed = ?, relevance_score = MIN(1.0, relevance_score + 0.05) WHERE id = ?", [now(), mem.id])
        }
        const entities = getAll("SELECT name, type, description FROM entities WHERE name LIKE ? LIMIT 5", [`%${query}%`])
        const searchMode = status.loaded ? "hybrid FTS5+vector" : "FTS5-only"
        const parts: string[] = [`Results for "${query}" (page ${page}, ${total} total, ${searchMode}):`]
        if (scored.length > 0) {
          parts.push("Memories:", scored.map((r) => `  - [${r.type}|i:${r.importance}|sim:${(r.similarity ?? 0).toFixed(2)}|acc:${r.access_count}] ${r.content}`).join("\n"))
        }
        if (entities.length > 0) {
          parts.push("\nEntities:", entities.map((r) => `  - ${r.name} (${r.type})${r.description ? ": " + r.description : ""}`).join("\n"))
        }
        if (scored.length === 0 && entities.length === 0) parts.push("  (no matches)")
        if (total > limit) {
          const lastPage = Math.ceil(total / limit)
          if (page < lastPage) parts.push(`\nNext: memory-query {query: "${query}", page: ${page + 1}, limit: ${limit}}`)
        }
        showToast(client, scored.length > 0 ? `${scored.length} matches (${searchMode})` : "No matches", scored.length > 0 ? "info" : "warning")
        return parts.join("\n")
      },
    }),
  }
}
