import { ipcMain } from 'electron'
import { literatureApiService } from '../services/literature-api'

interface LitSearchInput {
  query: string
  source?: 'semantic_scholar' | 'crossref' | 'arxiv' | 'all'
  limit?: number
}

export function registerLiteratureHandlers(): void {
  ipcMain.handle('lit:search', async (_event, input: LitSearchInput) => {
    const { query, source = 'all', limit = 20 } = input

    if (!query?.trim()) {
      throw new Error('Search query is required')
    }

    switch (source) {
      case 'semantic_scholar': {
        const result = await literatureApiService.searchSemanticScholar(query, limit)
        return result.papers
      }
      case 'crossref': {
        const result = await literatureApiService.searchCrossRef(query, limit)
        return result.papers
      }
      case 'arxiv': {
        const result = await literatureApiService.searchArxiv(query, limit)
        return result.papers
      }
      case 'all':
      default: {
        const result = await literatureApiService.searchAll(query, limit)
        return result.papers
      }
    }
  })

  ipcMain.handle('lit:get-citations', async (_event, paperId: string) => {
    if (!paperId?.trim()) {
      throw new Error('Paper ID is required')
    }
    return literatureApiService.getCitations(paperId)
  })

  ipcMain.handle('lit:get-references', async (_event, paperId: string) => {
    if (!paperId?.trim()) {
      throw new Error('Paper ID is required')
    }
    return literatureApiService.getReferences(paperId)
  })
}
