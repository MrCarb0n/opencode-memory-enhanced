import { extractEntities, generateAutoTags } from "./entities"
import { extractImportance, detectMemoryType, shouldNotSave } from "./types"

export interface MemoryRecord {
  content: string
  type: string
  importance: number
  keywords: string
  tags: string
  session_id: string
  relevance_score: number
  project_path: string
}

export interface SessionMeta {
  sid: string
  title?: string
  model?: string
  agent?: string
  cost?: number
  tokensIn?: number
  tokensOut?: number
}

function parseMessages(rawMessages: any[]): { role: string; text: string; synthetic?: boolean; toolName?: string; filePath?: string; command?: string }[] {
  const result: { role: string; text: string; synthetic?: boolean; toolName?: string; filePath?: string; command?: string }[] = []
  for (const msg of rawMessages) {
    let msgData: any
    if (msg.data) {
      msgData = typeof msg.data === "string" ? (() => { try { return JSON.parse(msg.data) } catch { return {} } })() : msg.data
    } else if (msg.info) {
      msgData = msg.info
    } else {
      msgData = msg
    }
    const role = msgData.role ?? ""
    const parts = msgData.parts ?? []
    for (const p of parts) {
      if (p.type === "text") {
        result.push({ role, text: p.text || "", synthetic: p.synthetic })
      } else if (p.type === "tool_use" || p.type === "tool_call") {
        const name = p.name || p.tool || ""
        const args = p.input || p.arguments || {}
        result.push({ role, text: "", toolName: name, filePath: args.filePath, command: args.command })
      }
    }
  }
  return result
}

export function extractSessionMemories(
  rawMessages: any[],
  meta: SessionMeta,
  projectPath: string
): MemoryRecord[] {
  const parsed = parseMessages(rawMessages)
  const allTools = new Set<string>()
  const allFiles = new Set<string>()
  const allCommands = new Set<string>()
  const assistantTexts: string[] = []
  const userTexts: string[] = []
  const records: MemoryRecord[] = []

  for (const p of parsed) {
    if (p.toolName) {
      allTools.add(p.toolName)
      if (p.filePath) allFiles.add(p.filePath)
      if (p.command && p.toolName === "bash") allCommands.add(p.command)
    } else if (p.text) {
      if (p.synthetic) continue
      if (p.role === "assistant" || p.role === "model") {
        assistantTexts.push(p.text)
      }
      if ((p.role === "user" || !p.role) && p.text.length >= 20) {
        userTexts.push(p.text)
      }
    }
  }

  for (const text of userTexts) {
    const clean = text.substring(0, 300).trim()
    if (clean.length < 20) continue
    if (shouldNotSave(clean)) continue
    const importance = extractImportance(clean)
    const memoryType = detectMemoryType(clean)
    const keywords = extractEntities(clean).join(",").toLowerCase()
    const autoTags = generateAutoTags(clean).join(",")
    records.push({
      content: clean,
      type: memoryType,
      importance,
      keywords,
      tags: autoTags,
      session_id: meta.sid,
      relevance_score: 0.5,
      project_path: projectPath,
    })
  }

  const metaParts = [
    `Session: ${meta.title ?? meta.sid.substring(0, 12)}`,
    `${rawMessages.length} messages`,
  ]
  if (meta.model) metaParts.push(`Model: ${meta.model}`)
  if (meta.agent) metaParts.push(`Agent: ${meta.agent}`)
  if ((meta.cost ?? 0) > 0) metaParts.push(`Cost: $${meta.cost!.toFixed(4)}`)
  if (meta.tokensIn || meta.tokensOut) metaParts.push(`Tokens: ${meta.tokensIn ?? 0} in / ${meta.tokensOut ?? 0} out`)
  if (allTools.size > 0) metaParts.push(`Tools: ${[...allTools].join(", ")}`)
  if (allFiles.size > 0) metaParts.push(`Files: ${[...allFiles].slice(0, 8).join(", ")}`)
  const metaKeywords = [...allTools, ...allFiles].join(",").toLowerCase()
  const metaTags = ["session", ...(meta.agent ? [meta.agent.toLowerCase()] : [])]
  const metaContent = metaParts.join(" | ").substring(0, 300)
  if (metaParts.length > 1) {
    records.push({
      content: metaContent,
      type: "project",
      importance: 6,
      keywords: metaKeywords,
      tags: metaTags.join(","),
      session_id: meta.sid,
      relevance_score: 0.6,
      project_path: projectPath,
    })
  }

  if (allTools.size > 0) {
    const toolList = [...allTools].join(", ")
    records.push({
      content: `Tools used: ${toolList}`,
      type: "tool-execution",
      importance: 4,
      keywords: toolList.toLowerCase(),
      tags: "tools," + toolList.toLowerCase().slice(0, 60),
      session_id: meta.sid,
      relevance_score: 0.5,
      project_path: projectPath,
    })
  }

  if (allFiles.size > 0) {
    const fileList = [...allFiles].slice(0, 15).join(", ")
    records.push({
      content: `Files referenced: ${fileList}`,
      type: "file",
      importance: 5,
      keywords: "files," + [...allFiles].map((f: string) => f.replace(/[^a-zA-Z0-9_\/.-]/g, "")).join(",").toLowerCase().substring(0, 100),
      tags: "files",
      session_id: meta.sid,
      relevance_score: 0.5,
      project_path: projectPath,
    })
  }

  if (allCommands.size > 0) {
    const cmdList = [...allCommands].slice(0, 5).join(" | ")
    records.push({
      content: `Shell commands: ${cmdList.substring(0, 250)}`,
      type: "shell",
      importance: 4,
      keywords: "shell,commands,bash",
      tags: "shell,commands",
      session_id: meta.sid,
      relevance_score: 0.4,
      project_path: projectPath,
    })
  }

  if (assistantTexts.length > 0) {
    const combined = assistantTexts.join(" ").substring(0, 300).trim()
    if (combined.length >= 30) {
      const importance = extractImportance(combined)
      const keywords = extractEntities(combined).join(",").toLowerCase()
      const autoTags = generateAutoTags(combined).join(",")
      records.push({
        content: combined,
        type: "reference",
        importance: Math.max(3, importance - 1),
        keywords,
        tags: autoTags,
        session_id: meta.sid,
        relevance_score: 0.4,
        project_path: projectPath,
      })
    }
  }

  return records
}
