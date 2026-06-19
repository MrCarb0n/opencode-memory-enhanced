import type { ToolContext } from "./_shared"
import { createQueryTool } from "./query"
import { createStoreTool } from "./store"
import { createLearnTool } from "./learn"
import { createInfoTool } from "./info"
import { createCuratedTool } from "./curated"
import { createMaintainTool } from "./maintain"
import { createExportTool } from "./export"
import { createScanTool } from "./scan"

export function createTools(ctx: ToolContext) {
  return {
    ...createQueryTool(ctx),
    ...createStoreTool(ctx),
    ...createLearnTool(ctx),
    ...createInfoTool(ctx),
    ...createCuratedTool(ctx),
    ...createMaintainTool(ctx),
    ...createExportTool(ctx),
    ...createScanTool(ctx),
  }
}
