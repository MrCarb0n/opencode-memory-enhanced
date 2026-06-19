import { tool } from "@opencode-ai/plugin"
import { getOne, getAll, execSingle, runInsert, now, saveDb, transaction } from "../db"
import { truncate } from "../utils"
import { generateAutoTags, linkEntity, discoverRelationships, autoLinkMemories } from "../entities"
import { precomputeVector } from "../memory"
import { showToast } from "../helpers"
import type { ToolContext } from "./_shared"

export function createStoreTool(ctx: ToolContext) {
  const { client, sessionId, projectPath } = ctx

  return {
    "memory-store": tool({
      description: "Store memories, import data, and manage procedural skills. Modes: store (default) — save with auto-tags/entities; import — bulk import from JSON export; skill — manage procedural skills (add/apply/list)",
      args: {
        mode: tool.schema.string().optional().describe("Operation mode: store (default), import, skill"),
        content: tool.schema.string().optional().describe("Memory text content (store mode) or skill content (skill add mode)"),
        type: tool.schema.string().optional().describe("Memory type: user/feedback/project/reference (default conversation)"),
        scope: tool.schema.string().optional().describe("Scope: project or global (default project)"),
        importance: tool.schema.number().optional().describe("Priority score 1-10 (default 5)"),
        keywords: tool.schema.string().optional().describe("Comma-separated keywords"),
        tags: tool.schema.string().optional().describe("Comma-separated tags"),
        json: tool.schema.string().optional().describe("Full JSON export string (import mode)"),
        action: tool.schema.string().optional().describe("Skill action: add, apply, or list (skill mode)"),
        name: tool.schema.string().optional().describe("Skill name (skill add mode)"),
        description: tool.schema.string().optional().describe("Skill description (skill add mode)"),
        category: tool.schema.string().optional().describe("Skill category (skill add/list mode)"),
        task: tool.schema.string().optional().describe("Task to match skills against (skill apply mode)"),
      },
      async execute(args: any) {
        const mode = String(args.mode ?? "store").toLowerCase()

        if (mode === "import") {
          const json = String(args.json ?? "")
          let importedMemories = 0
          let importedEntities = 0
          let importedPatterns = 0
          let importedRelationships = 0
          try {
            const data = JSON.parse(json)
            transaction(() => {
              if (data.memories) {
                for (const mem of data.memories) {
                  const existing = getOne("SELECT id FROM memories WHERE content = ?", [mem.content])
                  if (!existing) {
                    runInsert("INSERT INTO memories (content, type, scope, importance, relevance_score, access_count, tags, keywords, project_path, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [mem.content, mem.type || "project", mem.scope || "project", mem.importance || 5, mem.relevance_score ?? 0.5, mem.access_count ?? 0, mem.tags || "", mem.keywords || "", mem.project || projectPath, sessionId])
                    importedMemories++
                  }
                }
              }
              if (data.entities) {
                for (const ent of data.entities) {
                  const existing = getOne("SELECT id FROM entities WHERE name = ?", [ent.name])
                  if (!existing) {
                    runInsert("INSERT INTO entities (name, type, description, mention_count) VALUES (?, ?, ?, ?)", [ent.name, ent.type || "concept", ent.description || "", ent.mentions || 1])
                    importedEntities++
                  }
                }
              }
              if (data.relationships) {
                for (const rel of data.relationships) {
                  const src = getOne("SELECT id FROM entities WHERE name = ?", [rel.source])
                  const tgt = getOne("SELECT id FROM entities WHERE name = ?", [rel.target])
                  if (src && tgt) {
                    const existing = getOne("SELECT id FROM relationships WHERE source_entity_id = ? AND target_entity_id = ? AND relationship_type = ?", [src.id, tgt.id, rel.type || "related"])
                    if (!existing) {
                      runInsert("INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type, confidence) VALUES (?, ?, ?, ?)", [src.id, tgt.id, rel.type || "related", rel.confidence ?? 0.5])
                      importedRelationships++
                    }
                  }
                }
              }
              if (data.patterns) {
                for (const pat of data.patterns) {
                  const existing = getOne("SELECT id FROM learning_patterns WHERE pattern_text = ?", [pat.text])
                  if (!existing) {
                    runInsert("INSERT INTO learning_patterns (pattern_text, pattern_type, confidence, occurrences, project_path) VALUES (?, ?, ?, ?, ?)", [pat.text, pat.type || "general", pat.confidence || 0.5, pat.occurrences || 1, projectPath])
                    importedPatterns++
                  }
                }
              }
            })
            saveDb()
            const total = importedMemories + importedEntities + importedRelationships + importedPatterns
            if (total > 0) showToast(client, `Imported ${total} items`, "success")
            else showToast(client, "No new data to import", "info")
            return `Imported: ${importedMemories} memories, ${importedEntities} entities, ${importedRelationships} relationships, ${importedPatterns} patterns`
          } catch (e) {
            return `Import failed: ${e instanceof Error ? e.message : "invalid JSON"}`
          }
        }

        if (mode === "skill") {
          const action = String(args.action ?? "list").toLowerCase()

          if (action === "add") {
            const name = String(args.name ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-")
            const content = String(args.content ?? "").trim()
            if (!name || !content) {
              showToast(client, "name and content required", "error")
              return JSON.stringify({ success: false, error: "name and content required" })
            }
            const description = String(args.description ?? "").trim() || `Skill: ${name}`
            const category = String(args.category ?? "general").trim()
            const existing = getOne("SELECT id FROM procedural_knowledge WHERE name = ?", [name])
            if (existing) {
              execSingle("UPDATE procedural_knowledge SET content = ?, description = ?, category = ?, last_used = CURRENT_TIMESTAMP WHERE id = ?", [content, description, category, existing.id])
              saveDb()
              showToast(client, `Skill updated: ${name}`, "success")
              return JSON.stringify({ success: true, message: "Skill updated", id: existing.id })
            }
            const id = runInsert("INSERT INTO procedural_knowledge (name, description, category, content) VALUES (?, ?, ?, ?)", [name, description, category, content])
            saveDb()
            showToast(client, `Skill created: ${name}`, "success")
            return JSON.stringify({ success: true, message: "Skill created", id })
          }

          if (action === "apply") {
            const task = String(args.task ?? "")
            if (!task) {
              showToast(client, "task description required", "error")
              return JSON.stringify({ success: false, error: "task description required" })
            }
            const limit = Math.min(10, Math.max(1, (args.limit as number) || 3))
            const results = getAll(
              `SELECT name, description, category, content, use_count FROM procedural_knowledge WHERE (name LIKE ? OR description LIKE ? OR content LIKE ?) ORDER BY use_count DESC, last_used DESC LIMIT ?`,
              [`%${task}%`, `%${task}%`, `%${task}%`, limit]
            )
            for (const r of results) {
              execSingle("UPDATE procedural_knowledge SET use_count = use_count + 1, last_used = CURRENT_TIMESTAMP WHERE name = ?", [r.name])
            }
            saveDb()
            if (results.length === 0) {
              showToast(client, "No matching skills", "info")
              return JSON.stringify({ success: true, count: 0, skills: [] })
            }
            showToast(client, `Found ${results.length} matching skills`, "info")
            return JSON.stringify({
              success: true, count: results.length,
              skills: results.map((r: any) => ({
                name: r.name, description: r.description, category: r.category,
                content: r.content, use_count: r.use_count,
              })),
            })
          }

          const category = String(args.category ?? "")
          const skills = category
            ? getAll("SELECT name, description, category, use_count FROM procedural_knowledge WHERE category = ? ORDER BY use_count DESC", [category])
            : getAll("SELECT name, description, category, use_count FROM procedural_knowledge ORDER BY category, name")
          if (skills.length === 0) {
            showToast(client, "No skills stored", "info")
            return JSON.stringify({ success: true, count: 0, skills: [] })
          }
          showToast(client, `${skills.length} skills`, "info")
          return JSON.stringify({
            success: true, count: skills.length,
            skills: skills.map((s: any) => ({ name: s.name, description: s.description, category: s.category, use_count: s.use_count })),
          })
        }

        const content = String(args.content ?? "")
        const type = String(args.type ?? "conversation")
        const scope = String(args.scope ?? "project")
        const importance = (args.importance as number) || 5
        const autoTags = generateAutoTags(content)
        const manualTags = String(args.tags ?? "").split(",").filter(Boolean)
        const allTags = [...new Set([...autoTags, ...manualTags])].join(",")
        const similar = getOne("SELECT id, content FROM memories WHERE content = ?", [content])
        if (similar) {
          execSingle("UPDATE memories SET access_count = access_count + 1, last_accessed = ?, importance = MAX(importance, ?) WHERE id = ?", [now(), importance, similar.id])
          showToast(client, "Memory updated (merged)", "info")
          return `Merged with existing memory (id:${similar.id}): "${truncate(similar.content, 50)}"`
        }
        const embedding = await precomputeVector(content)
        const memoryId = runInsert(
          "INSERT INTO memories (content, type, scope, importance, session_id, relevance_score, keywords, tags, project_path, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [content, type, scope, importance, sessionId, importance * 0.1, String(args.keywords ?? ""), allTags, projectPath, embedding]
        )
        linkEntity(content, memoryId, projectPath)
        discoverRelationships(memoryId)
        autoLinkMemories(memoryId)
        saveDb()
        showToast(client, `Stored: ${truncate(content, 40)}`, "success")
        showToast(client, `Recall: memory-query {query: "${content.split(" ").slice(0, 3).join(" ")}", scope: "project"}`, "info", 5000)
        return `Stored: "${content}" (${type}, ${scope}, i:${importance}, tags: ${allTags || "none"})`
      },
    }),
  }
}
