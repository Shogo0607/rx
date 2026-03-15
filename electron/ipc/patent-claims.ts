import { ipcMain } from 'electron'
import { getDb } from '../services/database'

interface PatentClaimRow {
  id: string
  project_id: string
  document_id: string | null
  claim_number: number
  claim_type: string
  parent_claim_id: string | null
  claim_text: string
  status: string
  prior_art_notes: string | null
  created_at: string
  updated_at: string
}

function rowToPatentClaim(row: PatentClaimRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    documentId: row.document_id,
    claimNumber: row.claim_number,
    claimType: row.claim_type,
    parentClaimId: row.parent_claim_id,
    claimText: row.claim_text,
    status: row.status,
    priorArtNotes: row.prior_art_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

interface PatentClaimListInput {
  projectId: string
  pipelineRunId?: string
}

interface PatentClaimCreateInput {
  projectId: string
  documentId?: string
  claimNumber: number
  claimType?: string
  parentClaimId?: string
  claimText: string
  status?: string
  priorArtNotes?: string
}

interface PatentClaimUpdateInput {
  id: string
  documentId?: string
  claimNumber?: number
  claimType?: string
  parentClaimId?: string
  claimText?: string
  status?: string
  priorArtNotes?: string
}

export function registerPatentClaimHandlers(): void {
  ipcMain.handle('patent:list-claims', async (_event, input: PatentClaimListInput) => {
    const db = getDb()
    if (input.pipelineRunId) {
      const rows = db
        .prepare(
          'SELECT * FROM patent_claims WHERE project_id = ? AND pipeline_run_id = ? ORDER BY claim_number ASC'
        )
        .all(input.projectId, input.pipelineRunId) as PatentClaimRow[]
      return rows.map(rowToPatentClaim)
    }
    const rows = db
      .prepare(
        'SELECT * FROM patent_claims WHERE project_id = ? ORDER BY claim_number ASC'
      )
      .all(input.projectId) as PatentClaimRow[]
    return rows.map(rowToPatentClaim)
  })

  ipcMain.handle('patent:create-claim', async (_event, input: PatentClaimCreateInput) => {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO patent_claims (
        id, project_id, document_id, claim_number, claim_type,
        parent_claim_id, claim_text, status, prior_art_notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.documentId || null,
      input.claimNumber,
      input.claimType || 'independent',
      input.parentClaimId || null,
      input.claimText,
      input.status || 'draft',
      input.priorArtNotes || null,
      now,
      now
    )

    const row = db
      .prepare('SELECT * FROM patent_claims WHERE id = ?')
      .get(id) as PatentClaimRow
    return rowToPatentClaim(row)
  })

  ipcMain.handle('patent:update-claim', async (_event, input: PatentClaimUpdateInput) => {
    const db = getDb()
    const setClauses: string[] = []
    const params: unknown[] = []

    const fieldMap: Record<string, string> = {
      documentId: 'document_id',
      claimNumber: 'claim_number',
      claimType: 'claim_type',
      parentClaimId: 'parent_claim_id',
      claimText: 'claim_text',
      status: 'status',
      priorArtNotes: 'prior_art_notes'
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
        .prepare('SELECT * FROM patent_claims WHERE id = ?')
        .get(input.id) as PatentClaimRow
      return rowToPatentClaim(row)
    }

    setClauses.push("updated_at = datetime('now')")
    params.push(input.id)

    db.prepare(
      `UPDATE patent_claims SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...params)

    const row = db
      .prepare('SELECT * FROM patent_claims WHERE id = ?')
      .get(input.id) as PatentClaimRow
    return rowToPatentClaim(row)
  })

  ipcMain.handle('patent:delete-claim', async (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM patent_claims WHERE id = ?').run(id)
  })
}
