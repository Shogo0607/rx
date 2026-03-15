import { ipcMain, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { getDb } from '../services/database'

function getConfigPath(): string {
  return join(app.getPath('userData'), 'rx-config.json')
}

function readJsonConfig(): Record<string, string> {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) {
    return {}
  }
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'))
  } catch {
    return {}
  }
}

function writeJsonConfig(config: Record<string, string>): void {
  const configPath = getConfigPath()
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

export function registerSettingsHandlers(): void {
  // Migrate existing SQLite settings to JSON on first run
  try {
    const configPath = getConfigPath()
    if (!existsSync(configPath)) {
      const db = getDb()
      const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
      if (rows.length > 0) {
        const config: Record<string, string> = {}
        for (const row of rows) {
          config[row.key] = row.value
        }
        writeJsonConfig(config)
      }
    }
  } catch {
    // Ignore migration errors
  }

  ipcMain.handle('settings:get', async (_event, key: string) => {
    if (!key?.trim()) {
      throw new Error('Settings key is required')
    }

    // Read from JSON config file
    const config = readJsonConfig()
    if (config[key] !== undefined) {
      return config[key]
    }

    // Fallback to SQLite for backward compatibility
    const db = getDb()
    const row = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key) as { value: string } | undefined

    return row?.value ?? null
  })

  ipcMain.handle(
    'settings:set',
    async (_event, input: { key: string; value: string }) => {
      if (!input.key?.trim()) {
        throw new Error('Settings key is required')
      }

      // Save to JSON config file
      const config = readJsonConfig()
      config[input.key] = input.value
      writeJsonConfig(config)

      // Also save to SQLite for backward compatibility
      const db = getDb()
      db.prepare(
        `INSERT INTO settings (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).run(input.key, input.value)
    }
  )
}
