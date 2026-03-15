import { create } from 'zustand'
import type { SkillDefinition } from '../types/skill'

interface SkillState {
  skills: SkillDefinition[]
  customSkills: SkillDefinition[]

  registerSkill: (skill: SkillDefinition) => void
  registerSkills: (skills: SkillDefinition[]) => void
  addCustomSkill: (skill: SkillDefinition) => void
  removeCustomSkill: (id: string) => void
  getSkill: (id: string) => SkillDefinition | undefined
  getAllSkills: () => SkillDefinition[]
}

export const useSkillStore = create<SkillState>((set, get) => ({
  skills: [],
  customSkills: [],

  registerSkill: (skill) =>
    set((s) => ({
      skills: s.skills.some((sk) => sk.id === skill.id)
        ? s.skills.map((sk) => (sk.id === skill.id ? skill : sk))
        : [...s.skills, skill]
    })),

  registerSkills: (skills) => set({ skills }),

  addCustomSkill: (skill) =>
    set((s) => ({ customSkills: [...s.customSkills, skill] })),

  removeCustomSkill: (id) =>
    set((s) => ({ customSkills: s.customSkills.filter((sk) => sk.id !== id) })),

  getSkill: (id) => {
    const { skills, customSkills } = get()
    return [...skills, ...customSkills].find((sk) => sk.id === id)
  },

  getAllSkills: () => {
    const { skills, customSkills } = get()
    return [...skills, ...customSkills].sort((a, b) => a.order - b.order)
  }
}))
