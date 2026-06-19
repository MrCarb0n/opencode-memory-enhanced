#!/usr/bin/env node
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs"
import { join, dirname } from "path"
import { homedir, platform } from "os"
import { execSync } from "child_process"
import { fileURLToPath } from "url"

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const PKG = JSON.parse(readFileSync(join(SELF_DIR, "package.json"), "utf8"))
const VERSION = PKG.version || "0.0.0"
const NAME = "memory-enhanced"
const MIN_NODE = 18
const REQUIRED = Object.keys(PKG.dependencies || {}).filter(d => d.startsWith("@opencode-ai/") || d === "fts5-sql-bundle")
const LIB_FILES = readdirSync(join(SELF_DIR, "lib")).filter(f => f.endsWith(".ts")).sort()
const TOOLS_FILES = existsSync(join(SELF_DIR, "lib", "tools")) ? readdirSync(join(SELF_DIR, "lib", "tools")).filter(f => f.endsWith(".ts")).sort() : []

if (!LIB_FILES.includes("constants.ts")) {
  console.error("Error: lib/constants.ts not found — run from plugin root")
  process.exit(1)
}

function configDir() {
  const candidates = platform() === "win32"
    ? [join(homedir(), ".config", "opencode"), join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "opencode")]
    : [join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "opencode")]
  return candidates.find(c => existsSync(join(c, "opencode.jsonc"))) || candidates[0]
}

function nodeVersion() {
  const m = process.version.match(/^v(\d+)\./)
  if (!m || Number(m[1]) < MIN_NODE) {
    console.error(`Error: Node ${MIN_NODE}+ required, found ${process.version}`)
    process.exit(1)
  }
}

function checkSourceFiles() {
  const files = [`${NAME}.ts`, "plugin.json", "SKILL.md", "package.json"]
  const missing = files.filter(f => !existsSync(join(SELF_DIR, f)))
  if (missing.length) {
    console.error(`Error: missing source files: ${missing.join(", ")}`)
    process.exit(1)
  }
}

console.log(`\n  ${NAME} v${VERSION} — installing to ${configDir()}`)
nodeVersion()
checkSourceFiles()

// Create directories
const dirs = [
  configDir(),
  join(configDir(), "plugins", "lib"),
  join(configDir(), "skills", NAME),
]
for (const d of dirs) mkdirSync(d, { recursive: true })

// Remove stale lib/ files in target not in source
const targetLibDir = join(configDir(), "plugins", "lib")
if (existsSync(targetLibDir)) {
  for (const f of readdirSync(targetLibDir)) {
    if (f.endsWith(".ts") && !LIB_FILES.includes(f)) {
      unlinkSync(join(targetLibDir, f))
      console.log(`  rm    ${join(targetLibDir, f)}`)
    }
  }
}
// Clean stale tools/ files
const targetToolsDir = join(targetLibDir, "tools")
if (existsSync(targetToolsDir)) {
  for (const f of readdirSync(targetToolsDir)) {
    if (f.endsWith(".ts") && !TOOLS_FILES.includes(f)) {
      unlinkSync(join(targetToolsDir, f))
      console.log(`  rm    ${join(targetToolsDir, f)}`)
    }
  }
}

// Copy files
const copies = [
  { s: join(SELF_DIR, `${NAME}.ts`), d: join(configDir(), "plugins", `${NAME}.ts`) },
  ...LIB_FILES.map(f => ({ s: join(SELF_DIR, "lib", f), d: join(configDir(), "plugins", "lib", f) })),
  ...TOOLS_FILES.map(f => ({ s: join(SELF_DIR, "lib", "tools", f), d: join(configDir(), "plugins", "lib", "tools", f) })),
  { s: join(SELF_DIR, "SKILL.md"), d: join(configDir(), "skills", NAME, "SKILL.md") },
]
for (const { s, d } of copies) {
  mkdirSync(join(d, ".."), { recursive: true })
  cpSync(s, d, { force: true })
  console.log(`  copy  ${d}`)
}

// Register plugin tools so OpenCode routes user commands (memory-status, etc.) to the plugin
// Uses text-level manipulation to NEVER corrupt other config fields
const cfgPath = join(configDir(), "opencode.jsonc")
let raw
try { raw = readFileSync(cfgPath, "utf8") } catch { raw = '{\n  "plugin": []\n}' }

const entry = `./plugins/${NAME}.ts`

if (raw.includes(JSON.stringify(entry))) {
  console.log(`  already registered in ${cfgPath}`)
} else {
  // Remove any stale file:// URI entries for this plugin
  raw = raw.replace(new RegExp(`"file:///[^"]*${NAME}[^"]*"\\s*,?\\s*`, "g"), "")

  // Add entry to the plugin array, or create one
  const pluginMatch = raw.match(/"plugin"\s*:\s*\[([\s\S]*?)\]/)
  if (pluginMatch) {
    const existing = pluginMatch[1].trim()
    const inner = existing ? existing + ",\n    " + JSON.stringify(entry) : JSON.stringify(entry)
    raw = raw.replace(/"plugin"\s*:\s*\[([\s\S]*?)\]/, `"plugin": [\n    ${inner}\n  ]`)
  } else {
    const lastBrace = raw.lastIndexOf("}")
    raw = raw.slice(0, lastBrace) + ',\n  "plugin": [\n    ' + JSON.stringify(entry) + "\n  ]\n" + raw.slice(lastBrace)
  }

  writeFileSync(cfgPath, raw, "utf8")
  console.log(`  register  ${cfgPath}`)
}

// Dependencies — sync with source, removing stale deps
const pkgPath = join(configDir(), "package.json")
let pkg
try { pkg = JSON.parse(readFileSync(pkgPath, "utf8")) } catch { pkg = { dependencies: {} } }
if (!pkg.dependencies) pkg.dependencies = {}
const sourceDeps = PKG.dependencies || {}
// Remove deps no longer in source (except user-added non-plugin deps)
for (const name of Object.keys(pkg.dependencies)) {
  if (name.startsWith("@opencode-ai/") || name === "fts5-sql-bundle" || name in sourceDeps) {
    if (!(name in sourceDeps)) delete pkg.dependencies[name]
  }
}
// Add/update source deps
for (const [name, ver] of Object.entries(sourceDeps)) {
  pkg.dependencies[name] = ver
}
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8")

// Try vendored tarballs first
const vendorDir = join(SELF_DIR, "vendor")
let installed = false
if (existsSync(vendorDir)) {
  const tarballs = readdirSync(vendorDir).filter(f => f.endsWith(".tgz"))
  if (tarballs.length >= REQUIRED.length) {
    try {
      execSync(`npm install ${tarballs.map(t => `"${join(vendorDir, t)}"`).join(" ")} --no-save`, {
        cwd: configDir(), stdio: "pipe", windowsHide: true, timeout: 120000
      })
      installed = true
      console.log("  npm install (vendored)")
    } catch {}
  }
}
if (!installed) {
  execSync("npm install", { cwd: configDir(), stdio: "inherit", windowsHide: true, timeout: 120000 })
  console.log("  npm install (registry)")
}

// Verify
const errors = []
for (const f of [`${NAME}.ts`, "lib/db.ts", "lib/config.ts", "lib/constants.ts", "lib/tools/index.ts"]) {
  if (!existsSync(join(configDir(), "plugins", f))) errors.push(f)
}
if (!existsSync(join(configDir(), "skills", NAME, "SKILL.md"))) errors.push("SKILL.md")
if (!existsSync(join(configDir(), "node_modules", "@opencode-ai", "plugin"))) errors.push("@opencode-ai/plugin")
if (!existsSync(join(configDir(), "node_modules", "fts5-sql-bundle"))) errors.push("fts5-sql-bundle")

if (errors.length) {
  console.error(`\nIssues: ${errors.join(", ")}`)
  process.exit(1)
}

// Write version marker so constants.ts resolves version at runtime
writeFileSync(join(configDir(), "plugins", "package.json"), JSON.stringify({ version: VERSION }), "utf8")

console.log(`\n  ${NAME} v${VERSION} installed. Restart OpenCode.\n`)
