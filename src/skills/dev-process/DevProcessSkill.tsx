import { useState, useCallback, useEffect } from 'react'
import type { SkillProps } from '../../types/skill'
import { cn } from '../../lib/utils'
import { ipcInvoke } from '../../lib/ipc-client'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toaster'
import { useT } from '../../i18n'
import { useChatStore } from '../../stores/chat-store'
import { useUiStore } from '../../stores/ui-store'
import {
  GitBranch,
  Plus,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  Users,
  Layers,
  RotateCcw,
  ArrowRight,
  GripVertical,
  Calendar,
  BarChart3,
  Shield
} from 'lucide-react'

interface Task {
  id: string
  projectId: string
  sprintId: string | null
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignee: string | null
  dueDate: string | null
  startDate: string | null
  endDate: string | null
  estimatedHours: number | null
  actualHours: number | null
  parentTaskId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface Sprint {
  id: string
  projectId: string
  name: string
  goal: string | null
  status: 'planning' | 'active' | 'review' | 'completed'
  startDate: string | null
  endDate: string | null
  velocity: number | null
  retrospective: string | null
  createdAt: string
  updatedAt: string
}

type KanbanColumn = 'todo' | 'in_progress' | 'review' | 'done'

export function DevProcessSkill({ projectId }: SkillProps) {
  const { toast } = useToast()
  const t = useT()
  const [tasks, setTasks] = useState<Task[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(false)
  const [framework, setFramework] = useState('agile')
  const [view, setView] = useState<'kanban' | 'wbs' | 'risks'>('kanban')

  // Create task form
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskColumn, setNewTaskColumn] = useState<KanbanColumn>('todo')

  // Create sprint form
  const [showAddSprint, setShowAddSprint] = useState(false)
  const [newSprintName, setNewSprintName] = useState('')
  const [newSprintGoal, setNewSprintGoal] = useState('')

  const FRAMEWORKS = [
    { id: 'dsr', name: t('devProcess.framework.dsr'), fullName: t('devProcess.framework.dsrFull'), steps: [t('devProcess.step.problemId'), t('devProcess.step.objectives'), t('devProcess.step.design'), t('devProcess.step.demo'), t('devProcess.step.evaluation'), t('devProcess.step.communication')] },
    { id: 'agile', name: t('devProcess.framework.agile'), fullName: t('devProcess.framework.agileFull'), steps: [t('devProcess.step.sprintPlanning'), t('devProcess.step.dailyProgress'), t('devProcess.step.sprintReview'), t('devProcess.step.retrospective')] },
    { id: 'stage-gate', name: t('devProcess.framework.stageGate'), fullName: t('devProcess.framework.stageGateFull'), steps: [t('devProcess.step.discovery'), t('devProcess.step.scoping'), t('devProcess.step.businessCase'), t('devProcess.step.development'), t('devProcess.step.testing'), t('devProcess.step.launch')] },
    { id: 'pdca', name: t('devProcess.framework.pdca'), fullName: t('devProcess.framework.pdcaFull'), steps: [t('devProcess.step.plan'), t('devProcess.step.do'), t('devProcess.step.check'), t('devProcess.step.act')] }
  ] as const

  const KANBAN_COLUMNS: { id: KanbanColumn; label: string; color: string }[] = [
    { id: 'todo', label: t('devProcess.kanban.todo'), color: 'bg-gray-500' },
    { id: 'in_progress', label: t('devProcess.kanban.inProgress'), color: 'bg-blue-500' },
    { id: 'review', label: t('devProcess.kanban.review'), color: 'bg-yellow-500' },
    { id: 'done', label: t('devProcess.kanban.done'), color: 'bg-green-500' }
  ]

  const currentFramework = FRAMEWORKS.find(f => f.id === framework)!

  const loadData = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [taskList, sprintList] = await Promise.all([
        ipcInvoke('task:list', { projectId }),
        ipcInvoke('sprint:list', { projectId })
      ])
      setTasks(taskList as Task[])
      setSprints(sprintList as Sprint[])
    } catch {
      toast('error', t('devProcess.toast.loadError'))
    } finally {
      setLoading(false)
    }
  }, [projectId, toast, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAddTask = async (column: KanbanColumn) => {
    if (!projectId || !newTaskTitle.trim()) return
    try {
      await ipcInvoke('task:create', {
        projectId,
        title: newTaskTitle.trim(),
        status: column
      } as never)
      setNewTaskTitle('')
      setShowAddTask(false)
      toast('success', t('devProcess.toast.addTaskSuccess'))
      loadData()
    } catch {
      toast('error', t('devProcess.toast.addTaskError'))
    }
  }

  const handleUpdateTaskStatus = async (taskId: string, status: KanbanColumn) => {
    try {
      await ipcInvoke('task:update', { id: taskId, status })
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)))
      toast('success', t('devProcess.toast.statusUpdateSuccess'))
    } catch {
      toast('error', t('devProcess.toast.statusUpdateError'))
    }
  }

  const handleAddSprint = async () => {
    if (!projectId || !newSprintName.trim()) return
    try {
      await ipcInvoke('sprint:create', {
        projectId,
        name: newSprintName.trim(),
        goal: newSprintGoal.trim() || undefined
      })
      setNewSprintName('')
      setNewSprintGoal('')
      setShowAddSprint(false)
      toast('success', t('devProcess.toast.sprintCreateSuccess'))
      loadData()
    } catch {
      toast('error', t('devProcess.toast.sprintCreateError'))
    }
  }

  // ---- AI action handlers ----
  const handleAiPlan = () => {
    const { sendMessage } = useChatStore.getState()
    useUiStore.getState().setChatPanelOpen(true)
    const taskSummary = tasks.map(tk => `- [${tk.status}] ${tk.title} (${tk.priority})`).join('\n')
    const sprintInfo = activeSprint ? `Active sprint: ${activeSprint.name}${activeSprint.goal ? ', Goal: ' + activeSprint.goal : ''}` : 'No active sprint'
    sendMessage(
      `Create a sprint plan based on the current project state.\n\n${sprintInfo}\n\nCurrent tasks:\n${taskSummary}\n\nPlease suggest: 1) Sprint goal, 2) Task prioritization, 3) Estimated timeline, 4) Resource allocation recommendations.`,
      'You are an agile project management assistant. Analyze the current tasks and sprint state to create an actionable sprint plan. Be specific and practical.'
    )
  }

  const handleAiGenerateWbs = () => {
    const { sendMessage } = useChatStore.getState()
    useUiStore.getState().setChatPanelOpen(true)
    const taskList = tasks.map(tk => `- ${tk.title} (${tk.status}, ${tk.priority})`).join('\n')
    sendMessage(
      `Generate a Work Breakdown Structure (WBS) for this project.\n\nExisting tasks:\n${taskList}\n\nPlease create a hierarchical WBS with: 1) Major deliverables, 2) Work packages, 3) Individual tasks with estimated effort, 4) Dependencies between tasks.`,
      'You are a project management assistant specializing in work breakdown structures. Create a comprehensive WBS that covers all aspects of the project. Use the existing tasks as a starting point and identify gaps.'
    )
  }

  const handleAiRiskAssessment = () => {
    const { sendMessage } = useChatStore.getState()
    useUiStore.getState().setChatPanelOpen(true)
    const taskList = tasks.map(tk => `- ${tk.title} (status: ${tk.status}, priority: ${tk.priority}${tk.dueDate ? ', due: ' + tk.dueDate : ''})`).join('\n')
    const blockedTasks = tasks.filter(tk => tk.status === 'blocked' || tk.priority === 'critical')
    const blockedInfo = blockedTasks.length > 0 ? `\n\nBlocked/Critical tasks:\n${blockedTasks.map(tk => `- ${tk.title}: ${tk.description || 'no description'}`).join('\n')}` : ''
    sendMessage(
      `Perform a risk assessment for this project.\n\nAll tasks:\n${taskList}${blockedInfo}\n\nPlease provide: 1) Risk identification (what could go wrong), 2) Risk probability and impact matrix, 3) Mitigation strategies for each risk, 4) Contingency plans for high-priority risks.`,
      'You are a risk management consultant. Analyze the project tasks, identify potential risks, and provide actionable mitigation strategies. Focus on practical, implementable recommendations.'
    )
  }

  if (!projectId) {
    return <EmptyState icon={GitBranch} title={t('common.selectProject')} description={t('common.selectProjectDesc')} />
  }

  if (loading) {
    return <LoadingState message={t('devProcess.loading.processData')} />
  }

  // Group tasks by status for kanban
  const kanban: Record<KanbanColumn, Task[]> = {
    todo: tasks.filter((t) => t.status === 'todo'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    review: tasks.filter((t) => t.status === 'review'),
    done: tasks.filter((t) => t.status === 'done')
  }

  const activeSprint = sprints.find((s) => s.status === 'active')
  const totalPoints = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
  const donePoints = tasks.filter((t) => t.status === 'done').reduce((sum, t) => sum + (t.estimatedHours || 0), 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">{t('devProcess.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Framework selector */}
          <div className="flex items-center bg-secondary rounded-md">
            {FRAMEWORKS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFramework(f.id)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-md transition-colors',
                  framework === f.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f.name}
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-border" />
          {/* View toggle */}
          <div className="flex items-center bg-secondary rounded-md">
            <button onClick={() => setView('kanban')} className={cn('px-3 py-1.5 text-xs rounded-md', view === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setView('wbs')} className={cn('px-3 py-1.5 text-xs rounded-md', view === 'wbs' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              <GitBranch className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setView('risks')} className={cn('px-3 py-1.5 text-xs rounded-md', view === 'risks' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              <Shield className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={handleAiPlan} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm hover:bg-primary/20">
            <Sparkles className="w-3.5 h-3.5" />
            {t('devProcess.button.aiPlan')}
          </button>
        </div>
      </div>

      {/* Sprint info bar */}
      <div className="flex items-center gap-6 px-4 py-2 border-b border-border bg-muted/30 text-sm">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium">{activeSprint?.name ?? t('devProcess.text.noActiveSprint')}</span>
        </div>
        {activeSprint && (
          <>
            {activeSprint.startDate && activeSprint.endDate && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>{activeSprint.startDate.slice(0, 10)} - {activeSprint.endDate.slice(0, 10)}</span>
              </div>
            )}
            {activeSprint.goal && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Target className="w-3.5 h-3.5" />
                <span>{t('devProcess.text.goal')} {activeSprint.goal}</span>
              </div>
            )}
          </>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-muted-foreground">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>{donePoints}/{totalPoints} {t('devProcess.text.hours')}</span>
        </div>
        <button
          onClick={() => setShowAddSprint(true)}
          className="text-xs text-primary hover:text-primary/80"
        >
          {t('devProcess.button.addSprint')}
        </button>
      </div>

      {/* Sprint create form */}
      {showAddSprint && (
        <div className="px-4 py-2 border-b border-border bg-card flex items-center gap-2">
          <input
            value={newSprintName}
            onChange={(e) => setNewSprintName(e.target.value)}
            placeholder={t('devProcess.placeholder.sprintName')}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-sm"
          />
          <input
            value={newSprintGoal}
            onChange={(e) => setNewSprintGoal(e.target.value)}
            placeholder={t('devProcess.placeholder.goal')}
            className="flex-1 px-3 py-1.5 rounded-md border border-input bg-background text-sm"
          />
          <button onClick={handleAddSprint} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm">{t('devProcess.button.create')}</button>
          <button onClick={() => setShowAddSprint(false)} className="px-3 py-1.5 rounded-md bg-secondary text-sm">{t('devProcess.button.cancel')}</button>
        </div>
      )}

      {/* Framework steps */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border overflow-x-auto">
        {currentFramework.steps.map((step, idx) => (
          <div key={step} className="flex items-center">
            <div className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs whitespace-nowrap',
              idx <= 1 ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
            )}>
              {idx <= 1 ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              {step}
            </div>
            {idx < currentFramework.steps.length - 1 && <ArrowRight className="w-3.5 h-3.5 mx-1 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        {view === 'kanban' && (
          <div className="flex gap-4 h-full min-w-max">
            {KANBAN_COLUMNS.map((col) => (
              <div key={col.id} className="flex flex-col w-72 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', col.color)} />
                    <h3 className="text-sm font-medium">{col.label}</h3>
                    <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                      {kanban[col.id].length}
                    </span>
                  </div>
                  <button
                    onClick={() => { setNewTaskColumn(col.id); setShowAddTask(true) }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto">
                  {kanban[col.id].map((task) => (
                    <div key={task.id} className="p-3 rounded-lg border border-border bg-card hover:border-primary/30 cursor-pointer transition-colors group">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-medium leading-tight">{task.title}</p>
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                      {task.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            task.priority === 'high' || task.priority === 'critical' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                          )} />
                          <span className="text-[10px] text-muted-foreground">{task.priority}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {task.estimatedHours != null && (
                            <span className="text-[10px] text-muted-foreground">{task.estimatedHours}h</span>
                          )}
                          {task.assignee && (
                            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-medium">
                              {task.assignee.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Move to buttons */}
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[9px] text-muted-foreground mr-1">{t('devProcess.text.moveTo')}</span>
                        {KANBAN_COLUMNS.filter(c => c.id !== col.id).map((targetCol) => (
                          <button
                            key={targetCol.id}
                            onClick={(e) => { e.stopPropagation(); handleUpdateTaskStatus(task.id, targetCol.id) }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-secondary hover:bg-accent transition-colors"
                          >
                            <div className={cn('w-1.5 h-1.5 rounded-full', targetCol.color)} />
                            {targetCol.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'wbs' && (
          <div className="max-w-2xl">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              {t('devProcess.section.wbs')}
            </h2>
            {tasks.length > 0 ? (
              <div className="space-y-1">
                {tasks.map((task, idx) => {
                  const depth = task.parentTaskId ? 1 : 0
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        'flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent/50 cursor-pointer',
                        depth === 0 ? 'font-medium' : 'text-muted-foreground'
                      )}
                      style={{ paddingLeft: `${depth * 24 + 8}px` }}
                    >
                      {depth === 0 ? <ChevronDown className="w-3.5 h-3.5" /> : <Circle className="w-2 h-2" />}
                      <span className="text-sm">{task.title}</span>
                      <span className={cn(
                        'ml-auto text-[10px] px-1.5 py-0.5 rounded-full',
                        task.status === 'done' ? 'bg-green-500/20 text-green-400' :
                        task.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      )}>
                        {task.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('devProcess.empty.noTasks')}</p>
            )}

            <div className="mt-6">
              <button onClick={handleAiGenerateWbs} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary/10 text-primary text-sm hover:bg-primary/20">
                <Sparkles className="w-4 h-4" />
                {t('devProcess.button.aiGenerateWbs')}
              </button>
            </div>
          </div>
        )}

        {view === 'risks' && (
          <div className="max-w-3xl">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {t('devProcess.section.riskMatrix')}
            </h2>
            {/* Show blocked tasks as risks */}
            {tasks.filter((t) => t.status === 'blocked' || t.priority === 'critical').length > 0 ? (
              <div className="space-y-3">
                {tasks
                  .filter((t) => t.status === 'blocked' || t.priority === 'critical')
                  .map((task) => (
                    <div key={task.id} className="p-4 rounded-lg border border-border">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                          <AlertTriangle className={cn(
                            'w-4 h-4',
                            task.priority === 'critical' ? 'text-red-500' : 'text-yellow-500'
                          )} />
                          {task.title}
                        </h3>
                        <div className="flex gap-2">
                          <span className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full',
                            task.priority === 'critical' ? 'bg-red-500/20 text-red-400' : task.priority === 'high' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
                          )}>
                            {task.priority}
                          </span>
                          <span className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full',
                            task.status === 'blocked' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                          )}>
                            {task.status}
                          </span>
                        </div>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('devProcess.empty.noRisks')}</p>
            )}

            <div className="mt-4">
              <button onClick={handleAiRiskAssessment} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary/10 text-primary text-sm hover:bg-primary/20">
                <Sparkles className="w-4 h-4" />
                {t('devProcess.button.aiRiskAssessment')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add task form */}
      {showAddTask && (
        <div className="border-t border-border p-4 bg-card">
          <div className="flex items-center gap-3">
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={t('devProcess.placeholder.taskTitle')}
              className="flex-1 px-3 py-1.5 rounded-md border border-input bg-background text-sm"
            />
            <button onClick={() => handleAddTask(newTaskColumn)} className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm">
              Add to {KANBAN_COLUMNS.find((c) => c.id === newTaskColumn)?.label}
            </button>
            <button onClick={() => setShowAddTask(false)} className="px-4 py-1.5 rounded-md bg-secondary text-sm">{t('devProcess.button.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
