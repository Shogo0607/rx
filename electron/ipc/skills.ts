import { ipcMain } from 'electron'
import { skillLoader } from '../services/skill-loader'

interface CreateSkillInput {
  name: string
  description: string
  icon: string
  category: string
  systemPrompt: string
  tools: string // JSON string of ToolDefinition[]
}

export function registerSkillHandlers(): void {
  ipcMain.handle('skill:list-custom', async () => {
    const skills = await skillLoader.loadCustomSkills()

    // Map to the format the renderer expects (SkillDefinition)
    return skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      icon: skill.icon,
      category: skill.category,
      systemPrompt: skill.systemPrompt,
      tools: skill.tools,
      order: 0,
      enabled: true
    }))
  })

  ipcMain.handle('skill:create', async (_event, input: CreateSkillInput) => {
    let tools = []
    try {
      tools = typeof input.tools === 'string' ? JSON.parse(input.tools) : input.tools
    } catch {
      tools = []
    }

    const skill = await skillLoader.saveSkill({
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description,
      icon: input.icon || 'Sparkles',
      category: input.category || 'custom',
      systemPrompt: input.systemPrompt,
      tools
    })

    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      icon: skill.icon,
      category: skill.category,
      systemPrompt: skill.systemPrompt,
      tools: skill.tools,
      order: 0,
      enabled: true
    }
  })

  ipcMain.handle('skill:update', async (_event, input: { id: string } & Partial<CreateSkillInput>) => {
    if (!input.id?.trim()) {
      throw new Error('Skill ID is required')
    }
    const existing = (await skillLoader.loadCustomSkills()).find(s => s.id === input.id)
    if (!existing) {
      throw new Error('Skill not found')
    }

    let tools = existing.tools
    if (input.tools !== undefined) {
      try {
        tools = typeof input.tools === 'string' ? JSON.parse(input.tools) : input.tools
      } catch {
        tools = existing.tools
      }
    }

    const skill = await skillLoader.saveSkill({
      id: input.id,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      icon: input.icon ?? existing.icon,
      category: input.category ?? existing.category,
      systemPrompt: input.systemPrompt ?? existing.systemPrompt,
      tools
    })

    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      icon: skill.icon,
      category: skill.category,
      systemPrompt: skill.systemPrompt,
      tools: skill.tools,
      order: 0,
      enabled: true
    }
  })

  ipcMain.handle('skill:delete', async (_event, skillId: string) => {
    if (!skillId?.trim()) {
      throw new Error('Skill ID is required')
    }
    await skillLoader.deleteSkill(skillId)
  })
}
