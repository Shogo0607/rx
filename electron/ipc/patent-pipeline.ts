import { ipcMain, BrowserWindow } from 'electron'
import { getDb } from '../services/database'
import { randomUUID } from 'crypto'
import { patentPipelineService } from '../services/patent-pipeline'

function snakeToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    // Parse JSON fields
    if (['research_results', 'gap_analysis', 'generated_ideas', 'generated_claims', 'generated_spec', 'generated_diagrams'].includes(key) && typeof value === 'string') {
      try { result[camelKey] = JSON.parse(value) } catch { result[camelKey] = value }
    } else {
      result[camelKey] = value
    }
  }
  return result
}

export function registerPatentPipelineHandlers(): void {
  ipcMain.handle('pipeline:create', async (_event, input: {
    projectId: string
    inventionDescription: string
    template?: string
    mode?: 'auto' | 'semi-auto'
    jurisdiction?: string
  }) => {
    const db = getDb()
    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO patent_pipeline_runs (id, project_id, invention_description, template, mode, jurisdiction, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, input.projectId, input.inventionDescription, input.template || 'jp-patent', input.mode || 'auto', input.jurisdiction || 'all', now, now)

    const row = db.prepare('SELECT * FROM patent_pipeline_runs WHERE id = ?').get(id) as Record<string, unknown>
    return snakeToCamel(row)
  })

  ipcMain.handle('pipeline:get', async (_event, id: string) => {
    const db = getDb()
    const row = db.prepare('SELECT * FROM patent_pipeline_runs WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return row ? snakeToCamel(row) : null
  })

  ipcMain.handle('pipeline:list', async (_event, input: { projectId: string }) => {
    const db = getDb()
    const rows = db.prepare(
      'SELECT * FROM patent_pipeline_runs WHERE project_id = ? ORDER BY created_at DESC'
    ).all(input.projectId)
    return (rows as Record<string, unknown>[]).map(snakeToCamel)
  })

  ipcMain.handle('pipeline:start', async (event, runId: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new Error('No window found')

    const db = getDb()
    const row = db.prepare('SELECT * FROM patent_pipeline_runs WHERE id = ?').get(runId) as Record<string, unknown> | undefined
    if (!row) throw new Error('Pipeline run not found')

    // Start the pipeline asynchronously
    patentPipelineService.startPipeline(runId, window).catch((err) => {
      console.error('[patent-pipeline] Pipeline failed:', err)
      db.prepare("UPDATE patent_pipeline_runs SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?")
        .run(String(err), runId)
      window.webContents.send('pipeline:progress', {
        runId,
        step: -1,
        status: 'failed',
        error: String(err)
      })
    })

    return { started: true }
  })

  ipcMain.handle('pipeline:pause', async (_event, runId: string) => {
    const db = getDb()
    db.prepare("UPDATE patent_pipeline_runs SET status = 'paused', updated_at = datetime('now') WHERE id = ?").run(runId)
    return { paused: true }
  })

  ipcMain.handle('pipeline:resume', async (event, runId: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new Error('No window found')

    patentPipelineService.resumePipeline(runId, window).catch((err) => {
      console.error('[patent-pipeline] Pipeline resume failed:', err)
      const db = getDb()
      db.prepare("UPDATE patent_pipeline_runs SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?")
        .run(String(err), runId)
    })

    return { resumed: true }
  })

  ipcMain.handle('pipeline:update', async (_event, input: {
    id: string
    gapAnalysis?: unknown
    generatedIdeas?: unknown
    generatedClaims?: unknown
    generatedSpec?: unknown
    generatedDiagrams?: unknown
  }) => {
    const db = getDb()
    const sets: string[] = []
    const values: unknown[] = []

    if (input.gapAnalysis !== undefined) { sets.push('gap_analysis = ?'); values.push(JSON.stringify(input.gapAnalysis)) }
    if (input.generatedIdeas !== undefined) { sets.push('generated_ideas = ?'); values.push(JSON.stringify(input.generatedIdeas)) }
    if (input.generatedClaims !== undefined) { sets.push('generated_claims = ?'); values.push(JSON.stringify(input.generatedClaims)) }
    if (input.generatedSpec !== undefined) { sets.push('generated_spec = ?'); values.push(JSON.stringify(input.generatedSpec)) }
    if (input.generatedDiagrams !== undefined) { sets.push('generated_diagrams = ?'); values.push(JSON.stringify(input.generatedDiagrams)) }

    if (sets.length > 0) {
      sets.push("updated_at = datetime('now')")
      values.push(input.id)
      db.prepare(`UPDATE patent_pipeline_runs SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    }

    const row = db.prepare('SELECT * FROM patent_pipeline_runs WHERE id = ?').get(input.id) as Record<string, unknown>
    return snakeToCamel(row)
  })

  console.log('[ipc] Patent pipeline handlers registered')
}
