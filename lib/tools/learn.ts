import { tool } from "@opencode-ai/plugin"
import { getOne, execSingle, runInsert, now, saveDb } from "../db"
import { truncate } from "../utils"
import { generateAutoTags, getEntityOrCreate, discoverRelationships, autoLinkMemories } from "../entities"
import { precomputeVector } from "../memory"
import { showToast } from "../helpers"

export function createLearnTool(client: any, projectPath: string) {

  return {
    "memory-learn": tool({
      description: "Store structured facts and track conversation intent. Modes: learn (default) — fact with entity tracking, relationships, pattern detection; arc — track conversation intent and topics",
      args: {
        mode: tool.schema.string().optional().describe("Operation mode: learn (default), arc"),
        subject: tool.schema.string().optional().describe("Entity name (learn mode)"),
        fact: tool.schema.string().optional().describe("Fact/description to store (learn mode)"),
        subjectType: tool.schema.string().optional().describe("Entity type: concept/framework/tool/person (learn mode, default concept)"),
        relatesTo: tool.schema.string().optional().describe("Related entity name (learn mode)"),
        relation: tool.schema.string().optional().describe("Relationship type e.g. built_with/depends_on/uses (learn mode)"),
        scope: tool.schema.string().optional().describe("Scope: project or global (default project)"),
        intent: tool.schema.string().optional().describe("Conversation intent/goal (arc mode)"),
        topics: tool.schema.string().optional().describe("Comma-separated topic tags (arc mode)"),
      },
      async execute(args: any, context: any) {
        const mode = String(args.mode ?? "learn").toLowerCase()

        if (mode === "arc") {
          const intent = String(args.intent ?? "")
          const topics = String(args.topics ?? "")
          execSingle("UPDATE conversation_arcs SET end_time = ? WHERE session_id = ? AND end_time IS NULL AND id = (SELECT id FROM conversation_arcs WHERE session_id = ? AND end_time IS NULL ORDER BY id DESC LIMIT 1)", [now(), context.sessionID, context.sessionID])
          runInsert("INSERT INTO conversation_arcs (session_id, intent, topics, message_count, project_path) VALUES (?, ?, ?, 1, ?)", [context.sessionID, intent, topics, projectPath])
          saveDb()
          showToast(client, `Arc: "${intent}"`, "info")
          return `Arc tracked: intent="${intent}", topics=[${topics}]`
        }

        const subject = String(args.subject ?? "")
        const fact = String(args.fact ?? "")
        const subjectType = String(args.subjectType ?? "concept")
        const relatesTo = String(args.relatesTo ?? "")
        const relation = String(args.relation ?? "")
        const scope = String(args.scope ?? "project")
        const subjectId = getEntityOrCreate(subject, projectPath)
        execSingle("UPDATE entities SET mention_count = mention_count + 1, last_seen = ?, description = ?, type = ? WHERE id = ?", [now(), truncate(fact, 200), subjectType, subjectId])
        const autoTags = generateAutoTags(fact).join(",")
        const embedding = await precomputeVector(fact)
        const memoryId = runInsert("INSERT INTO memories (content, type, scope, importance, session_id, keywords, tags, project_path, embedding) VALUES (?, ?, ?, 6, ?, ?, ?, ?, ?)", [fact, subjectType, scope, context.sessionID, subject, autoTags, projectPath, embedding])
        execSingle("INSERT OR IGNORE INTO concept_tags (memory_id, entity_id) VALUES (?, ?)", [memoryId, subjectId])
        if (relatesTo && relation) {
          const relatedId = getEntityOrCreate(relatesTo, projectPath)
          const existingRel = getOne("SELECT id FROM relationships WHERE source_entity_id = ? AND target_entity_id = ? AND relationship_type = ?", [subjectId, relatedId, relation])
          if (existingRel) {
            execSingle("UPDATE relationships SET last_seen = ?, confidence = MIN(1.0, confidence + 0.1) WHERE id = ?", [now(), existingRel.id])
          } else {
            runInsert("INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type, description) VALUES (?, ?, ?, ?)", [subjectId, relatedId, relation, truncate(fact, 200)])
          }
          discoverRelationships(memoryId)
          autoLinkMemories(memoryId)
        }
        const existingPattern = getOne("SELECT id FROM learning_patterns WHERE pattern_text = ? AND project_path = ?", [truncate(fact, 100), projectPath])
        if (existingPattern) {
          execSingle("UPDATE learning_patterns SET occurrences = occurrences + 1, last_seen = ?, confidence = MIN(1.0, confidence + 0.05) WHERE id = ?", [now(), existingPattern.id])
        } else {
          runInsert("INSERT INTO learning_patterns (pattern_text, pattern_type, confidence, project_path) VALUES (?, ?, 0.5, ?)", [truncate(fact, 100), subjectType, projectPath])
        }
        saveDb()
        showToast(client, `Learned: ${subject} ${relatesTo ? "→ " + relatesTo : ""}`, "success")
        let result = `Learned: "${fact}"\nEntity: ${subject} (${subjectType}) | Tags: ${autoTags || "none"}`
        if (relatesTo && relation) result += `\nRelationship: ${subject} --[${relation}]--> ${relatesTo}`
        return result
      },
    }),
  }
}
