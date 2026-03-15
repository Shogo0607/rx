import { ipcMain } from 'electron'
import { getDb } from '../services/database'

interface SprintRow {
  id: string
  project_id: string
  name: string
  goal: string | null
  status: string
  start_date: string | null
  end_date: string | null
  velocity: number | null
  retrospective: string | null
  created_at: string
  updated_at: string
}

function rowToSprint(row: SprintRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    goal: row.goal,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    velocity: row.velocity,
    retrospective: row.retrospective,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

interface SprintListInput {
  projectId: string
}

interface SprintCreateInput {
  projectId: string
  name: string
  goal?: string
  status?: string
  startDate?: string
  endDate?: string
  velocity?: number
  retrospective?: string
}

interface SprintUpdateInput {
  id: string
  name?: string
  goal?: string
  status?: string
  startDate?: string
  endDate?: string
  velocity?: number
  retrospective?: string
}

export function registerSprintHandlers(): void {
  ipcMain.handle('sprint:list', async (_event, input: SprintListInput) => {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM sprints WHERE project_id = ? ORDER BY created_at DESC')
      .all(input.projectId) as SprintRow[]
    return rows.map(rowToSprint)
  })

  ipcMain.handle('sprint:create', async (_event, input: SprintCreateInput) => {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO sprints (
        id, project_id, name, goal, status,
        start_date, end_date, velocity, retrospective,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.name,
      input.goal || null,
      input.status || 'planning',
      input.startDate || null,
      input.endDate || null,
      input.velocity ?? null,
      input.retrospective || null,
      now,
      now
    )

    const row = db
      .prepare('SELECT * FROM sprints WHERE id = ?')
      .get(id) as SprintRow
    return rowToSprint(row)
  })

  ipcMain.handle('sprint:update', async (_event, input: SprintUpdateInput) => {
    const db = getDb()
    const setClauses: string[] = []
    const params: unknown[] = []

    const fieldMap: Record<string, string> = {
      name: 'name',
      goal: 'goal',
      status: 'status',
      startDate: 'start_date',
      endDate: 'end_date',
      velocity: 'velocity',
      retrospective: 'retrospective'
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
        .prepare('SELECT * FROM sprints WHERE id = ?')
        .get(input.id) as SprintRow
      return rowToSprint(row)
    }

    setClauses.push("updated_at = datetime('now')")
    params.push(input.id)

    db.prepare(
      `UPDATE sprints SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...params)

    const row = db
      .prepare('SELECT * FROM sprints WHERE id = ?')
      .get(input.id) as SprintRow
    return rowToSprint(row)
  })

  ipcMain.handle('sprint:delete', async (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM sprints WHERE id = ?').run(id)
  })
}
