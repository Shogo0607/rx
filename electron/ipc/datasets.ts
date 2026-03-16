import { ipcMain } from 'electron'
import { basename } from 'path'
import { getDb } from '../services/database'
import { fileManager } from '../services/file-manager'
import { statisticsService } from '../services/statistics'

interface DatasetRow {
  id: string
  project_id: string
  experiment_id: string | null
  name: string
  description: string | null
  file_path: string | null
  file_type: string | null
  row_count: number | null
  column_names: string
  summary_stats: string | null
  created_at: string
  updated_at: string
}

function rowToDataset(row: DatasetRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    experimentId: row.experiment_id,
    name: row.name,
    description: row.description,
    filePath: row.file_path,
    fileType: row.file_type,
    rowCount: row.row_count,
    columnNames: JSON.parse(row.column_names),
    summaryStats: row.summary_stats,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

interface DatasetListInput {
  projectId: string
}

interface DatasetCreateInput {
  projectId: string
  experimentId?: string
  name: string
  description?: string
  filePath?: string
  fileType?: string
  rowCount?: number
  columnNames?: string[]
  summaryStats?: string
}

interface DatasetUpdateInput {
  id: string
  experimentId?: string
  name?: string
  description?: string
  filePath?: string
  fileType?: string
  rowCount?: number
  columnNames?: string[]
  summaryStats?: string
}

export function registerDatasetHandlers(): void {
  ipcMain.handle('dataset:list', async (_event, input: DatasetListInput) => {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM datasets WHERE project_id = ? ORDER BY created_at ASC')
      .all(input.projectId) as DatasetRow[]
    return rows.map(rowToDataset)
  })

  ipcMain.handle('dataset:create', async (_event, input: DatasetCreateInput) => {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO datasets (
        id, project_id, experiment_id, name, description,
        file_path, file_type, row_count, column_names, summary_stats,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.experimentId || null,
      input.name,
      input.description || null,
      input.filePath || null,
      input.fileType || null,
      input.rowCount ?? null,
      input.columnNames ? JSON.stringify(input.columnNames) : '[]',
      input.summaryStats || null,
      now,
      now
    )

    const row = db
      .prepare('SELECT * FROM datasets WHERE id = ?')
      .get(id) as DatasetRow
    return rowToDataset(row)
  })

  ipcMain.handle('dataset:update', async (_event, input: DatasetUpdateInput) => {
    const db = getDb()
    const setClauses: string[] = []
    const params: unknown[] = []

    const fieldMap: Record<string, string> = {
      experimentId: 'experiment_id',
      name: 'name',
      description: 'description',
      filePath: 'file_path',
      fileType: 'file_type',
      rowCount: 'row_count',
      summaryStats: 'summary_stats'
    }

    for (const [key, column] of Object.entries(fieldMap)) {
      const value = (input as Record<string, unknown>)[key]
      if (value !== undefined) {
        setClauses.push(`${column} = ?`)
        params.push(value)
      }
    }

    if (input.columnNames !== undefined) {
      setClauses.push('column_names = ?')
      params.push(JSON.stringify(input.columnNames))
    }

    if (setClauses.length === 0) {
      const row = db
        .prepare('SELECT * FROM datasets WHERE id = ?')
        .get(input.id) as DatasetRow
      return rowToDataset(row)
    }

    setClauses.push("updated_at = datetime('now')")
    params.push(input.id)

    db.prepare(
      `UPDATE datasets SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...params)

    const row = db
      .prepare('SELECT * FROM datasets WHERE id = ?')
      .get(input.id) as DatasetRow
    return rowToDataset(row)
  })

  ipcMain.handle('dataset:delete', async (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM datasets WHERE id = ?').run(id)
  })

  // Import a CSV file: parse it, copy to project dir, create dataset record
  ipcMain.handle(
    'dataset:import-csv',
    async (_event, input: { projectId: string; filePath: string; name?: string }) => {
      const db = getDb()

      // Parse CSV
      const { headers, rows } = await fileManager.importCsv(input.filePath)

      // Copy file to project directory
      const destPath = await fileManager.copyToProject(input.projectId, input.filePath, 'datasets')

      // Determine file name for dataset name
      const fileName = basename(input.filePath)
      const datasetName = input.name || fileName.replace(/\.[^.]+$/, '')

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      db.prepare(`
        INSERT INTO datasets (
          id, project_id, experiment_id, name, description,
          file_path, file_type, row_count, column_names, summary_stats,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.projectId,
        null,
        datasetName,
        null,
        destPath,
        'csv',
        rows.length,
        JSON.stringify(headers),
        null,
        now,
        now
      )

      const row = db.prepare('SELECT * FROM datasets WHERE id = ?').get(id) as DatasetRow
      return rowToDataset(row)
    }
  )

  // Compute descriptive statistics for a dataset
  ipcMain.handle('dataset:compute-stats', async (_event, datasetId: string) => {
    const db = getDb()
    const row = db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId) as DatasetRow | undefined
    if (!row) throw new Error('Dataset not found')
    if (!row.file_path) throw new Error('Dataset has no file')

    // Parse the CSV file
    const { headers, rows } = await fileManager.importCsv(row.file_path)

    // Compute stats for each numeric column
    const stats: Record<string, unknown> = {}
    for (const header of headers) {
      const values = rows
        .map((r) => parseFloat(r[header]))
        .filter((v) => !isNaN(v))

      if (values.length >= 2) {
        const result = statisticsService.descriptiveStats(values)
        stats[header] = {
          n: result.count,
          mean: result.mean,
          median: result.median,
          sd: result.standardDeviation,
          min: result.min,
          max: result.max,
          q1: result.q1,
          q3: result.q3,
          variance: result.variance,
          skewness: result.skewness
        }
      }
    }

    // Save stats to dataset
    const statsJson = JSON.stringify(stats)
    db.prepare("UPDATE datasets SET summary_stats = ?, updated_at = datetime('now') WHERE id = ?").run(
      statsJson,
      datasetId
    )

    const updated = db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId) as DatasetRow
    return rowToDataset(updated)
  })

  // Get raw CSV data for visualization
  ipcMain.handle('dataset:get-data', async (_event, datasetId: string) => {
    const db = getDb()
    const row = db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId) as DatasetRow | undefined
    if (!row) throw new Error('Dataset not found')
    if (!row.file_path) throw new Error('Dataset has no file')

    const { headers, rows } = await fileManager.importCsv(row.file_path)
    return { headers, rows }
  })
}
