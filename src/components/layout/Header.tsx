import { useState, useRef, useEffect } from 'react'
import { useProjectStore } from '../../stores/project-store'
import { useUiStore } from '../../stores/ui-store'
import { useI18nStore, useT } from '../../i18n'
import { Search, Settings, MessageSquare, ChevronDown, Plus, FolderOpen, Trash2 } from 'lucide-react'
import { useToast } from '../ui/Toaster'

export function Header() {
  const projects = useProjectStore((s) => s.projects)
  const currentProjectId = useProjectStore((s) => s.currentProjectId)
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const createProject = useProjectStore((s) => s.createProject)
  const deleteProject = useProjectStore((s) => s.deleteProject)
  const toggleChatPanel = useUiStore((s) => s.toggleChatPanel)
  const chatPanelOpen = useUiStore((s) => s.chatPanelOpen)
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen)
  const setSettingsDialogOpen = useUiStore((s) => s.setSettingsDialogOpen)
  const t = useT()
  const locale = useI18nStore((s) => s.locale)
  const setLocale = useI18nStore((s) => s.setLocale)

  const { toast } = useToast()
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const createInputRef = useRef<HTMLInputElement>(null)

  const currentProject = projects.find((p) => p.id === currentProjectId)

  // Close dropdown on outside click
  useEffect(() => {
    if (!projectDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false)
        setShowCreateForm(false)
        setNewProjectName('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [projectDropdownOpen])

  // Focus input when create form opens
  useEffect(() => {
    if (showCreateForm) {
      createInputRef.current?.focus()
    }
  }, [showCreateForm])

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteProject(id)
      setConfirmDeleteId(null)
      toast('success', t('common.deleteSuccess'))
    } catch (err) {
      console.error('Failed to delete project:', err)
      toast('error', t('common.deleteFailed'))
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    try {
      const project = await createProject({ name: newProjectName.trim(), description: '' })
      setCurrentProject(project.id)
      setProjectDropdownOpen(false)
      setShowCreateForm(false)
      setNewProjectName('')
    } catch (err) {
      console.error('Failed to create project:', err)
    }
  }

  return (
    <header className="flex items-center h-12 px-4 border-b border-border bg-background titlebar-drag">
      {/* App title + traffic light spacer on macOS */}
      <div className="flex items-center gap-3 min-w-[100px]">
        <span className="font-bold text-sm tracking-wide pl-16">RX</span>
      </div>

      {/* Project selector */}
      <div className="titlebar-no-drag relative" ref={dropdownRef}>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-accent text-sm transition-colors"
          onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
        >
          <span className="text-muted-foreground">{t('header.project')}</span>
          <span className="font-medium">
            {currentProject?.name ?? t('header.noProjectSelected')}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {projectDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-popover border border-border rounded-lg shadow-lg z-50 py-1 titlebar-no-drag">
            {projects.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {t('common.noProjects')}
              </div>
            ) : (
              projects.map((p) => (
                <div key={p.id} className="relative">
                  {confirmDeleteId === p.id ? (
                    <div className="px-3 py-2 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {t('common.confirmDeleteProject')}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          className="flex-1 px-2 py-1 text-xs font-medium rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                          onClick={() => handleDeleteProject(p.id)}
                        >
                          {t('common.delete')}
                        </button>
                        <button
                          className="flex-1 px-2 py-1 text-xs font-medium rounded-md border border-border hover:bg-accent transition-colors"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors group ${
                        p.id === currentProjectId ? 'bg-accent/50' : ''
                      }`}
                    >
                      <button
                        className="flex-1 flex items-center gap-2 text-left min-w-0"
                        onClick={() => {
                          setCurrentProject(p.id)
                          setProjectDropdownOpen(false)
                        }}
                      >
                        <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          {p.description && (
                            <div className="text-xs text-muted-foreground truncate">{p.description}</div>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            <div className="border-t border-border mt-1 pt-1">
              {showCreateForm ? (
                <form
                  className="px-3 py-2"
                  onSubmit={(e) => { e.preventDefault(); handleCreateProject() }}
                >
                  <input
                    ref={createInputRef}
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder={t('common.projectName')}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background outline-none focus:border-primary"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="submit"
                      disabled={!newProjectName.trim()}
                      className="flex-1 px-2 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {t('common.create')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCreateForm(false); setNewProjectName('') }}
                      className="flex-1 px-2 py-1 text-xs font-medium rounded-md border border-border hover:bg-accent transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors text-primary"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  {t('common.newProject')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1 titlebar-no-drag">
        {/* Search / Command Palette */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent text-sm text-muted-foreground transition-colors"
        >
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">{t('header.search')}</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border text-[10px] font-mono">
            &#8984;K
          </kbd>
        </button>

        {/* Settings */}
        <button
          onClick={() => setSettingsDialogOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors"
          title={t('header.settings')}
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Language toggle */}
        <button
          onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors"
          title={locale === 'ja' ? t('header.switchToEn') : t('header.switchToJa')}
        >
          <span className="text-xs font-bold text-muted-foreground">
            {locale === 'ja' ? 'EN' : 'JA'}
          </span>
        </button>

        {/* AI Chat toggle */}
        <button
          onClick={toggleChatPanel}
          className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
            chatPanelOpen
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent text-muted-foreground'
          }`}
          title={t('header.aiChat')}
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
