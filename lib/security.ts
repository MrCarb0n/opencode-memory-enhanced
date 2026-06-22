interface ScanResult {
  safe: boolean
  reason?: string
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|above|below)\s+instructions/i,
  /system\s*(prompt|message|instruction)/i,
  /you\s+(are|were)\s+(an?\s+)?(AI|assistant|agent|model)/i,
  /forget\s+(all\s+)?(previous|everything)/i,
  /new\s+(instructions|directive|command)/i,
]

const EXFILTRATION_PATTERNS: RegExp[] = [
  /(send|exfiltrate|upload|leak)\s+(my\s+)?(data|files|keys|secrets|credentials)/i,
  /(ssh[-_])?(key|private|secret)\s*\w{20,}/,
  /BEGIN\s+(RSA|EC|DSA|OPENSSH|PGP)\s+PRIVATE\s+KEY/,
  /(api[-_])?(key|token|secret)\s*[:=]\s*['\"][a-zA-Z0-9_-]{16,}['\"]/i,
  /password\s*[:=]\s*['\"][^'\"]+['\"]/i,
  /(aws|gcp|azure)_?(access|secret|key|token|credential)/i,
]

const UNICODE_ATTACK_PATTERNS: RegExp[] = [
  /\u202E/, // RIGHT-TO-LEFT OVERRIDE
  /[\u2066\u2067\u2068\u2069]/, // bidi isolates
  /[\u200B-\u200D\uFEFF]/, // zero-width chars
  /[\u00AD\u2060]/, // soft hyphen, word joiner
]

const DANGEROUS_PATTERNS: RegExp[] = [
  /rm\s+-rf\s+\/|format\s+\w+:|>(\/dev\/)?sda/i,
  /DROP\s+(TABLE|DATABASE|SCHEMA)/i,
  /TRUNCATE\s+(TABLE|DATABASE)/i,
  /(wget|curl)\s+.*(\||-o\s+|--output\s+)/i,
]

export function scanMemoryContent(content: string): ScanResult {
  if (!content || content.trim().length === 0) {
    return { safe: false, reason: "empty content" }
  }

  for (const re of INJECTION_PATTERNS) {
    if (re.test(content)) {
      return { safe: false, reason: `prompt injection pattern detected: ${re.source.substring(0, 40)}` }
    }
  }

  for (const re of EXFILTRATION_PATTERNS) {
    if (re.test(content)) {
      return { safe: false, reason: `possible exfiltration pattern detected: ${re.source.substring(0, 40)}` }
    }
  }

  for (const re of UNICODE_ATTACK_PATTERNS) {
    if (re.test(content)) {
      return { safe: false, reason: "invisible unicode control characters detected" }
    }
  }

  for (const re of DANGEROUS_PATTERNS) {
    if (re.test(content)) {
      return { safe: false, reason: `destructive command pattern detected: ${re.source.substring(0, 40)}` }
    }
  }

  return { safe: true }
}
