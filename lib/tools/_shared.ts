import { truncate } from "../utils"

export function formatMemoryLine(m: any): string {
  return `  - #${m.id} [${m.type}|${m.scope}|i:${m.importance}|acc:${m.access_count}] ${truncate(m.content, 80)}`
}
