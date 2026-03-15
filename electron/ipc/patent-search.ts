import { ipcMain } from 'electron'
import { patentSearchApiService } from '../services/patent-search-api'
import { getDb } from '../services/database'

export function registerPatentSearchHandlers(): void {
  // Initialize EPO credentials from settings
  const initCredentials = (): void => {
    try {
      const db = getDb()
      const keyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('epo_consumer_key') as { value: string } | undefined
      const secretRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('epo_consumer_secret') as { value: string } | undefined
      if (keyRow?.value && secretRow?.value) {
        patentSearchApiService.setCredentials(keyRow.value, secretRow.value)
      }
    } catch {
      // Settings may not exist yet
    }
  }

  ipcMain.handle('patent-search:search', async (_event, input: {
    query: string
    source?: 'epo' | 'uspto' | 'all'
    limit?: number
    offset?: number
    dateFrom?: string
    dateTo?: string
    jurisdiction?: string
  }) => {
    initCredentials()

    const options = {
      limit: input.limit,
      offset: input.offset,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      jurisdiction: input.jurisdiction
    }

    switch (input.source) {
      case 'epo':
        return patentSearchApiService.searchEpo(input.query, options)
      case 'uspto':
        return patentSearchApiService.searchUspto(input.query, options)
      default:
        return patentSearchApiService.searchAll(input.query, options)
    }
  })

  ipcMain.handle('patent-search:details', async (_event, patentNumber: string) => {
    initCredentials()
    return patentSearchApiService.getPatentDetails(patentNumber)
  })

  ipcMain.handle('patent-search:family', async (_event, patentNumber: string) => {
    initCredentials()
    return patentSearchApiService.getPatentFamily(patentNumber)
  })

  console.log('[ipc] Patent search handlers registered')
}
