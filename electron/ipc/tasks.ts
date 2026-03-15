import { ipcMain } from 'electron'
import { getDb } from '../services/database'

interface TaskRow {
  id: string
  project_id: string
  sprint_id: string | null
  title: string
  description: string | null
  status: string
  priority: string
  assignee: string | null
  due_date: string | null
  start_date: string | null
  end_date: string | null
  estimated_hours: number | null
  actual_hours: number | null
  parent_task_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

function rowToTask(row: TaskRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    sprintId: row.sprint_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee,
    dueDate: row.due_date,
    startDate: row.start_date,
    endDate: row.end_date,
    estimatedHours: row.estimated_hours,
    actualHours: row.actual_hours,
    parentTaskId: row.parent_task_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

interface TaskListInput {
  projectId: string
  status?: string
  sprintId?: string
}

interface TaskCreateInput {
  projectId: string
  title: string
  description?: string
  status?: string
  priority?: string
  assignee?: string
  dueDate?: string
  startDate?: string
  endDate?: string
  estimatedHours?: number
  parentTaskId?: string
  sprintId?: string
}

interface TaskUpdateInput {
  id: string
  title?: string
  description?: string
  status?: string
  priority?: string
  assignee?: string
  dueDate?: string
  startDate?: string
  endDate?: string
  estimatedHours?: number
  actualHours?: number
  parentTaskId?: string
  sprintId?: string
  sortOrder?: number
}

export function registerTaskHandlers(): void {
  ipcMain.handle('task:list', async (_event, input: TaskListInput) => {
    const db = getDb()
    let sql = 'SELECT * FROM tasks WHERE project_id = ?'
    const params: unknown[] = [input.projectId]

    if (input.status) {
      sql += ' AND status = ?'
      params.push(input.status)
    }

    if (input.sprintId) {
      sql += ' AND sprint_id = ?'
      params.push(input.sprintId)
    }

    sql += ' ORDER BY sort_order ASC, created_at ASC'

    const rows = db.prepare(sql).all(...params) as TaskRow[]
    return rows.map(rowToTask)
  })

  ipcMain.handle('task:create', async (_event, input: TaskCreateInput) => {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO tasks (
        id, project_id, sprint_id, title, description,
        status, priority, assignee, due_date, start_date, end_date,
        estimated_hours, parent_task_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.sprintId || null,
      input.title,
      input.description || null,
      input.status || 'todo',
      input.priority || 'medium',
      input.assignee || null,
      input.dueDate || null,
      input.startDate || null,
      input.endDate || null,
      input.estimatedHours || null,
      input.parentTaskId || null,
      now,
      now
    )

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow
    return rowToTask(row)
  })

  ipcMain.handle('task:update', async (_event, input: TaskUpdateInput) => {
    const db = getDb()
    const setClauses: string[] = []
    const params: unknown[] = []

    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      status: 'status',
      priority: 'priority',
      assignee: 'assignee',
      dueDate: 'due_date',
      startDate: 'start_date',
      endDate: 'end_date',
      estimatedHours: 'estimated_hours',
      actualHours: 'actual_hours',
      parentTaskId: 'parent_task_id',
      sprintId: 'sprint_id',
      sortOrder: 'sort_order'
    }

    for (const [key, column] of Object.entries(fieldMap)) {
      const value = (input as Record<string, unknown>)[key]
      if (value !== undefined) {
        setClauses.push(`${column} = ?`)
        params.push(value)
      }
    }

    if (setClauses.length === 0) {
      const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(input.id) as TaskRow
      return rowToTask(row)
    }

    setClauses.push("updated_at = datetime('now')")
    params.push(input.id)

    db.prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...params)

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(input.id) as TaskRow
    return rowToTask(row)
  })

  ipcMain.handle('task:gantt-data', async (_event, projectId: string) => {
    const db = getDb()
    const rows = db
      .prepare(
        `SELECT * FROM tasks
         WHERE project_id = ? AND start_date IS NOT NULL
         ORDER BY start_date ASC, sort_order ASC`
      )
      .all(projectId) as TaskRow[]

    const PHASE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#f97316']
    const STATUS_COLORS: Record<string, string> = {
      todo: '#9ca3af',
      in_progress: '#3b82f6',
      review: '#f59e0b',
      done: '#10b981',
      blocked: '#ef4444'
    }

    // Return data formatted for Gantt chart rendering
    return rows.map((row, i) => ({
      id: row.id,
      title: row.title,
      startDate: row.start_date,
      endDate: row.end_date || row.due_date || row.start_date,
      progress: row.status === 'done' ? 100 : row.status === 'in_progress' ? 50 : 0,
      dependencies: row.parent_task_id ? [row.parent_task_id] : [],
      status: row.status,
      color: STATUS_COLORS[row.status] || PHASE_COLORS[i % PHASE_COLORS.length]
    }))
  })
}
