import { app } from 'electron'
import { join, dirname, basename } from 'path'
import { readFile as fsReadFile, writeFile as fsWriteFile, mkdir } from 'fs/promises'
import { existsSync, createReadStream } from 'fs'
import { createInterface } from 'readline'

export class FileManager {
  private dataDir: string

  constructor() {
    this.dataDir = join(app.getPath('userData'), 'data')
  }

  /**
   * Read a file and return its contents as a Buffer
   */
  async readFile(filePath: string): Promise<Buffer> {
    return fsReadFile(filePath)
  }

  /**
   * Write data (Buffer or string) to a file
   */
  async writeFile(filePath: string, data: Buffer | string): Promise<void> {
    // Ensure parent directory exists
    const dir = dirname(filePath)
    if (dir && !existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    await fsWriteFile(filePath, data)
  }

  /**
   * Get (and create if needed) the project data directory
   */
  async getProjectDir(projectId: string): Promise<string> {
    const projectDir = join(this.dataDir, 'projects', projectId)
    if (!existsSync(projectDir)) {
      await mkdir(projectDir, { recursive: true })
    }
    return projectDir
  }

  /**
   * Get a subdirectory inside a project directory
   */
  async getProjectSubDir(projectId: string, subdir: string): Promise<string> {
    const projectDir = await this.getProjectDir(projectId)
    const subPath = join(projectDir, subdir)
    if (!existsSync(subPath)) {
      await mkdir(subPath, { recursive: true })
    }
    return subPath
  }

  /**
   * Import a CSV file and return parsed data as an array of objects
   */
  async importCsv(filePath: string): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }

    return new Promise((resolve, reject) => {
      const rows: Record<string, string>[] = []
      let headers: string[] = []
      let lineIndex = 0

      const rl = createInterface({
        input: createReadStream(filePath, { encoding: 'utf-8' }),
        crlfDelay: Infinity
      })

      rl.on('line', (line: string) => {
        const fields = parseCsvLine(line)

        if (lineIndex === 0) {
          headers = fields.map((h) => h.trim())
        } else {
          const row: Record<string, string> = {}
          for (let i = 0; i < headers.length; i++) {
            row[headers[i]] = fields[i]?.trim() || ''
          }
          rows.push(row)
        }

        lineIndex++
      })

      rl.on('close', () => {
        resolve({ headers, rows })
      })

      rl.on('error', (err: Error) => {
        reject(new Error(`Failed to read CSV: ${err.message}`))
      })
    })
  }

  /**
   * Get the base data directory path
   */
  getDataDir(): string {
    return this.dataDir
  }

  /**
   * Copy a file to a project directory and return the new path
   */
  async copyToProject(projectId: string, sourcePath: string, subdir: string = 'files'): Promise<string> {
    const destDir = await this.getProjectSubDir(projectId, subdir)
    const fileName = basename(sourcePath)
    const destPath = join(destDir, fileName)

    const data = await this.readFile(sourcePath)
    await this.writeFile(destPath, data)

    return destPath
  }
}

// --- CSV parser ---

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          current += '"'
          i++
        } else {
          // End of quoted field
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }

  fields.push(current)
  return fields
}

// Singleton instance
export const fileManager = new FileManager()
