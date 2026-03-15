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
  ClipboardList,
  FileText,
  Download,
  Sparkles,
  Plus,
  ChevronRight,
  Clock,
  Target,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Calendar,
  TrendingUp,
  Folder,
  Trash2,
  Save
} from 'lucide-react'

interface Document {
  id: string
  projectId: string
  title: string
  type: 'note' | 'paper' | 'patent' | 'report' | 'proposal' | 'presentation'
  content: string | null
  template: string | null
  version: number
  status: 'draft' | 'review' | 'revision' | 'final' | 'published'
  wordCount: number
  createdAt: string
  updatedAt: string
}

const REPORT_TEMPLATES: Record<string, string[]> = {
  progress: ['Executive Summary', 'Progress Overview', 'Completed Tasks', 'Ongoing Activities', 'Issues & Risks', 'Next Steps', 'Timeline Status'],
  final: ['Abstract', 'Introduction', 'Objectives', 'Methodology', 'Results', 'Discussion', 'Conclusions', 'Recommendations', 'References'],
  technical: ['Summary', 'Introduction', 'Technical Background', 'Design & Implementation', 'Testing & Validation', 'Results', 'Conclusions'],
  proposal: ['Title & Abstract', 'Background & Significance', 'Research Questions', 'Methodology', 'Expected Outcomes', 'Timeline', 'Budget', 'References'],
  grant: ['Project Summary', 'Specific Aims', 'Significance', 'Innovation', 'Approach', 'Timeline & Milestones', 'Budget Justification', 'Personnel']
}

export function ReportSkill({ projectId }: SkillProps) {
  const { toast } = useToast()
  const t = useT()
  const [reports, setReports] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('progress')
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [view, setView] = useState<'create' | 'library'>('create')
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [sectionContents, setSectionContents] = useState<Record<string, string>>({})

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const REPORT_TYPES = [
    { id: 'progress', name: t('report.type.progress'), icon: TrendingUp, description: t('report.type.progressDesc') },
    { id: 'final', name: t('report.type.final'), icon: CheckCircle2, description: t('report.type.finalDesc') },
    { id: 'technical', name: t('report.type.technical'), icon: FileText, description: t('report.type.technicalDesc') },
    { id: 'proposal', name: t('report.type.proposal'), icon: Target, description: t('report.type.proposalDesc') },
    { id: 'grant', name: t('report.type.grant'), icon: BookOpen, description: t('report.type.grantDesc') }
  ] as const

  const loadReports = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await ipcInvoke('document:list', { projectId, type: 'report' })
      setReports(data as Document[])
    } catch {
      toast('error', t('report.toast.loadError'))
    } finally {
      setLoading(false)
    }
  }, [projectId, toast, t])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const handleCreateReport = async () => {
    if (!projectId || !newTitle.trim()) return
    try {
      const created = await ipcInvoke('document:create', {
        projectId,
        title: newTitle.trim(),
        type: 'report',
        template: selectedType
      })
      const newDoc = created as Document
      setReports((prev) => [...prev, newDoc])
      setSelectedReportId(newDoc.id)
      setEditContent(newDoc.content || '')
      setSectionContents(parseSectionContents(newDoc.content || '', newDoc.template))
      setNewTitle('')
      setShowCreate(false)
      setView('library')
      toast('success', t('report.toast.createSuccess'))
    } catch {
      toast('error', t('report.toast.createError'))
    }
  }

  const parseSectionContents = (content: string, template: string | null): Record<string, string> => {
    const templateSections = REPORT_TEMPLATES[template || selectedType] || []
    const result: Record<string, string> = {}
    if (!content) return result
    const lines = content.split('\n')
    let currentSection = ''
    let currentBody: string[] = []
    for (const line of lines) {
      const headingMatch = line.match(/^##\s+(.+)$/)
      if (headingMatch && templateSections.includes(headingMatch[1])) {
        if (currentSection) {
          result[currentSection] = currentBody.join('\n').trim()
        }
        currentSection = headingMatch[1]
        currentBody = []
      } else {
        currentBody.push(line)
      }
    }
    if (currentSection) {
      result[currentSection] = currentBody.join('\n').trim()
    }
    return result
  }

  const aggregateSectionContents = (contents: Record<string, string>, template: string | null): string => {
    const templateSections = REPORT_TEMPLATES[template || selectedType] || []
    return templateSections
      .filter((s) => contents[s]?.trim())
      .map((s) => `## ${s}\n\n${contents[s].trim()}`)
      .join('\n\n')
  }

  const handleSelectReport = async (id: string) => {
    setSelectedReportId(id)
    try {
      const doc = await ipcInvoke('document:get', id)
      if (doc) {
        const d = doc as Document
        setEditContent(d.content || '')
        setSectionContents(parseSectionContents(d.content || '', d.template))
        if (d.template && REPORT_TEMPLATES[d.template]) {
          setSelectedType(d.template)
        }
      }
    } catch {
      toast('error', t('report.toast.getError'))
    }
  }

  const handleSave = async () => {
    if (!selectedReportId) return
    const selectedReport = reports.find((r) => r.id === selectedReportId)
    const content = aggregateSectionContents(sectionContents, selectedReport?.template || null)
    try {
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length
      const updated = await ipcInvoke('document:update', {
        id: selectedReportId,
        content,
        wordCount
      })
      setEditContent(content)
      setReports((prev) => prev.map((r) => (r.id === selectedReportId ? (updated as Document) : r)))
      toast('success', t('report.toast.saveSuccess'))
    } catch {
      toast('error', t('report.toast.saveError'))
    }
  }

  const handleAiDraft = async (sectionName: string) => {
    const selectedReport = reports.find((r) => r.id === selectedReportId)
    const title = selectedReport?.title || 'Untitled'
    const prompt = `You are a research report writing assistant. Draft the '${sectionName}' section for a ${selectedType} report titled '${title}'. Write in academic style. Return only the section content.`
    const systemPrompt = 'You are an expert academic research report writing assistant. Help researchers write clear, well-structured report sections.'
    useUiStore.getState().setChatPanelOpen(true)
    await useChatStore.getState().sendMessage(prompt, systemPrompt)
  }

  const handleAutoGenerate = async () => {
    const selectedReport = reports.find((r) => r.id === selectedReportId)
    const title = selectedReport?.title || 'Untitled'
    const sectionList = sections.map((s, i) => `${i + 1}. ${s}`).join('\n')
    const prompt = `You are a research report writing assistant. Generate all sections for a ${selectedType} report titled '${title}'. The sections are:\n${sectionList}\n\nFor each section, write the heading as "## Section Name" followed by the content. Write in academic style.`
    const systemPrompt = 'You are an expert academic research report writing assistant. Help researchers write clear, well-structured reports.'
    useUiStore.getState().setChatPanelOpen(true)
    await useChatStore.getState().sendMessage(prompt, systemPrompt)
  }

  const handleExport = async (format: 'docx' | 'pdf') => {
    const selectedReport = reports.find((r) => r.id === selectedReportId)
    if (!selectedReport) {
      toast('error', t('report.toast.exportError'))
      return
    }
    const exportSections = sections
      .filter((s) => sectionContents[s]?.trim())
      .map((s) => ({ heading: s, body: sectionContents[s].trim() }))
    if (exportSections.length === 0) {
      toast('error', t('report.toast.exportError'))
      return
    }
    try {
      const channel = format === 'docx' ? 'doc:export-docx' : 'doc:export-pdf'
      const result = await ipcInvoke(channel as 'doc:export-docx', {
        content: {
          title: selectedReport.title,
          date: new Date().toISOString().slice(0, 10),
          sections: exportSections
        },
        template: selectedReport.template || selectedType
      })
      if (result) {
        toast('success', t('report.toast.exportSuccess'))
      }
    } catch {
      toast('error', t('report.toast.exportError'))
    }
  }

  const updateSectionContent = (section: string, value: string) => {
    setSectionContents((prev) => ({ ...prev, [section]: value }))
  }

  const getSectionWordCount = (section: string): number => {
    const text = sectionContents[section]?.trim()
    if (!text) return 0
    return text.split(/\s+/).filter(Boolean).length
  }

  const handleDelete = async (id: string) => {
    try {
      await ipcInvoke('document:delete', id)
      setReports((prev) => prev.filter((r) => r.id !== id))
      if (selectedReportId === id) {
        setSelectedReportId(null)
        setEditContent('')
        setSectionContents({})
      }
      toast('success', t('report.toast.deleteSuccess'))
    } catch {
      toast('error', t('report.toast.deleteError'))
    }
  }

  if (!projectId) {
    return <EmptyState icon={ClipboardList} title={t('common.selectProject')} description={t('common.selectProjectDesc')} />
  }

  if (loading) {
    return <LoadingState message={t('report.loading.reports')} />
  }

  const sections = REPORT_TEMPLATES[selectedType]
  const selectedTypeInfo = REPORT_TYPES.find(rt => rt.id === selectedType)!

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">{t('report.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary rounded-md">
            <button
              onClick={() => setView('create')}
              className={cn('px-3 py-1.5 text-sm rounded-md transition-colors', view === 'create' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {t('report.button.create')}
            </button>
            <button
              onClick={() => setView('library')}
              className={cn('px-3 py-1.5 text-sm rounded-md transition-colors', view === 'library' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {t('report.button.library')}
            </button>
          </div>
          {selectedReportId && (
            <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-sm">
              <Save className="w-3.5 h-3.5" />
              {t('report.button.save') || 'Save'}
            </button>
          )}
          <button
            onClick={() => handleExport('docx')}
            disabled={!selectedReportId}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            {t('report.button.export')}
          </button>
        </div>
      </div>

      {view === 'create' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Report type selector */}
          <div className="w-56 border-r border-border p-3 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">{t('report.section.reportType')}</p>
            <div className="space-y-1">
              {REPORT_TYPES.map((type) => {
                const Icon = type.icon
                return (
                  <button
                    key={type.id}
                    onClick={() => { setSelectedType(type.id); setActiveSection(null) }}
                    className={cn(
                      'flex items-start gap-2.5 w-full p-2.5 rounded-md text-left transition-colors',
                      selectedType === type.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{type.name}</p>
                      <p className="text-[11px] text-muted-foreground">{type.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('report.button.createReport')}
              </button>
              <button
                onClick={handleAutoGenerate}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors mt-2"
              >
                <Sparkles className="w-4 h-4" />
                {t('report.button.autoGenerate')}
              </button>
              <p className="text-[10px] text-muted-foreground mt-2 px-1">
                {t('report.text.generateHint')}
              </p>
            </div>
          </div>

          {/* Section navigation + Editor */}
          <div className="flex-1 flex overflow-hidden">
            {/* Section list */}
            <div className="w-52 border-r border-border p-3 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('report.section.sections')}</p>
              </div>
              <div className="space-y-0.5">
                {sections.map((section, idx) => (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section)}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-colors',
                      activeSection === section ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                    {section}
                  </button>
                ))}
              </div>
            </div>

            {/* Editor area */}
            <div className="flex-1 p-6 overflow-y-auto">
              {/* Create form */}
              {showCreate && (
                <div className="mb-6 p-4 rounded-lg border border-border bg-card space-y-2">
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={t('report.placeholder.title')}
                    className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleCreateReport} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground">{t('common.create')}</button>
                    <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs rounded-md bg-secondary">{t('common.cancel')}</button>
                  </div>
                </div>
              )}

              {activeSection ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">{activeSection}</h2>
                    <button
                      onClick={() => handleAiDraft(activeSection)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm hover:bg-primary/20"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {t('report.button.aiDraft')}
                    </button>
                  </div>
                  <div className="min-h-[400px] rounded-lg border border-border p-4">
                    <textarea
                      value={sectionContents[activeSection] || ''}
                      onChange={(e) => updateSectionContent(activeSection, e.target.value)}
                      placeholder={t('report.placeholder.sectionContent')}
                      className="w-full text-sm min-h-[300px] bg-transparent resize-none focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>{getSectionWordCount(activeSection)} {t('report.text.words')}</span>
                    <div className="flex gap-3">
                      <button className="hover:text-foreground">{t('report.button.insertChart')}</button>
                      <button className="hover:text-foreground">{t('report.button.insertTable')}</button>
                      <button className="hover:text-foreground">{t('report.button.insertCitation')}</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <selectedTypeInfo.icon className="w-12 h-12 mb-4 opacity-30" />
                  <h3 className="text-lg font-medium mb-1">{selectedTypeInfo.name}</h3>
                  <p className="text-sm mb-6">{sections.length} {t('report.text.sections')}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setActiveSection(sections[0])}
                      className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
                    >
                      <FileText className="w-4 h-4" />
                      {t('report.button.startWriting')}
                    </button>
                    <button
                      onClick={handleAutoGenerate}
                      className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm hover:bg-accent"
                    >
                      <Sparkles className="w-4 h-4" />
                      {t('report.button.aiGenerateAll')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Library view */
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold">{t('report.section.reportLibrary')}</h2>
            <button
              onClick={() => { setView('create'); setShowCreate(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('report.button.newReport')}
            </button>
          </div>
          {reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">{t('report.empty.noReports')}</p>
              <p className="text-xs mt-1 max-w-xs mx-auto">{t('report.empty.noReportsDescription')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <div key={report.id} className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors">
                  <Folder className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1" onClick={() => handleSelectReport(report.id)}>
                    <p className="text-sm font-medium">{report.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{report.createdAt.slice(0, 10)}</span>
                      <span>{report.template || 'report'}</span>
                      <span>{report.wordCount} {t('report.text.words')}</span>
                    </div>
                  </div>
                  <span className={cn(
                    'text-xs px-2 py-1 rounded-full',
                    report.status === 'final' || report.status === 'published' ? 'bg-green-500/20 text-green-400' :
                    report.status === 'review' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  )}>
                    {report.status}
                  </span>
                  <button
                    onClick={() => handleDelete(report.id)}
                    className="p-1 rounded hover:bg-accent text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
