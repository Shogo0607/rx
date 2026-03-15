import { useEffect, useState, useCallback, useRef } from 'react'
import type { SkillProps } from '../../types/skill'
import { cn } from '../../lib/utils'
import { useProjectStore } from '../../stores/project-store'
import { useUiStore } from '../../stores/ui-store'
import { ipcInvoke } from '../../lib/ipc-client'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toaster'
import { useT } from '../../i18n'
import {
  LayoutDashboard,
  Plus,
  FileText,
  Beaker,
  Lightbulb,
  BookOpen,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  FolderOpen,
  Activity,
  Target,
  BarChart3,
  ChevronRight,
  HelpCircle,
  Sparkles,
  Trash2
} from 'lucide-react'
import type { TranslationKey } from '../../i18n'

const RESEARCH_PHASES = [
  { id: 'literature', label: 'Literature', icon: BookOpen },
  { id: 'rq', label: 'RQ', icon: Target },
  { id: 'hypothesis', label: 'Hypothesis', icon: Lightbulb },
  { id: 'experiment', label: 'Experiment', icon: Beaker },
  { id: 'analysis', label: 'Analysis', icon: BarChart3 },
  { id: 'writing', label: 'Writing', icon: FileText }
]

interface ProjectStats {
  papers: number
  hypotheses: number
  experiments: number
  tasksDone: number
  tasksTotal: number
}

export function DashboardSkill({ projectId }: SkillProps) {
  const { toast } = useToast()
  const t = useT()
  const projects = useProjectStore((s) => s.projects)
  const loading = useProjectStore((s) => s.loading)
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const createProject = useProjectStore((s) => s.createProject)
  const deleteProject = useProjectStore((s) => s.deleteProject)
  const setActiveSkill = useUiStore((s) => s.setActiveSkill)

  const [stats, setStats] = useState<ProjectStats>({ papers: 0, hypotheses: 0, experiments: 0, tasksDone: 0, tasksTotal: 0 })
  const [statsLoading, setStatsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const createInputRef = useRef<HTMLInputElement>(null)

  // Load stats for the current project
  const loadStats = useCallback(async (pid: string) => {
    setStatsLoading(true)
    try {
      const [papersRes, hypRes, expRes, tasksDoneRes, tasksAllRes] = await Promise.all([
        ipcInvoke('db:query', { sql: 'SELECT COUNT(*) as cnt FROM papers WHERE project_id = ?', params: [pid] }),
        ipcInvoke('db:query', { sql: 'SELECT COUNT(*) as cnt FROM hypotheses WHERE project_id = ?', params: [pid] }),
        ipcInvoke('db:query', { sql: 'SELECT COUNT(*) as cnt FROM experiments WHERE project_id = ?', params: [pid] }),
        ipcInvoke('db:query', { sql: "SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ? AND status = 'done'", params: [pid] }),
        ipcInvoke('db:query', { sql: 'SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ?', params: [pid] })
      ])
      setStats({
        papers: (papersRes[0] as { cnt: number })?.cnt ?? 0,
        hypotheses: (hypRes[0] as { cnt: number })?.cnt ?? 0,
        experiments: (expRes[0] as { cnt: number })?.cnt ?? 0,
        tasksDone: (tasksDoneRes[0] as { cnt: number })?.cnt ?? 0,
        tasksTotal: (tasksAllRes[0] as { cnt: number })?.cnt ?? 0
      })
    } catch {
      // Stats unavailable
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (projectId) {
      loadStats(projectId)
    }
  }, [projectId, loadStats])

  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleNewProject = async () => {
    const name = newProjectName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const project = await createProject({ name, description: '' })
      setCurrentProject(project.id)
      setShowCreateForm(false)
      setNewProjectName('')
      toast('success', t('common.projectCreated'))
    } catch (err) {
      console.error('Failed to create project:', err)
      toast('error', t('common.projectCreateFailed'))
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteProject(id)
      setDeletingId(null)
      toast('success', t('common.deleteSuccess'))
    } catch (err) {
      console.error('Failed to delete project:', err)
      toast('error', t('common.deleteFailed'))
    }
  }

  useEffect(() => {
    if (showCreateForm) {
      createInputRef.current?.focus()
    }
  }, [showCreateForm])

  if (loading) {
    return <LoadingState message={t('dashboard.loadingProjects')} />
  }

  const statsCards = [
    { label: t('dashboard.papers'), value: stats.papers, icon: BookOpen, color: 'text-blue-500' },
    { label: t('dashboard.hypotheses'), value: stats.hypotheses, icon: Lightbulb, color: 'text-amber-500' },
    { label: t('dashboard.experiments'), value: stats.experiments, icon: Beaker, color: 'text-emerald-500' },
    { label: t('dashboard.tasksDone'), value: stats.tasksTotal > 0 ? `${stats.tasksDone}/${stats.tasksTotal}` : '0', icon: CheckCircle2, color: 'text-violet-500' }
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t('dashboard.title')}</h1>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('dashboard.newProject')}
        </button>
      </div>

      {/* Inline create form */}
      {showCreateForm && (
        <div className="px-6 py-3 border-b border-border bg-muted/30">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); handleNewProject() }}
          >
            <input
              ref={createInputRef}
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder={t('common.projectName')}
              className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={!newProjectName.trim() || creating}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {creating ? t('common.creating') : t('common.create')}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreateForm(false); setNewProjectName('') }}
              className="px-4 py-1.5 text-sm font-medium rounded-md border border-border hover:bg-accent transition-colors"
            >
              {t('common.cancel')}
            </button>
          </form>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {!projectId ? (
          <div className="max-w-3xl mx-auto space-y-8">
            {/* App description */}
            <div className="text-center space-y-3 pt-4">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold">RX</h2>
              </div>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                {t('welcome.appDescription')}
              </p>
            </div>

            {/* Research workflow */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground text-center">
                {t('welcome.workflowTitle')}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: 'literature', icon: BookOpen, color: 'text-blue-500 bg-blue-500/10' },
                  { key: 'rq', icon: HelpCircle, color: 'text-purple-500 bg-purple-500/10' },
                  { key: 'hypothesis', icon: Lightbulb, color: 'text-amber-500 bg-amber-500/10' },
                  { key: 'experiment', icon: Beaker, color: 'text-emerald-500 bg-emerald-500/10' },
                  { key: 'analysis', icon: BarChart3, color: 'text-rose-500 bg-rose-500/10' },
                  { key: 'writing', icon: FileText, color: 'text-cyan-500 bg-cyan-500/10' },
                ] as const).map((step) => (
                  <div
                    key={step.key}
                    className="p-4 rounded-xl border border-border bg-card space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn('p-1.5 rounded-lg', step.color)}>
                        <step.icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium">
                        {t(`welcome.step.${step.key}.title` as TranslationKey)}
                      </span>
                    </div>
                    <div className="space-y-1 pl-1">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/70">Input: </span>
                        {t(`welcome.step.${step.key}.input` as TranslationKey)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/70">Output: </span>
                        {t(`welcome.step.${step.key}.output` as TranslationKey)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Get started */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">{t('welcome.getStarted')}</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('common.createNewProject')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4">
              {statsCards.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card"
                >
                  <div className={cn('p-2.5 rounded-lg bg-muted', stat.color)}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {statsLoading ? '...' : stat.value}
                    </p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Two-column layout: Projects + Quick Actions */}
            <div className="grid grid-cols-5 gap-6">
              {/* Project Cards */}
              <div className="col-span-3 space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {t('dashboard.projects')}
                </h2>
                {projects.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-4">{t('common.noProjects')}</div>
                ) : (
                  projects.map((project) => (
                    <div key={project.id} className="relative">
                      <button
                        onClick={() => setCurrentProject(project.id)}
                        className={cn(
                          'w-full text-left p-4 rounded-xl border transition-colors',
                          project.id === projectId
                            ? 'border-blue-500/50 bg-blue-500/5'
                            : 'border-border bg-card hover:bg-accent'
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-muted-foreground" />
                            <h3 className="font-semibold text-sm">{project.name}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">
                              {project.status}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeletingId(project.id)
                              }}
                              className="p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              title={t('common.delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {project.description && (
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {new Date(project.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </button>

                      {/* Delete confirmation dialog */}
                      {deletingId === project.id && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/95 border border-red-500/30 z-10">
                          <div className="text-center space-y-3 px-4">
                            <p className="text-sm text-foreground">
                              {t('common.confirmDeleteProject')}
                            </p>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleDeleteProject(project.id)}
                                className="px-4 py-1.5 text-sm font-medium rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                              >
                                {t('common.delete')}
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="px-4 py-1.5 text-sm font-medium rounded-md border border-border hover:bg-accent transition-colors"
                              >
                                {t('common.cancel')}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Quick Actions */}
              <div className="col-span-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {t('dashboard.quickActions')}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: t('dashboard.searchPapers'), icon: BookOpen, skill: 'literature' },
                    { label: t('dashboard.addHypothesis'), icon: Lightbulb, skill: 'hypothesis' },
                    { label: t('dashboard.viewTimeline'), icon: Activity, skill: 'timeline' },
                    { label: t('dashboard.writeDocument'), icon: FileText, skill: 'documents' }
                  ].map((action) => (
                    <button
                      key={action.label}
                      onClick={() => setActiveSkill(action.skill)}
                      className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm"
                    >
                      <action.icon className="w-4 h-4 text-muted-foreground" />
                      <span>{action.label}</span>
                      <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
