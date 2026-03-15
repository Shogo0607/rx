import { useState, useCallback, useEffect } from 'react'
import type { SkillProps } from '../../types/skill'
import { cn } from '../../lib/utils'
import { ipcInvoke } from '../../lib/ipc-client'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toaster'
import { useT } from '../../i18n'
import {
  FlaskConical,
  Plus,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Link,
  ChevronRight,
  Calculator,
  ClipboardList,
  Beaker,
  Settings,
  BarChart3,
  Users,
  Shield,
  Variable,
  Layers,
  ArrowRight,
  Target,
  Trash2,
  XCircle
} from 'lucide-react'

type ExperimentStatus = 'planned' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

interface Experiment {
  id: string
  projectId: string
  hypothesisId: string | null
  title: string
  description: string | null
  methodology: string | null
  variables: Record<string, unknown> | null
  status: ExperimentStatus
  results: string | null
  conclusion: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export function ExperimentSkill({ projectId }: SkillProps) {
  const { toast } = useToast()
  const t = useT()

  const STATUS_STYLES: Record<ExperimentStatus, { label: string; color: string; bg: string; icon: typeof Clock }> = {
    planned: { label: t('experiment.status.planned'), color: 'text-muted-foreground', bg: 'bg-muted', icon: Clock },
    in_progress: { label: t('experiment.status.inProgress'), color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Play },
    completed: { label: t('experiment.status.completed'), color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
    failed: { label: t('experiment.status.failed'), color: 'text-red-500', bg: 'bg-red-500/10', icon: XCircle },
    cancelled: { label: t('experiment.status.cancelled'), color: 'text-orange-500', bg: 'bg-orange-500/10', icon: Pause }
  }
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'design' | 'protocol' | 'stats' | 'sample'>('design')
  const [calcEffectSize, setCalcEffectSize] = useState('0.5')
  const [calcAlpha, setCalcAlpha] = useState('0.05')
  const [calcPower, setCalcPower] = useState('0.8')

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')

  const loadExperiments = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await ipcInvoke('experiment:list', { projectId })
      setExperiments(data as Experiment[])
      if ((data as Experiment[]).length > 0 && !selectedId) {
        setSelectedId((data as Experiment[])[0].id)
      }
    } catch {
      toast('error', t('experiment.toast.loadError'))
    } finally {
      setLoading(false)
    }
  }, [projectId, toast, selectedId])

  useEffect(() => {
    loadExperiments()
  }, [loadExperiments])

  const handleCreate = async () => {
    if (!projectId || !newTitle.trim()) return
    try {
      const created = await ipcInvoke('experiment:create', {
        projectId,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined
      })
      setExperiments((prev) => [...prev, created as Experiment])
      setSelectedId((created as Experiment).id)
      setNewTitle('')
      setNewDescription('')
      setShowCreate(false)
      toast('success', t('experiment.toast.createSuccess'))
    } catch {
      toast('error', t('experiment.toast.createError'))
    }
  }

  const handleUpdateStatus = async (id: string, status: ExperimentStatus) => {
    try {
      const updated = await ipcInvoke('experiment:update', { id, status })
      setExperiments((prev) => prev.map((e) => (e.id === id ? (updated as Experiment) : e)))
      toast('success', t('experiment.toast.statusUpdateSuccess'))
    } catch {
      toast('error', t('experiment.toast.statusUpdateError'))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await ipcInvoke('experiment:delete', id)
      setExperiments((prev) => prev.filter((e) => e.id !== id))
      if (selectedId === id) {
        setSelectedId(experiments.find((e) => e.id !== id)?.id ?? null)
      }
      toast('success', t('experiment.toast.deleteSuccess'))
    } catch {
      toast('error', t('experiment.toast.deleteError'))
    }
  }

  if (!projectId) {
    return <EmptyState icon={FlaskConical} title={t('common.selectProject')} description={t('common.selectProjectDesc')} />
  }

  if (loading) {
    return <LoadingState message={t('experiment.loading.experiments')} />
  }

  const experiment = experiments.find((e) => e.id === selectedId)
  const st = experiment ? STATUS_STYLES[experiment.status] : null

  const sections = [
    { id: 'design', label: t('experiment.section.design'), icon: Layers },
    { id: 'protocol', label: t('experiment.section.protocol'), icon: ClipboardList },
    { id: 'stats', label: t('experiment.section.statsTest'), icon: BarChart3 },
    { id: 'sample', label: t('experiment.section.sampleSize'), icon: Calculator }
  ] as const

  // Parse variables from experiment
  const variables = experiment?.variables
    ? (Array.isArray(experiment.variables)
        ? experiment.variables
        : Object.entries(experiment.variables).map(([name, val]) => ({ name, ...(typeof val === 'object' ? val as Record<string, unknown> : { value: val }) })))
    : []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t('experiment.title')}</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('experiment.button.newExperiment')}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-6 py-3 border-b border-border bg-card space-y-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t('experiment.placeholder.title')}
            className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background outline-none focus:border-blue-500"
          />
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder={t('experiment.placeholder.description')}
            className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground">{t('experiment.button.create')}</button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs rounded-md bg-secondary">{t('experiment.button.cancel')}</button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Experiment List */}
        <div className="w-72 border-r border-border overflow-y-auto p-3 space-y-1">
          {experiments.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8 px-3">
              <p className="font-medium">{t('experiment.empty.noExperiments')}</p>
              <p className="text-xs mt-1">{t('experiment.empty.noExperimentsDescription')}</p>
            </div>
          ) : (
            experiments.map((exp) => {
              const s = STATUS_STYLES[exp.status]
              return (
                <button
                  key={exp.id}
                  onClick={() => setSelectedId(exp.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg transition-colors',
                    exp.id === selectedId ? 'bg-accent' : 'hover:bg-accent/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-medium line-clamp-2">{exp.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={cn('px-1.5 py-0.5 rounded-full font-medium', s.bg, s.color)}>
                      {s.label}
                    </span>
                    {exp.hypothesisId && (
                      <span className="text-muted-foreground flex items-center gap-0.5 ml-auto">
                        <Link className="w-3 h-3" /> {exp.hypothesisId}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Detail Panel */}
        <div className="flex-1 overflow-y-auto">
          {experiment && st ? (
            <>
              {/* Experiment Header */}
              <div className="px-6 py-4 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">{experiment.title}</h2>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      {experiment.methodology && (
                        <span className="flex items-center gap-1">
                          <Beaker className="w-3.5 h-3.5" /> {experiment.methodology}
                        </span>
                      )}
                      {experiment.hypothesisId && (
                        <span className="flex items-center gap-1">
                          <Link className="w-3.5 h-3.5" /> {experiment.hypothesisId}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'flex items-center gap-1 px-2.5 py-1 text-xs rounded-full font-medium',
                      st.bg, st.color
                    )}>
                      <st.icon className="w-3 h-3" />
                      {st.label}
                    </span>
                    <button
                      onClick={() => handleDelete(experiment.id)}
                      className="p-1.5 rounded-md hover:bg-accent text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Status actions */}
                <div className="flex items-center gap-1 mt-3">
                  {(['planned', 'in_progress', 'completed', 'failed', 'cancelled'] as ExperimentStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleUpdateStatus(experiment.id, s)}
                      className={cn(
                        'px-2 py-1 text-[10px] rounded-md transition-colors',
                        experiment.status === s
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {STATUS_STYLES[s].label}
                    </button>
                  ))}
                </div>

                {/* Section tabs */}
                <div className="flex items-center gap-1 mt-4">
                  {sections.map((sec) => (
                    <button
                      key={sec.id}
                      onClick={() => setActiveSection(sec.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                        activeSection === sec.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent'
                      )}
                    >
                      <sec.icon className="w-3.5 h-3.5" />
                      {sec.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 space-y-6">
                {activeSection === 'design' && (
                  <>
                    {/* Description */}
                    {experiment.description && (
                      <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          {t('experiment.section.description')}
                        </h3>
                        <p className="text-sm text-muted-foreground">{experiment.description}</p>
                      </div>
                    )}

                    {/* Variable Matrix */}
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Variable className="w-3.5 h-3.5" />
                        {t('experiment.section.variableMatrix')}
                      </h3>
                      {variables.length > 0 ? (
                        <div className="border border-border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">{t('experiment.table.variable')}</th>
                                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">{t('experiment.table.type')}</th>
                                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">{t('experiment.table.details')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {variables.map((v: Record<string, unknown>, i: number) => (
                                <tr key={i} className="border-t border-border">
                                  <td className="px-3 py-2 font-medium">{String(v.name ?? `Variable ${i + 1}`)}</td>
                                  <td className="px-3 py-2">
                                    <span className={cn(
                                      'px-1.5 py-0.5 text-[10px] rounded font-medium',
                                      v.type === 'IV' ? 'bg-blue-500/10 text-blue-500' :
                                      v.type === 'DV' ? 'bg-emerald-500/10 text-emerald-500' :
                                      'bg-amber-500/10 text-amber-500'
                                    )}>{String(v.type ?? 'N/A')}</span>
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {Array.isArray(v.levels) ? (v.levels as string[]).join(', ') : String(v.value ?? '')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t('experiment.empty.noVariables')}</p>
                      )}
                    </div>
                  </>
                )}

                {activeSection === 'protocol' && (
                  <>
                    {/* Methodology */}
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        {t('experiment.section.methodology')}
                      </h3>
                      <div className="p-4 rounded-xl border border-border">
                        <p className="text-sm">{experiment.methodology || t('experiment.empty.noMethodology')}</p>
                      </div>
                    </div>

                    {/* Results */}
                    {experiment.results && (
                      <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          {t('experiment.section.results')}
                        </h3>
                        <div className="p-4 rounded-xl border border-border">
                          <p className="text-sm">{experiment.results}</p>
                        </div>
                      </div>
                    )}

                    {/* Conclusion */}
                    {experiment.conclusion && (
                      <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          {t('experiment.section.conclusion')}
                        </h3>
                        <div className="p-4 rounded-xl border border-border">
                          <p className="text-sm">{experiment.conclusion}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {activeSection === 'stats' && (
                  <div className="p-5 rounded-xl border border-border bg-card">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5" />
                      {t('experiment.section.statisticalAnalysis')}
                    </h3>
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <Target className="w-6 h-6 text-blue-500" />
                      <div>
                        <p className="font-semibold">
                          {variables.length > 0 ? t('experiment.text.variablesConfigured') : t('experiment.text.noVariablesDefined')}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Based on {variables.length} variables
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-muted-foreground space-y-2">
                      <p className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Experiment status: {st.label}
                      </p>
                      {experiment.startedAt && (
                        <p className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Started: {new Date(experiment.startedAt).toLocaleDateString()}
                        </p>
                      )}
                      {experiment.completedAt && (
                        <p className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Completed: {new Date(experiment.completedAt).toLocaleDateString()}
                        </p>
                      )}
                      <p className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        {t('experiment.text.normalDistWarning')}
                      </p>
                    </div>
                  </div>
                )}

                {activeSection === 'sample' && (
                  <div className="max-w-lg">
                    <div className="p-5 rounded-xl border border-border bg-card">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5" />
                        {t('experiment.section.sampleSizeCalc')}
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">{t('experiment.label.effectSize')}</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="2.0"
                            value={calcEffectSize}
                            onChange={(e) => setCalcEffectSize(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-blue-500"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">{t('experiment.text.effectSizeGuide')}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">{t('experiment.label.significanceLevel')}</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max="0.1"
                            value={calcAlpha}
                            onChange={(e) => setCalcAlpha(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">{t('experiment.label.statisticalPower')}</label>
                          <input
                            type="number"
                            step="0.05"
                            min="0.5"
                            max="0.99"
                            value={calcPower}
                            onChange={(e) => setCalcPower(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-blue-500"
                          />
                        </div>
                        <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                          <Calculator className="w-4 h-4" />
                          {t('experiment.button.calculate')}
                        </button>
                      </div>

                      {/* Result */}
                      <div className="mt-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                        <div className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-emerald-500" />
                          <div>
                            <p className="text-sm text-muted-foreground">{t('experiment.text.requiredSampleSize')}</p>
                            <p className="text-2xl font-bold text-emerald-500">
                              N = {Math.ceil(
                                (Math.pow(1.96 + 0.84, 2) * 2) /
                                Math.pow(parseFloat(calcEffectSize) || 0.5, 2)
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              icon={FlaskConical}
              title={t('experiment.empty.selectTitle')}
              description={t('experiment.empty.selectDescription')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
