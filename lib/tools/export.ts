import { tool } from "@opencode-ai/plugin"
import { getOne, getAll, now } from "../db"
import { truncate } from "../utils"
import { getConfig } from "../config"
import { Paths } from "../constants"
import { showToast } from "../helpers"
import { writeFileSync } from "fs"
import { join } from "path"
import type { ToolContext } from "./_shared"

export function createExportTool(ctx: ToolContext) {
  const { projectPath, client } = ctx

  return {
    "memory-export": tool({
      description: "Export memories and knowledge graph. Modes: json (default) — full JSON export with entities/relationships/patterns; md — Markdown export; svg — interactive SVG knowledge graph; dot — Graphviz DOT graph",
      args: {
        mode: tool.schema.string().optional().describe("Output mode: json (default), md, svg, dot"),
        scope: tool.schema.string().optional().describe("Scope filter: all (default), project, or global"),
        minMentions: tool.schema.number().optional().describe("Minimum entity mention count for graph modes (default 1)"),
      },
      async execute(args: any) {
        const mode = String(args.mode ?? "json").toLowerCase()
        const scope = String(args.scope ?? "all").toLowerCase()
        const minMentions = (args.minMentions as number) || 1

        if (mode === "svg" || mode === "dot") {
          const entities = getAll("SELECT id, name, type, description, mention_count FROM entities WHERE mention_count >= ? ORDER BY mention_count DESC LIMIT 50", [minMentions])
          const rels = getAll("SELECT s.name as src, r.relationship_type as rel, t.name as tgt, r.confidence FROM relationships r JOIN entities s ON r.source_entity_id = s.id JOIN entities t ON r.target_entity_id = t.id WHERE r.confidence >= 0.3")

          if (mode === "svg") {
            if (entities.length === 0) return "(no entities to graph)"
            const cols = Math.max(1, Math.ceil(Math.sqrt(entities.length)))
            const nodeW = 160, nodeH = 44, gapX = 200, gapY = 80, pad = 40
            const gw = cols * gapX + pad, gh = Math.ceil(entities.length / cols) * gapY + pad
            let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gw} ${gh}" style="background:#fafafa;font-family:sans-serif">`
            svg += `<defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#888"/></marker></defs>`
            for (const r of rels) {
              const si = entities.findIndex((e) => e.name === r.src)
              const ti = entities.findIndex((e) => e.name === r.tgt)
              if (si === -1 || ti === -1) continue
              const x1 = pad + (si % cols) * gapX + nodeW, y1 = pad + Math.floor(si / cols) * gapY + nodeH / 2
              const x2 = pad + (ti % cols) * gapX, y2 = pad + Math.floor(ti / cols) * gapY + nodeH / 2
              svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#999" stroke-width="1.5" marker-end="url(#arrow)"/>`
              const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
              svg += `<text x="${mx}" y="${my - 6}" text-anchor="middle" font-size="9" fill="#666">${r.rel}</text>`
            }
            const typeColors = getConfig().graph_type_colors
            for (let i = 0; i < entities.length; i++) {
              const e = entities[i]
              const x = pad + (i % cols) * gapX, y = pad + Math.floor(i / cols) * gapY
              const color = typeColors[e.type] || "#F0F0F0"
              const safeName = e.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
              svg += `<g><rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="6" fill="${color}" stroke="#4A90D9" stroke-width="1"/>`
              svg += `<text x="${x + nodeW / 2}" y="${y + nodeH / 2 + 4}" text-anchor="middle" font-size="11" fill="#222">${safeName}</text></g>`
            }
            svg += "</svg>"
            return svg
          }

          const lines: string[] = ["digraph MemoryGraph {", '  rankdir=LR;', '  node [shape=box, style=filled, fillcolor="#E8F0FE"];', '  edge [color="#666", fontsize=10];']
          const typeColors = getConfig().graph_type_colors
          for (const e of entities) {
            const color = typeColors[e.type] || "#F5F5F5"
            lines.push(`  "${e.name}" [label="${e.name}\\n(${e.type})", fillcolor="${color}", tooltip="${(e.description || "").substring(0, 60).replace(/"/g, "\\\"")}"];`)
          }
          for (const r of rels) {
            lines.push(`  "${r.src}" -> "${r.tgt}" [label="${r.rel}", penwidth=${Math.max(1, r.confidence * 2)}];`)
          }
          lines.push("}")
          return lines.join("\n")
        }

        if (mode === "md" || mode === "markdown") {
          const scopeParam = scope !== "all" ? scope : null
          const memories = scopeParam
            ? getAll("SELECT * FROM memories WHERE scope = ? ORDER BY timestamp", [scopeParam])
            : getAll("SELECT * FROM memories ORDER BY timestamp")
          const date = new Date().toISOString().slice(0, 10)
          const exportDir = Paths.dataRoot()
          const lines: string[] = [`# Memory Export (${date})`, `Scope: ${scope} | Total: ${memories.length} memories`, ""]
          const byType: Record<string, any[]> = {}
          for (const m of memories) {
            const t = m.type || "conversation"
            if (!byType[t]) byType[t] = []
            byType[t].push(m)
          }
          for (const [type, items] of Object.entries(byType)) {
            lines.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)} (${items.length})`)
            for (const m of items) {
              lines.push(`- **${truncate(m.content, 120)}** — i:${m.importance}, s:${m.relevance_score?.toFixed(2) ?? "?"}, scope:${m.scope}${m.tags ? `, tags:${m.tags}` : ""}`)
              if (m.keywords) lines.push(`  _keywords: ${m.keywords}_`)
            }
            lines.push("")
          }
          const path = join(exportDir, `memory-export-${date}.md`)
          writeFileSync(path, lines.join("\n"), "utf-8")
          showToast(client, `Exported ${memories.length} memories to ${path}`, "info")
          return path
        }

        const scopeParam = scope !== "all" ? scope : null
        const memories = scopeParam
          ? getAll("SELECT * FROM memories WHERE scope = ? ORDER BY timestamp", [scopeParam])
          : getAll("SELECT * FROM memories ORDER BY timestamp")
        const entities = getAll("SELECT name, type, description, mention_count FROM entities ORDER BY mention_count DESC")
        const rels = getAll(`SELECT COALESCE(s.name, '?') as source, r.relationship_type, COALESCE(t.name, '?') as target, r.confidence FROM relationships r LEFT JOIN entities s ON r.source_entity_id = s.id LEFT JOIN entities t ON r.target_entity_id = t.id`)
        const patterns = getAll("SELECT pattern_text, pattern_type, confidence, occurrences FROM learning_patterns ORDER BY occurrences DESC")
        const data = {
          exported_at: now(),
          memories: memories.map((r) => ({
            id: r.id, content: r.content, type: r.type, scope: r.scope,
            importance: r.importance, relevance_score: r.relevance_score,
            access_count: r.access_count, tags: r.tags, keywords: r.keywords,
            timestamp: r.timestamp, project: r.project_path
          })),
          entities: entities.map((r) => ({ name: r.name, type: r.type, description: r.description, mentions: r.mention_count })),
          relationships: rels.map((r) => ({ source: r.source, type: r.relationship_type, target: r.target, confidence: r.confidence })),
          patterns: patterns.map((r) => ({ text: r.pattern_text, type: r.pattern_type, confidence: r.confidence, occurrences: r.occurrences })),
        }
        const date = new Date().toISOString().slice(0, 10)
        const exportDir = Paths.dataRoot()
        const path = join(exportDir, `memory-export-${date}.json`)
        writeFileSync(path, JSON.stringify(data, null, 2), "utf-8")
        showToast(client, `Exported ${memories.length} memories + ${entities.length} entities + ${rels.length} relationships + ${patterns.length} patterns to ${path}`, "info")
        return path
      },
    }),
  }
}
