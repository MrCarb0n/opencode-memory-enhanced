import { existsSync, readFileSync, writeFileSync, renameSync } from "fs"
import { Paths } from "./constants"

export interface MemoryConfig {
  auto_remember: boolean
  decay_rate: number
  access_boost: number
  toast_enabled: boolean
  scan_on_start: boolean
  max_memory_length: number
  importance_threshold: number
  hide_types: string[]
  tracked_tools: string[]
  dont_save_patterns: string[]
  auto_remember_patterns: string[]
  noise_commands: string[]
  auto_allow_keywords: string[]
  auto_deny_keywords: string[]
  tech_stack: string[]
  tag_patterns: [string, string][]
  memory_type_patterns: Record<string, string[]>
  importance_patterns: { pattern: string; score: number }[]
  graph_type_colors: Record<string, string>
  enable_vectors: boolean
  db_path: string | null
  write_approval: boolean
  agent_note_limit: number
  user_profile_limit: number
  security_scan: boolean
  background_consolidate: boolean
  context_budget: number
}

let _cfg: MemoryConfig | null = null

const DEFAULTS: MemoryConfig = {
  auto_remember: true,
  decay_rate: 0.01,
  access_boost: 0.05,
  toast_enabled: true,
  scan_on_start: true,
  max_memory_length: 300,
  importance_threshold: 3,
  hide_types: [],
  tracked_tools: ["bash", "read", "write", "edit", "grep", "glob"],
  dont_save_patterns: [
    "/\\b(code pattern|coding style|convention|architecture|file path|file structure)\\b/i",
    "/\\b(git log|git blame|commit history|who changed|recent changes)\\b/i",
    "/\\b(debug|fix|solution|workaround|hotfix|patch)\\b/i",
    "/\\b(this (file|function|class|method) (is|has|does))\\b/i",
    "/\\b(the (code|implementation|logic) (is|has|does))\\b/i",
  ],
  auto_remember_patterns: [
    "/\\b(i prefer|i like|i want|i need|i use|i always|i never|i usually)\\b/i",
    "/\\b(this project uses|we're using|we use|the (api|database|server|config) is)\\b/i",
    "/\\b(let's go with|i'll use|we decided|decided to use|switching to)\\b/i",
    "/\\b(the (endpoint|port|path|file|folder) is|located at|stored in)\\b/i",
    "/\\b(remember|don't forget|note that|important:)\\b/i",
    "/\\b(version \\d|v\\d+\\.\\d+)/i",
    "/\\b(react|vue|angular|svelte|nextjs|nuxt|express|fastify|django|flask|rails|laravel|spring)\\b/i",
    "/\\b(typescript|javascript|python|rust|go|java|c\\+\\+|ruby|php)\\b/i",
    "/\\b(postgres|mysql|mongo|redis|sqlite|elasticsearch)\\b/i",
    "/\\b(aws|gcp|azure|docker|kubernetes|vercel|netlify)\\b/i",
  ],
  noise_commands: ["npx ", "npm ", "bun ", "deno "],
  auto_allow_keywords: ["auto-allow", "auto-approve"],
  auto_deny_keywords: ["deny"],
  tech_stack: [
    "react", "vue", "angular", "svelte", "nextjs", "nuxt",
    "express", "fastify", "django", "flask", "rails", "laravel", "spring",
    "typescript", "javascript", "python", "rust", "go", "java", "ruby", "php",
    "postgres", "mysql", "mongo", "redis", "sqlite",
    "docker", "kubernetes", "aws", "gcp", "azure", "vercel", "netlify",
  ],
  tag_patterns: [
    ["preference", "/\\b(prefer|like|want|choose|favorite)\\b/i"],
    ["error", "/\\b(error|bug|fail|crash|broken|issue)\\b/i"],
    ["decision", "/\\b(decided|chose|go with|switching to|picked)\\b/i"],
    ["config", "/\\b(config|setting|setup|env|option)\\b/i"],
    ["api", "/\\b(api|endpoint|route|request|response|fetch)\\b/i"],
    ["database", "/\\b(database|db|sql|query|table|schema)\\b/i"],
    ["auth", "/\\b(auth|login|password|token|jwt|session|oauth)\\b/i"],
    ["deploy", "/\\b(deploy|release|ship|build|ci|cd|pipeline)\\b/i"],
    ["performance", "/\\b(fast|slow|optimize|cache|latency|speed)\\b/i"],
    ["security", "/\\b(security|vulnerability|exploit|sanitize|encrypt)\\b/i"],
    ["testing", "/\\b(test|spec|mock|assert|coverage|e2e)\\b/i"],
    ["refactor", "/\\b(refactor|reorganize|restructure|clean up|simplify)\\b/i"],
    ["deadline", "/\\b(deadline|due date|sprint|milestone|timeline)\\b/i"],
    ["team", "/\\b(team|collaborate|pair|review|pr|merge)\\b/i"],
    ["docs", "/\\b(document|readme|comment|doc|guide|tutorial)\\b/i"],
  ],
  memory_type_patterns: {
    user: [
      "/\\b(i'm|i am|my role|my job|my position|i work|i do)\\b/i",
      "/\\b(i prefer|i like|i want|i need|i use|i always|i never|i usually)\\b/i",
      "/\\b(i've been|i have been|my background|my experience)\\b/i",
    ],
    feedback: [
      "/\\b(don't|do not|stop|never|always|no not|wrong|incorrect)\\b/i",
      "/\\b(yes exactly|perfect|keep doing|that's right|exactly|good)\\b/i",
      "/\\b(should|must|need to|have to|required|important)\\b/i",
    ],
    project: [
      "/\\b(this project|we're using|we use|the (api|database|server|config) is)\\b/i",
      "/\\b(let's go with|i'll use|we decided|decided to use|switching to)\\b/i",
      "/\\b(deadline|release|freeze|launch|deploy|shipping)\\b/i",
      "/\\b(version \\d|v\\d+\\.\\d+|milestone|sprint)\\b/i",
    ],
    reference: [
      "/\\b(check|look at|see|reference|dashboard|board|channel)\\b/i",
      "/\\b(linear|jira|slack|discord|grafana|datadog|sentry)\\b/i",
      "/\\b(documentation|docs|wiki|notion|confluence)\\b/i",
      "/\\b(track|ticket|issue|bug|feature request)\\b/i",
    ],
  },
  importance_patterns: [
    { pattern: "/\\b(important|critical|must|always|never|remember)\\b/i", score: 8 },
    { pattern: "/\\b(prefer|like|want|need|use)\\b/i", score: 7 },
    { pattern: "/\\b(project|app|server|api|config)\\b/i", score: 6 },
  ],
  graph_type_colors: { concept: "#E8F0FE", framework: "#FFF3E0", tool: "#E8F5E9", person: "#FCE4EC" },
  enable_vectors: true,
  db_path: null,
  write_approval: false,
  agent_note_limit: 2200,
  user_profile_limit: 1375,
  security_scan: true,
  background_consolidate: true,
  context_budget: 2000,
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return (a as unknown[]).every((v, i) => deepEqual(v, b[i]))
  }
  if (a && typeof a === "object" && b && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a as object), kb = Object.keys(b as object)
    if (ka.length !== kb.length) return false
    return ka.every(k => deepEqual((a as any)[k], (b as any)[k]))
  }
  return false
}

function configDiff(cfg: MemoryConfig): Partial<MemoryConfig> {
  const delta: Record<string, unknown> = {}
  for (const k of Object.keys(DEFAULTS) as (keyof MemoryConfig)[]) {
    if (!deepEqual(cfg[k], DEFAULTS[k])) {
      if (k === "db_path" && cfg[k] === Paths.db()) continue
      delta[k] = cfg[k]
    }
  }
  return delta as Partial<MemoryConfig>
}

export function loadConfig(): MemoryConfig {
  if (_cfg) return _cfg
  const configPath = Paths.userConfig()
  try {
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, "utf8")
      const user = JSON.parse(raw)
      _cfg = { ...DEFAULTS, ...user }
    }
  } catch (e) { console.debug("[memory-enhanced] corrupt config, using defaults:", e) }
  if (!_cfg) _cfg = { ...DEFAULTS }
  if (!_cfg.db_path) _cfg.db_path = Paths.db()
  return _cfg!
}

export function getConfig(): MemoryConfig {
  if (!_cfg) loadConfig()
  return { ..._cfg! }
}

function atomicWrite(path: string, content: string): void {
  const tmp = path + ".tmp." + Date.now()
  writeFileSync(tmp, content, "utf8")
  renameSync(tmp, path)
}

export function saveConfig(cfg: MemoryConfig): void {
  _cfg = { ...cfg }
  try {
    const delta = configDiff(cfg)
    if (Object.keys(delta).length === 0) {
      if (existsSync(Paths.userConfig())) atomicWrite(Paths.userConfig(), "{}")
      return
    }
    atomicWrite(Paths.userConfig(), JSON.stringify(delta, null, 2))
  } catch (e) {
    console.error("[memory-enhanced] failed to save config:", e)
  }
}
