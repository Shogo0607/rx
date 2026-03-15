import { ipcMain } from 'electron'
import { getDb } from '../services/database'

interface KgEntityRow {
  id: string
  project_id: string
  name: string
  entity_type: string
  properties: string
  source_id: string | null
  source_type: string | null
  created_at: string
}

interface KgRelationRow {
  id: string
  project_id: string
  source_entity_id: string
  target_entity_id: string
  relation_type: string
  properties: string
  weight: number
  created_at: string
}

function rowToEntity(row: KgEntityRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    entityType: row.entity_type,
    properties: JSON.parse(row.properties),
    sourceId: row.source_id,
    sourceType: row.source_type,
    createdAt: row.created_at
  }
}

function rowToRelation(row: KgRelationRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceEntityId: row.source_entity_id,
    targetEntityId: row.target_entity_id,
    relationType: row.relation_type,
    properties: JSON.parse(row.properties),
    weight: row.weight,
    createdAt: row.created_at
  }
}

interface EntityListInput {
  projectId: string
}

interface EntityCreateInput {
  projectId: string
  name: string
  entityType: string
  properties?: Record<string, unknown>
  sourceId?: string
  sourceType?: string
}

interface RelationListInput {
  projectId: string
}

interface RelationCreateInput {
  projectId: string
  sourceEntityId: string
  targetEntityId: string
  relationType: string
  properties?: Record<string, unknown>
  weight?: number
}

export function registerKnowledgeGraphHandlers(): void {
  ipcMain.handle('kg:list-entities', async (_event, input: EntityListInput) => {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM kg_entities WHERE project_id = ? ORDER BY created_at ASC')
      .all(input.projectId) as KgEntityRow[]
    return rows.map(rowToEntity)
  })

  ipcMain.handle('kg:create-entity', async (_event, input: EntityCreateInput) => {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO kg_entities (
        id, project_id, name, entity_type, properties,
        source_id, source_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.name,
      input.entityType,
      input.properties ? JSON.stringify(input.properties) : '{}',
      input.sourceId || null,
      input.sourceType || null,
      now
    )

    const row = db
      .prepare('SELECT * FROM kg_entities WHERE id = ?')
      .get(id) as KgEntityRow
    return rowToEntity(row)
  })

  ipcMain.handle('kg:delete-entity', async (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM kg_entities WHERE id = ?').run(id)
  })

  ipcMain.handle('kg:list-relations', async (_event, input: RelationListInput) => {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM kg_relations WHERE project_id = ? ORDER BY created_at ASC')
      .all(input.projectId) as KgRelationRow[]
    return rows.map(rowToRelation)
  })

  ipcMain.handle('kg:create-relation', async (_event, input: RelationCreateInput) => {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO kg_relations (
        id, project_id, source_entity_id, target_entity_id,
        relation_type, properties, weight, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.sourceEntityId,
      input.targetEntityId,
      input.relationType,
      input.properties ? JSON.stringify(input.properties) : '{}',
      input.weight ?? 1.0,
      now
    )

    const row = db
      .prepare('SELECT * FROM kg_relations WHERE id = ?')
      .get(id) as KgRelationRow
    return rowToRelation(row)
  })

  ipcMain.handle('kg:delete-relation', async (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM kg_relations WHERE id = ?').run(id)
  })
}
