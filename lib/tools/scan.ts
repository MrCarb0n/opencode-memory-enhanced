import { tool } from "@opencode-ai/plugin"
import { getOne, getAll } from "../db"
import { scanPastSessions, scanFromOpenCodeDB } from "../scan"
import { showToast } from "../helpers"

export function createScanTool(client: any, projectPath: string) {

  return {
    "memory-scan": tool({
      description: "Scan past session logs to extract memories from OpenCode sessions.",
      args: {
        limit: tool.schema.number().optional().describe("Max sessions to scan (default 50, use full=true for all)"),
        full: tool.schema.boolean().optional().describe("Scan all past sessions if true"),
        source: tool.schema.string().optional().describe("Scan source: db/fast (default), api/legacy, auto (tries DB first)"),
      },
      async execute(args: any) {
        const limit = (args.full as boolean) ? 500 : ((args.limit as number) || 50)
        const source = String(args.source ?? "db").toLowerCase()

        let stored = 0
        if (source === "db" || source === "opencode") {
          showToast(client, `Scanning ${limit === 99999 ? "all" : limit} sessions from OpenCode DB...`, "info")
          stored = await scanFromOpenCodeDB(projectPath, limit)
        } else if (source === "api") {
          showToast(client, `Scanning ${limit === 99999 ? "all" : limit} sessions from API...`, "info")
          stored = await scanPastSessions(client, projectPath, limit)
        } else {
          showToast(client, "Scanning from OpenCode DB (fast)...", "info")
          stored = await scanFromOpenCodeDB(projectPath, limit)
          if (stored === 0) {
            showToast(client, "Falling back to API scan...", "info")
            stored = await scanPastSessions(client, projectPath, limit)
          }
        }

        if (stored > 0) showToast(client, `Stored ${stored} memories from sessions`, "success")
        else showToast(client, "No new memories found in past sessions", "info")

        const totalSessions = getOne("SELECT COUNT(*) as c FROM scanned_sessions")?.c ?? 0
        const totalMemories = getOne("SELECT COUNT(*) as c FROM memories")?.c ?? 0
        const totalEntities = getOne("SELECT COUNT(*) as c FROM entities")?.c ?? 0
        const typeBreakdown = getAll("SELECT type, COUNT(*) as c FROM memories GROUP BY type ORDER BY c DESC")
        const breakdown = typeBreakdown.map((r: any) => `${r.type}:${r.c}`).join(" ")

        return `Scanned ${totalSessions} sessions | Stored: ${stored} new | Total: ${totalMemories} memories, ${totalEntities} entities\nBreakdown: ${breakdown || "none"}`
      },
    }),
  }
}
