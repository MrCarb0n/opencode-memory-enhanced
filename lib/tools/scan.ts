import { tool } from "@opencode-ai/plugin"
import { getOne, getAll } from "../db"
import { scanFromOpenCodeDB } from "../scan"
import { showToast } from "../helpers"

export function createScanTool(client: any, projectPath: string) {

  return {
    "memory-scan": tool({
      description: "Scan past session logs to extract memories from OpenCode sessions.",
      args: {
        limit: tool.schema.number().optional().describe("Max sessions to scan (default 50, use full=true for all)"),
        full: tool.schema.boolean().optional().describe("Scan all past sessions if true"),
        source: tool.schema.string().optional().describe("Scan source (deprecated, always db)"),
      },
      async execute(args: any) {
        const limit = (args.full as boolean) ? 500 : ((args.limit as number) || 50)

        showToast(client, `Scanning ${limit === 99999 ? "all" : limit} sessions from OpenCode DB...`, "info")
        const stored = await scanFromOpenCodeDB(client, projectPath, limit)

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
