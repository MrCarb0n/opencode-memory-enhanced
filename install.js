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
const REQUIRED = Object.keys(PKG.dependencies || {}).filter(d => d.startsWith("@opencode-ai/"))
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
  return candidates.find(c => existsSync(join(c, "opencode.jsonc")) || existsSync(join(c, "opencode.json"))) || candidates[0]
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

// Plugin is auto-loaded from the global plugin directory (~/.config/opencode/plugins/)
// No config registration needed — skip to avoid duplicate loading.

// Dependencies — sync with source, removing stale deps
const pkgPath = join(configDir(), "package.json")
let pkg
try { pkg = JSON.parse(readFileSync(pkgPath, "utf8")) } catch { pkg = { dependencies: {} } }
if (!pkg.dependencies) pkg.dependencies = {}
const sourceDeps = PKG.dependencies || {}
// Remove deps no longer in source (except user-added non-plugin deps)
for (const name of Object.keys(pkg.dependencies)) {
  if (name.startsWith("@opencode-ai/") || name in sourceDeps) {
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
for (const f of [`${NAME}.ts`, "lib/db.ts", "lib/config.ts", "lib/constants.ts"]) {
  if (!existsSync(join(configDir(), "plugins", f))) errors.push(f)
}
// Check for tools (single file or directory with index)
const toolsSingle = existsSync(join(configDir(), "plugins", "lib", "tools.ts"))
const toolsIndex = existsSync(join(configDir(), "plugins", "lib", "tools", "index.ts"))
if (!toolsSingle && !toolsIndex) errors.push("lib/tools.ts or lib/tools/index.ts")
if (!existsSync(join(configDir(), "skills", NAME, "SKILL.md"))) errors.push("SKILL.md")
if (!existsSync(join(configDir(), "node_modules", "@opencode-ai", "plugin"))) errors.push("@opencode-ai/plugin")

if (errors.length) {
  console.error(`\nIssues: ${errors.join(", ")}`)
  process.exit(1)
}

// Write version marker so constants.ts resolves version at runtime
const pluginsPkgPath = join(configDir(), "plugins", "package.json")
let pluginsPkg
try { pluginsPkg = JSON.parse(readFileSync(pluginsPkgPath, "utf8")) } catch { pluginsPkg = {} }
pluginsPkg.version = VERSION
writeFileSync(pluginsPkgPath, JSON.stringify(pluginsPkg, null, 2) + "\n", "utf8")

console.log(`\n  ${NAME} v${VERSION} installed. Restart OpenCode.\n`)
