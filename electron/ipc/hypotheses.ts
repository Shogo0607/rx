import { ipcMain } from 'electron'
import { getDb } from '../services/database'

interface HypothesisRow {
  id: string
  project_id: string
  question_id: string | null
  title: string
  description: string | null
  null_hypothesis: string | null
  alt_hypothesis: string | null
  status: string
  evidence: string | null
  confidence: number | null
  created_at: string
  updated_at: string
}

function rowToHypothesis(row: HypothesisRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    questionId: row.question_id,
    title: row.title,
    description: row.description,
    nullHypothesis: row.null_hypothesis,
    altHypothesis: row.alt_hypothesis,
    status: row.status,
    evidence: row.evidence,
    confidence: row.confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

interface HypothesisListInput {
  projectId: string
}

interface HypothesisCreateInput {
  projectId: string
  questionId?: string
  title: string
  description?: string
  nullHypothesis?: string
  altHypothesis?: string
  status?: string
  evidence?: string
  confidence?: number
}

interface HypothesisUpdateInput {
  id: string
  questionId?: string
  title?: string
  description?: string
  nullHypothesis?: string
  altHypothesis?: string
  status?: string
  evidence?: string
  confidence?: number
}

export function registerHypothesisHandlers(): void {
  ipcMain.handle('hypothesis:list', async (_event, input: HypothesisListInput) => {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM hypotheses WHERE project_id = ? ORDER BY created_at ASC')
      .all(input.projectId) as HypothesisRow[]
    return rows.map(rowToHypothesis)
  })

  ipcMain.handle('hypothesis:create', async (_event, input: HypothesisCreateInput) => {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO hypotheses (
        id, project_id, question_id, title, description,
        null_hypothesis, alt_hypothesis, status, evidence, confidence,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.questionId || null,
      input.title,
      input.description || null,
      input.nullHypothesis || null,
      input.altHypothesis || null,
      input.status || 'draft',
      input.evidence || null,
      input.confidence ?? null,
      now,
      now
    )

    const row = db
      .prepare('SELECT * FROM hypotheses WHERE id = ?')
      .get(id) as HypothesisRow
    return rowToHypothesis(row)
  })

  ipcMain.handle('hypothesis:update', async (_event, input: HypothesisUpdateInput) => {
    const db = getDb()
    const setClauses: string[] = []
    const params: unknown[] = []

    const fieldMap: Record<string, string> = {
      questionId: 'question_id',
      title: 'title',
      description: 'description',
      nullHypothesis: 'null_hypothesis',
      altHypothesis: 'alt_hypothesis',
      status: 'status',
      evidence: 'evidence',
      confidence: 'confidence'
    }

    for (const [key, column] of Object.entries(fieldMap)) {
      const value = (input as Record<string, unknown>)[key]
      if (value !== undefined) {
        setClauses.push(`${column} = ?`)
        params.push(value)
      }
    }

    if (setClauses.length === 0) {
      const row = db
        .prepare('SELECT * FROM hypotheses WHERE id = ?')
        .get(input.id) as HypothesisRow
      return rowToHypothesis(row)
    }

    setClauses.push("updated_at = datetime('now')")
    params.push(input.id)

    db.prepare(
      `UPDATE hypotheses SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...params)

    const row = db
      .prepare('SELECT * FROM hypotheses WHERE id = ?')
      .get(input.id) as HypothesisRow
    return rowToHypothesis(row)
  })

  ipcMain.handle('hypothesis:delete', async (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM hypotheses WHERE id = ?').run(id)
  })
}
