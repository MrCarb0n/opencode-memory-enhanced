import { truncate } from "../utils"

export interface ToolContext {
  client: any
  sessionId: string
  projectPath: string
}

const YIELD_INTERVAL = 50

export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export { YIELD_INTERVAL }

export function formatMemoryLine(m: any): string {
  return `  - #${m.id} [${m.type}|${m.scope}|i:${m.importance}|acc:${m.access_count}] ${truncate(m.content, 80)}`
}
