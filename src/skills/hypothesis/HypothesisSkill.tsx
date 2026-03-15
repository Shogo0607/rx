import { useState, useEffect, useCallback } from 'react'
import type { SkillProps } from '../../types/skill'
import type { Hypothesis } from '../../types/ipc'
import { cn } from '../../lib/utils'
import { ipcInvoke } from '../../lib/ipc-client'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toaster'
import { useT } from '../../i18n'
import {
  Lightbulb,
  Plus,
  Sparkles,
  ChevronRight,
  Target,
  TrendingUp,
  Gauge,
  CheckCircle2,
  XCircle,
  Clock,
  Beaker,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Variable,
  FileText,
  Link,
  Trash2,
  Edit3,
  Save,
  FolderOpen
} from 'lucide-react'

type HypothesisStatus = Hypothesis['status']

interface EvidenceItem {
  id: string
  type: 'supporting' | 'contradicting'
  source: string
  description: string
}

function parseEvidence(evidenceStr: string | null): EvidenceItem[] {
  if (!evidenceStr) return []
  try {
    const parsed = JSON.parse(evidenceStr)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch {
    return []
  }
}

interface CreateFormState {
  title: string
  nullHypothesis: string
  altHypothesis: string
  description: string
  confidence: string
}

const INITIAL_FORM: CreateFormState = {
  title: '',
  nullHypothesis: '',
  altHypothesis: '',
  description: '',
  confidence: ''
}

export function HypothesisSkill({ projectId }: SkillProps) {
  const { toast } = useToast()
  const t = useT()

  const STATUS_CONFIG: Record<HypothesisStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
    proposed: { label: t('hypothesis.status.proposed'), color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Clock },
    testing: { label: t('hypothesis.status.testing'), color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Beaker },
    supported: { label: t('hypothesis.status.supported'), color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
    rejected: { label: t('hypothesis.status.rejected'), color: 'text-red-500', bg: 'bg-red-500/10', icon: XCircle },
    revised: { label: t('hypothesis.status.revised'), color: 'text-violet-500', bg: 'bg-violet-500/10', icon: Edit3 }
  }
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState<CreateFormState>(INITIAL_FORM)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const hypothesis = hypotheses.find((h) => h.id === selectedId) ?? hypotheses[0] ?? null
  const statusCfg = hypothesis ? STATUS_CONFIG[hypothesis.status] : null
  const evidenceItems = hypothesis ? parseEvidence(hypothesis.evidence) : []

  // Load hypotheses when projectId changes
  const loadHypotheses = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const result = await ipcInvoke('hypothesis:list', { projectId })
      setHypotheses(result)
      if (result.length > 0 && !result.find((h) => h.id === selectedId)) {
        setSelectedId(result[0].id)
      }
    } catch {
      toast('error', t('hypothesis.toast.loadError'))
    } finally {
      setLoading(false)
    }
  }, [projectId, selectedId, toast])

  useEffect(() => {
    if (projectId) {
      loadHypotheses()
    } else {
      setHypotheses([])
      setSelectedId(null)
    }
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!projectId) {
      toast('warning', t('hypothesis.toast.selectProject'))
      return
    }
    if (!createForm.title.trim()) {
      toast('warning', t('hypothesis.toast.enterTitle'))
      return
    }
    try {
      const created = await ipcInvoke('hypothesis:create', {
        projectId,
        title: createForm.title.trim(),
        description: createForm.description.trim() || undefined,
        nullHypothesis: createForm.nullHypothesis.trim() || undefined,
        altHypothesis: createForm.altHypothesis.trim() || undefined,
        confidence: createForm.confidence ? parseInt(createForm.confidence) : undefined
      })
      setHypotheses((prev) => [created, ...prev])
      setSelectedId(created.id)
      setCreateForm(INITIAL_FORM)
      setShowCreateForm(false)
      toast('success', t('hypothesis.toast.createSuccess'))
    } catch {
      toast('error', t('hypothesis.toast.createError'))
    }
  }

  const handleUpdate = async (id: string, updates: Partial<Pick<Hypothesis, 'title' | 'description' | 'nullHypothesis' | 'altHypothesis' | 'status' | 'evidence' | 'confidence'>>) => {
    try {
      const updated = await ipcInvoke('hypothesis:update', { id, ...updates })
      setHypotheses((prev) => prev.map((h) => (h.id === id ? updated : h)))
      setEditingField(null)
      toast('success', t('hypothesis.toast.updateSuccess'))
    } catch {
      toast('error', t('hypothesis.toast.updateError'))
    }
  }

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [evidenceForm, setEvidenceForm] = useState<{ type: 'supporting' | 'contradicting'; source: string; description: string } | null>(null)

  const handleDelete = async (id: string) => {
    try {
      await ipcInvoke('hypothesis:delete', id)
      setHypotheses((prev) => prev.filter((h) => h.id !== id))
      if (selectedId === id) {
        setSelectedId(hypotheses.find((h) => h.id !== id)?.id ?? null)
      }
      setDeleteConfirmId(null)
      toast('success', t('hypothesis.toast.deleteSuccess'))
    } catch {
      toast('error', t('hypothesis.toast.deleteError'))
    }
  }

  const handleAddEvidence = () => {
    if (!hypothesis || !evidenceForm) return
    if (!evidenceForm.source.trim() || !evidenceForm.description.trim()) return

    const newItem: EvidenceItem = {
      id: `e-${Date.now()}`,
      type: evidenceForm.type,
      source: evidenceForm.source.trim(),
      description: evidenceForm.description.trim()
    }
    const currentEvidence = parseEvidence(hypothesis.evidence)
    const updated = [...currentEvidence, newItem]
    handleUpdate(hypothesis.id, { evidence: JSON.stringify(updated) })
    setEvidenceForm(null)
  }

  const handleRemoveEvidence = (evidenceId: string) => {
    if (!hypothesis) return
    const currentEvidence = parseEvidence(hypothesis.evidence)
    const updated = currentEvidence.filter((e) => e.id !== evidenceId)
    handleUpdate(hypothesis.id, { evidence: JSON.stringify(updated) })
  }

  const startEditField = (field: string, currentValue: string) => {
    setEditingField(field)
    setEditText(currentValue)
  }

  if (!projectId) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Lightbulb className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">{t('hypothesis.title')}</h1>
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
            <Lightbulb className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">{t('hypothesis.title')}</h1>
          </div>
        </div>
        <LoadingState message={t('hypothesis.loading.hypotheses')} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Hypothesis Lab</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('hypothesis.button.newHypothesis')}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="border-b border-border p-4 space-y-3 bg-card">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">{t('hypothesis.label.title')}</label>
              <input
                type="text"
                value={createForm.title}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder={t('hypothesis.placeholder.title')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('hypothesis.label.nullHypothesis')}</label>
              <textarea
                value={createForm.nullHypothesis}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, nullHypothesis: e.target.value }))}
                placeholder={t('hypothesis.placeholder.nullHypothesis')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-blue-500 transition-colors resize-none"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('hypothesis.label.altHypothesis')}</label>
              <textarea
                value={createForm.altHypothesis}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, altHypothesis: e.target.value }))}
                placeholder={t('hypothesis.placeholder.altHypothesis')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-blue-500 transition-colors resize-none"
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">{t('hypothesis.label.description')}</label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t('hypothesis.placeholder.description')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-blue-500 transition-colors resize-none"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('hypothesis.label.confidence')}</label>
              <input
                type="number"
                min="0"
                max="100"
                value={createForm.confidence}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, confidence: e.target.value }))}
                placeholder="0-100"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t('hypothesis.button.create')}
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setCreateForm(INITIAL_FORM) }}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-border hover:bg-accent transition-colors"
            >
              {t('hypothesis.button.cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Hypothesis List */}
        <div className="w-80 border-r border-border overflow-y-auto p-3 space-y-1">
          {hypotheses.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              title={t('hypothesis.empty.noHypotheses')}
              description={t('hypothesis.empty.noHypothesesDescription')}
            />
          ) : (
            hypotheses.map((h) => {
              const sc = STATUS_CONFIG[h.status]
              return (
                <button
                  key={h.id}
                  onClick={() => setSelectedId(h.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg transition-colors',
                    h.id === selectedId ? 'bg-accent' : 'hover:bg-accent/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-sm font-medium leading-snug line-clamp-2">{h.title}</h3>
                    <span className={cn('shrink-0 px-1.5 py-0.5 text-[10px] rounded-full font-medium', sc.bg, sc.color)}>
                      {sc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    {h.confidence != null && (
                      <span className="flex items-center gap-0.5">
                        <Gauge className="w-2.5 h-2.5" /> {h.confidence}%
                      </span>
                    )}
                    <span className="flex items-center gap-0.5 ml-auto">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(h.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Hypothesis Detail */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {hypothesis && statusCfg ? (
            <>
              {/* Title & Status */}
              <div>
                <div className="flex items-start justify-between gap-4 mb-2">
                  {editingField === 'title' ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-base font-semibold rounded-lg border border-border bg-background outline-none focus:border-blue-500 transition-colors"
                      />
                      <button
                        onClick={() => handleUpdate(hypothesis.id, { title: editText })}
                        className="p-1.5 rounded hover:bg-accent transition-colors"
                      >
                        <Save className="w-4 h-4 text-emerald-500" />
                      </button>
                    </div>
                  ) : (
                    <h2
                      className="text-base font-semibold leading-snug cursor-pointer hover:text-blue-500 transition-colors"
                      onDoubleClick={() => startEditField('title', hypothesis.title)}
                    >
                      {hypothesis.title}
                    </h2>
                  )}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      'flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium',
                      statusCfg.bg, statusCfg.color
                    )}>
                      <statusCfg.icon className="w-3 h-3" />
                      {statusCfg.label}
                    </span>
                    {deleteConfirmId === hypothesis.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(hypothesis.id)}
                          className="px-2 py-1 text-[10px] font-medium rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          {t('hypothesis.button.delete')}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 text-[10px] font-medium rounded border border-border hover:bg-accent transition-colors"
                        >
                          {t('hypothesis.button.cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(hypothesis.id)}
                        className="p-1.5 rounded hover:bg-accent transition-colors"
                        title={t('hypothesis.tooltip.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Status Change Buttons */}
                <div className="flex items-center gap-1 mt-1">
                  {(Object.keys(STATUS_CONFIG) as HypothesisStatus[]).map((status) => {
                    const cfg = STATUS_CONFIG[status]
                    return (
                      <button
                        key={status}
                        onClick={() => handleUpdate(hypothesis.id, { status })}
                        className={cn(
                          'px-2 py-1 text-[10px] font-medium rounded transition-colors',
                          hypothesis.status === status
                            ? cn(cfg.bg, cfg.color)
                            : 'text-muted-foreground hover:bg-accent'
                        )}
                      >
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* H0 / H1 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border bg-card">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Minus className="w-3 h-3" />
                    {t('hypothesis.section.nullHypothesis')}
                  </h3>
                  {editingField === 'nullHypothesis' ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-blue-500 transition-colors resize-none"
                        rows={3}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdate(hypothesis.id, { nullHypothesis: editText })}
                          className="px-2 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          {t('hypothesis.button.save')}
                        </button>
                        <button
                          onClick={() => setEditingField(null)}
                          className="px-2 py-1 text-xs font-medium rounded border border-border hover:bg-accent transition-colors"
                        >
                          {t('hypothesis.button.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className="text-sm leading-relaxed cursor-pointer hover:text-blue-500 transition-colors"
                      onDoubleClick={() => startEditField('nullHypothesis', hypothesis.nullHypothesis ?? '')}
                    >
                      {hypothesis.nullHypothesis || <span className="text-muted-foreground italic">{t('hypothesis.placeholder.doubleClickEdit')}</span>}
                    </p>
                  )}
                </div>
                <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
                  <h3 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ArrowRight className="w-3 h-3" />
                    {t('hypothesis.section.altHypothesis')}
                  </h3>
                  {editingField === 'altHypothesis' ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-blue-500 transition-colors resize-none"
                        rows={3}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdate(hypothesis.id, { altHypothesis: editText })}
                          className="px-2 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          {t('hypothesis.button.save')}
                        </button>
                        <button
                          onClick={() => setEditingField(null)}
                          className="px-2 py-1 text-xs font-medium rounded border border-border hover:bg-accent transition-colors"
                        >
                          {t('hypothesis.button.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className="text-sm leading-relaxed cursor-pointer hover:text-blue-500 transition-colors"
                      onDoubleClick={() => startEditField('altHypothesis', hypothesis.altHypothesis ?? '')}
                    >
                      {hypothesis.altHypothesis || <span className="text-muted-foreground italic">{t('hypothesis.placeholder.doubleClickEdit')}</span>}
                    </p>
                  )}
                </div>
              </div>

              {/* Description (Variables / Rationale) */}
              <div className="p-4 rounded-xl border border-border bg-card">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  {t('hypothesis.section.description')}
                </h3>
                {editingField === 'description' ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:border-blue-500 transition-colors resize-none"
                      rows={5}
                      placeholder={t('hypothesis.placeholder.description')}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdate(hypothesis.id, { description: editText })}
                        className="px-2 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        {t('hypothesis.button.save')}
                      </button>
                      <button
                        onClick={() => setEditingField(null)}
                        className="px-2 py-1 text-xs font-medium rounded border border-border hover:bg-accent transition-colors"
                      >
                        {t('hypothesis.button.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap cursor-pointer hover:text-foreground transition-colors"
                    onDoubleClick={() => startEditField('description', hypothesis.description ?? '')}
                  >
                    {hypothesis.description || <span className="italic">{t('hypothesis.placeholder.doubleClickDescription')}</span>}
                  </p>
                )}
              </div>

              {/* Confidence */}
              {hypothesis.confidence != null && (
                <div className="p-4 rounded-xl border border-border bg-card">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    {t('hypothesis.section.confidenceLevel')}
                  </h3>
                  <div className="text-center">
                    <div className={cn(
                      'text-3xl font-bold',
                      hypothesis.confidence >= 80 ? 'text-emerald-500' : hypothesis.confidence >= 60 ? 'text-amber-500' : 'text-red-500'
                    )}>
                      {hypothesis.confidence}%
                    </div>
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-1">
                      <Gauge className="w-3.5 h-3.5" /> {t('hypothesis.text.confidence')}
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          hypothesis.confidence >= 80 ? 'bg-emerald-500' : hypothesis.confidence >= 60 ? 'bg-amber-500' : 'bg-red-500'
                        )}
                        style={{ width: `${hypothesis.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Evidence Map */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('hypothesis.section.evidenceMap')}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEvidenceForm({ type: 'supporting', source: '', description: '' })}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      {t('hypothesis.button.addSupporting')}
                    </button>
                    <button
                      onClick={() => setEvidenceForm({ type: 'contradicting', source: '', description: '' })}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <ThumbsDown className="w-3 h-3" />
                      {t('hypothesis.button.addContradicting')}
                    </button>
                  </div>
                </div>
                {evidenceForm && (
                  <form
                    className="p-3 rounded-lg border border-border bg-muted/30 mb-3 space-y-2"
                    onSubmit={(e) => { e.preventDefault(); handleAddEvidence() }}
                  >
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      {evidenceForm.type === 'supporting' ? t('hypothesis.text.supporting') : t('hypothesis.text.contradicting')} {t('hypothesis.text.evidence')}
                    </div>
                    <input
                      type="text"
                      value={evidenceForm.source}
                      onChange={(e) => setEvidenceForm({ ...evidenceForm, source: e.target.value })}
                      placeholder={t('hypothesis.placeholder.evidenceSource')}
                      className="w-full px-2 py-1.5 text-xs rounded border border-border bg-background outline-none focus:border-primary"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={evidenceForm.description}
                      onChange={(e) => setEvidenceForm({ ...evidenceForm, description: e.target.value })}
                      placeholder={t('hypothesis.placeholder.evidenceDescription')}
                      className="w-full px-2 py-1.5 text-xs rounded border border-border bg-background outline-none focus:border-primary"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={!evidenceForm.source.trim() || !evidenceForm.description.trim()}
                        className="px-3 py-1 text-[10px] font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {t('hypothesis.button.add')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEvidenceForm(null)}
                        className="px-3 py-1 text-[10px] font-medium rounded border border-border hover:bg-accent transition-colors"
                      >
                        {t('hypothesis.button.cancel')}
                      </button>
                    </div>
                  </form>
                )}
                {evidenceItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    {t('hypothesis.empty.noEvidence')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {evidenceItems.map((e) => (
                      <div
                        key={e.id}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-lg border',
                          e.type === 'supporting'
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-red-500/30 bg-red-500/5'
                        )}
                      >
                        {e.type === 'supporting' ? (
                          <ThumbsUp className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <ThumbsDown className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold">{e.source}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={cn(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                            e.type === 'supporting' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                          )}>
                            {e.type}
                          </span>
                          <button
                            onClick={() => handleRemoveEvidence(e.id)}
                            className="p-1 rounded hover:bg-accent transition-colors"
                            title={t('hypothesis.tooltip.remove')}
                          >
                            <Trash2 className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Lightbulb}
              title={t('hypothesis.empty.selectTitle')}
              description={t('hypothesis.empty.selectDescription')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
