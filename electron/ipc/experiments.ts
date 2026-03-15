import { ipcMain } from 'electron'
import { getDb } from '../services/database'

interface ExperimentRow {
  id: string
  project_id: string
  hypothesis_id: string | null
  title: string
  description: string | null
  methodology: string | null
  variables: string
  status: string
  results: string | null
  conclusion: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

function rowToExperiment(row: ExperimentRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    hypothesisId: row.hypothesis_id,
    title: row.title,
    description: row.description,
    methodology: row.methodology,
    variables: JSON.parse(row.variables),
    status: row.status,
    results: row.results,
    conclusion: row.conclusion,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

interface ExperimentListInput {
  projectId: string
}

interface ExperimentCreateInput {
  projectId: string
  hypothesisId?: string
  title: string
  description?: string
  methodology?: string
  variables?: Record<string, unknown>
  status?: string
  results?: string
  conclusion?: string
  startedAt?: string
  completedAt?: string
}

interface ExperimentUpdateInput {
  id: string
  hypothesisId?: string
  title?: string
  description?: string
  methodology?: string
  variables?: Record<string, unknown>
  status?: string
  results?: string
  conclusion?: string
  startedAt?: string
  completedAt?: string
}

export function registerExperimentHandlers(): void {
  ipcMain.handle('experiment:list', async (_event, input: ExperimentListInput) => {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM experiments WHERE project_id = ? ORDER BY created_at ASC')
      .all(input.projectId) as ExperimentRow[]
    return rows.map(rowToExperiment)
  })

  ipcMain.handle('experiment:create', async (_event, input: ExperimentCreateInput) => {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO experiments (
        id, project_id, hypothesis_id, title, description,
        methodology, variables, status, results, conclusion,
        started_at, completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.hypothesisId || null,
      input.title,
      input.description || null,
      input.methodology || null,
      input.variables ? JSON.stringify(input.variables) : '{}',
      input.status || 'planned',
      input.results || null,
      input.conclusion || null,
      input.startedAt || null,
      input.completedAt || null,
      now,
      now
    )

    const row = db
      .prepare('SELECT * FROM experiments WHERE id = ?')
      .get(id) as ExperimentRow
    return rowToExperiment(row)
  })

  ipcMain.handle('experiment:update', async (_event, input: ExperimentUpdateInput) => {
    const db = getDb()
    const setClauses: string[] = []
    const params: unknown[] = []

    const fieldMap: Record<string, string> = {
      hypothesisId: 'hypothesis_id',
      title: 'title',
      description: 'description',
      methodology: 'methodology',
      status: 'status',
      results: 'results',
      conclusion: 'conclusion',
      startedAt: 'started_at',
      completedAt: 'completed_at'
    }

    for (const [key, column] of Object.entries(fieldMap)) {
      const value = (input as Record<string, unknown>)[key]
      if (value !== undefined) {
        setClauses.push(`${column} = ?`)
        params.push(value)
      }
    }

    if (input.variables !== undefined) {
      setClauses.push('variables = ?')
      params.push(JSON.stringify(input.variables))
    }

    if (setClauses.length === 0) {
      const row = db
        .prepare('SELECT * FROM experiments WHERE id = ?')
        .get(input.id) as ExperimentRow
      return rowToExperiment(row)
    }

    setClauses.push("updated_at = datetime('now')")
    params.push(input.id)

    db.prepare(
      `UPDATE experiments SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...params)

    const row = db
      .prepare('SELECT * FROM experiments WHERE id = ?')
      .get(input.id) as ExperimentRow
    return rowToExperiment(row)
  })

  ipcMain.handle('experiment:delete', async (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM experiments WHERE id = ?').run(id)
  })
}
