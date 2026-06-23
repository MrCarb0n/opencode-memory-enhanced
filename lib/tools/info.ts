import { tool } from "@opencode-ai/plugin"
import { getOne, getAll } from "../db"
import { getConfig, saveConfig } from "../config"
import { VERSION, Paths } from "../constants"
import { truncate } from "../utils"
import { showToast } from "../helpers"
import { embeddingStatus } from "../embeddings"
export function createInfoTool(client: any, _projectPath: string) {

  return {
    "memory-info": tool({
      description: "System information and configuration. Modes: status (default) — system stats, health, embedding model; config — view/update settings with schema validation; timeline — activity history",
      args: {
        mode: tool.schema.string().optional().describe("Operation mode: status (default), config, timeline"),
        health: tool.schema.boolean().optional().describe("Diagnostic report with health score (status mode)"),
        key: tool.schema.string().optional().describe("Config key name (config mode)"),
        value: tool.schema.string().optional().describe("New value as string, auto-parsed (config mode)"),
        days: tool.schema.number().optional().describe("Lookback days 1-365 (timeline mode, default 7)"),
      },
      async execute(args: any) {
        const mode = String(args.mode ?? "status").toLowerCase()

        if (mode === "config") {
          const cfg = getConfig()
          const key = String(args.key ?? "")
          const value = String(args.value ?? "")
          if (key && value) {
            const typedKeys: Record<string, { type: string; validate?: (v: any) => string | null }> = {
              auto_remember: { type: "boolean" },
              decay_rate: { type: "number", validate: (v) => v < 0 || v > 1 ? "must be 0–1" : null },
              access_boost: { type: "number", validate: (v) => v < 0 || v > 1 ? "must be 0–1" : null },
              toast_enabled: { type: "boolean" },
              scan_on_start: { type: "boolean" },
              max_memory_length: { type: "number", validate: (v) => v < 50 || v > 5000 ? "must be 50–5000" : null },
              importance_threshold: { type: "number", validate: (v) => v < 1 || v > 10 ? "must be 1–10" : null },
              tracked_tools: { type: "array" },
              dont_save_patterns: { type: "array" },
              auto_remember_patterns: { type: "array" },
              noise_commands: { type: "array" },
              auto_allow_keywords: { type: "array" },
              auto_deny_keywords: { type: "array" },
              tech_stack: { type: "array" },
              tag_patterns: { type: "json" },
              memory_type_patterns: { type: "json" },
              importance_patterns: { type: "json" },
              graph_type_colors: { type: "json" },
              enable_vectors: { type: "boolean" },
              hide_types: { type: "array" },
              write_approval: { type: "boolean" },
              agent_note_limit: { type: "number", validate: (v) => v < 100 || v > 10000 ? "must be 100–10000" : null },
              user_profile_limit: { type: "number", validate: (v) => v < 100 || v > 10000 ? "must be 100–10000" : null },
              security_scan: { type: "boolean" },
              background_consolidate: { type: "boolean" },
            }
            const entry = typedKeys[key]
            if (!entry) { showToast(client, `Unknown config key: ${key}`, "error"); return `(unknown key: ${key})` }
            const t = entry.type
            let parsed: any
            if (t === "boolean") parsed = value === "true"
            else if (t === "number") parsed = parseFloat(value)
            else if (t === "array") parsed = value.split(",").map((s: string) => s.trim()).filter(Boolean)
            else if (t === "json") try { parsed = JSON.parse(value) } catch { parsed = value }
            else parsed = value
            if (entry.validate) {
              const err = entry.validate(parsed)
              if (err) { showToast(client, `Invalid ${key}: ${err}`, "error"); return `(invalid: ${err})` }
            }
            ;(cfg as any)[key] = parsed
            saveConfig(cfg)
            showToast(client, `Config: ${key}=${parsed}`, "info")
          }
          return `## Memory Enhanced v${VERSION}\nConfig: ${Paths.userConfig()}\n\n${Object.entries(cfg).map(([k, v]) => `  - ${k}: ${v}`).join("\n")}`
        }

        if (mode === "timeline") {
          const days = Math.max(1, Math.min(365, (args.days as number) || 7))
          const suffix = `-${days} days`
          const daily = getAll(`SELECT DATE(timestamp) as day, COUNT(*) as count, AVG(importance) as avg_imp FROM memories WHERE timestamp >= datetime('now', ?) GROUP BY DATE(timestamp) ORDER BY day DESC`, [suffix])
          const byType = getAll(`SELECT type, COUNT(*) as count FROM memories WHERE timestamp >= datetime('now', ?) GROUP BY type ORDER BY count DESC`, [suffix])
          const topActive = getAll(`SELECT content, type, access_count, last_accessed FROM memories WHERE last_accessed > datetime('now', ?) ORDER BY access_count DESC LIMIT 5`, [suffix])
          const parts: string[] = [`Timeline (last ${days} days):`]
          if (daily.length > 0) {
            parts.push("\nDaily activity:")
            for (const d of daily) parts.push(`  ${d.day}: ${d.count} memories (avg importance: ${(d.avg_imp ?? 0).toFixed(1)})`)
          }
          if (byType.length > 0) {
            parts.push("\nBy type:")
            for (const t of byType) parts.push(`  ${t.type}: ${t.count}`)
          }
          if (topActive.length > 0) {
            parts.push("\nMost accessed:")
            for (const m of topActive) parts.push(`  [${m.type}|acc:${m.access_count}] ${truncate(m.content, 80)}`)
          }
          if (daily.length === 0) parts.push("  (no activity in this period)")
          showToast(client, `Timeline: ${daily.length} active days`, daily.length > 0 ? "info" : "warning")
          return parts.join("\n")
        }

        const healthReport = (args.health as boolean) || false
        const count = (sql: string) => getOne(sql)?.c ?? 0

        if (!healthReport) {
          const total = count("SELECT COUNT(*) as c FROM memories")
          const stale = count("SELECT COUNT(*) as c FROM memories WHERE relevance_score < 0.2 AND scope = 'project'")
          const entities = count("SELECT COUNT(*) as c FROM entities")
          const rels = count("SELECT COUNT(*) as c FROM relationships")
          const patterns = count("SELECT COUNT(*) as c FROM learning_patterns")
          const embedded = count("SELECT COUNT(*) as c FROM memories WHERE embedding != '' AND embedding IS NOT NULL")
          const status = embeddingStatus()
          const modelStatus = status.loaded ? `ready (${status.dim}d)` : "unavailable"
          return [
            `── Memory v${VERSION} ───────────────`,
            `  Memories: ${total} (${stale} stale) · ${entities} entities · ${rels} rels · ${patterns} patterns`,
            `  Embedded: ${embedded}/${total} · model: ${modelStatus}`,
            `────────────────────────────────────`,
          ].join("\n")
        }

        const totalProject = count("SELECT COUNT(*) as c FROM memories WHERE scope = 'project'")
        const staleCount = count("SELECT COUNT(*) as c FROM memories WHERE relevance_score < 0.2 AND scope = 'project'")
        const neverAccessed = count("SELECT COUNT(*) as c FROM memories WHERE access_count = 0 AND scope = 'project'")
        const totalEntities = count("SELECT COUNT(*) as c FROM entities")
        const weakEntities = count("SELECT COUNT(*) as c FROM entities WHERE mention_count = 1")
        const avgScoreVal = getOne("SELECT AVG(relevance_score) as avg FROM memories WHERE scope = 'project'")?.avg ?? 0
        const healthScore = Math.round(Math.max(0, Math.min(100,
          100 - (totalProject > 0 ? (staleCount / totalProject) * 30 : 0)
          - (totalProject > 0 ? (neverAccessed / totalProject) * 20 : 0)
          - (totalEntities > 0 ? (weakEntities / totalEntities) * 15 : 0)
          + (avgScoreVal * 25)
        )))
        return [
          `Health Score: ${healthScore}/100`,
          `  Avg relevance: ${avgScoreVal.toFixed(3)} | Stale: ${staleCount} | Never accessed: ${neverAccessed}`,
          `  Weak entities: ${weakEntities}/${totalEntities}`,
          healthScore < 50 ? `  Run: memory-maintain {mode: optimize}` : "  Healthy",
        ].join("\n")
      },
    }),
  }
}
