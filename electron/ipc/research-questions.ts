import { ipcMain } from 'electron'
import { getDb } from '../services/database'

interface ResearchQuestionRow {
  id: string
  project_id: string
  question: string
  type: string
  status: string
  answer: string | null
  evidence_summary: string | null
  created_at: string
  updated_at: string
}

function rowToResearchQuestion(row: ResearchQuestionRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    question: row.question,
    type: row.type,
    status: row.status,
    answer: row.answer,
    evidenceSummary: row.evidence_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

interface RQListInput {
  projectId: string
}

interface RQCreateInput {
  projectId: string
  question: string
  type?: string
  status?: string
  answer?: string
  evidenceSummary?: string
}

interface RQUpdateInput {
  id: string
  question?: string
  type?: string
  status?: string
  answer?: string
  evidenceSummary?: string
}

export function registerResearchQuestionHandlers(): void {
  ipcMain.handle('rq:list', async (_event, input: RQListInput) => {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM research_questions WHERE project_id = ? ORDER BY created_at ASC')
      .all(input.projectId) as ResearchQuestionRow[]
    return rows.map(rowToResearchQuestion)
  })

  ipcMain.handle('rq:create', async (_event, input: RQCreateInput) => {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO research_questions (
        id, project_id, question, type, status, answer, evidence_summary,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.question,
      input.type || 'primary',
      input.status || 'open',
      input.answer || null,
      input.evidenceSummary || null,
      now,
      now
    )

    const row = db
      .prepare('SELECT * FROM research_questions WHERE id = ?')
      .get(id) as ResearchQuestionRow
    return rowToResearchQuestion(row)
  })

  ipcMain.handle('rq:update', async (_event, input: RQUpdateInput) => {
    const db = getDb()
    const setClauses: string[] = []
    const params: unknown[] = []

    const fieldMap: Record<string, string> = {
      question: 'question',
      type: 'type',
      status: 'status',
      answer: 'answer',
      evidenceSummary: 'evidence_summary'
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
        .prepare('SELECT * FROM research_questions WHERE id = ?')
        .get(input.id) as ResearchQuestionRow
      return rowToResearchQuestion(row)
    }

    setClauses.push("updated_at = datetime('now')")
    params.push(input.id)

    db.prepare(
      `UPDATE research_questions SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...params)

    const row = db
      .prepare('SELECT * FROM research_questions WHERE id = ?')
      .get(input.id) as ResearchQuestionRow
    return rowToResearchQuestion(row)
  })

  ipcMain.handle('rq:delete', async (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM research_questions WHERE id = ?').run(id)
  })
}
