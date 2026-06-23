import { extractSessionMemories, type MemoryRecord } from "./extractor"

async function queryOpenCodeDB(dbPath: string, sql: string, params: any[] = []): Promise<any[]> {
  try {
    const mod = await import("better-sqlite3")
    const Database = mod.default || mod
    const odb = new Database(dbPath, { readonly: true })
    const stmt = odb.prepare(sql)
    const result = params.length > 0 ? stmt.all(...params) : stmt.all()
    odb.close()
    return result
  } catch {
    return []
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { dbPath, sessionIds, projectPath } = e.data as { dbPath: string; sessionIds: string[]; projectPath: string }
  const total = sessionIds.length
  const allRecords: MemoryRecord[] = []

  for (let i = 0; i < sessionIds.length; i++) {
    const sid = sessionIds[i]
    try {
      const messages = await queryOpenCodeDB(
        dbPath,
        "SELECT id, data, time_created FROM message WHERE session_id = ? ORDER BY time_created",
        [sid]
      )
      if (messages.length === 0) {
        self.postMessage({ type: "progress", sessionId: sid, done: i + 1, total, stored: 0 })
        continue
      }

      const sessionRow = await queryOpenCodeDB(
        dbPath,
        "SELECT id, title, model, cost, tokens_input, tokens_output FROM session WHERE id = ?",
        [sid]
      )
      const sess = sessionRow[0] ?? {}

      const records = extractSessionMemories(messages, {
        sid,
        title: sess.title,
        model: sess.model,
        cost: sess.cost,
        tokensIn: sess.tokens_input,
        tokensOut: sess.tokens_output,
      }, projectPath)

      allRecords.push(...records)
      self.postMessage({ type: "progress", sessionId: sid, done: i + 1, total, stored: records.length })
    } catch (err) {
      self.postMessage({ type: "progress", sessionId: sid, done: i + 1, total, stored: 0, error: String(err).substring(0, 200) })
    }
  }

  self.postMessage({ type: "done", memories: allRecords })
}
