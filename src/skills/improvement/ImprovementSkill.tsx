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
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Circle,
  ClipboardCheck,
  RefreshCw,
  Play,
  Eye,
  Zap,
  ChevronRight,
  ArrowRight,
  Target,
  Shield,
  TrendingUp,
  Users,
  BarChart3,
  MessageSquare,
  ThumbsUp,
  AlertCircle,
  Flag,
  ListChecks,
  Plus,
  Trash2
} from 'lucide-react'

interface ImprovementCycle {
  id: string
  projectId: string
  title: string
  cycleType: 'pdca' | 'kaizen' | 'retrospective'
  plan: string | null
  doActions: string | null
  checkResults: string | null
  actImprovements: string | null
  status: 'plan' | 'do' | 'check' | 'act' | 'completed'
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

const PDCA_PHASES = ['plan', 'do', 'check', 'act'] as const
type PDCAPhase = typeof PDCA_PHASES[number]

const FIELD_MAP: Record<PDCAPhase, keyof ImprovementCycle> = {
  plan: 'plan',
  do: 'doActions',
  check: 'checkResults',
  act: 'actImprovements'
}

export function ImprovementSkill({ projectId }: SkillProps) {
  const { toast } = useToast()
  const t = useT()
  const [cycles, setCycles] = useState<ImprovementCycle[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [activePDCA, setActivePDCA] = useState<PDCAPhase>('plan')

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCycleType, setNewCycleType] = useState<ImprovementCycle['cycleType']>('pdca')

  // Edit
  const [editField, setEditField] = useState('')

  const PDCA_LABELS: Record<PDCAPhase, { label: string; description: string; color: string }> = {
    plan: { label: t('improvement.pdca.plan'), description: t('improvement.pdca.planDesc'), color: 'text-blue-500' },
    do: { label: t('improvement.pdca.do'), description: t('improvement.pdca.doDesc'), color: 'text-amber-500' },
    check: { label: t('improvement.pdca.check'), description: t('improvement.pdca.checkDesc'), color: 'text-emerald-500' },
    act: { label: t('improvement.pdca.act'), description: t('improvement.pdca.actDesc'), color: 'text-violet-500' }
  }

  const loadCycles = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await ipcInvoke('improvement:list', { projectId })
      setCycles(data as ImprovementCycle[])
      if ((data as ImprovementCycle[]).length > 0 && !selectedCycleId) {
        setSelectedCycleId((data as ImprovementCycle[])[0].id)
      }
    } catch {
      toast('error', t('improvement.toast.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [projectId, toast, selectedCycleId, t])

  useEffect(() => {
    loadCycles()
  }, [loadCycles])

  const handleCreate = async () => {
    if (!projectId || !newTitle.trim()) return
    try {
      const created = await ipcInvoke('improvement:create', {
        projectId,
        title: newTitle.trim(),
        cycleType: newCycleType
      })
      setCycles((prev) => [...prev, created as ImprovementCycle])
      setSelectedCycleId((created as ImprovementCycle).id)
      setNewTitle('')
      setShowCreate(false)
      toast('success', t('improvement.toast.createSuccess'))
    } catch {
      toast('error', t('improvement.toast.createFailed'))
    }
  }

  const handleUpdatePhase = async (phase: PDCAPhase, content: string) => {
    if (!selectedCycleId) return
    try {
      const field = FIELD_MAP[phase]
      const updated = await ipcInvoke('improvement:update', {
        id: selectedCycleId,
        [field]: content
      })
      setCycles((prev) => prev.map((c) => (c.id === selectedCycleId ? (updated as ImprovementCycle) : c)))
      toast('success', t('improvement.toast.saveSuccess'))
    } catch {
      toast('error', t('improvement.toast.saveFailed'))
    }
  }

  const handleUpdateStatus = async (status: ImprovementCycle['status']) => {
    if (!selectedCycleId) return
    try {
      const updated = await ipcInvoke('improvement:update', {
        id: selectedCycleId,
        status
      })
      setCycles((prev) => prev.map((c) => (c.id === selectedCycleId ? (updated as ImprovementCycle) : c)))
      toast('success', t('improvement.toast.statusUpdateSuccess'))
    } catch {
      toast('error', t('improvement.toast.statusUpdateFailed'))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await ipcInvoke('improvement:delete', id)
      setCycles((prev) => prev.filter((c) => c.id !== id))
      if (selectedCycleId === id) {
        setSelectedCycleId(cycles.find((c) => c.id !== id)?.id ?? null)
      }
      toast('success', t('improvement.toast.deleteSuccess'))
    } catch {
      toast('error', t('improvement.toast.deleteFailed'))
    }
  }

  const handleAiSuggest = async () => {
    if (!selectedCycle) return
    const phaseContent = (selectedCycle[FIELD_MAP[activePDCA]] as string | null) || ''
    const prompt = `You are an improvement methodology advisor. The user is working on a ${selectedCycle.cycleType.toUpperCase()} improvement cycle titled "${selectedCycle.title}".

Current phase: ${PDCA_LABELS[activePDCA].label} (${PDCA_LABELS[activePDCA].description})
Current content for this phase:
${phaseContent || '(empty)'}

Please suggest improvements and additions for this phase. Provide actionable, specific suggestions.`

    const { sendMessage } = useChatStore.getState()
    useUiStore.getState().setChatPanelOpen(true)
    await sendMessage(prompt, 'You are a research process improvement advisor specializing in PDCA, Kaizen, and retrospective methodologies.', [])
  }

  const handleAiPeerReview = async () => {
    if (!selectedCycle) return
    const allContent = PDCA_PHASES.map(p => {
      const content = (selectedCycle[FIELD_MAP[p]] as string | null) || '(empty)'
      return `${PDCA_LABELS[p].label}: ${content}`
    }).join('\n\n')

    const prompt = `You are simulating a peer review for a ${selectedCycle.cycleType.toUpperCase()} improvement cycle titled "${selectedCycle.title}".

Here is the full cycle content:
${allContent}

Please provide a constructive peer review: identify strengths, weaknesses, gaps in logic, missing metrics, and suggestions for the next iteration.`

    const { sendMessage } = useChatStore.getState()
    useUiStore.getState().setChatPanelOpen(true)
    await sendMessage(prompt, 'You are a senior researcher conducting a constructive peer review of an improvement cycle.', [])
  }

  if (!projectId) {
    return <EmptyState icon={RefreshCw} title={t('improvement.empty.selectProject')} description={t('improvement.empty.selectProjectDesc')} />
  }

  if (loading) {
    return <LoadingState message={t('improvement.loading.cycles')} />
  }

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t('improvement.title')}</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('improvement.button.newCycle')}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-6 py-3 border-b border-border bg-card space-y-2">
          <div className="flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('improvement.placeholder.cycleTitle')}
              className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background outline-none focus:border-blue-500"
            />
            <select
              value={newCycleType}
              onChange={(e) => setNewCycleType(e.target.value as ImprovementCycle['cycleType'])}
              className="px-3 py-1.5 text-sm rounded-md border border-border bg-background"
            >
              <option value="pdca">{t('improvement.cycleType.pdca')}</option>
              <option value="kaizen">{t('improvement.cycleType.kaizen')}</option>
              <option value="retrospective">{t('improvement.cycleType.retrospective')}</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground">{t('improvement.button.create')}</button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs rounded-md bg-secondary">{t('improvement.button.cancel')}</button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Cycle list sidebar */}
        <div className="w-64 border-r border-border overflow-y-auto p-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            {t('improvement.label.cycles')} ({cycles.length})
          </p>
          <div className="space-y-1">
            {cycles.length === 0 ? (
              <div className="px-2 py-2 text-muted-foreground">
                <p className="text-xs font-medium">{t('improvement.empty.noCycles')}</p>
                <p className="text-[11px] mt-1">{t('improvement.empty.noCyclesDescription')}</p>
              </div>
            ) : (
              cycles.map((cycle) => (
                <div key={cycle.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedCycleId(cycle.id)}
                    className={cn(
                      'flex-1 text-left p-2.5 rounded-lg transition-colors',
                      cycle.id === selectedCycleId ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                  >
                    <p className="text-sm font-medium truncate">{cycle.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px]">
                      <span className="text-muted-foreground capitalize">{cycle.cycleType}</span>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded-full font-medium',
                        cycle.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
                      )}>
                        {cycle.status}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDelete(cycle.id)}
                    className="p-1 rounded hover:bg-accent text-destructive shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedCycle ? (
            <div className="space-y-4">
              {/* Title and status */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{selectedCycle.title}</h2>
                <div className="flex items-center gap-1">
                  {([...PDCA_PHASES, 'completed'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleUpdateStatus(s as ImprovementCycle['status'])}
                      className={cn(
                        'px-2 py-1 text-[10px] rounded-md transition-colors capitalize',
                        selectedCycle.status === s
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* PDCA phase buttons */}
              <div className="flex items-center gap-2">
                {PDCA_PHASES.map((phase) => {
                  const data = PDCA_LABELS[phase]
                  const content = selectedCycle[FIELD_MAP[phase]] as string | null
                  const hasContent = !!content && content.trim().length > 0
                  const isActive = activePDCA === phase
                  return (
                    <button
                      key={phase}
                      onClick={() => setActivePDCA(phase)}
                      className={cn(
                        'flex-1 p-3 rounded-lg border text-center transition-colors',
                        isActive ? 'border-blue-500 bg-blue-500/5' : 'border-border hover:bg-accent/50'
                      )}
                    >
                      <div className={cn('text-lg font-bold', data.color)}>{data.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {hasContent ? t('improvement.label.hasContent') : t('improvement.label.empty')}
                      </div>
                      <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', isActive ? 'bg-blue-500' : 'bg-muted-foreground/30')}
                          style={{ width: hasContent ? '100%' : '0%' }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* AI action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAiSuggest}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {t('improvement.button.aiSuggest')}
                </button>
                <button
                  onClick={handleAiPeerReview}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-secondary hover:bg-accent transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  {t('improvement.button.aiPeerReview')}
                </button>
              </div>

              {/* Phase content */}
              <div className="p-5 rounded-xl border border-border bg-card">
                <p className="text-sm text-muted-foreground mb-4">{PDCA_LABELS[activePDCA].description}</p>
                <textarea
                  value={(selectedCycle[FIELD_MAP[activePDCA]] as string | null) || ''}
                  onChange={(e) => {
                    const field = FIELD_MAP[activePDCA]
                    setCycles((prev) => prev.map((c) =>
                      c.id === selectedCycleId ? { ...c, [field]: e.target.value } : c
                    ))
                  }}
                  onBlur={(e) => handleUpdatePhase(activePDCA, e.target.value)}
                  placeholder={`${t('improvement.placeholder.phaseContent')} (${PDCA_LABELS[activePDCA].label})`}
                  className="w-full min-h-[200px] px-3 py-2 text-sm rounded-lg border border-border bg-background resize-y outline-none focus:border-blue-500"
                />
              </div>

              {/* Dates */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {selectedCycle.startedAt && (
                  <span>{t('improvement.label.started')}: {new Date(selectedCycle.startedAt).toLocaleDateString()}</span>
                )}
                {selectedCycle.completedAt && (
                  <span>{t('improvement.label.completed')}: {new Date(selectedCycle.completedAt).toLocaleDateString()}</span>
                )}
                <span>{t('improvement.label.created')}: {new Date(selectedCycle.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={RefreshCw}
              title={t('improvement.empty.selectCycle')}
              description={t('improvement.empty.selectCycleDesc')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
