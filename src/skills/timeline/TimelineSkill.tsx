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
  Calendar,
  Plus,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Flag,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  ArrowRight,
  Milestone,
  Download,
  LayoutTemplate,
  ZoomIn,
  ZoomOut
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

interface GanttTask {
  id: string
  title: string
  startDate: string
  endDate: string
  progress: number
  status: string
  dependencies: string[]
  color: string
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#9ca3af',
  in_progress: '#3b82f6',
  review: '#f59e0b',
  done: '#10b981',
  blocked: '#ef4444'
}

const PHASE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#f97316']

export function TimelineSkill({ projectId }: SkillProps) {
  const { toast } = useToast()
  const t = useT()
  const [tasks, setTasks] = useState<Task[]>([])
  const [ganttData, setGanttData] = useState<GanttTask[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<string>('Month')
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskStart, setNewTaskStart] = useState('')
  const [newTaskEnd, setNewTaskEnd] = useState('')

  const VIEW_MODES = [
    { key: 'Day', label: t('timeline.viewMode.day') },
    { key: 'Week', label: t('timeline.viewMode.week') },
    { key: 'Month', label: t('timeline.viewMode.month') },
    { key: 'Quarter', label: t('timeline.viewMode.quarter') }
  ] as const

  const loadTasks = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [taskList, gantt] = await Promise.all([
        ipcInvoke('task:list', { projectId }),
        ipcInvoke('task:gantt-data', projectId)
      ])
      setTasks(taskList as Task[])
      setGanttData(gantt as unknown as GanttTask[])
    } catch {
      toast('error', t('timeline.toast.loadError'))
    } finally {
      setLoading(false)
    }
  }, [projectId, toast, t])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleAiSchedule = async () => {
    if (!projectId) return
    const taskSummary = tasks.map(t => `- ${t.title} (status: ${t.status}, priority: ${t.priority}${t.startDate ? `, start: ${t.startDate.slice(0,10)}` : ''}${t.endDate ? `, end: ${t.endDate.slice(0,10)}` : ''}${t.estimatedHours ? `, est: ${t.estimatedHours}h` : ''})`).join('\n')

    const prompt = taskSummary
      ? `You are a project scheduling assistant. Here are the current tasks:\n${taskSummary}\n\nPlease suggest an optimized schedule. Consider dependencies, priorities, and workload balance. Provide specific date recommendations for tasks without dates.`
      : `You are a project scheduling assistant. There are no tasks yet. Please suggest a research project timeline with recommended phases and milestones for a 6-month research project.`

    const { sendMessage } = useChatStore.getState()
    useUiStore.getState().setChatPanelOpen(true)
    await sendMessage(prompt, 'You are a project management expert specializing in research project scheduling.', [])
  }

  const handleTemplate = async (templateName: string) => {
    if (!projectId) return
    const TEMPLATES: Record<string, Array<{ title: string; offsetWeeks: number; durationWeeks: number }>> = {
      'research-6m': [
        { title: 'Literature Review', offsetWeeks: 0, durationWeeks: 4 },
        { title: 'Research Design', offsetWeeks: 3, durationWeeks: 3 },
        { title: 'Data Collection', offsetWeeks: 6, durationWeeks: 8 },
        { title: 'Data Analysis', offsetWeeks: 12, durationWeeks: 4 },
        { title: 'Writing Draft', offsetWeeks: 16, durationWeeks: 4 },
        { title: 'Peer Review', offsetWeeks: 20, durationWeeks: 2 },
        { title: 'Final Revision', offsetWeeks: 22, durationWeeks: 2 },
        { title: 'Submission', offsetWeeks: 24, durationWeeks: 1 }
      ],
      'thesis': [
        { title: 'Topic Selection & Proposal', offsetWeeks: 0, durationWeeks: 4 },
        { title: 'Literature Review', offsetWeeks: 4, durationWeeks: 8 },
        { title: 'Methodology Design', offsetWeeks: 10, durationWeeks: 4 },
        { title: 'Experiment / Data Collection', offsetWeeks: 14, durationWeeks: 12 },
        { title: 'Analysis & Results', offsetWeeks: 24, durationWeeks: 6 },
        { title: 'Writing Chapters', offsetWeeks: 28, durationWeeks: 10 },
        { title: 'Advisor Review', offsetWeeks: 38, durationWeeks: 4 },
        { title: 'Defense Preparation', offsetWeeks: 42, durationWeeks: 2 }
      ],
      'sprint-2w': [
        { title: 'Sprint Planning', offsetWeeks: 0, durationWeeks: 0.1 },
        { title: 'Development Sprint', offsetWeeks: 0, durationWeeks: 2 },
        { title: 'Sprint Review', offsetWeeks: 2, durationWeeks: 0.1 },
        { title: 'Retrospective', offsetWeeks: 2, durationWeeks: 0.1 }
      ]
    }
    const template = TEMPLATES[templateName]
    if (!template) return

    try {
      const now = new Date()
      for (const item of template) {
        const start = new Date(now.getTime() + item.offsetWeeks * 7 * 86400000)
        const end = new Date(start.getTime() + item.durationWeeks * 7 * 86400000)
        await ipcInvoke('task:create', {
          projectId,
          title: item.title,
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10)
        } as never)
      }
      toast('success', t('timeline.toast.templateApplied'))
      loadTasks()
    } catch {
      toast('error', t('timeline.toast.templateError'))
    }
  }

  const [showTemplateMenu, setShowTemplateMenu] = useState(false)

  const handleAddTask = async () => {
    if (!projectId || !newTaskName.trim()) return
    try {
      await ipcInvoke('task:create', {
        projectId,
        title: newTaskName.trim(),
        startDate: newTaskStart || undefined,
        endDate: newTaskEnd || undefined
      } as never)
      setNewTaskName('')
      setNewTaskStart('')
      setNewTaskEnd('')
      setShowAddTask(false)
      toast('success', t('timeline.toast.addSuccess'))
      loadTasks()
    } catch {
      toast('error', t('timeline.toast.addError'))
    }
  }

  if (!projectId) {
    return <EmptyState icon={Calendar} title={t('common.selectProject')} description={t('common.selectProjectDesc')} />
  }

  if (loading) {
    return <LoadingState message={t('timeline.loading.timeline')} />
  }

  // Calculate Gantt layout based on viewMode
  const allDates = [...tasks.filter(t => t.startDate).map(t => new Date(t.startDate!)),
                    ...tasks.filter(t => t.endDate).map(t => new Date(t.endDate!)),
                    ...ganttData.filter(g => g.startDate).map(g => new Date(g.startDate)),
                    ...ganttData.filter(g => g.endDate).map(g => new Date(g.endDate))]

  const now = new Date()

  // Adjust date range based on viewMode
  const getDateRange = () => {
    const DAY = 86400000
    if (viewMode === 'Day') {
      const s = allDates.length > 0
        ? new Date(Math.min(...allDates.map(d => d.getTime()), now.getTime() - 3 * DAY))
        : new Date(now.getTime() - 3 * DAY)
      const e = allDates.length > 0
        ? new Date(Math.max(...allDates.map(d => d.getTime()), now.getTime() + 14 * DAY))
        : new Date(now.getTime() + 14 * DAY)
      return { start: s, end: e }
    }
    if (viewMode === 'Week') {
      const s = allDates.length > 0
        ? new Date(Math.min(...allDates.map(d => d.getTime()), now.getTime() - 7 * DAY))
        : new Date(now.getTime() - 7 * DAY)
      const e = allDates.length > 0
        ? new Date(Math.max(...allDates.map(d => d.getTime()), now.getTime() + 42 * DAY))
        : new Date(now.getTime() + 56 * DAY)
      return { start: s, end: e }
    }
    if (viewMode === 'Quarter') {
      const s = allDates.length > 0
        ? new Date(Math.min(...allDates.map(d => d.getTime()), now.getTime() - 30 * DAY))
        : new Date(now.getTime() - 90 * DAY)
      const e = allDates.length > 0
        ? new Date(Math.max(...allDates.map(d => d.getTime()), now.getTime() + 180 * DAY))
        : new Date(now.getTime() + 365 * DAY)
      return { start: s, end: e }
    }
    // Month (default)
    const s = allDates.length > 0
      ? new Date(Math.min(...allDates.map(d => d.getTime()), now.getTime() - 7 * DAY))
      : new Date(now.getTime() - 30 * DAY)
    const e = allDates.length > 0
      ? new Date(Math.max(...allDates.map(d => d.getTime()), now.getTime() + 30 * DAY))
      : new Date(now.getTime() + 90 * DAY)
    return { start: s, end: e }
  }

  const { start: startDate, end: endDate } = getDateRange()
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))

  const getBarStyle = (start: string, end: string) => {
    const taskStart = new Date(start)
    const taskEnd = new Date(end)
    const left = Math.max(0, Math.ceil((taskStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100)
    const width = Math.max(1, Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100)
    return { left: `${left}%`, width: `${width}%` }
  }

  // Generate time labels based on viewMode
  const timeLabels: string[] = []
  if (viewMode === 'Day') {
    const dayDate = new Date(startDate)
    while (dayDate <= endDate) {
      timeLabels.push(dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
      dayDate.setDate(dayDate.getDate() + 1)
    }
  } else if (viewMode === 'Week') {
    const weekDate = new Date(startDate)
    // Align to Monday
    const dayOfWeek = weekDate.getDay()
    weekDate.setDate(weekDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    while (weekDate <= endDate) {
      const weekEnd = new Date(weekDate)
      weekEnd.setDate(weekEnd.getDate() + 6)
      timeLabels.push(`${weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { day: 'numeric' })}`)
      weekDate.setDate(weekDate.getDate() + 7)
    }
  } else if (viewMode === 'Quarter') {
    const qDate = new Date(startDate)
    qDate.setDate(1)
    // Align to quarter start
    qDate.setMonth(Math.floor(qDate.getMonth() / 3) * 3)
    while (qDate <= endDate) {
      const q = Math.floor(qDate.getMonth() / 3) + 1
      timeLabels.push(`Q${q} ${qDate.getFullYear()}`)
      qDate.setMonth(qDate.getMonth() + 3)
    }
  } else {
    // Month (default)
    const monthDate = new Date(startDate)
    monthDate.setDate(1)
    while (monthDate <= endDate) {
      timeLabels.push(monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }))
      monthDate.setMonth(monthDate.getMonth() + 1)
    }
  }

  // Use ganttData if available, otherwise derive from tasks
  const displayTasks = ganttData.length > 0 ? ganttData : tasks
    .filter(t => t.startDate && t.endDate)
    .map((t, i) => ({
      id: t.id,
      title: t.title,
      startDate: t.startDate!,
      endDate: t.endDate!,
      progress: t.status === 'done' ? 100 : t.status === 'in_progress' ? 50 : 0,
      status: t.status,
      dependencies: [],
      color: PHASE_COLORS[i % PHASE_COLORS.length]
    }))

  const getStatusLabel = (status: string) => {
    if (status === 'in_progress') return t('timeline.status.active')
    if (status === 'done') return t('timeline.status.done')
    if (status === 'blocked') return t('timeline.status.blocked')
    return t('timeline.status.pending')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">{t('timeline.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode */}
          <div className="flex items-center bg-secondary rounded-md">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.key}
                onClick={() => setViewMode(mode.key)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-md transition-colors',
                  viewMode === mode.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowTemplateMenu(!showTemplateMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-sm"
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              {t('timeline.button.template')}
            </button>
            {showTemplateMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-border bg-card shadow-lg z-20 py-1">
                <button onClick={() => { handleTemplate('research-6m'); setShowTemplateMenu(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent">
                  6-Month Research Plan
                </button>
                <button onClick={() => { handleTemplate('thesis'); setShowTemplateMenu(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent">
                  Thesis / Dissertation
                </button>
                <button onClick={() => { handleTemplate('sprint-2w'); setShowTemplateMenu(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent">
                  2-Week Sprint
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleAiSchedule}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm hover:bg-primary/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t('timeline.button.aiSchedule')}
          </button>
          <button
            onClick={() => setShowAddTask(!showAddTask)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('timeline.button.addTask')}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Task list sidebar */}
        <div className="w-72 border-r border-border overflow-y-auto">
          <div className="p-2 border-b border-border">
            <div className="grid grid-cols-[1fr_60px_60px] text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1">
              <span>{t('timeline.table.task')}</span>
              <span>{t('timeline.table.progress')}</span>
              <span>{t('timeline.table.status')}</span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {displayTasks.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <p className="font-medium">{t('timeline.empty.noTasks')}</p>
                <p className="text-xs mt-1 max-w-xs mx-auto">{t('timeline.empty.noTasksDescription')}</p>
              </div>
            ) : (
              displayTasks.map((task) => {
                const progress = 'progress' in task ? task.progress : 0
                const status = task.status
                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task.id)}
                    className={cn(
                      'grid grid-cols-[1fr_60px_60px] items-center w-full px-3 py-2.5 text-left transition-colors',
                      selectedTask === task.id ? 'bg-primary/10' : 'hover:bg-accent/50'
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      {'startDate' in task && task.startDate && (
                        <p className="text-[10px] text-muted-foreground">
                          {task.startDate.slice(0, 10)} → {'endDate' in task && task.endDate ? task.endDate.slice(5, 10) : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-8 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{progress}%</span>
                    </div>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full text-center',
                      status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                      status === 'done' ? 'bg-green-500/20 text-green-400' :
                      status === 'blocked' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    )}>
                      {getStatusLabel(status)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Gantt chart area */}
        <div className="flex-1 overflow-auto">
          {/* Month headers */}
          <div className="flex border-b border-border sticky top-0 bg-background z-10">
            {timeLabels.map((label) => (
              <div key={label} className="flex-1 px-3 py-2 text-xs font-medium text-muted-foreground text-center border-r border-border last:border-r-0 whitespace-nowrap">
                {label}
              </div>
            ))}
          </div>

          {/* Gantt bars */}
          <div className="relative min-h-[400px]">
            {/* Grid lines */}
            <div className="absolute inset-0 flex">
              {timeLabels.map((_, i) => (
                <div key={i} className="flex-1 border-r border-border/30 last:border-r-0" />
              ))}
            </div>

            {/* Today line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
              style={{ left: `${Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100)}%` }}
            >
              <div className="absolute -top-0 -left-2 text-[9px] bg-red-500 text-white px-1 rounded">{t('timeline.text.today')}</div>
            </div>

            {/* Task bars */}
            {displayTasks.map((task, idx) => {
              const taskStart = 'startDate' in task ? task.startDate : null
              const taskEnd = 'endDate' in task ? task.endDate : null
              if (!taskStart || !taskEnd) return null
              const style = getBarStyle(taskStart, taskEnd)
              const progress = 'progress' in task ? task.progress : 0
              const color = 'color' in task ? task.color : STATUS_COLORS[(task as Task).status] || '#3b82f6'
              return (
                <div key={task.id} className="relative h-10 flex items-center" style={{ marginTop: idx === 0 ? '8px' : '0' }}>
                  <div
                    className={cn(
                      'absolute h-7 rounded-md cursor-pointer transition-all hover:brightness-110',
                      selectedTask === task.id && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                    )}
                    style={{
                      left: style.left,
                      width: style.width,
                      backgroundColor: color + '30',
                      borderLeft: `3px solid ${color}`
                    }}
                    onClick={() => setSelectedTask(task.id)}
                  >
                    {/* Progress fill */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-l-md opacity-30"
                      style={{ width: `${progress}%`, backgroundColor: color }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-[11px] font-medium truncate">
                      {task.title}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Add task form */}
      {showAddTask && (
        <div className="border-t border-border p-4 bg-card">
          <div className="flex items-center gap-3">
            <input
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder={t('timeline.placeholder.taskName')}
              className="flex-1 px-3 py-1.5 rounded-md border border-input bg-background text-sm"
            />
            <input
              type="date"
              value={newTaskStart}
              onChange={(e) => setNewTaskStart(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-input bg-background text-sm"
            />
            <input
              type="date"
              value={newTaskEnd}
              onChange={(e) => setNewTaskEnd(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-input bg-background text-sm"
            />
            <button onClick={handleAddTask} className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm">{t('timeline.button.add')}</button>
            <button onClick={() => setShowAddTask(false)} className="px-4 py-1.5 rounded-md bg-secondary text-sm">{t('timeline.button.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
