import { tool } from "@opencode-ai/plugin"
import { getOne, getAll, execSingle, now, saveDb, transaction } from "../db"
import { truncate, cosineSimilarity, simhash, hammingDistance } from "../utils"
import { sameBucket } from "../helpers"
import { runOptimize } from "../optimize"
import { showToast } from "../helpers"

export function createMaintainTool(client: any, projectPath: string) {

  return {
    "memory-maintain": tool({
      description: "System maintenance tasks. Modes: optimize (default) — prune stale, dedup, backfill embeddings, vacuum; dedup — find and merge duplicates with threshold/dryRun; conflicts — detect contradictory feedback memories",
      args: {
        mode: tool.schema.string().optional().describe("Operation mode: optimize (default), dedup, conflicts"),
        full: tool.schema.boolean().optional().describe("Deep consolidation (optimize mode)"),
        threshold: tool.schema.number().optional().describe("Similarity threshold 0-1 (dedup mode, default 0.8)"),
        dryRun: tool.schema.boolean().optional().describe("Preview merges without applying (dedup mode, default true)"),
      },
      async execute(args: any) {
        const mode = String(args.mode ?? "optimize").toLowerCase()

        if (mode === "dedup") {
          const threshold = (args.threshold as number) || 0.8
          const dryRun = (args.dryRun as boolean) !== false
          const projectMemories = getAll("SELECT id, content, type, importance, access_count FROM memories WHERE scope = 'project' ORDER BY id")
          let mergeCount = 0
          const merges: string[] = []
          const hashBucket = new Map<number, any[]>()
          for (const mem of projectMemories) {
            const fp = simhash(mem.content as string)
            const bucketKey = Number(fp >> 32n)
            if (!hashBucket.has(bucketKey)) hashBucket.set(bucketKey, [])
            hashBucket.get(bucketKey)!.push(mem)
          }
          const dedupLoop = () => {
            for (const [, bucket] of hashBucket) {
              if (bucket.length < 2) continue
              for (let i = 0; i < bucket.length; i++) {
                for (let j = i + 1; j < bucket.length; j++) {
                  const fpA = simhash(bucket[i].content)
                  const fpB = simhash(bucket[j].content)
                  if (hammingDistance(fpA, fpB) > 12) continue
                  const sim = cosineSimilarity(bucket[i].content, bucket[j].content)
                  if (sim > threshold && bucket[i].importance >= bucket[j].importance) {
                    if (!dryRun) {
                      execSingle("UPDATE memories SET access_count = access_count + ?, importance = MAX(importance, ?), last_accessed = ? WHERE id = ?", [bucket[j].access_count, bucket[j].importance, now(), bucket[i].id])
                      execSingle("DELETE FROM memories WHERE id = ?", [bucket[j].id])
                    }
                    merges.push(`  Merge: [${bucket[j].id}] "${truncate(bucket[j].content, 40)}" -> [${bucket[i].id}] (sim: ${sim.toFixed(2)})`)
                    mergeCount++
                  }
                }
              }
            }
          }
          if (dryRun) { dedupLoop() } else { transaction(dedupLoop) }
          if (!dryRun && mergeCount > 0) saveDb()
          if (mergeCount > 0) showToast(client, `Merged ${mergeCount} duplicates`, "success")
          else showToast(client, "No duplicates found", "info")
          return [`Dedup ${dryRun ? "(dry run)" : ""}:`, `  Found: ${mergeCount} mergeable`, ...merges.slice(0, 10)].join("\n")
        }

        if (mode === "conflicts") {
          const conflicts: string[] = []
          const feedbacks = getAll("SELECT id, content, importance FROM memories WHERE type = 'feedback' AND scope = 'project' ORDER BY importance DESC")
          for (let i = 0; i < feedbacks.length; i++) {
            for (let j = i + 1; j < feedbacks.length; j++) {
              if (!sameBucket(feedbacks[i].content, feedbacks[j].content)) continue
              const sim = cosineSimilarity(feedbacks[i].content, feedbacks[j].content)
              if (sim > 0.4 && sim < 0.85) {
                const hasNeg1 = /\b(don't|do not|stop|never|no)\b/i.test(feedbacks[i].content)
                const hasNeg2 = /\b(don't|do not|stop|never|no)\b/i.test(feedbacks[j].content)
                if (hasNeg1 !== hasNeg2) {
                  conflicts.push(`  [${feedbacks[i].id}] "${truncate(feedbacks[i].content, 60)}"`)
                  conflicts.push(`  [${feedbacks[j].id}] "${truncate(feedbacks[j].content, 60)}" (sim: ${sim.toFixed(2)})`)
                  conflicts.push("")
                }
              }
            }
          }
          if (conflicts.length === 0) {
            showToast(client, "No memory conflicts", "success")
            return "No conflicts detected"
          }
          showToast(client, `${Math.floor(conflicts.length / 3)} conflict pairs`, "warning")
          return `Potential conflicts (${Math.floor(conflicts.length / 3)} pairs):\n${conflicts.join("\n")}`
        }

        const isFull = (args.full as boolean) || false
        const result = await runOptimize(projectPath, isFull)
        const stale = getOne("SELECT COUNT(*) as c FROM memories WHERE relevance_score < 0.2 AND scope = 'project'")?.c ?? 0
        if (stale === 0) showToast(client, "Memory system healthy", "success")
        const parts = [`Optimized: ${stale} stale remaining${isFull ? " (full)" : ""}`]
        if (isFull) {
          if (result.duplicatesMerged > 0) parts.push(`Merged ${result.duplicatesMerged} duplicates`)
          if (result.embeddingsBackfilled > 0) parts.push(`Backfilled ${result.embeddingsBackfilled} embeddings`)
          if (result.patternsDetected > 0) parts.push(`Detected ${result.patternsDetected} patterns`)
        }
        return parts.join("\n")
      },
    }),
  }
}
