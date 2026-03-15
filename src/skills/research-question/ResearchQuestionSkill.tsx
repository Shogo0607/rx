import { useState, useEffect, useCallback } from 'react'
import type { SkillProps } from '../../types/skill'
import type { ResearchQuestion } from '../../types/ipc'
import { cn } from '../../lib/utils'
import { ipcInvoke } from '../../lib/ipc-client'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toaster'
import { useT } from '../../i18n'
import {
  HelpCircle,
  Sparkles,
  History,
  Star,
  Copy,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Target,
  Gauge,
  TrendingUp,
  Zap,
  Clock,
  Eye,
  Plus,
  Trash2,
  Edit3,
  FolderOpen
} from 'lucide-react'

type Framework = 'PICO' | 'FINER' | 'SPIDER' | 'PEO'

export function ResearchQuestionSkill({ projectId }: SkillProps) {
  const { toast } = useToast()
  const t = useT()

  const FRAMEWORKS: Record<Framework, { label: string; description: string; fields: { key: string; label: string; placeholder: string }[] }> = {
    PICO: {
      label: 'PICO',
      description: t('rq.framework.pico.description'),
      fields: [
        { key: 'population', label: t('rq.framework.pico.population'), placeholder: t('rq.framework.pico.populationPlaceholder') },
        { key: 'intervention', label: t('rq.framework.pico.intervention'), placeholder: t('rq.framework.pico.interventionPlaceholder') },
        { key: 'comparison', label: t('rq.framework.pico.comparison'), placeholder: t('rq.framework.pico.comparisonPlaceholder') },
        { key: 'outcome', label: t('rq.framework.pico.outcome'), placeholder: t('rq.framework.pico.outcomePlaceholder') }
      ]
    },
    FINER: {
      label: 'FINER',
      description: t('rq.framework.finer.description'),
      fields: [
        { key: 'feasible', label: t('rq.framework.finer.feasible'), placeholder: t('rq.framework.finer.feasiblePlaceholder') },
        { key: 'interesting', label: t('rq.framework.finer.interesting'), placeholder: t('rq.framework.finer.interestingPlaceholder') },
        { key: 'novel', label: t('rq.framework.finer.novel'), placeholder: t('rq.framework.finer.novelPlaceholder') },
        { key: 'ethical', label: t('rq.framework.finer.ethical'), placeholder: t('rq.framework.finer.ethicalPlaceholder') },
        { key: 'relevant', label: t('rq.framework.finer.relevant'), placeholder: t('rq.framework.finer.relevantPlaceholder') }
      ]
    },
    SPIDER: {
      label: 'SPIDER',
      description: t('rq.framework.spider.description'),
      fields: [
        { key: 'sample', label: t('rq.framework.spider.sample'), placeholder: t('rq.framework.spider.samplePlaceholder') },
        { key: 'phenomenon', label: t('rq.framework.spider.phenomenon'), placeholder: t('rq.framework.spider.phenomenonPlaceholder') },
        { key: 'design', label: t('rq.framework.spider.design'), placeholder: t('rq.framework.spider.designPlaceholder') },
        { key: 'evaluation', label: t('rq.framework.spider.evaluation'), placeholder: t('rq.framework.spider.evaluationPlaceholder') },
        { key: 'researchType', label: t('rq.framework.spider.researchType'), placeholder: t('rq.framework.spider.researchTypePlaceholder') }
      ]
    },
    PEO: {
      label: 'PEO',
      description: t('rq.framework.peo.description'),
      fields: [
        { key: 'population', label: t('rq.framework.peo.population'), placeholder: t('rq.framework.peo.populationPlaceholder') },
        { key: 'exposure', label: t('rq.framework.peo.exposure'), placeholder: t('rq.framework.peo.exposurePlaceholder') },
        { key: 'outcome', label: t('rq.framework.peo.outcome'), placeholder: t('rq.framework.peo.outcomePlaceholder') }
      ]
    }
  }

  const TYPE_LABELS: Record<ResearchQuestion['type'], { label: string; color: string; bg: string }> = {
    primary: { label: t('rq.type.primary'), color: 'text-blue-500', bg: 'bg-blue-500/10' },
    secondary: { label: t('rq.type.secondary'), color: 'text-violet-500', bg: 'bg-violet-500/10' },
    exploratory: { label: t('rq.type.exploratory'), color: 'text-amber-500', bg: 'bg-amber-500/10' }
  }

  const STATUS_LABELS: Record<ResearchQuestion['status'], { label: string; color: string; bg: string }> = {
    open: { label: t('rq.status.open'), color: 'text-blue-500', bg: 'bg-blue-500/10' },
    investigating: { label: t('rq.status.investigating'), color: 'text-amber-500', bg: 'bg-amber-500/10' },
    answered: { label: t('rq.status.answered'), color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    revised: { label: t('rq.status.revised'), color: 'text-violet-500', bg: 'bg-violet-500/10' }
  }
  const [activeFramework, setActiveFramework] = useState<Framework>('PICO')
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [selectedRQId, setSelectedRQId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<ResearchQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const frameworkConfig = FRAMEWORKS[activeFramework]
  const selectedRQ = questions.find((rq) => rq.id === selectedRQId) ?? questions[0] ?? null

  // Load research questions when projectId changes
  const loadQuestions = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const result = await ipcInvoke('rq:list', { projectId })
      setQuestions(result)
      if (result.length > 0 && !result.find((r) => r.id === selectedRQId)) {
        setSelectedRQId(result[0].id)
      }
    } catch {
      toast('error', t('rq.toast.loadError'))
    } finally {
      setLoading(false)
    }
  }, [projectId, selectedRQId, toast])

  useEffect(() => {
    if (projectId) {
      loadQuestions()
    } else {
      setQuestions([])
      setSelectedRQId(null)
    }
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Generate a question text from the framework form values
  const generateQuestionFromForm = (): string => {
    const values = frameworkConfig.fields.map((f) => formValues[f.key]?.trim()).filter(Boolean)
    if (values.length === 0) return ''

    switch (activeFramework) {
      case 'PICO':
        return `How does ${formValues['intervention'] || '___'} affect ${formValues['outcome'] || '___'} in ${formValues['population'] || '___'} compared to ${formValues['comparison'] || '___'}?`
      case 'FINER':
        return values.join(' - ')
      case 'SPIDER':
        return `For ${formValues['sample'] || '___'}, what is the ${formValues['phenomenon'] || '___'} when using ${formValues['design'] || '___'}, evaluated by ${formValues['evaluation'] || '___'} (${formValues['researchType'] || '___'})?`
      case 'PEO':
        return `How does ${formValues['exposure'] || '___'} affect ${formValues['outcome'] || '___'} in ${formValues['population'] || '___'}?`
      default:
        return values.join(' ')
    }
  }

  const handleCreate = async () => {
    if (!projectId) {
      toast('warning', t('rq.toast.selectProject'))
      return
    }
    const question = generateQuestionFromForm()
    if (!question || question.includes('___')) {
      toast('warning', t('rq.toast.fillFrameworkFields'))
      return
    }
    try {
      const created = await ipcInvoke('rq:create', {
        projectId,
        question,
        type: 'primary'
      })
      setQuestions((prev) => [created, ...prev])
      setSelectedRQId(created.id)
      setFormValues({})
      toast('success', t('rq.toast.createSuccess'))
    } catch {
      toast('error', t('rq.toast.createError'))
    }
  }

  const handleUpdate = async (id: string, updates: Partial<Pick<ResearchQuestion, 'question' | 'type' | 'status' | 'answer' | 'evidenceSummary'>>) => {
    try {
      const updated = await ipcInvoke('rq:update', { id, ...updates })
      setQuestions((prev) => prev.map((rq) => (rq.id === id ? updated : rq)))
      setEditingId(null)
      toast('success', t('rq.toast.updateSuccess'))
    } catch {
      toast('error', t('rq.toast.updateError'))
    }
  }

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    try {
      await ipcInvoke('rq:delete', id)
      setQuestions((prev) => prev.filter((rq) => rq.id !== id))
      if (selectedRQId === id) {
        setSelectedRQId(questions.find((rq) => rq.id !== id)?.id ?? null)
      }
      setDeleteConfirmId(null)
      toast('success', t('rq.toast.deleteSuccess'))
    } catch {
      toast('error', t('rq.toast.deleteError'))
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast('success', t('rq.toast.copySuccess'))
  }

  if (!projectId) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">{t('rq.title')}</h1>
          </div>
        </div>
        <EmptyState
          icon={FolderOpen}
          title={t('common.selectProject')}
          description={t('common.selectProjectDesc')}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">{t('rq.title')}</h1>
          </div>
        </div>
        <LoadingState message={t('rq.loading.questions')} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Research Question</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent transition-colors">
            <History className="w-3.5 h-3.5" />
            {t('rq.button.history')} ({questions.length})
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Framework Form */}
        <div className="flex-1 overflow-y-auto border-r border-border">
          {/* Framework Tabs */}
          <div className="flex items-center gap-1 px-6 pt-4 pb-3 border-b border-border">
            {(Object.keys(FRAMEWORKS) as Framework[]).map((fw) => (
              <button
                key={fw}
                onClick={() => setActiveFramework(fw)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  activeFramework === fw
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                {fw}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-5">
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                {frameworkConfig.label}: {frameworkConfig.description}
              </p>
            </div>

            {/* Dynamic Form Fields */}
            {frameworkConfig.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium mb-1.5">
                  {field.label}
                </label>
                <input
                  type="text"
                  value={formValues[field.key] ?? ''}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            ))}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                {t('rq.button.generate')}
              </button>
              <button
                onClick={() => setFormValues({})}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t('rq.button.clear')}
              </button>
            </div>

            {/* Selected RQ Display */}
            {selectedRQ && (
              <div className="mt-4 p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('rq.section.selectedRQ')}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy(selectedRQ.question)}
                      className="p-1.5 rounded hover:bg-accent transition-colors"
                      title={t('rq.tooltip.copy')}
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(selectedRQ.id)
                        setEditText(selectedRQ.question)
                      }}
                      className="p-1.5 rounded hover:bg-accent transition-colors"
                      title={t('rq.tooltip.edit')}
                    >
                      <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    {deleteConfirmId === selectedRQ.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(selectedRQ.id)}
                          className="px-2 py-1 text-[10px] font-medium rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          {t('rq.button.delete')}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 text-[10px] font-medium rounded border border-border hover:bg-accent transition-colors"
                        >
                          {t('rq.button.cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(selectedRQ.id)}
                        className="p-1.5 rounded hover:bg-accent transition-colors"
                        title={t('rq.tooltip.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
                {editingId === selectedRQ.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-blue-500 transition-colors resize-none"
                      rows={3}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdate(selectedRQ.id, { question: editText })}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        {t('rq.button.save')}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent transition-colors"
                      >
                        {t('rq.button.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed font-medium">
                    {selectedRQ.question}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(selectedRQ.createdAt).toLocaleDateString()}
                  </span>
                  <span className={cn('px-1.5 py-0.5 rounded font-medium', TYPE_LABELS[selectedRQ.type].bg, TYPE_LABELS[selectedRQ.type].color)}>
                    {TYPE_LABELS[selectedRQ.type].label}
                  </span>
                  <span className={cn('px-1.5 py-0.5 rounded font-medium', STATUS_LABELS[selectedRQ.status].bg, STATUS_LABELS[selectedRQ.status].color)}>
                    {STATUS_LABELS[selectedRQ.status].label}
                  </span>
                </div>
                {/* Status Change */}
                <div className="flex items-center gap-1 mt-3">
                  {(Object.keys(STATUS_LABELS) as ResearchQuestion['status'][]).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleUpdate(selectedRQ.id, { status })}
                      className={cn(
                        'px-2 py-1 text-[10px] font-medium rounded transition-colors',
                        selectedRQ.status === status
                          ? cn(STATUS_LABELS[status].bg, STATUS_LABELS[status].color)
                          : 'text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {STATUS_LABELS[status].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Answer Section */}
            {selectedRQ && selectedRQ.status === 'answered' && selectedRQ.answer && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                <h3 className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('rq.section.answer')}
                </h3>
                <p className="text-sm leading-relaxed">{selectedRQ.answer}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Suggestions + History */}
        <div className="w-80 overflow-y-auto">
          {/* Suggestions */}
          <div className="p-5 border-b border-border">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              <Sparkles className="w-4 h-4" />
              {t('rq.section.aiEvaluation')}
            </h3>
            {selectedRQ ? (
              <div className="mt-4 p-3 rounded-lg bg-muted">
                <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {t('rq.section.tips')}
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                    {t('rq.tip.useFramework')}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <AlertCircle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                    {t('rq.tip.defineMetrics')}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <AlertCircle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                    {t('rq.tip.specificTestable')}
                  </li>
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('rq.empty.selectOrCreate')}
              </p>
            )}
          </div>

          {/* RQ History */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                <History className="w-4 h-4" />
                {t('rq.section.allQuestions')}
              </h3>
              <button
                onClick={handleCreate}
                className="p-1 rounded hover:bg-accent transition-colors"
                title={t('rq.tooltip.newQuestion')}
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
            {questions.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center px-2">
                <p className="text-xs font-medium">{t('rq.empty.noQuestions')}</p>
                <p className="text-[11px] mt-1">{t('rq.empty.noQuestionsDescription')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {questions.map((rq, index) => {
                  const typeCfg = TYPE_LABELS[rq.type]
                  const statusCfg = STATUS_LABELS[rq.status]
                  return (
                    <button
                      key={rq.id}
                      onClick={() => setSelectedRQId(rq.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg transition-colors',
                        rq.id === selectedRQId
                          ? 'bg-accent border border-blue-500/30'
                          : 'hover:bg-accent/50 border border-transparent'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">RQ-{index + 1}</span>
                        <div className="flex items-center gap-1">
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', statusCfg.bg, statusCfg.color)}>
                            {statusCfg.label}
                          </span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', typeCfg.bg, typeCfg.color)}>
                            {typeCfg.label}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{rq.question}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-muted-foreground/60 ml-auto">
                          {new Date(rq.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
