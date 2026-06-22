import { createQueryTool } from "./query"
import { createStoreTool } from "./store"
import { createLearnTool } from "./learn"
import { createInfoTool } from "./info"
import { createCuratedTool } from "./curated"
import { createMaintainTool } from "./maintain"
import { createExportTool } from "./export"
import { createScanTool } from "./scan"

export function createTools(client: any, projectPath: string) {
  return {
    ...createQueryTool(client, projectPath),
    ...createStoreTool(client, projectPath),
    ...createLearnTool(client, projectPath),
    ...createInfoTool(client, projectPath),
    ...createCuratedTool(client, projectPath),
    ...createMaintainTool(client, projectPath),
    ...createExportTool(client, projectPath),
    ...createScanTool(client, projectPath),
  }
}
