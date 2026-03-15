import { ipcMain, dialog, BrowserWindow } from 'electron'
import { documentGenerator } from '../services/document-generator'
import { fileManager } from '../services/file-manager'

interface Section {
  heading: string
  level?: number
  body?: string
  subsections?: Section[]
}

interface DocumentContent {
  title: string
  authors?: string[]
  date?: string
  abstract?: string
  keywords?: string[]
  sections: Section[]
  references?: string[]
}

type TemplateType =
  | 'paper-imrad'
  | 'patent-jp'
  | 'patent-us'
  | 'report-progress'
  | 'report-final'

interface ExportInput {
  content: DocumentContent
  template?: TemplateType
  savePath?: string // If not provided, show save dialog
}

export function registerDocumentHandlers(): void {
  ipcMain.handle('doc:export-docx', async (_event, input: ExportInput) => {
    let savePath = input.savePath

    // Show save dialog if no path provided
    if (!savePath) {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) {
        throw new Error('No focused window available for dialog')
      }

      const result = await dialog.showSaveDialog(window, {
        title: 'Export as Word Document',
        defaultPath: `${sanitizeFilename(input.content.title)}.docx`,
        filters: [{ name: 'Word Document', extensions: ['docx'] }]
      })

      if (result.canceled || !result.filePath) {
        return null
      }

      savePath = result.filePath
    }

    const buffer = await documentGenerator.generateDocx(input.content, input.template)
    await fileManager.writeFile(savePath, buffer)

    return savePath
  })

  ipcMain.handle('doc:export-pdf', async (_event, input: ExportInput) => {
    let savePath = input.savePath

    // Show save dialog if no path provided
    if (!savePath) {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) {
        throw new Error('No focused window available for dialog')
      }

      const result = await dialog.showSaveDialog(window, {
        title: 'Export as PDF',
        defaultPath: `${sanitizeFilename(input.content.title)}.pdf`,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
      })

      if (result.canceled || !result.filePath) {
        return null
      }

      savePath = result.filePath
    }

    const buffer = await documentGenerator.generatePdf(input.content, input.template)
    await fileManager.writeFile(savePath, buffer)

    return savePath
  })
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100)
}
