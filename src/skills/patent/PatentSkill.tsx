import { useState, useCallback, useEffect } from 'react'
import type { SkillProps } from '../../types/skill'
import type { PriorArtPatent, GapAnalysis, GeneratedIdeas, MermaidDiagram, PatentEmbodiment, GeneratedSpecWithEmbodiments } from '../../types/ipc'
import { cn } from '../../lib/utils'
import { ipcInvoke } from '../../lib/ipc-client'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toaster'
import { useT } from '../../i18n'
import { useChatStore } from '../../stores/chat-store'
import { useUiStore } from '../../stores/ui-store'
import { usePatentPipelineStore } from '../../stores/patent-pipeline-store'
import { MermaidDiagram as MermaidDiagramComponent, mermaidToPng } from '../../components/ui/MermaidDiagram'
import {
  Scale,
  Plus,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Download,
  FileText,
  Search,
  Trash2,
  Globe,
  Flag,
  BookOpen,
  CornerDownRight,
  Play,
  Pause,
  SkipForward,
  Zap,
  FlaskConical,
  Lightbulb,
  Image as ImageIcon,
  ExternalLink,
  Check,
  X,
  Edit3,
  Loader2
} from 'lucide-react'

interface PatentClaim {
  id: string
  projectId: string
  documentId: string | null
  claimNumber: number
  claimType: 'independent' | 'dependent'
  parentClaimId: string | null
  claimText: string
  status: 'draft' | 'review' | 'final' | 'filed' | 'granted' | 'rejected'
  priorArtNotes: string | null
  createdAt: string
  updatedAt: string
}

const PATENT_SECTIONS = ['auto-generate', 'prior-art', 'gap-analysis', 'ideas', 'claims', 'specification', 'abstract', 'drawings'] as const
const PATENT_TEMPLATES = ['jp-patent', 'us-patent'] as const

const PIPELINE_STEPS = [
  { step: 1, label: '公知例調査', labelEn: 'Prior Art Research' },
  { step: 2, label: '差分分析', labelEn: 'Gap Analysis' },
  { step: 3, label: 'アイディア生成', labelEn: 'Idea Generation' },
  { step: 4, label: '請求項作成', labelEn: 'Claims Drafting' },
  { step: 5, label: '明細書作成', labelEn: 'Spec Drafting' },
  { step: 6, label: '図面生成', labelEn: 'Diagrams' },
  { step: 7, label: '出力', labelEn: 'Export' }
]

const SECTION_ICONS: Record<string, typeof Scale> = {
  'auto-generate': Zap,
  'prior-art': Search,
  'gap-analysis': FlaskConical,
  'ideas': Lightbulb,
  'claims': FileText,
  'specification': FileText,
  'abstract': FileText,
  'drawings': ImageIcon
}

export function PatentSkill({ projectId }: SkillProps) {
  const { toast } = useToast()
  const t = useT()
  const [claims, setClaims] = useState<PatentClaim[]>([])
  const [loading, setLoading] = useState(false)
  const [template, setTemplate] = useState<typeof PATENT_TEMPLATES[number]>('jp-patent')
  const [activeSection, setActiveSection] = useState<typeof PATENT_SECTIONS[number]>('auto-generate')
  const [expandedClaims, setExpandedClaims] = useState<Set<string>>(new Set())
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null)

  // Specification & abstract content
  const [specContents, setSpecContents] = useState<Record<string, string>>({})
  const [abstractContent, setAbstractContent] = useState('')
  const [embodiments, setEmbodiments] = useState<PatentEmbodiment[]>([])
  const [expandedEmbodiments, setExpandedEmbodiments] = useState<Set<string>>(new Set())

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newClaimText, setNewClaimText] = useState('')
  const [newClaimType, setNewClaimType] = useState<'independent' | 'dependent'>('independent')
  const [newParentClaimId, setNewParentClaimId] = useState<string>('')

  // Pipeline state
  const [inventionDescription, setInventionDescription] = useState('')
  const [pipelineMode, setPipelineMode] = useState<'auto' | 'semi-auto'>('semi-auto')
  const [jurisdiction, setJurisdiction] = useState<string>('JP')
  const [mermaidCodes, setMermaidCodes] = useState<Array<{ id: string; label: string; code: string }>>([])
  const [editingDiagramId, setEditingDiagramId] = useState<string | null>(null)
  const [editingDiagramCode, setEditingDiagramCode] = useState('')

  const {
    currentRun, pipelineRuns, priorArtPatents, pipelineStatus, progressData, isLoading: pipelineLoading,
    loadRuns, loadPriorArt, createPipeline, startPipeline, pausePipeline, resumePipeline,
    refreshRun, setCurrentRun, initProgressListener
  } = usePatentPipelineStore()

  // Initialize progress listener
  useEffect(() => {
    const cleanup = initProgressListener()
    return cleanup
  }, [])

  // Load pipeline data when project changes
  useEffect(() => {
    if (projectId) {
      loadRuns(projectId)
      loadPriorArt(projectId)
    }
  }, [projectId])

  // Sync pipeline data to local state when currentRun updates
  useEffect(() => {
    if (currentRun) {
      // Populate spec contents from pipeline (handle both old flat and new structured format)
      if (currentRun.generatedSpec) {
        const raw = currentRun.generatedSpec as GeneratedSpecWithEmbodiments | Record<string, string>
        if ('sections' in raw && raw.sections) {
          // New structured format
          setSpecContents(raw.sections)
          setEmbodiments(raw.embodiments || [])
          if (raw._abstract) {
            setAbstractContent(raw._abstract)
          }
        } else {
          // Legacy flat format
          const spec = { ...(raw as Record<string, string>) }
          if (spec._abstract) {
            setAbstractContent(spec._abstract)
            delete spec._abstract
          }
          setSpecContents(spec)
          setEmbodiments([])
        }
      }
      // Populate diagrams
      if (currentRun.generatedDiagrams) {
        setMermaidCodes(currentRun.generatedDiagrams.map((d) => ({
          id: d.id,
          label: d.label,
          code: d.mermaidCode
        })))
      }
      // Load prior art for this run
      loadPriorArt(currentRun.projectId, currentRun.id)
    }
  }, [currentRun?.id, currentRun?.status])

  const handleAiAction = async (prompt: string) => {
    const { sendMessage } = useChatStore.getState()
    useUiStore.getState().setChatPanelOpen(true)
    await sendMessage(prompt, 'You are a patent attorney assistant.', [])
  }

  const getSpecSummary = () => {
    const sections = template === 'jp-patent' ? JP_SPEC_SECTIONS : US_SPEC_SECTIONS
    const baseSummary = sections
      .map((s) => `[${s}]: ${specContents[s] || '(empty)'}`)
      .join('\n\n')
    const embSummary = embodiments.length > 0
      ? '\n\n[実施形態/Embodiments]:\n' + embodiments.map((e) => `- ${e.title}: ${e.description.slice(0, 300)}...`).join('\n')
      : ''
    return baseSummary + embSummary
  }

  const getClaimsSummary = () => {
    return claims
      .map((c) => `Claim ${c.claimNumber} (${c.claimType}): ${c.claimText}`)
      .join('\n')
  }

  const handleGenerateClaims = () => {
    const formatLabel = template === 'jp-patent' ? 'Japanese patent (JP)' : 'US patent'
    const spec = getSpecSummary()
    handleAiAction(
      `Based on the following specification, generate patent claims for a ${formatLabel} format patent.\n\nSpecification:\n${spec}\n\nGenerate 1 independent claim and 2-3 dependent claims. Format each claim clearly with its number and type.`
    )
  }

  const handleDraftSpec = () => {
    const formatLabel = template === 'jp-patent' ? 'Japanese patent (JP)' : 'US patent'
    const claimsSummary = getClaimsSummary()
    const sections = template === 'jp-patent' ? JP_SPEC_SECTIONS : US_SPEC_SECTIONS
    handleAiAction(
      `Based on the following patent claims, draft a ${formatLabel} patent specification.\n\nClaims:\n${claimsSummary}\n\nPlease draft content for each of the following sections:\n${sections.map((s) => `- ${s}`).join('\n')}`
    )
  }

  const handleAnalyzePriorArt = () => {
    const claimsSummary = getClaimsSummary()
    const spec = getSpecSummary()
    handleAiAction(
      `Analyze potential prior art for the following patent application.\n\nClaims:\n${claimsSummary}\n\nSpecification:\n${spec}\n\nIdentify potential prior art references, analyze novelty and non-obviousness, and suggest ways to strengthen the claims.`
    )
  }

  const handleSectionAi = (section: string) => {
    const formatLabel = template === 'jp-patent' ? 'Japanese patent (JP)' : 'US patent'
    const claimsSummary = getClaimsSummary()
    handleAiAction(
      `Draft the "${section}" section for a ${formatLabel} patent specification.\n\nClaims:\n${claimsSummary}\n\nExisting content for this section: ${specContents[section] || '(none yet)'}\n\nPlease generate appropriate content for this section.`
    )
  }

  const handleAbstractAi = () => {
    const claimsSummary = getClaimsSummary()
    const spec = getSpecSummary()
    const formatLabel = template === 'jp-patent' ? 'Japanese patent (JP)' : 'US patent'
    handleAiAction(
      `Generate a patent abstract for a ${formatLabel} patent application.\n\nClaims:\n${claimsSummary}\n\nSpecification:\n${spec}\n\nThe abstract should be concise (around 150 words) and summarize the key aspects of the invention.`
    )
  }

  const handleExport = async (format: 'docx' | 'pdf' = 'docx') => {
    const sections: Array<{ heading: string; body?: string; subsections?: Array<{ heading: string; body?: string }> }> = (template === 'jp-patent' ? JP_SPEC_SECTIONS : US_SPEC_SECTIONS).map(
      (s) => ({ heading: s, body: specContents[s] || '' })
    )
    // Add embodiments as subsections under a main embodiment heading
    if (embodiments.length > 0) {
      const isJp = template === 'jp-patent'
      const embSection: { heading: string; body?: string; subsections: Array<{ heading: string; body?: string }> } = {
        heading: isJp ? '発明を実施するための形態' : 'Detailed Description of Preferred Embodiments',
        subsections: embodiments.map((emb) => {
          const figRefs = emb.figures.map((f) =>
            isJp ? `\n\n【図${f.figureNumber}】${f.label}\n${f.description}` : `\n\nFIG. ${f.figureNumber} - ${f.label}\n${f.description}`
          ).join('')
          return { heading: emb.title, body: emb.description + figRefs }
        })
      }
      sections.push(embSection)
    }
    sections.push({ heading: 'Claims', body: claims.map((c) => `${c.claimNumber}. ${c.claimText}`).join('\n\n') })
    if (abstractContent) {
      sections.push({ heading: 'Abstract', body: abstractContent })
    }

    // Render Mermaid diagrams to PNG for export
    let images: Array<{ label: string; data: string; width: number; height: number }> = []
    if (mermaidCodes.length > 0) {
      try {
        const rendered = await Promise.all(
          mermaidCodes.map(async (diagram) => {
            const pngDataUrl = await mermaidToPng(diagram.code)
            return {
              label: diagram.label,
              data: pngDataUrl.split(',')[1], // base64 only
              width: 500,
              height: 400
            }
          })
        )
        images = rendered
      } catch (err) {
        console.warn('Failed to render some diagrams:', err)
      }
    }

    try {
      const templateName = template === 'jp-patent' ? 'patent-jp' : 'patent-us'
      const channel = format === 'pdf' ? 'doc:export-pdf' : 'doc:export-docx'
      const result = await ipcInvoke(channel as 'doc:export-docx', {
        content: {
          title: t('patent.title'),
          date: new Date().toISOString().slice(0, 10),
          sections,
          images
        },
        template: templateName
      })
      if (result) {
        toast('success', t('patent.toast.exportSuccess'))
      }
    } catch {
      toast('error', t('patent.toast.exportFailed'))
    }
  }

  const JP_SPEC_SECTIONS = [
    t('patent.specSection.jp.technicalField'),
    t('patent.specSection.jp.backgroundArt'),
    t('patent.specSection.jp.problemToSolve'),
    t('patent.specSection.jp.meansToSolve'),
    t('patent.specSection.jp.effectOfInvention')
    // 実施形態 is now generated as detailed embodiments separately
  ]

  const US_SPEC_SECTIONS = [
    t('patent.specSection.en.technicalField'),
    t('patent.specSection.en.backgroundArt'),
    t('patent.specSection.en.summary'),
    t('patent.specSection.en.briefDescription'),
    t('patent.specSection.en.detailedDescription')
  ]

  const loadClaims = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const params: { projectId: string; pipelineRunId?: string } = { projectId }
      if (currentRun?.id) {
        params.pipelineRunId = currentRun.id
      }
      const data = await ipcInvoke('patent:list-claims', params)
      setClaims(data as PatentClaim[])
      if ((data as PatentClaim[]).length > 0) {
        setExpandedClaims(new Set((data as PatentClaim[]).filter(c => c.claimType === 'independent').map(c => c.id)))
        if (!selectedClaim) {
          setSelectedClaim((data as PatentClaim[])[0].id)
        }
      }
    } catch {
      toast('error', t('patent.toast.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [projectId, currentRun?.id, toast, selectedClaim, t])

  useEffect(() => {
    loadClaims()
  }, [loadClaims])

  // ── Pipeline Actions ──

  const handleStartPipeline = async () => {
    if (!projectId || !inventionDescription.trim()) {
      toast('error', '発明の概要を入力してください')
      return
    }
    try {
      const run = await createPipeline(projectId, inventionDescription, template, pipelineMode, jurisdiction)
      await startPipeline(run.id)
      toast('success', 'パイプラインを開始しました')
    } catch (err) {
      toast('error', `パイプライン開始エラー: ${err}`)
    }
  }

  const handlePausePipeline = async () => {
    if (!currentRun) return
    try {
      await pausePipeline(currentRun.id)
      toast('success', 'パイプラインを一時停止しました')
    } catch (err) {
      toast('error', `一時停止エラー: ${err}`)
    }
  }

  const handleResumePipeline = async () => {
    if (!currentRun) return
    try {
      await resumePipeline(currentRun.id)
      toast('success', 'パイプラインを再開しました')
    } catch (err) {
      toast('error', `再開エラー: ${err}`)
    }
  }

  // ── Claim CRUD ──

  const handleCreateClaim = async () => {
    if (!projectId || !newClaimText.trim()) return
    const nextNumber = claims.length > 0 ? Math.max(...claims.map(c => c.claimNumber)) + 1 : 1
    try {
      const created = await ipcInvoke('patent:create-claim', {
        projectId,
        claimNumber: nextNumber,
        claimText: newClaimText.trim(),
        claimType: newClaimType,
        parentClaimId: newParentClaimId || undefined
      })
      setClaims((prev) => [...prev, created as PatentClaim])
      setSelectedClaim((created as PatentClaim).id)
      setNewClaimText('')
      setShowCreate(false)
      toast('success', t('patent.toast.claimAddSuccess'))
    } catch {
      toast('error', t('patent.toast.claimAddFailed'))
    }
  }

  const handleUpdateClaim = async (id: string, updates: { claimText?: string; claimType?: 'independent' | 'dependent'; status?: PatentClaim['status']; priorArtNotes?: string }) => {
    try {
      const updated = await ipcInvoke('patent:update-claim', { id, ...updates })
      setClaims((prev) => prev.map((c) => (c.id === id ? (updated as PatentClaim) : c)))
      toast('success', t('patent.toast.updateSuccess'))
    } catch {
      toast('error', t('patent.toast.updateFailed'))
    }
  }

  const handleDeleteClaim = async (id: string) => {
    try {
      await ipcInvoke('patent:delete-claim', id)
      setClaims((prev) => prev.filter((c) => c.id !== id))
      if (selectedClaim === id) {
        setSelectedClaim(claims.find((c) => c.id !== id)?.id ?? null)
      }
      toast('success', t('patent.toast.claimDeleteSuccess'))
    } catch {
      toast('error', t('patent.toast.deleteFailed'))
    }
  }

  const toggleClaim = (id: string) => {
    const next = new Set(expandedClaims)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedClaims(next)
  }

  if (!projectId) {
    return <EmptyState icon={Scale} title={t('patent.empty.selectProject')} description={t('patent.empty.selectProjectDesc')} />
  }

  if (loading) {
    return <LoadingState message={t('patent.loading.data')} />
  }

  // Build tree: independent claims with their dependent children
  const independentClaims = claims.filter(c => c.claimType === 'independent')
  const dependentClaims = claims.filter(c => c.claimType === 'dependent')

  const renderClaim = (claim: PatentClaim, depth: number = 0) => {
    const children = dependentClaims.filter(c => c.parentClaimId === claim.id)
    return (
      <div key={claim.id}>
        <div
          className={cn(
            'flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors group',
            selectedClaim === claim.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent',
            depth > 0 && 'ml-6'
          )}
          onClick={() => setSelectedClaim(claim.id)}
        >
          {children.length > 0 ? (
            <button onClick={(e) => { e.stopPropagation(); toggleClaim(claim.id) }} className="mt-0.5">
              {expandedClaims.has(claim.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <CornerDownRight className="w-4 h-4 mt-0.5 text-muted-foreground" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold">{t('patent.label.claim')} {claim.claimNumber}</span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                claim.claimType === 'independent' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
              )}>
                {claim.claimType === 'independent' ? t('patent.claimType.independent') : t('patent.claimType.dependent')}
              </span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground'
              )}>
                {claim.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{claim.claimText}</p>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteClaim(claim.id) }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent text-destructive shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {expandedClaims.has(claim.id) && children.map(child => renderClaim(child, depth + 1))}
      </div>
    )
  }

  // Pipeline progress bar
  const renderPipelineProgress = () => {
    if (!currentRun) return null
    const currentStep = currentRun.currentStep || 0
    const isRunning = !['pending', 'completed', 'failed', 'paused'].includes(currentRun.status)

    return (
      <div className="px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-1 mb-2">
          {PIPELINE_STEPS.map((step) => {
            const isDone = currentStep > step.step || currentRun.status === 'completed'
            const isActive = currentStep === step.step && isRunning
            const isPaused = currentStep === step.step && currentRun.status === 'paused'
            return (
              <div key={step.step} className="flex-1 flex flex-col items-center">
                <div className={cn(
                  'w-full h-1.5 rounded-full transition-colors',
                  isDone ? 'bg-green-500' :
                  isActive ? 'bg-primary animate-pulse' :
                  isPaused ? 'bg-yellow-500' :
                  'bg-secondary'
                )} />
                <span className={cn(
                  'text-[9px] mt-1 truncate max-w-full',
                  isDone ? 'text-green-400' :
                  isActive ? 'text-primary' :
                  isPaused ? 'text-yellow-400' :
                  'text-muted-foreground'
                )}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {currentRun.status === 'completed' ? '完了' :
             currentRun.status === 'failed' ? `エラー: ${currentRun.errorMessage || '不明'}` :
             currentRun.status === 'paused' ? `ステップ ${currentStep} 完了 - 確認待ち` :
             isRunning ? `ステップ ${currentStep}/7 実行中...` :
             '待機中'}
          </span>
          <div className="flex items-center gap-1">
            {isRunning && (
              <button onClick={handlePausePipeline} className="p-1 rounded hover:bg-accent" title="一時停止">
                <Pause className="w-3.5 h-3.5" />
              </button>
            )}
            {currentRun.status === 'paused' && (
              <button onClick={handleResumePipeline} className="flex items-center gap-1 px-2 py-1 rounded bg-primary text-primary-foreground text-xs hover:bg-primary/90">
                <SkipForward className="w-3 h-3" />
                次のステップへ
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Scale className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">{t('patent.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Template selector */}
          <div className="flex items-center bg-secondary rounded-md">
            {PATENT_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl}
                onClick={() => setTemplate(tmpl)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
                  template === tmpl ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tmpl === 'jp-patent' ? <Flag className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                {tmpl === 'jp-patent' ? t('patent.template.jpPatent') : t('patent.template.usPatent')}
              </button>
            ))}
          </div>
          <button onClick={() => handleExport('docx')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-sm">
            <Download className="w-3.5 h-3.5" />
            DOCX
          </button>
          <button onClick={() => handleExport('pdf')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-sm">
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      </div>

      {/* Pipeline Progress Bar */}
      {currentRun && renderPipelineProgress()}

      <div className="flex flex-1 overflow-hidden">
        {/* Section navigation */}
        <div className="w-48 border-r border-border p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">{t('patent.label.sections')}</p>
          {PATENT_SECTIONS.map((section) => {
            const Icon = SECTION_ICONS[section] || FileText
            return (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-colors',
                  activeSection === section ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
                {section === 'auto-generate' ? '自動生成' :
                 section === 'prior-art' ? '公知例' :
                 section === 'gap-analysis' ? '差分分析' :
                 section === 'ideas' ? 'アイディア' :
                 section}
              </button>
            )
          })}

          <div className="pt-4 mt-4 border-t border-border space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('patent.label.aiActions')}</p>
            <button onClick={handleGenerateClaims} className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              <Sparkles className="w-4 h-4" />
              {t('patent.ai.generateClaims')}
            </button>
            <button onClick={handleDraftSpec} className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm bg-secondary hover:bg-accent transition-colors">
              <Sparkles className="w-4 h-4" />
              {t('patent.ai.draftSpec')}
            </button>
            <button onClick={handleAnalyzePriorArt} className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm bg-secondary hover:bg-accent transition-colors">
              <Search className="w-4 h-4" />
              {t('patent.ai.analyzePriorArt')}
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* ── Auto Generate Section ── */}
          {activeSection === 'auto-generate' && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                特許自動生成
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">発明の概要</label>
                  <textarea
                    value={inventionDescription}
                    onChange={(e) => setInventionDescription(e.target.value)}
                    placeholder="発明の技術分野、解決する課題、技術的な特徴を詳しく記述してください..."
                    className="w-full min-h-[200px] rounded-md bg-background border border-border p-3 text-sm outline-none focus:border-primary resize-y"
                  />
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">実行モード</label>
                    <div className="flex items-center bg-secondary rounded-md">
                      <button
                        onClick={() => setPipelineMode('auto')}
                        className={cn(
                          'px-3 py-1.5 text-sm rounded-md transition-colors',
                          pipelineMode === 'auto' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                        )}
                      >
                        全自動
                      </button>
                      <button
                        onClick={() => setPipelineMode('semi-auto')}
                        className={cn(
                          'px-3 py-1.5 text-sm rounded-md transition-colors',
                          pipelineMode === 'semi-auto' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                        )}
                      >
                        半自動（ステップ確認）
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">調査対象</label>
                    <div className="flex items-center bg-secondary rounded-md">
                      <button
                        onClick={() => setJurisdiction('JP')}
                        className={cn(
                          'px-3 py-1.5 text-sm rounded-md transition-colors',
                          jurisdiction === 'JP' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                        )}
                      >
                        日本 (JP)
                      </button>
                      <button
                        onClick={() => setJurisdiction('US')}
                        className={cn(
                          'px-3 py-1.5 text-sm rounded-md transition-colors',
                          jurisdiction === 'US' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                        )}
                      >
                        米国 (US)
                      </button>
                      <button
                        onClick={() => setJurisdiction('all')}
                        className={cn(
                          'px-3 py-1.5 text-sm rounded-md transition-colors',
                          jurisdiction === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                        )}
                      >
                        全世界
                      </button>
                    </div>
                  </div>

                  <div className="flex-1" />

                  <button
                    onClick={handleStartPipeline}
                    disabled={pipelineLoading || !inventionDescription.trim() || (currentRun && !['completed', 'failed', 'paused', 'pending'].includes(currentRun.status))}
                    className={cn(
                      'flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-medium transition-colors',
                      'bg-primary text-primary-foreground hover:bg-primary/90',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {pipelineLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    生成開始
                  </button>
                </div>

                {pipelineMode === 'semi-auto' && (
                  <p className="text-xs text-muted-foreground">
                    半自動モードでは、各ステップ完了後に結果を確認・編集してから次のステップに進めます。
                  </p>
                )}
              </div>

              {/* Previous runs */}
              {pipelineRuns.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-medium mb-3">過去の実行履歴</h3>
                  <div className="space-y-2">
                    {pipelineRuns.map((run) => (
                      <div
                        key={run.id}
                        onClick={() => setCurrentRun(run)}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-md border border-border cursor-pointer transition-colors',
                          currentRun?.id === run.id ? 'bg-primary/10 border-primary/30' : 'hover:bg-accent'
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-sm truncate">{run.inventionDescription.slice(0, 80)}...</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(run.createdAt).toLocaleDateString()} - {run.mode === 'auto' ? '全自動' : '半自動'}
                          </p>
                        </div>
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full shrink-0',
                          run.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          run.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          run.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        )}>
                          {run.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Prior Art Section ── */}
          {activeSection === 'prior-art' && (
            <div>
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5" />
                公知例調査結果
              </h2>
              {priorArtPatents.length === 0 ? (
                <div className="text-muted-foreground text-center py-12">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">公知例がまだありません</p>
                  <p className="text-xs mt-1">「自動生成」タブからパイプラインを実行してください</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {priorArtPatents.map((patent) => (
                    <div key={patent.id} className="border border-border rounded-lg p-4 hover:bg-accent/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-primary">{patent.patentNumber || 'N/A'}</span>
                            {patent.jurisdiction && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">{patent.jurisdiction}</span>
                            )}
                            {patent.relevanceScore !== null && (
                              <span className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                patent.relevanceScore >= 70 ? 'bg-red-500/20 text-red-400' :
                                patent.relevanceScore >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
                              )}>
                                {patent.relevanceScore}%
                              </span>
                            )}
                            {patent.category && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{patent.category}</span>
                            )}
                          </div>
                          <h3 className="text-sm font-medium mb-1">{patent.title}</h3>
                          {patent.applicant && (
                            <p className="text-xs text-muted-foreground mb-1">出願人: {patent.applicant}</p>
                          )}
                          {patent.abstract && (
                            <p className="text-xs text-muted-foreground line-clamp-3">{patent.abstract}</p>
                          )}
                          {patent.relevanceNotes && (
                            <p className="text-xs text-muted-foreground mt-2 border-l-2 border-primary/30 pl-2 italic">{patent.relevanceNotes}</p>
                          )}
                        </div>
                        {patent.url && (
                          <a
                            href={patent.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Gap Analysis Section ── */}
          {activeSection === 'gap-analysis' && (
            <div>
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <FlaskConical className="w-5 h-5" />
                差分分析
              </h2>
              {!currentRun?.gapAnalysis ? (
                <div className="text-muted-foreground text-center py-12">
                  <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">差分分析結果がまだありません</p>
                </div>
              ) : (() => {
                const gap = currentRun.gapAnalysis as GapAnalysis
                return (
                  <div className="space-y-6">
                    {/* Overall Assessment */}
                    <div className="border border-border rounded-lg p-4 bg-primary/5">
                      <h3 className="text-sm font-semibold mb-2">総合評価</h3>
                      <p className="text-sm text-muted-foreground">{gap.overallAssessment}</p>
                    </div>

                    {/* Novel Aspects */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        新規性のある要素 ({gap.novelAspects.length})
                      </h3>
                      <div className="space-y-2">
                        {gap.novelAspects.map((aspect, i) => (
                          <div key={i} className="border border-green-500/20 rounded-lg p-3 bg-green-500/5">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">{aspect.aspect}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">{aspect.strength}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{aspect.noveltyReason}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Covered Aspects */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <X className="w-4 h-4 text-red-400" />
                        既存技術でカバーされている要素 ({gap.coveredAspects.length})
                      </h3>
                      <div className="space-y-2">
                        {gap.coveredAspects.map((aspect, i) => (
                          <div key={i} className="border border-red-500/20 rounded-lg p-3 bg-red-500/5">
                            <span className="text-sm font-medium">{aspect.aspect}</span>
                            <p className="text-xs text-muted-foreground mt-1">{aspect.details}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">公知例: {aspect.coveredBy.join(', ')}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Technical Advantages */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3">技術的優位性</h3>
                      <ul className="space-y-1">
                        {gap.technicalAdvantages.map((adv, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                            <span className="text-muted-foreground">{adv}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Concerns */}
                    {gap.patentabilityConcerns.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3">特許性の懸念事項</h3>
                        <div className="space-y-2">
                          {gap.patentabilityConcerns.map((concern, i) => (
                            <div key={i} className="border border-yellow-500/20 rounded-lg p-3 bg-yellow-500/5">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">{concern.concern}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">{concern.severity}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">対策: {concern.mitigation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Ideas Section ── */}
          {activeSection === 'ideas' && (
            <div>
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                アイディア生成
              </h2>
              {!currentRun?.generatedIdeas ? (
                <div className="text-muted-foreground text-center py-12">
                  <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">アイディアがまだ生成されていません</p>
                </div>
              ) : (() => {
                const ideas = currentRun.generatedIdeas as GeneratedIdeas
                return (
                  <div className="space-y-6">
                    {/* Core Novelty */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 text-primary">コア新規性</h3>
                      <div className="space-y-3">
                        {ideas.coreNovelty.map((idea) => (
                          <div key={idea.id} className="border border-primary/20 rounded-lg p-4 bg-primary/5">
                            <h4 className="text-sm font-medium mb-1">{idea.title}</h4>
                            <p className="text-xs text-muted-foreground mb-2">{idea.description}</p>
                            <p className="text-xs"><span className="font-medium">技術的効果:</span> <span className="text-muted-foreground">{idea.technicalEffect}</span></p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {idea.differentiators.map((d, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{d}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Embodiments */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3">具体的実施形態</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {ideas.embodiments.map((idea) => (
                          <div key={idea.id} className="border border-border rounded-lg p-3">
                            <h4 className="text-sm font-medium mb-1">{idea.title}</h4>
                            <p className="text-xs text-muted-foreground">{idea.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Alternatives */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3">代替実装</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {ideas.alternatives.map((idea) => (
                          <div key={idea.id} className="border border-border rounded-lg p-3">
                            <h4 className="text-sm font-medium mb-1">{idea.title}</h4>
                            <p className="text-xs text-muted-foreground">{idea.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Claims Section ── */}
          {activeSection === 'claims' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">{t('patent.label.claimsEditor')}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('patent.button.addClaim')}
                  </button>
                </div>
              </div>

              {/* Create claim form */}
              {showCreate && (
                <div className="mb-4 p-4 rounded-lg border border-border bg-card space-y-2">
                  <textarea
                    value={newClaimText}
                    onChange={(e) => setNewClaimText(e.target.value)}
                    placeholder={t('patent.placeholder.claimText')}
                    className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background resize-y min-h-[80px] outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={newClaimType}
                      onChange={(e) => setNewClaimType(e.target.value as 'independent' | 'dependent')}
                      className="px-3 py-1.5 text-sm rounded-md border border-border bg-background"
                    >
                      <option value="independent">{t('patent.claimType.independent')}</option>
                      <option value="dependent">{t('patent.claimType.dependent')}</option>
                    </select>
                    {newClaimType === 'dependent' && (
                      <select
                        value={newParentClaimId}
                        onChange={(e) => setNewParentClaimId(e.target.value)}
                        className="px-3 py-1.5 text-sm rounded-md border border-border bg-background"
                      >
                        <option value="">{t('patent.placeholder.selectParentClaim')}</option>
                        {independentClaims.map((c) => (
                          <option key={c.id} value={c.id}>{t('patent.label.claim')} {c.claimNumber}</option>
                        ))}
                      </select>
                    )}
                    <button onClick={handleCreateClaim} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm">{t('patent.button.add')}</button>
                    <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 rounded-md bg-secondary text-sm">{t('patent.button.cancel')}</button>
                  </div>
                </div>
              )}

              {claims.length === 0 ? (
                <div className="text-muted-foreground text-center py-8 max-w-xs mx-auto">
                  <p className="text-sm font-medium">{t('patent.empty.noClaims')}</p>
                  <p className="text-xs mt-1">{t('patent.empty.noClaimsDescription')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {independentClaims.map(claim => renderClaim(claim))}
                  {/* Show orphan dependent claims */}
                  {dependentClaims
                    .filter(c => !c.parentClaimId || !claims.find(p => p.id === c.parentClaimId))
                    .map(claim => renderClaim(claim))}
                </div>
              )}
            </div>
          )}

          {/* ── Specification Section ── */}
          {activeSection === 'specification' && (
            <div>
              <h2 className="text-base font-semibold mb-4">
                {template === 'jp-patent' ? t('patent.section.specificationJp') : t('patent.section.specification')}
              </h2>
              <div className="space-y-6">
                {/* Base specification sections */}
                {(template === 'jp-patent' ? JP_SPEC_SECTIONS : US_SPEC_SECTIONS).map((section) => (
                  <div key={section} className="border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      {section}
                      <button onClick={() => handleSectionAi(section)} className="text-primary hover:text-primary/80">
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    </h3>
                    <textarea
                      value={specContents[section] || ''}
                      onChange={(e) => setSpecContents((prev) => ({ ...prev, [section]: e.target.value }))}
                      placeholder={t('patent.placeholder.editOrGenerate')}
                      className="w-full min-h-[100px] rounded-md bg-background border border-border p-3 text-sm outline-none focus:border-blue-500 resize-y"
                    />
                  </div>
                ))}

                {/* ── Claims Display in Specification ── */}
                {claims.length > 0 && (
                  <div className="border-2 border-green-500/30 rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-green-400">
                      <Scale className="w-4 h-4" />
                      {template === 'jp-patent' ? '【特許請求の範囲】' : 'Claims'}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                        {claims.length} {template === 'jp-patent' ? '項' : 'claims'}
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {claims.map((claim) => (
                        <div key={claim.id} className="p-3 rounded-md bg-green-500/5 border border-green-500/10">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold">
                              {template === 'jp-patent' ? `【請求項${claim.claimNumber}】` : `Claim ${claim.claimNumber}`}
                            </span>
                            <span className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                              claim.claimType === 'independent' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                            )}>
                              {claim.claimType === 'independent'
                                ? (template === 'jp-patent' ? '独立項' : 'Independent')
                                : (template === 'jp-patent' ? '従属項' : 'Dependent')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{claim.claimText}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Detailed Embodiments Section ── */}
                {embodiments.length > 0 && (
                  <div className="border-2 border-blue-500/30 rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-blue-400">
                      <BookOpen className="w-4 h-4" />
                      {template === 'jp-patent' ? '【発明を実施するための形態】' : 'Detailed Description of Embodiments'}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                        {embodiments.length} {template === 'jp-patent' ? '実施形態' : 'embodiments'}
                      </span>
                    </h3>

                    <div className="space-y-4">
                      {embodiments.map((emb, embIdx) => {
                        const isExpanded = expandedEmbodiments.has(emb.id)
                        return (
                          <div key={emb.id} className="border border-border rounded-lg overflow-hidden">
                            {/* Embodiment header - clickable to expand/collapse */}
                            <button
                              onClick={() => setExpandedEmbodiments((prev) => {
                                const next = new Set(prev)
                                if (next.has(emb.id)) next.delete(emb.id)
                                else next.add(emb.id)
                                return next
                              })}
                              className="w-full flex items-center gap-2 p-3 hover:bg-accent/50 transition-colors text-left"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                              <span className="text-xs font-mono text-muted-foreground shrink-0">
                                {template === 'jp-patent' ? `実施形態${embIdx + 1}` : `Embodiment ${embIdx + 1}`}
                              </span>
                              <span className="text-sm font-medium truncate">{emb.title}</span>
                              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                                {emb.figures.length > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                                    <ImageIcon className="w-3 h-3 inline mr-0.5" />
                                    {emb.figures.length} {template === 'jp-patent' ? '図' : 'fig'}
                                  </span>
                                )}
                              </div>
                            </button>

                            {/* Expanded content */}
                            {isExpanded && (
                              <div className="border-t border-border">
                                {/* Description text */}
                                <div className="p-4">
                                  <textarea
                                    value={emb.description}
                                    onChange={(e) => {
                                      const newVal = e.target.value
                                      setEmbodiments((prev) => prev.map((em) =>
                                        em.id === emb.id ? { ...em, description: newVal } : em
                                      ))
                                    }}
                                    className="w-full min-h-[200px] rounded-md bg-background border border-border p-3 text-sm outline-none focus:border-blue-500 resize-y leading-relaxed"
                                  />
                                  <div className="mt-1 text-[10px] text-muted-foreground">
                                    {emb.description.length.toLocaleString()} {template === 'jp-patent' ? '文字' : 'chars'}
                                  </div>
                                </div>

                                {/* Inline figures for this embodiment */}
                                {emb.figures.length > 0 && (
                                  <div className="border-t border-border p-4">
                                    <h4 className="text-xs font-semibold mb-3 flex items-center gap-1 text-purple-400">
                                      <ImageIcon className="w-3.5 h-3.5" />
                                      {template === 'jp-patent' ? '【図面】' : 'Figures'}
                                    </h4>
                                    <div className="space-y-4">
                                      {emb.figures.map((fig) => (
                                        <div key={fig.figureNumber} className="border border-border/50 rounded-lg overflow-hidden">
                                          <div className="px-3 py-2 bg-accent/30 flex items-center gap-2">
                                            <span className="text-xs font-semibold">
                                              {template === 'jp-patent' ? `【図${fig.figureNumber}】` : `FIG. ${fig.figureNumber}`}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{fig.label}</span>
                                          </div>
                                          <div className="p-3 text-xs text-muted-foreground mb-2">
                                            {fig.description}
                                          </div>
                                          <div className="p-3 bg-white/5">
                                            <MermaidDiagramComponent
                                              code={fig.mermaidCode}
                                              className="min-h-[150px]"
                                            />
                                          </div>
                                          {/* Editable Mermaid code */}
                                          <details className="border-t border-border/50">
                                            <summary className="px-3 py-1.5 text-[10px] text-muted-foreground cursor-pointer hover:bg-accent/30">
                                              {template === 'jp-patent' ? 'Mermaidコードを編集' : 'Edit Mermaid code'}
                                            </summary>
                                            <div className="p-3">
                                              <textarea
                                                value={fig.mermaidCode}
                                                onChange={(e) => {
                                                  const newCode = e.target.value
                                                  setEmbodiments((prev) => prev.map((em) =>
                                                    em.id === emb.id
                                                      ? {
                                                          ...em,
                                                          figures: em.figures.map((f) =>
                                                            f.figureNumber === fig.figureNumber ? { ...f, mermaidCode: newCode } : f
                                                          )
                                                        }
                                                      : em
                                                  ))
                                                }}
                                                className="w-full min-h-[100px] rounded-md bg-background border border-border p-2 text-xs font-mono outline-none focus:border-blue-500 resize-y"
                                              />
                                            </div>
                                          </details>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Hint when no embodiments yet */}
                {embodiments.length === 0 && currentRun && (
                  <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
                    <BookOpen className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    {template === 'jp-patent'
                      ? 'パイプラインを実行すると、詳細な実施形態と図面が自動生成されます'
                      : 'Run the pipeline to auto-generate detailed embodiments and figures'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Abstract Section ── */}
          {activeSection === 'abstract' && (
            <div>
              <h2 className="text-base font-semibold mb-4">{template === 'jp-patent' ? t('patent.section.abstractJp') : t('patent.section.abstract')}</h2>
              <div className="border border-border rounded-lg p-4">
                <textarea
                  value={abstractContent}
                  onChange={(e) => setAbstractContent(e.target.value)}
                  placeholder={t('patent.placeholder.enterAbstract')}
                  className="w-full min-h-[200px] rounded-md bg-background border border-border p-3 text-sm outline-none focus:border-blue-500 resize-y"
                />
                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                  <span>{abstractContent.trim().split(/\s+/).filter(Boolean).length} / 150 words</span>
                  <button onClick={handleAbstractAi} className="flex items-center gap-1 text-primary hover:text-primary/80">
                    <Sparkles className="w-3 h-3" />
                    {t('patent.ai.generate')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Drawings Section (Enhanced with Mermaid) ── */}
          {activeSection === 'drawings' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">{template === 'jp-patent' ? t('patent.section.drawingsJp') : t('patent.section.drawings')}</h2>
                <button
                  onClick={() => {
                    const newId = `diagram-${Date.now()}`
                    setMermaidCodes((prev) => [...prev, { id: newId, label: `図${prev.length + 1}`, code: 'flowchart TD\n    A[開始] --> B[処理]\n    B --> C[終了]' }])
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  図面追加
                </button>
              </div>

              {mermaidCodes.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-12 flex flex-col items-center justify-center text-muted-foreground">
                  <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">図面がまだありません</p>
                  <p className="text-xs mt-1">「自動生成」を実行するか、手動で追加してください</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {mermaidCodes.map((diagram, index) => (
                    <div key={diagram.id} className="border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-b border-border">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">【図{index + 1}】</span>
                          <input
                            value={diagram.label}
                            onChange={(e) => {
                              setMermaidCodes((prev) => prev.map((d) =>
                                d.id === diagram.id ? { ...d, label: e.target.value } : d
                              ))
                            }}
                            className="text-sm bg-transparent border-none outline-none text-muted-foreground w-48"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (editingDiagramId === diagram.id) {
                                // Save edits
                                setMermaidCodes((prev) => prev.map((d) =>
                                  d.id === diagram.id ? { ...d, code: editingDiagramCode } : d
                                ))
                                setEditingDiagramId(null)
                              } else {
                                setEditingDiagramId(diagram.id)
                                setEditingDiagramCode(diagram.code)
                              }
                            }}
                            className="p-1 rounded hover:bg-accent"
                            title={editingDiagramId === diagram.id ? '保存' : '編集'}
                          >
                            {editingDiagramId === diagram.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Edit3 className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => setMermaidCodes((prev) => prev.filter((d) => d.id !== diagram.id))}
                            className="p-1 rounded hover:bg-accent text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex">
                        {/* Code editor (shown when editing) */}
                        {editingDiagramId === diagram.id && (
                          <div className="w-1/2 border-r border-border">
                            <textarea
                              value={editingDiagramCode}
                              onChange={(e) => setEditingDiagramCode(e.target.value)}
                              className="w-full h-[300px] p-3 text-xs font-mono bg-background resize-none outline-none"
                              spellCheck={false}
                            />
                          </div>
                        )}
                        {/* Preview */}
                        <div className={cn('p-4 bg-white/5', editingDiagramId === diagram.id ? 'w-1/2' : 'w-full')}>
                          <MermaidDiagramComponent
                            code={editingDiagramId === diagram.id ? editingDiagramCode : diagram.code}
                            className="min-h-[200px]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Claim detail / Prior art sidebar */}
        <div className="w-72 border-l border-border p-3 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {selectedClaim ? t('patent.label.claimDetail') : t('patent.label.priorArt')}
            </h3>
          </div>

          {selectedClaim && (() => {
            const claim = claims.find(c => c.id === selectedClaim)
            if (!claim) return null
            return (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('patent.label.status')}</p>
                  <div className="flex flex-wrap gap-1">
                    {(['draft', 'review', 'final', 'filed', 'granted', 'rejected'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleUpdateClaim(claim.id, { status: s })}
                        className={cn(
                          'px-2 py-0.5 text-[10px] rounded-full transition-colors capitalize',
                          claim.status === s
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground hover:bg-accent'
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('patent.label.priorArtNotes')}</p>
                  <textarea
                    value={claim.priorArtNotes || ''}
                    onChange={(e) => {
                      setClaims((prev) => prev.map((c) =>
                        c.id === claim.id ? { ...c, priorArtNotes: e.target.value } : c
                      ))
                    }}
                    onBlur={(e) => handleUpdateClaim(claim.id, { priorArtNotes: e.target.value })}
                    placeholder={t('patent.placeholder.priorArtNotes')}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background resize-y min-h-[80px] outline-none focus:border-blue-500"
                  />
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>{t('patent.label.created')}: {new Date(claim.createdAt).toLocaleDateString()}</p>
                  <p>{t('patent.label.updated')}: {new Date(claim.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
