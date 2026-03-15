import { ipcMain } from 'electron'
import { getDb } from '../services/database'

interface ImprovementCycleRow {
  id: string
  project_id: string
  title: string
  cycle_type: string
  plan: string | null
  do_actions: string | null
  check_results: string | null
  act_improvements: string | null
  status: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

function rowToImprovementCycle(row: ImprovementCycleRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    cycleType: row.cycle_type,
    plan: row.plan,
    doActions: row.do_actions,
    checkResults: row.check_results,
    actImprovements: row.act_improvements,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

interface ImprovementListInput {
  projectId: string
}

interface ImprovementCreateInput {
  projectId: string
  title: string
  cycleType?: string
  plan?: string
  doActions?: string
  checkResults?: string
  actImprovements?: string
  status?: string
  startedAt?: string
  completedAt?: string
}

interface ImprovementUpdateInput {
  id: string
  title?: string
  cycleType?: string
  plan?: string
  doActions?: string
  checkResults?: string
  actImprovements?: string
  status?: string
  startedAt?: string
  completedAt?: string
}

export function registerImprovementHandlers(): void {
  ipcMain.handle('improvement:list', async (_event, input: ImprovementListInput) => {
    const db = getDb()
    const rows = db
      .prepare(
        'SELECT * FROM improvement_cycles WHERE project_id = ? ORDER BY created_at ASC'
      )
      .all(input.projectId) as ImprovementCycleRow[]
    return rows.map(rowToImprovementCycle)
  })

  ipcMain.handle('improvement:create', async (_event, input: ImprovementCreateInput) => {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO improvement_cycles (
        id, project_id, title, cycle_type, plan, do_actions,
        check_results, act_improvements, status,
        started_at, completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.title,
      input.cycleType || 'pdca',
      input.plan || null,
      input.doActions || null,
      input.checkResults || null,
      input.actImprovements || null,
      input.status || 'planning',
      input.startedAt || null,
      input.completedAt || null,
      now,
      now
    )

    const row = db
      .prepare('SELECT * FROM improvement_cycles WHERE id = ?')
      .get(id) as ImprovementCycleRow
    return rowToImprovementCycle(row)
  })

  ipcMain.handle('improvement:update', async (_event, input: ImprovementUpdateInput) => {
    const db = getDb()
    const setClauses: string[] = []
    const params: unknown[] = []

    const fieldMap: Record<string, string> = {
      title: 'title',
      cycleType: 'cycle_type',
      plan: 'plan',
      doActions: 'do_actions',
      checkResults: 'check_results',
      actImprovements: 'act_improvements',
      status: 'status',
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

    if (setClauses.length === 0) {
      const row = db
        .prepare('SELECT * FROM improvement_cycles WHERE id = ?')
        .get(input.id) as ImprovementCycleRow
      return rowToImprovementCycle(row)
    }

    setClauses.push("updated_at = datetime('now')")
    params.push(input.id)

    db.prepare(
      `UPDATE improvement_cycles SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...params)

    const row = db
      .prepare('SELECT * FROM improvement_cycles WHERE id = ?')
      .get(input.id) as ImprovementCycleRow
    return rowToImprovementCycle(row)
  })

  ipcMain.handle('improvement:delete', async (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM improvement_cycles WHERE id = ?').run(id)
  })
}
