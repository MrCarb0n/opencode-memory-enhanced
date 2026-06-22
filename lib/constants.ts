import { join, dirname } from "path"
import { homedir, platform } from "os"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"

// ─── Platform Detection ──────────────────────────────────────────
export const IS_WIN = platform() === "win32"

// ─── Version (read from package.json, one level up from lib/) ────
let _version: string
try {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json")
  _version = JSON.parse(readFileSync(pkgPath, "utf8")).version || "0.0.0"
} catch {
  _version = "0.0.0"
}
export const VERSION = _version

// ─── Path Resolution ─────────────────────────────────────────────
// Priority: env var → platform standard → OS fallback

function dataRoot(): string {
  return process.env.MEMORY_ENHANCED_DATA_DIR
    || join(process.env.USERPROFILE || process.env.HOME || homedir(), ".opencode")
}

function opencodeConfigDir(): string {
  if (process.env.MEMORY_ENHANCED_CONFIG_DIR) return process.env.MEMORY_ENHANCED_CONFIG_DIR
  if (IS_WIN) {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "opencode")
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "opencode")
}

export const Paths = {
  dataRoot,
  opencodeConfig: opencodeConfigDir,
  db: (override?: string) => override || join(dataRoot(), "memory-enhanced.db"),
  userConfig: () => join(dataRoot(), "memory-config.json"),
  agentsMd: () => join(opencodeConfigDir(), "AGENTS.md"),
  pluginEntry: () => join(opencodeConfigDir(), "plugins", "memory-enhanced.ts"),
  pluginDir: () => join(opencodeConfigDir(), "plugins"),
  libDir: () => join(opencodeConfigDir(), "plugins", "lib"),
  configJsonc: () => join(opencodeConfigDir(), "opencode.jsonc"),
  packageJson: () => join(opencodeConfigDir(), "package.json"),
}

// ─── Table Names ─────────────────────────────────────────────────
export const Tables = {
  memories: "memories",
  entities: "entities",
  relationships: "relationships",
  conversationArcs: "conversation_arcs",
  conceptTags: "concept_tags",
  learningPatterns: "learning_patterns",
  memoryLinks: "memory_links",
  scannedSessions: "scanned_sessions",
  memoriesFts: "memories_fts",
  curatedStore: "curated_store",
  pendingMemories: "pending_memories",
  proceduralKnowledge: "procedural_knowledge",
} as const

export const CURATED_STORE_LIMITS = {
  agent_note: 2200,
  user_profile: 1375,
} as const

export type CuratedStore = keyof typeof CURATED_STORE_LIMITS
