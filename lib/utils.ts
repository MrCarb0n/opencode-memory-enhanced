// ─── 64-bit SimHash (pure JS, no deps) ──────────────────────────
// Returns a 64-bit BigInt fingerprint. Similar texts produce similar
// fingerprints (small Hamming distance).
export function simhash(text: string): bigint {
  const tokens = tokenize(text)
  if (tokens.length === 0) return 0n

  const bits = new Int32Array(64)
  for (const token of tokens) {
    let h = hash32(token)
    const weight = token.length
    for (let i = 0; i < 64; i++) {
      if (h & 1) bits[i] += weight
      else bits[i] -= weight
      h >>>= 1
    }
  }
  let fp = 0n
  for (let i = 0; i < 64; i++) {
    if (bits[i] > 0) fp |= (1n << BigInt(i))
  }
  return fp
}

function hash32(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return h
}

export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b
  let count = 0
  while (xor) {
    count += Number(xor & 1n)
    xor >>= 1n
  }
  return count
}

function porterStem(word: string): string {
  if (word.length < 3) return word
  let w = word.toLowerCase()
  // Step 1a
  if (w.endsWith("sses")) w = w.slice(0, -2)
  else if (w.endsWith("ies")) w = w.slice(0, -2)
  else if (w.endsWith("ss")) w = w
  else if (w.endsWith("s")) w = w.slice(0, -1)
  // Step 1b
  const m = w.match(/^(.*?[aeiou].*?)(ing|ed|ly|er)$/)
  if (m && m[1].length >= 1) {
    w = m[1]
    if (w.endsWith("at") || w.endsWith("bl") || w.endsWith("iz")) w += "e"
    else if (w.length > 2 && !/[aeiou][^aeiou]$/.test(w) && w[w.length-1] === w[w.length-2] && !"lsz".includes(w[w.length-1])) w = w.slice(0, -1)
  }
  // Step 1c
  if (w.endsWith("y") && /[aeiou]/.test(w.slice(0, -1))) w = w.slice(0, -1) + "i"
  // Step 2
  const step2: [RegExp, string][] = [
    [/ational$/, "ate"], [/tional$/, "tion"], [/enci$/, "ence"], [/anci$/, "ance"],
    [/izer$/, "ize"], [/abli$/, "able"], [/alli$/, "al"], [/entli$/, "ent"],
    [/eli$/, "e"], [/ousli$/, "ous"], [/ization$/, "ize"], [/ation$/, "ate"],
    [/ator$/, "ate"], [/alism$/, "al"], [/iveness$/, "ive"], [/fulness$/, "ful"],
    [/ousness$/, "ous"], [/aliti$/, "al"], [/iviti$/, "ive"], [/biliti$/, "ble"],
  ]
  for (const [re, replacement] of step2) {
    if (re.test(w)) { w = w.replace(re, replacement as string); break }
  }
  // Step 3
  if (/icate$/.test(w)) w = w.replace(/icate$/, "ic")
  else if (/ative$/.test(w)) w = w.replace(/ative$/, "")
  else if (/alize$/.test(w)) w = w.replace(/alize$/, "al")
  else if (/iciti$/.test(w)) w = w.replace(/iciti$/, "ic")
  else if (/ical$/.test(w)) w = w.replace(/ical$/, "ic")
  else if (/ful$/.test(w)) w = w.slice(0, -3)
  else if (/ness$/.test(w)) w = w.slice(0, -4)
  // Step 4
  if (/ement$/.test(w)) w = w.replace(/ement$/, "")
  else if (/ment$/.test(w)) w = w.replace(/ment$/, "")
  else if (/(tion|sion)$/.test(w)) w = w.replace(/.(?:t|s)ion$/, "")
  else if (/(ance|ence|able|ible|ant|ent|ism|ate|iti|ous|ive|ize)$/.test(w)) w = w.replace(/.(?:ance|ence|able|ible|ant|ent|ism|ate|iti|ous|ive|ize)$/, "")
  // Step 5a
  if (w.endsWith("e") && w.length > 2 && !/[aeiou][^aeiou]e$/.test(w)) w = w.slice(0, -1)
  // Step 5b
  if (w.endsWith("ll") && w.length > 3) w = w.slice(0, -1)
  return w
}

export function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .map(porterStem)
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
