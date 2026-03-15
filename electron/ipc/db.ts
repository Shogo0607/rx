import { ipcMain } from 'electron'
import { getDb } from '../services/database'

// SQL patterns that are not allowed in generic queries
const DESTRUCTIVE_PATTERNS = [
  /\bDROP\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bCREATE\s+TABLE\b/i,
  /\bCREATE\s+INDEX\b/i,
  /\bDROP\s+INDEX\b/i,
  /\bATTACH\b/i,
  /\bDETACH\b/i,
  /\bPRAGMA\b/i,
  /\bVACUUM\b/i,
  /\bREINDEX\b/i
]

function validateSql(sql: string): void {
  const trimmed = sql.trim()

  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new Error(
        `Forbidden SQL operation detected. Pattern: ${pattern.source}. ` +
        'Use specific IPC handlers for schema modifications.'
      )
    }
  }
}

export function registerDbHandlers(): void {
  /**
   * Execute a SELECT query and return rows
   */
  ipcMain.handle(
    'db:query',
    async (_event, input: { sql: string; params?: unknown[] }) => {
      validateSql(input.sql)

      const db = getDb()
      const stmt = db.prepare(input.sql)
      const rows = input.params ? stmt.all(...input.params) : stmt.all()

      return rows
    }
  )

  /**
   * Execute an INSERT/UPDATE/DELETE statement
   */
  ipcMain.handle(
    'db:execute',
    async (_event, input: { sql: string; params?: unknown[] }) => {
      validateSql(input.sql)

      const db = getDb()
      const stmt = db.prepare(input.sql)
      const result = input.params ? stmt.run(...input.params) : stmt.run()

      return { changes: result.changes }
    }
  )
}
