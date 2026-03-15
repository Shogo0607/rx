import { ipcMain } from 'electron'
import { getDb } from '../services/database'

interface ProjectRow {
  id: string
  name: string
  description: string | null
  status: string
  created_at: string
  updated_at: string
}

function rowToProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as 'active' | 'archived' | 'completed',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function registerProjectHandlers(): void {
  ipcMain.handle('project:list', async () => {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM projects ORDER BY updated_at DESC')
      .all() as ProjectRow[]
    return rows.map(rowToProject)
  })

  ipcMain.handle('project:get', async (_event, id: string) => {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(id) as ProjectRow | undefined
    return row ? rowToProject(row) : null
  })

  ipcMain.handle(
    'project:create',
    async (_event, input: { name: string; description?: string }) => {
      const db = getDb()
      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      db.prepare(
        `INSERT INTO projects (id, name, description, status, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?)`
      ).run(id, input.name, input.description || null, now, now)

      const row = db
        .prepare('SELECT * FROM projects WHERE id = ?')
        .get(id) as ProjectRow
      return rowToProject(row)
    }
  )

  ipcMain.handle(
    'project:update',
    async (
      _event,
      input: { id: string; name?: string; description?: string; status?: string }
    ) => {
      const db = getDb()
      const setClauses: string[] = []
      const params: unknown[] = []

      if (input.name !== undefined) {
        setClauses.push('name = ?')
        params.push(input.name)
      }
      if (input.description !== undefined) {
        setClauses.push('description = ?')
        params.push(input.description)
      }
      if (input.status !== undefined) {
        setClauses.push('status = ?')
        params.push(input.status)
      }

      if (setClauses.length === 0) {
        const row = db
          .prepare('SELECT * FROM projects WHERE id = ?')
          .get(input.id) as ProjectRow
        return rowToProject(row)
      }

      setClauses.push("updated_at = datetime('now')")
      params.push(input.id)

      db.prepare(
        `UPDATE projects SET ${setClauses.join(', ')} WHERE id = ?`
      ).run(...params)

      const row = db
        .prepare('SELECT * FROM projects WHERE id = ?')
        .get(input.id) as ProjectRow
      return rowToProject(row)
    }
  )

  ipcMain.handle('project:delete', async (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  })
}
