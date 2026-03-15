import { useState, useEffect, useRef } from 'react'
import { useUiStore } from '../../stores/ui-store'
import { useSkillStore } from '../../stores/skill-store'
import { useProjectStore } from '../../stores/project-store'
import { useT } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { cn } from '../../lib/utils'
import {
  Search,
  LayoutDashboard,
  BookOpen,
  HelpCircle,
  Lightbulb,
  FlaskConical,
  BarChart3,
  Sparkles,
  Workflow,
  FileText,
  Scale,
  ClipboardList,
  Calendar,
  GitBranch,
  Network,
  Wrench,
  Settings,
  Plus,
  MessageSquare,
  type LucideIcon
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, BookOpen, HelpCircle, Lightbulb, FlaskConical,
  BarChart3, Sparkles, Workflow, FileText, Scale, ClipboardList,
  Calendar, GitBranch, Network, Wrench
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen)
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen)
  const setActiveSkill = useUiStore((s) => s.setActiveSkill)
  const setChatPanelOpen = useUiStore((s) => s.setChatPanelOpen)
  const getAllSkills = useSkillStore((s) => s.getAllSkills)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const t = useT()

  const skills = getAllSkills()

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, setOpen])

  if (!open) return null

  const filtered = skills.filter(s =>
    (s.nameKey ? t(s.nameKey as TranslationKey) : s.name).toLowerCase().includes(query.toLowerCase()) ||
    (s.descriptionKey ? t(s.descriptionKey as TranslationKey) : s.description).toLowerCase().includes(query.toLowerCase())
  )

  const actions = [
    { id: 'new-project', label: t('commandPalette.newProject'), icon: Plus, action: () => {} },
    { id: 'open-chat', label: t('commandPalette.openChat'), icon: MessageSquare, action: () => { setChatPanelOpen(true); setOpen(false) } },
    { id: 'settings', label: t('commandPalette.settings'), icon: Settings, action: () => { useUiStore.getState().setSettingsDialogOpen(true); setOpen(false) } }
  ].filter(a =>
    a.label.toLowerCase().includes(query.toLowerCase())
  )

  const handleSelect = (skillId: string) => {
    setActiveSkill(skillId)
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />

      {/* Dialog */}
      <div className="relative w-[520px] max-h-[400px] rounded-xl border border-border bg-popover shadow-2xl overflow-hidden animate-fade-in">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('commandPalette.placeholder')}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-[320px] p-2">
          {/* Skills */}
          {filtered.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1">{t('commandPalette.skills')}</p>
              {filtered.map((skill) => {
                const Icon = iconMap[skill.icon] ?? LayoutDashboard
                return (
                  <button
                    key={skill.id}
                    onClick={() => handleSelect(skill.id)}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent text-left transition-colors"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{skill.nameKey ? t(skill.nameKey as TranslationKey) : skill.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{skill.descriptionKey ? t(skill.descriptionKey as TranslationKey) : skill.description}</p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground capitalize">{skill.category}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Actions */}
          {actions.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1">{t('commandPalette.actions')}</p>
              {actions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.id}
                    onClick={action.action}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent text-left transition-colors"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{action.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {filtered.length === 0 && actions.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">{t('common.noResults')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
