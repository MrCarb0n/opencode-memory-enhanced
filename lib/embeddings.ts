import { tokenize } from "./utils"

// ─── Configuration ────────────────────────────────────────────────
const EMBEDDING_DIM = 256
const VOCAB_SIZE = 8192

// ─── Deterministic Random Projection Matrix ───────────────────────
// Fixed seed ensures same matrix across sessions.
// Random projection preserves cosine similarity (JL lemma).
let _projectionMatrix: Float32Array | null = null

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function getProjectionMatrix(): Float32Array {
  if (_projectionMatrix) return _projectionMatrix
  const rng = mulberry32(42)
  const totalSize = VOCAB_SIZE * EMBEDDING_DIM
  _projectionMatrix = new Float32Array(totalSize)
  const CHUNK = 250000
  for (let i = 0; i < totalSize; i += CHUNK) {
    const end = Math.min(i + CHUNK, totalSize)
    for (let j = i; j < end; j++) {
      const u1 = rng()
      const u2 = rng()
      _projectionMatrix[j] = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2)
    }
  }
  return _projectionMatrix
}

// ─── Hashing Vectorizer (TF-IDF-like) ─────────────────────────────
function hashingVectorize(text: string): Float32Array {
  const tokens = tokenize(text)
  const vec = new Float32Array(VOCAB_SIZE)
  const tf = new Map<string, number>()
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
  for (const [token, count] of tf) {
    // Hash token to bucket, apply TF weighting
    let h = 0
    for (let i = 0; i < token.length; i++) {
      h = ((h << 5) - h + token.charCodeAt(i)) | 0
    }
    const bucket = Math.abs(h) % VOCAB_SIZE
    // Log-normalized TF
    vec[bucket] += 1 + Math.log(count)
  }
  return vec
}

// ─── Embed Text ───────────────────────────────────────────────────
export async function embed(text: string): Promise<number[]> {
  try {
    const tfidf = hashingVectorize(text)
    const matrix = getProjectionMatrix()

    // Collect non-zero TF-IDF indices for sparse projection
    const nonZero: number[] = []
    for (let i = 0; i < VOCAB_SIZE; i++) {
      if (tfidf[i] !== 0) nonZero.push(i)
    }

    // Sparse projection: only iterate non-zero entries
    const result = new Float32Array(EMBEDDING_DIM)
    for (const i of nonZero) {
      const val = tfidf[i]
      const rowOffset = i * EMBEDDING_DIM
      for (let j = 0; j < EMBEDDING_DIM; j++) {
        result[j] += val * matrix[rowOffset + j]
      }
    }

    // L2 normalize
    let norm = 0
    for (let i = 0; i < EMBEDDING_DIM; i++) norm += result[i] * result[i]
    norm = Math.sqrt(norm)
    if (norm > 0) {
      for (let i = 0; i < EMBEDDING_DIM; i++) result[i] /= norm
    }

    return Array.from(result)
  } catch (e) {
    console.error("[memory-enhanced] Embedding failed:", e)
    return []
  }
}

// ─── Cosine Similarity (vector) ───────────────────────────────────
export function vectorCosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// ─── Serialize / Deserialize ──────────────────────────────────────
export function serializeEmbedding(vec: number[]): string {
  return JSON.stringify(vec)
}

export function deserializeEmbedding(raw: string | null): number[] {
  if (!raw || raw === "") return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length === EMBEDDING_DIM) return parsed
    return []
  } catch {
    return []
  }
}

// ─── Model Status ─────────────────────────────────────────────────
export function embeddingStatus(): { loaded: boolean; loading: boolean; dim: number; model: string } {
  return { loaded: true, loading: false, dim: EMBEDDING_DIM, model: "random-projection-tfidf" }
}

// ─── Preload ─────────────────────────────────────────────────────
export function preloadEmbeddings(): boolean {
  return !!_projectionMatrix || !!getProjectionMatrix()
}
