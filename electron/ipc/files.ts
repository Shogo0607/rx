import { ipcMain, dialog, BrowserWindow } from 'electron'

interface FileDialogOptions {
  title?: string
  filters?: Array<{ name: string; extensions: string[] }>
  properties?: string[]
}

interface SaveDialogOptions {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

export function registerFileHandlers(): void {
  ipcMain.handle('file:open-dialog', async (_event, options: FileDialogOptions) => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) {
      throw new Error('No focused window available for dialog')
    }

    // Map string properties to Electron's expected type
    const electronProperties: Array<
      | 'openFile'
      | 'openDirectory'
      | 'multiSelections'
      | 'showHiddenFiles'
      | 'createDirectory'
    > = []
    if (options.properties) {
      for (const prop of options.properties) {
        if (
          prop === 'openFile' ||
          prop === 'openDirectory' ||
          prop === 'multiSelections' ||
          prop === 'showHiddenFiles' ||
          prop === 'createDirectory'
        ) {
          electronProperties.push(prop)
        }
      }
    }

    // Default to openFile if no properties specified
    if (electronProperties.length === 0) {
      electronProperties.push('openFile')
    }

    const result = await dialog.showOpenDialog(window, {
      title: options.title || 'Open File',
      filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
      properties: electronProperties
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths
  })

  ipcMain.handle('file:save-dialog', async (_event, options: SaveDialogOptions) => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) {
      throw new Error('No focused window available for dialog')
    }

    const result = await dialog.showSaveDialog(window, {
      title: options.title || 'Save File',
      defaultPath: options.defaultPath,
      filters: options.filters || [{ name: 'All Files', extensions: ['*'] }]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    return result.filePath
  })
}
