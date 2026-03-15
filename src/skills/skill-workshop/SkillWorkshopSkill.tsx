import { useState, useCallback, useEffect } from 'react'
import type { SkillProps } from '../../types/skill'
import type { SkillDefinition } from '../../types/skill'
import { cn } from '../../lib/utils'
import { ipcInvoke } from '../../lib/ipc-client'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toaster'
import { useT } from '../../i18n'
import { useChatStore } from '../../stores/chat-store'
import { useUiStore } from '../../stores/ui-store'
import {
  Wrench,
  Plus,
  Sparkles,
  Settings,
  Code,
  MessageSquare,
  LayoutGrid,
  Table,
  FileText,
  Play,
  Download,
  Upload,
  Trash2,
  Copy,
  ChevronRight,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  Pencil,
  BookOpen,
  BarChart3,
  Shield,
  Presentation,
  Zap
} from 'lucide-react'

const ICON_OPTIONS = [
  'BookOpen', 'BarChart3', 'Shield', 'FlaskConical', 'Lightbulb',
  'FileText', 'Database', 'Network', 'Cpu', 'Sparkles',
  'Target', 'Zap', 'Brain', 'Search', 'Globe'
]

const CATEGORY_OPTIONS = ['research', 'analysis', 'writing', 'management', 'custom']

export function SkillWorkshopSkill({ projectId: _projectId }: SkillProps) {
  const { toast } = useToast()
  const t = useT()
  const [skills, setSkills] = useState<SkillDefinition[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'library' | 'create' | 'presets'>('library')
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)

  // Edit mode state for library detail
  const [editSystemPrompt, setEditSystemPrompt] = useState('')
  const [editTools, setEditTools] = useState('')

  // Create form state
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillDesc, setNewSkillDesc] = useState('')
  const [newSkillIcon, setNewSkillIcon] = useState('Sparkles')
  const [newSkillCategory, setNewSkillCategory] = useState('custom')
  const [newSkillPrompt, setNewSkillPrompt] = useState('')
  const [newSkillTools, setNewSkillTools] = useState('[\n  \n]')
  const [newSkillTemplate, setNewSkillTemplate] = useState('chat')

  const UI_TEMPLATES = [
    { id: 'chat', name: t('skillWorkshop.template.chat'), icon: MessageSquare, description: t('skillWorkshop.template.chatDesc') },
    { id: 'form', name: t('skillWorkshop.template.form'), icon: FileText, description: t('skillWorkshop.template.formDesc') },
    { id: 'canvas', name: t('skillWorkshop.template.canvas'), icon: LayoutGrid, description: t('skillWorkshop.template.canvasDesc') },
    { id: 'table', name: t('skillWorkshop.template.table'), icon: Table, description: t('skillWorkshop.template.tableDesc') }
  ] as const

  const PRESET_SKILLS = [
    { id: 'p1', name: t('skillWorkshop.preset.grantProposalWriter'), description: t('skillWorkshop.preset.grantProposalWriterDesc'), icon: BookOpen, category: 'writing' },
    { id: 'p2', name: t('skillWorkshop.preset.statisticalConsultant'), description: t('skillWorkshop.preset.statisticalConsultantDesc'), icon: BarChart3, category: 'analysis' },
    { id: 'p3', name: t('skillWorkshop.preset.researchEthicsChecker'), description: t('skillWorkshop.preset.researchEthicsCheckerDesc'), icon: Shield, category: 'research' },
    { id: 'p4', name: t('skillWorkshop.preset.presentationOutliner'), description: t('skillWorkshop.preset.presentationOutlinerDesc'), icon: Presentation, category: 'writing' }
  ]

  const loadSkills = useCallback(async () => {
    setLoading(true)
    try {
      const data = await ipcInvoke('skill:list-custom')
      setSkills(data as SkillDefinition[])
      if ((data as SkillDefinition[]).length > 0 && !selectedSkill) {
        setSelectedSkill((data as SkillDefinition[])[0].id)
      }
    } catch {
      toast('error', t('skillWorkshop.toast.loadError'))
    } finally {
      setLoading(false)
    }
  }, [toast, selectedSkill, t])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  const handleCreate = async () => {
    if (!newSkillName.trim()) return
    try {
      const created = await ipcInvoke('skill:create', {
        name: newSkillName.trim(),
        description: newSkillDesc.trim(),
        icon: newSkillIcon,
        category: newSkillCategory,
        systemPrompt: newSkillPrompt,
        tools: newSkillTools
      })
      setSkills((prev) => [...prev, created as SkillDefinition])
      setSelectedSkill((created as SkillDefinition).id)
      setNewSkillName('')
      setNewSkillDesc('')
      setNewSkillPrompt('')
      setNewSkillTools('[\n  \n]')
      setView('library')
      toast('success', t('skillWorkshop.toast.createSuccess'))
    } catch {
      toast('error', t('skillWorkshop.toast.createError'))
    }
  }

  // Sync edit fields when selectedSkill changes or editMode is toggled
  useEffect(() => {
    if (selectedSkillData && editMode) {
      setEditSystemPrompt(selectedSkillData.systemPrompt ?? '')
      setEditTools(JSON.stringify(selectedSkillData.tools ?? [], null, 2))
    }
  }, [selectedSkill, editMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!selectedSkillData) return
    try {
      await ipcInvoke('db:execute', {
        sql: "UPDATE skills SET system_prompt = ?, tools = ?, updated_at = datetime('now') WHERE id = ?",
        params: [editSystemPrompt, editTools, selectedSkillData.id]
      })
      // Update local state
      setSkills((prev) =>
        prev.map((s) =>
          s.id === selectedSkillData.id
            ? { ...s, systemPrompt: editSystemPrompt, tools: JSON.parse(editTools || '[]') }
            : s
        )
      )
      setEditMode(false)
      toast('success', t('skillWorkshop.toast.saveSuccess'))
    } catch {
      toast('error', t('skillWorkshop.toast.saveError'))
    }
  }

  const handleTest = () => {
    if (!selectedSkillData) return
    useChatStore.getState().clearMessages()
    useChatStore.getState().setActiveAgent(selectedSkillData.name)
    useUiStore.getState().setChatPanelOpen(true)
  }

  const handleInstallPreset = async (preset: typeof PRESET_SKILLS[number]) => {
    try {
      const created = await ipcInvoke('skill:create', {
        name: preset.name,
        description: preset.description,
        icon: preset.icon.displayName ?? 'Zap',
        category: preset.category,
        systemPrompt: `You are a ${preset.name}. ${preset.description}`,
        tools: '[]'
      })
      setSkills((prev) => [...prev, created as SkillDefinition])
      setSelectedSkill((created as SkillDefinition).id)
      setView('library')
      toast('success', t('skillWorkshop.toast.installSuccess'))
    } catch {
      toast('error', t('skillWorkshop.toast.installError'))
    }
  }

  const handleClonePreset = (preset: typeof PRESET_SKILLS[number]) => {
    setNewSkillName(preset.name + ' (Copy)')
    setNewSkillDesc(preset.description)
    setNewSkillCategory(preset.category)
    setNewSkillPrompt(`You are a ${preset.name}. ${preset.description}`)
    setNewSkillTools('[\n  \n]')
    setView('create')
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      try {
        const file = input.files?.[0]
        if (!file) return
        const text = await file.text()
        const data = JSON.parse(text)
        const created = await ipcInvoke('skill:create', {
          name: data.name ?? 'Imported Skill',
          description: data.description ?? '',
          icon: data.icon ?? 'Zap',
          category: data.category ?? 'custom',
          systemPrompt: data.systemPrompt ?? '',
          tools: typeof data.tools === 'string' ? data.tools : JSON.stringify(data.tools ?? [])
        })
        setSkills((prev) => [...prev, created as SkillDefinition])
        setSelectedSkill((created as SkillDefinition).id)
        toast('success', t('skillWorkshop.toast.importSuccess'))
      } catch {
        toast('error', t('skillWorkshop.toast.importError'))
      }
    }
    input.click()
  }

  const handleExport = () => {
    if (!selectedSkillData) {
      toast('error', t('skillWorkshop.toast.selectToExport'))
      return
    }
    const exportData = {
      name: selectedSkillData.name,
      description: selectedSkillData.description,
      icon: selectedSkillData.icon,
      category: selectedSkillData.category,
      systemPrompt: selectedSkillData.systemPrompt,
      tools: selectedSkillData.tools
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `skill-${selectedSkillData.name.toLowerCase().replace(/\s+/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast('success', t('skillWorkshop.toast.exportSuccess'))
  }

  const handleDelete = async (id: string) => {
    try {
      await ipcInvoke('skill:delete', id)
      setSkills((prev) => prev.filter((s) => s.id !== id))
      if (selectedSkill === id) {
        setSelectedSkill(skills.find((s) => s.id !== id)?.id ?? null)
      }
      toast('success', t('skillWorkshop.toast.deleteSuccess'))
    } catch {
      toast('error', t('skillWorkshop.toast.deleteError'))
    }
  }

  if (loading) {
    return <LoadingState message={t('skillWorkshop.loading.skills')} />
  }

  const selectedSkillData = skills.find(s => s.id === selectedSkill)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Wrench className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">{t('skillWorkshop.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary rounded-md">
            <button onClick={() => setView('library')} className={cn('px-3 py-1.5 text-sm rounded-md', view === 'library' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              {t('skillWorkshop.tab.library')}
            </button>
            <button onClick={() => setView('create')} className={cn('px-3 py-1.5 text-sm rounded-md', view === 'create' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              {t('skillWorkshop.tab.create')}
            </button>
            <button onClick={() => setView('presets')} className={cn('px-3 py-1.5 text-sm rounded-md', view === 'presets' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              {t('skillWorkshop.tab.presets')}
            </button>
          </div>
          <button onClick={handleImport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-sm">
            <Upload className="w-3.5 h-3.5" />
            {t('skillWorkshop.button.import')}
          </button>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-sm">
            <Download className="w-3.5 h-3.5" />
            {t('skillWorkshop.button.export')}
          </button>
        </div>
      </div>

      {view === 'library' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Skill list */}
          <div className="w-72 border-r border-border overflow-y-auto">
            <div className="p-3 border-b border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('skillWorkshop.section.customSkills')} ({skills.length})
              </p>
            </div>
            {skills.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <p className="font-medium">{t('skillWorkshop.empty.noCustomSkills')}</p>
                <p className="text-xs mt-1">{t('skillWorkshop.empty.noCustomSkillsDescription')}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {skills.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => setSelectedSkill(skill.id)}
                    className={cn(
                      'flex items-center gap-3 w-full p-3 text-left transition-colors',
                      selectedSkill === skill.id ? 'bg-primary/10' : 'hover:bg-accent/50'
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{skill.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{skill.description}</p>
                    </div>
                    {skill.enabled
                      ? <ToggleRight className="w-5 h-5 text-primary shrink-0" />
                      : <ToggleLeft className="w-5 h-5 text-muted-foreground shrink-0" />
                    }
                  </button>
                ))}
              </div>
            )}
            <div className="p-3">
              <button
                onClick={() => setView('create')}
                className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('skillWorkshop.button.createNewSkill')}
              </button>
            </div>
          </div>

          {/* Skill detail */}
          {selectedSkillData ? (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{selectedSkillData.name}</h2>
                      <p className="text-sm text-muted-foreground">{selectedSkillData.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleTest} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-500/10 text-green-500 text-sm hover:bg-green-500/20">
                      <Play className="w-3.5 h-3.5" />
                      {t('skillWorkshop.button.test')}
                    </button>
                    {editMode ? (
                      <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90">
                        <Check className="w-3.5 h-3.5" />
                        {t('skillWorkshop.button.save')}
                      </button>
                    ) : null}
                    <button onClick={() => setEditMode(!editMode)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-sm hover:bg-accent">
                      <Pencil className="w-3.5 h-3.5" />
                      {editMode ? (t('common.cancel')) : t('skillWorkshop.button.edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(selectedSkillData.id)}
                      className="p-1.5 rounded-md hover:bg-accent text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Meta info */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-secondary">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t('skillWorkshop.label.category')}</p>
                      <p className="text-sm font-medium capitalize">{selectedSkillData.category}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t('skillWorkshop.label.icon')}</p>
                      <p className="text-sm font-medium">{selectedSkillData.icon}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t('skillWorkshop.label.status')}</p>
                      <p className="text-sm font-medium">{selectedSkillData.enabled ? t('skillWorkshop.text.enabled') : t('skillWorkshop.text.disabled')}</p>
                    </div>
                  </div>

                  {/* System Prompt */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{t('skillWorkshop.label.systemPrompt')}</p>
                      <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                        <Sparkles className="w-3 h-3" />
                        {t('skillWorkshop.button.optimize')}
                      </button>
                    </div>
                    <textarea
                      value={editMode ? editSystemPrompt : selectedSkillData.systemPrompt}
                      onChange={editMode ? (e) => setEditSystemPrompt(e.target.value) : undefined}
                      readOnly={!editMode}
                      className={cn(
                        "w-full h-32 px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring",
                        editMode && "border-primary/50 bg-primary/5"
                      )}
                    />
                  </div>

                  {/* Tool Definitions */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Code className="w-4 h-4" />
                        {t('skillWorkshop.label.toolDefinitions')}
                      </p>
                    </div>
                    <textarea
                      value={editMode ? editTools : JSON.stringify(selectedSkillData.tools, null, 2)}
                      onChange={editMode ? (e) => setEditTools(e.target.value) : undefined}
                      readOnly={!editMode}
                      className={cn(
                        "w-full h-40 px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring",
                        editMode && "border-primary/50 bg-primary/5"
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t('skillWorkshop.empty.selectSkill')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'create' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-lg font-semibold mb-6">{t('skillWorkshop.section.createNewSkill')}</h2>

            <div className="space-y-6">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('skillWorkshop.label.name')}</label>
                  <input
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    placeholder={t('skillWorkshop.placeholder.name')}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('skillWorkshop.label.category')}</label>
                  <select
                    value={newSkillCategory}
                    onChange={(e) => setNewSkillCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                  >
                    {CATEGORY_OPTIONS.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('skillWorkshop.label.description')}</label>
                <input
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                  placeholder={t('skillWorkshop.placeholder.description')}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                />
              </div>

              {/* Icon selector */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('skillWorkshop.label.icon')}</label>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setNewSkillIcon(icon)}
                      className={cn(
                        'w-9 h-9 rounded-md border flex items-center justify-center text-xs transition-colors',
                        newSkillIcon === icon ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-accent'
                      )}
                      title={icon}
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              {/* UI Template */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('skillWorkshop.label.uiTemplate')}</label>
                <div className="grid grid-cols-4 gap-3">
                  {UI_TEMPLATES.map((tmpl) => {
                    const Icon = tmpl.icon
                    return (
                      <button
                        key={tmpl.id}
                        onClick={() => setNewSkillTemplate(tmpl.id)}
                        className={cn(
                          'flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors',
                          newSkillTemplate === tmpl.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'
                        )}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-xs font-medium">{tmpl.name}</span>
                        <span className="text-[10px] text-muted-foreground">{tmpl.description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium">{t('skillWorkshop.label.systemPrompt')}</label>
                  <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                    <Sparkles className="w-3 h-3" />
                    {t('skillWorkshop.button.aiGenerate')}
                  </button>
                </div>
                <textarea
                  value={newSkillPrompt}
                  onChange={(e) => setNewSkillPrompt(e.target.value)}
                  placeholder={t('skillWorkshop.placeholder.systemPrompt')}
                  className="w-full h-40 px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Tool Definitions */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    {t('skillWorkshop.label.toolDefinitionsJson')}
                  </label>
                </div>
                <textarea
                  value={newSkillTools}
                  onChange={(e) => setNewSkillTools(e.target.value)}
                  className="w-full h-48 px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  onClick={handleCreate}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
                >
                  <Check className="w-4 h-4" />
                  {t('skillWorkshop.button.createSkill')}
                </button>
                <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-green-500/10 text-green-500 text-sm hover:bg-green-500/20">
                  <Play className="w-4 h-4" />
                  {t('skillWorkshop.button.testBeforeSaving')}
                </button>
                <button onClick={() => setView('library')} className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-sm hover:bg-accent">
                  <X className="w-4 h-4" />
                  {t('skillWorkshop.button.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'presets' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-lg font-semibold mb-2">{t('skillWorkshop.section.presetSkills')}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t('skillWorkshop.text.presetDescription')}</p>

            <div className="grid grid-cols-2 gap-4">
              {PRESET_SKILLS.map((preset) => {
                const Icon = preset.icon
                return (
                  <div key={preset.id} className="p-4 rounded-lg border border-border hover:border-primary/30 transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{preset.name}</h3>
                        <p className="text-xs text-muted-foreground">{preset.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">{preset.category}</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleClonePreset(preset)} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary text-xs hover:bg-accent">
                          <Copy className="w-3 h-3" />
                          {t('skillWorkshop.button.clone')}
                        </button>
                        <button onClick={() => handleInstallPreset(preset)} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90">
                          <Plus className="w-3 h-3" />
                          {t('skillWorkshop.button.install')}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
