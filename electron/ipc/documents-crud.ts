import { ipcMain } from 'electron'
import { getDb } from '../services/database'

interface DocumentRow {
  id: string
  project_id: string
  title: string
  type: string
  content: string | null
  template: string | null
  version: number
  status: string
  word_count: number
  created_at: string
  updated_at: string
}

function rowToDocument(row: DocumentRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    type: row.type,
    content: row.content,
    template: row.template,
    version: row.version,
    status: row.status,
    wordCount: row.word_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

interface DocumentListInput {
  projectId: string
  type?: string
}

interface DocumentCreateInput {
  projectId: string
  title: string
  type?: string
  content?: string
  template?: string
  version?: number
  status?: string
  wordCount?: number
}

interface DocumentUpdateInput {
  id: string
  title?: string
  type?: string
  content?: string
  template?: string
  version?: number
  status?: string
  wordCount?: number
}

export function registerDocumentCrudHandlers(): void {
  ipcMain.handle('document:list', async (_event, input: DocumentListInput) => {
    const db = getDb()
    let sql = 'SELECT * FROM documents WHERE project_id = ?'
    const params: unknown[] = [input.projectId]

    if (input.type) {
      sql += ' AND type = ?'
      params.push(input.type)
    }

    sql += ' ORDER BY updated_at DESC'

    const rows = db.prepare(sql).all(...params) as DocumentRow[]
    return rows.map(rowToDocument)
  })

  ipcMain.handle('document:get', async (_event, id: string) => {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM documents WHERE id = ?')
      .get(id) as DocumentRow | undefined
    return row ? rowToDocument(row) : null
  })

  ipcMain.handle('document:create', async (_event, input: DocumentCreateInput) => {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO documents (
        id, project_id, title, type, content, template,
        version, status, word_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.title,
      input.type || 'general',
      input.content || null,
      input.template || null,
      input.version ?? 1,
      input.status || 'draft',
      input.wordCount ?? 0,
      now,
      now
    )

    const row = db
      .prepare('SELECT * FROM documents WHERE id = ?')
      .get(id) as DocumentRow
    return rowToDocument(row)
  })

  ipcMain.handle('document:update', async (_event, input: DocumentUpdateInput) => {
    const db = getDb()
    const setClauses: string[] = []
    const params: unknown[] = []

    const fieldMap: Record<string, string> = {
      title: 'title',
      type: 'type',
      content: 'content',
      template: 'template',
      version: 'version',
      status: 'status',
      wordCount: 'word_count'
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
        .prepare('SELECT * FROM documents WHERE id = ?')
        .get(input.id) as DocumentRow
      return rowToDocument(row)
    }

    setClauses.push("updated_at = datetime('now')")
    params.push(input.id)

    db.prepare(
      `UPDATE documents SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...params)

    const row = db
      .prepare('SELECT * FROM documents WHERE id = ?')
      .get(input.id) as DocumentRow
    return rowToDocument(row)
  })

  ipcMain.handle('document:delete', async (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM documents WHERE id = ?').run(id)
  })
}
