import { create } from 'zustand'

interface UiState {
  activeSkillId: string
  chatPanelOpen: boolean
  commandPaletteOpen: boolean
  sidebarCollapsed: boolean
  settingsDialogOpen: boolean
  defaultModel: string

  setActiveSkill: (id: string) => void
  toggleChatPanel: () => void
  setChatPanelOpen: (open: boolean) => void
  toggleCommandPalette: () => void
  setCommandPaletteOpen: (open: boolean) => void
  toggleSidebar: () => void
  setSettingsDialogOpen: (open: boolean) => void
  setDefaultModel: (model: string) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeSkillId: 'dashboard',
  chatPanelOpen: false,
  commandPaletteOpen: false,
  sidebarCollapsed: false,
  settingsDialogOpen: false,
  defaultModel: 'gpt-4o',

  setActiveSkill: (id) => set({ activeSkillId: id }),
  toggleChatPanel: () => set((s) => ({ chatPanelOpen: !s.chatPanelOpen })),
  setChatPanelOpen: (open) => set({ chatPanelOpen: open }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSettingsDialogOpen: (open) => set({ settingsDialogOpen: open }),
  setDefaultModel: (model) => set({ defaultModel: model || 'gpt-4o' })
}))
