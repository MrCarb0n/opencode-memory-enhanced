import { getConfig } from "./config"
import { parsePattern } from "./types"
import { getOne, getAll, runInsert, execSingle, now } from "./db"
import { Tables } from "./constants"

const E = Tables.entities
const CT = Tables.conceptTags
const M = Tables.memories
const R = Tables.relationships
const ML = Tables.memoryLinks
const LP = Tables.learningPatterns

export function extractEntities(content: string): string[] {
  const entities: string[] = []

  // Multi-word phrases: consecutive capitalized or special words (2-4 tokens)
  const words = content.split(/\s+/)
  for (let i = 0; i < words.length - 1; i++) {
    if (/^[A-Z][a-z]/.test(words[i]) && /^[A-Z][a-z]/.test(words[i + 1])) {
      const phrase = words.slice(i, i + Math.min(4, words.length - i)).filter((w, j) => j === 0 || /^[A-Z]/.test(w)).join(" ")
      if (phrase.split(/\s+/).length >= 2) entities.push(phrase)
    }
  }

  for (const raw of words) {
    const w = raw.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF-]/g, "")

    // PascalCase / camelCase splitting
    if (/[a-z][A-Z]/.test(w)) {
      const parts = w.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/).filter(p => p.length >= 3)
      entities.push(...parts)
      if (parts.length > 0) continue
    }

    // snake_case or kebab-case
    if (/[a-zA-Z][_-][a-zA-Z]/.test(w)) {
      const parts = w.split(/[_-]/).filter(p => p.length >= 3)
      entities.push(...parts)
      if (parts.length > 0) continue
    }

    // UPPER_CASE or capitalized words (ASCII + Unicode uppercase)
    if ((/^[A-Z]/.test(w) || /^\p{Lu}/u.test(w)) && w.length > 2) {
      entities.push(w)
      continue
    }

    // Non-Latin word (CJK, Cyrillic, etc.) — take whole word as entity
    if (/[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(w) && w.length >= 2) {
      entities.push(w)
    }
  }

  return [...new Set(entities)]
}

export function generateAutoTags(content: string): string[] {
  const tags: string[] = []

  for (const [tag, patternStr] of getConfig().tag_patterns) {
    const re = parsePattern(patternStr)
    if (re?.test(content)) tags.push(tag)
  }

  const techNames = getConfig().tech_stack
  const techPat = new RegExp(`\\b(${techNames.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
  const techStack = content.match(techPat)
  if (techStack) tags.push(...techStack.map((t) => t.toLowerCase()))

  return [...new Set(tags)]
}

export function linkEntity(content: string, memoryId: number, projectPath: string): void {
  for (const name of extractEntities(content)) {
    const row = getOne(`SELECT id FROM "${E}" WHERE name = ?`, [name])
    if (row) {
      execSingle(`UPDATE "${E}" SET mention_count = mention_count + 1, last_seen = ? WHERE name = ?`, [now(), name])
      execSingle(`INSERT OR IGNORE INTO "${CT}" (memory_id, entity_id) VALUES (?, ?)`, [memoryId, row.id])
    } else {
      const newId = runInsert(
        `INSERT INTO "${E}" (name, type, project_path, description) VALUES (?, 'concept', ?, ?)`,
        [name, projectPath, content.substring(0, 100)]
      )
      execSingle(`INSERT OR IGNORE INTO "${CT}" (memory_id, entity_id) VALUES (?, ?)`, [memoryId, newId])
    }
  }
}

export function getEntityOrCreate(name: string, projectPath: string): number {
  const row = getOne(`SELECT id FROM "${E}" WHERE name = ?`, [name])
  if (row) {
    execSingle(`UPDATE "${E}" SET mention_count = mention_count + 1, last_seen = ? WHERE name = ?`, [now(), name])
    return row.id as number
  }
  return runInsert(
    `INSERT INTO "${E}" (name, type, project_path) VALUES (?, 'concept', ?)`,
    [name, projectPath]
  )
}

// ─── Knowledge Graph: Auto-Relationships ──────────────────────────
// When entities co-occur in the same memory, create or strengthen a relationship between them.
export function discoverRelationships(memoryId: number): void {
  const entityIds = getAll(
    `SELECT entity_id FROM "${CT}" WHERE memory_id = ?`,
    [memoryId]
  ).map((r) => r.entity_id as number)

  if (entityIds.length < 2) return

  for (let i = 0; i < entityIds.length; i++) {
    for (let j = i + 1; j < entityIds.length; j++) {
      const a = entityIds[i]
      const b = entityIds[j]

      const existing = getOne(
        `SELECT id, confidence FROM "${R}"
         WHERE (source_entity_id = ? AND target_entity_id = ?)
         OR (source_entity_id = ? AND target_entity_id = ?)`,
        [a, b, b, a]
      )
      if (existing) {
        execSingle(
          `UPDATE "${R}" SET confidence = MIN(1.0, confidence + 0.15), last_seen = ? WHERE id = ?`,
          [now(), existing.id]
        )
      } else {
        runInsert(
          `INSERT INTO "${R}" (source_entity_id, target_entity_id, relationship_type, confidence, description)
           VALUES (?, ?, 'co_occurs', 0.5, 'Co-occurs in same context')`,
          [a, b]
        )
      }
    }
  }
}

// ─── Knowledge Graph: Auto-Memory-Linking ─────────────────────────
// Link memories that share entities above a configurable threshold.
export function autoLinkMemories(memoryId: number): void {
  const entityIds = getAll(
    `SELECT entity_id FROM "${CT}" WHERE memory_id = ?`,
    [memoryId]
  ).map((r) => r.entity_id as number)

  if (entityIds.length === 0) return

  const shared = getAll(
    `SELECT ct2.memory_id, COUNT(*) as shared_count FROM "${CT}" ct1
     JOIN "${CT}" ct2 ON ct1.entity_id = ct2.entity_id
     WHERE ct1.memory_id = ? AND ct2.memory_id != ?
     GROUP BY ct2.memory_id
     HAVING shared_count >= 2
     ORDER BY shared_count DESC LIMIT 5`,
    [memoryId, memoryId]
  )

  for (const s of shared) {
    const sid = s.memory_id as number
    const strength = Math.min(1.0, (s.shared_count as number) / Math.max(entityIds.length, 1))

    const existing = getOne(
      `SELECT id FROM "${ML}"
       WHERE (source_memory_id = ? AND target_memory_id = ?)
       OR (source_memory_id = ? AND target_memory_id = ?)`,
      [memoryId, sid, sid, memoryId]
    )
    if (!existing) {
      runInsert(
        `INSERT INTO "${ML}" (source_memory_id, target_memory_id, link_type, strength)
         VALUES (?, ?, 'entity_shared', ?)`,
        [memoryId, sid, strength]
      )
    }
  }
}

// ─── Knowledge Graph: Entity Pattern Detection ────────────────────
// Find entity pairs that repeatedly co-occur across memories and record as learning_patterns.
export function cleanupOrphanEntities(): number {
  const removed = execSingle(
    `DELETE FROM "${E}" WHERE id NOT IN (SELECT DISTINCT entity_id FROM "${CT}")`
  ) as unknown as number || 0
  if (removed > 0) console.debug(`[memory-enhanced] Cleaned ${removed} orphan entities`)
  return removed
}

export function detectEntityPatterns(projectPath: string): number {
  const pairs = getAll(
    `SELECT ct1.entity_id as e1_id, ct2.entity_id as e2_id,
            e1.name as e1_name, e2.name as e2_name,
            COUNT(DISTINCT ct1.memory_id) as co_occurrences
     FROM "${CT}" ct1
     JOIN "${CT}" ct2 ON ct1.memory_id = ct2.memory_id AND ct1.entity_id < ct2.entity_id
     JOIN "${E}" e1 ON ct1.entity_id = e1.id
     JOIN "${E}" e2 ON ct2.entity_id = e2.id
     GROUP BY ct1.entity_id, ct2.entity_id
     HAVING co_occurrences >= 2
     ORDER BY co_occurrences DESC`
  )

  let detected = 0
  for (const pair of pairs) {
    const patternText = `${(pair.e1_name as string).substring(0, 60)} ↔ ${(pair.e2_name as string).substring(0, 60)}`
    const occurrences = pair.co_occurrences as number

    const existing = getOne(
      `SELECT id FROM "${LP}" WHERE pattern_text = ? AND project_path = ?`,
      [patternText, projectPath]
    )
    if (existing) {
      execSingle(
        `UPDATE "${LP}" SET occurrences = ?, last_seen = ?, confidence = MIN(1.0, 0.3 + ? * 0.1) WHERE id = ?`,
        [occurrences, now(), occurrences, existing.id]
      )
    } else {
      runInsert(
        `INSERT INTO "${LP}" (pattern_text, pattern_type, confidence, occurrences, project_path)
         VALUES (?, 'entity_cooccurrence', ?, ?, ?)`,
        [patternText, Math.min(0.9, 0.3 + occurrences * 0.1), occurrences, projectPath]
      )
    }
    detected++
  }
  return detected
}
