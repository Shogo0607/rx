import { ipcMain } from 'electron'
import { getDb } from '../services/database'

interface CanvasStateRow {
  id: string
  project_id: string
  name: string
  nodes: string
  edges: string
  viewport: string
  created_at: string
  updated_at: string
}

function rowToCanvasState(row: CanvasStateRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    nodes: JSON.parse(row.nodes),
    edges: JSON.parse(row.edges),
    viewport: JSON.parse(row.viewport),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

interface CanvasListInput {
  projectId: string
}

interface CanvasSaveInput {
  id?: string
  projectId: string
  name: string
  nodes?: unknown[]
  edges?: unknown[]
  viewport?: { x: number; y: number; zoom: number }
}

export function registerCanvasHandlers(): void {
  ipcMain.handle('canvas:list', async (_event, input: CanvasListInput) => {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM canvas_states WHERE project_id = ? ORDER BY updated_at DESC')
      .all(input.projectId) as CanvasStateRow[]
    return rows.map(rowToCanvasState)
  })

  ipcMain.handle('canvas:get', async (_event, id: string) => {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM canvas_states WHERE id = ?')
      .get(id) as CanvasStateRow | undefined
    return row ? rowToCanvasState(row) : null
  })

  ipcMain.handle('canvas:save', async (_event, input: CanvasSaveInput) => {
    const db = getDb()
    const now = new Date().toISOString()

    if (input.id) {
      // Update existing canvas
      const setClauses: string[] = []
      const params: unknown[] = []

      if (input.name !== undefined) {
        setClauses.push('name = ?')
        params.push(input.name)
      }
      if (input.nodes !== undefined) {
        setClauses.push('nodes = ?')
        params.push(JSON.stringify(input.nodes))
      }
      if (input.edges !== undefined) {
        setClauses.push('edges = ?')
        params.push(JSON.stringify(input.edges))
      }
      if (input.viewport !== undefined) {
        setClauses.push('viewport = ?')
        params.push(JSON.stringify(input.viewport))
      }

      if (setClauses.length === 0) {
        const row = db
          .prepare('SELECT * FROM canvas_states WHERE id = ?')
          .get(input.id) as CanvasStateRow
        return rowToCanvasState(row)
      }

      setClauses.push("updated_at = datetime('now')")
      params.push(input.id)

      db.prepare(
        `UPDATE canvas_states SET ${setClauses.join(', ')} WHERE id = ?`
      ).run(...params)

      const row = db
        .prepare('SELECT * FROM canvas_states WHERE id = ?')
        .get(input.id) as CanvasStateRow
      return rowToCanvasState(row)
    } else {
      // Create new canvas
      const id = crypto.randomUUID()

      db.prepare(`
        INSERT INTO canvas_states (
          id, project_id, name, nodes, edges, viewport,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.projectId,
        input.name,
        input.nodes ? JSON.stringify(input.nodes) : '[]',
        input.edges ? JSON.stringify(input.edges) : '[]',
        input.viewport ? JSON.stringify(input.viewport) : '{"x":0,"y":0,"zoom":1}',
        now,
        now
      )

      const row = db
        .prepare('SELECT * FROM canvas_states WHERE id = ?')
        .get(id) as CanvasStateRow
      return rowToCanvasState(row)
    }
  })

  ipcMain.handle('canvas:delete', async (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM canvas_states WHERE id = ?').run(id)
  })
}
