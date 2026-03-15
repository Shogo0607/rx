import { ipcMain } from 'electron'
import { getDb } from '../services/database'
import { randomUUID } from 'crypto'

function snakeToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    // Parse JSON fields
    if ((key === 'inventors' || key === 'classification_codes') && typeof value === 'string') {
      try { result[camelKey] = JSON.parse(value) } catch { result[camelKey] = [] }
    } else {
      result[camelKey] = value
    }
  }
  return result
}

export function registerPriorArtHandlers(): void {
  ipcMain.handle('prior-art:list', async (_event, input: { projectId: string; pipelineRunId?: string }) => {
    const db = getDb()
    let rows
    if (input.pipelineRunId) {
      rows = db.prepare(
        'SELECT * FROM prior_art_patents WHERE project_id = ? AND pipeline_run_id = ? ORDER BY relevance_score DESC, created_at DESC'
      ).all(input.projectId, input.pipelineRunId)
    } else {
      rows = db.prepare(
        'SELECT * FROM prior_art_patents WHERE project_id = ? ORDER BY relevance_score DESC, created_at DESC'
      ).all(input.projectId)
    }
    return (rows as Record<string, unknown>[]).map(snakeToCamel)
  })

  ipcMain.handle('prior-art:create', async (_event, input: {
    projectId: string
    pipelineRunId?: string
    patentNumber?: string
    title: string
    abstract?: string
    applicant?: string
    inventors?: string[]
    filingDate?: string
    publicationDate?: string
    jurisdiction?: string
    classificationCodes?: string[]
    url?: string
    source?: string
    relevanceScore?: number
    relevanceNotes?: string
    keyClaims?: string
    category?: string
  }) => {
    const db = getDb()
    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO prior_art_patents (id, project_id, pipeline_run_id, patent_number, title, abstract, applicant, inventors, filing_date, publication_date, jurisdiction, classification_codes, url, source, relevance_score, relevance_notes, key_claims, category, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.pipelineRunId || null,
      input.patentNumber || null,
      input.title,
      input.abstract || null,
      input.applicant || null,
      JSON.stringify(input.inventors || []),
      input.filingDate || null,
      input.publicationDate || null,
      input.jurisdiction || null,
      JSON.stringify(input.classificationCodes || []),
      input.url || null,
      input.source || 'manual',
      input.relevanceScore ?? null,
      input.relevanceNotes || null,
      input.keyClaims || null,
      input.category || null,
      now,
      now
    )

    const row = db.prepare('SELECT * FROM prior_art_patents WHERE id = ?').get(id) as Record<string, unknown>
    return snakeToCamel(row)
  })

  ipcMain.handle('prior-art:update', async (_event, input: {
    id: string
    relevanceScore?: number
    relevanceNotes?: string
    keyClaims?: string
    category?: string
    title?: string
    abstract?: string
  }) => {
    const db = getDb()
    const sets: string[] = []
    const values: unknown[] = []

    if (input.relevanceScore !== undefined) { sets.push('relevance_score = ?'); values.push(input.relevanceScore) }
    if (input.relevanceNotes !== undefined) { sets.push('relevance_notes = ?'); values.push(input.relevanceNotes) }
    if (input.keyClaims !== undefined) { sets.push('key_claims = ?'); values.push(input.keyClaims) }
    if (input.category !== undefined) { sets.push('category = ?'); values.push(input.category) }
    if (input.title !== undefined) { sets.push('title = ?'); values.push(input.title) }
    if (input.abstract !== undefined) { sets.push('abstract = ?'); values.push(input.abstract) }

    if (sets.length === 0) {
      const row = db.prepare('SELECT * FROM prior_art_patents WHERE id = ?').get(input.id) as Record<string, unknown>
      return snakeToCamel(row)
    }

    sets.push("updated_at = datetime('now')")
    values.push(input.id)

    db.prepare(`UPDATE prior_art_patents SET ${sets.join(', ')} WHERE id = ?`).run(...values)

    const row = db.prepare('SELECT * FROM prior_art_patents WHERE id = ?').get(input.id) as Record<string, unknown>
    return snakeToCamel(row)
  })

  ipcMain.handle('prior-art:delete', async (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM prior_art_patents WHERE id = ?').run(id)
  })

  console.log('[ipc] Prior art handlers registered')
}
