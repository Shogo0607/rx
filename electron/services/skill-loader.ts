import { app } from 'electron'
import { join } from 'path'
import { readdir, readFile, writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

interface CustomSkill {
  id: string
  name: string
  description: string
  icon: string
  category: string
  systemPrompt: string
  tools: ToolDefinition[]
  createdAt?: string
  updatedAt?: string
}

export class SkillLoader {
  private skillsDir: string

  constructor() {
    this.skillsDir = join(app.getPath('userData'), 'skills')
  }

  /**
   * Ensure the skills directory exists
   */
  private async ensureDir(): Promise<void> {
    if (!existsSync(this.skillsDir)) {
      await mkdir(this.skillsDir, { recursive: true })
    }
  }

  /**
   * Load all custom skill definitions from the skills directory
   */
  async loadCustomSkills(): Promise<CustomSkill[]> {
    await this.ensureDir()

    const files = await readdir(this.skillsDir)
    const jsonFiles = files.filter((f) => f.endsWith('.json'))

    const skills: CustomSkill[] = []

    for (const file of jsonFiles) {
      try {
        const filePath = join(this.skillsDir, file)
        const raw = await readFile(filePath, 'utf-8')
        const skill = JSON.parse(raw) as CustomSkill

        // Validate required fields
        if (!skill.id || !skill.name || !skill.systemPrompt) {
          console.warn(`[skill-loader] Skipping invalid skill file: ${file}`)
          continue
        }

        // Ensure tools is an array
        if (!Array.isArray(skill.tools)) {
          skill.tools = []
        }

        skills.push(skill)
      } catch (error) {
        console.error(`[skill-loader] Failed to load skill file ${file}:`, error)
      }
    }

    // Sort by name
    skills.sort((a, b) => a.name.localeCompare(b.name))

    return skills
  }

  /**
   * Save a skill definition to a JSON file
   */
  async saveSkill(skill: CustomSkill): Promise<CustomSkill> {
    await this.ensureDir()

    // Generate ID if not provided
    if (!skill.id) {
      skill.id = crypto.randomUUID()
    }

    // Set timestamps
    const now = new Date().toISOString()
    if (!skill.createdAt) {
      skill.createdAt = now
    }
    skill.updatedAt = now

    // Validate
    if (!skill.name?.trim()) {
      throw new Error('Skill name is required')
    }
    if (!skill.systemPrompt?.trim()) {
      throw new Error('Skill system prompt is required')
    }

    // Set defaults
    skill.icon = skill.icon || 'Sparkles'
    skill.category = skill.category || 'custom'
    skill.tools = skill.tools || []

    // Write to file (filename = skill id)
    const filePath = join(this.skillsDir, `${skill.id}.json`)
    await writeFile(filePath, JSON.stringify(skill, null, 2), 'utf-8')

    console.log(`[skill-loader] Saved skill: ${skill.name} (${skill.id})`)

    return skill
  }

  /**
   * Delete a skill file by ID
   */
  async deleteSkill(skillId: string): Promise<void> {
    const filePath = join(this.skillsDir, `${skillId}.json`)

    if (!existsSync(filePath)) {
      throw new Error(`Skill not found: ${skillId}`)
    }

    await unlink(filePath)
    console.log(`[skill-loader] Deleted skill: ${skillId}`)
  }

  /**
   * Get a single skill by ID
   */
  async getSkill(skillId: string): Promise<CustomSkill | null> {
    const filePath = join(this.skillsDir, `${skillId}.json`)

    if (!existsSync(filePath)) {
      return null
    }

    try {
      const raw = await readFile(filePath, 'utf-8')
      return JSON.parse(raw) as CustomSkill
    } catch {
      return null
    }
  }
}

// Singleton instance
export const skillLoader = new SkillLoader()
