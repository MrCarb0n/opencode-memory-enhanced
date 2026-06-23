
export function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
}

function freqMap(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1)
  return m
}

export function cosineSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)
  if (tokensA.length === 0 || tokensB.length === 0) return 0
  const fA = freqMap(tokensA)
  const fB = freqMap(tokensB)
  const allTokens = new Set([...fA.keys(), ...fB.keys()])
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (const token of allTokens) {
    const countA = fA.get(token) ?? 0
    const countB = fB.get(token) ?? 0
    dotProduct += countA * countB
    normA += countA * countA
    normB += countB * countB
  }
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.substring(0, maxLen) + "..." : text
}
