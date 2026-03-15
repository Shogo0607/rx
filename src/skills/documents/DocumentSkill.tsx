import { useState, useCallback, useEffect, useRef } from 'react'
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
  FileText,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Image,
  Table,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Download,
  FileType,
  Undo,
  Redo,
  ChevronRight,
  Hash,
  PenTool,
  RefreshCw,
  GraduationCap,
  CheckCircle2,
  FileDown,
  Subscript,
  Superscript,
  Plus,
  Trash2
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

const TEMPLATES = ['IEEE', 'ACM', 'IMRAD', 'APA'] as const

export function DocumentSkill({ projectId }: SkillProps) {
  const { toast } = useToast()
  const t = useT()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('IEEE')
  const [showExport, setShowExport] = useState(false)
  const [editContent, setEditContent] = useState<string>('')

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<Document['type']>('paper')

  const EXPORT_FORMATS = [
    { id: 'docx', label: t('document.export.word'), icon: FileDown },
    { id: 'pdf', label: t('document.export.pdf'), icon: FileDown },
    { id: 'latex', label: t('document.export.latex'), icon: FileType },
    { id: 'markdown', label: t('document.export.markdown'), icon: FileText }
  ]

  const AI_ACTIONS = [
    { id: 'draft', label: t('document.ai.draftSection'), icon: PenTool, description: t('document.ai.draftSectionDesc') },
    { id: 'paraphrase', label: t('document.ai.paraphrase'), icon: RefreshCw, description: t('document.ai.paraphraseDesc') },
    { id: 'academic', label: t('document.ai.academicTone'), icon: GraduationCap, description: t('document.ai.academicToneDesc') },
    { id: 'logic', label: t('document.ai.checkLogic'), icon: CheckCircle2, description: t('document.ai.checkLogicDesc') }
  ]

  const loadDocuments = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await ipcInvoke('document:list', { projectId })
      setDocuments(data as Document[])
      if ((data as Document[]).length > 0 && !selectedDocId) {
        const firstDoc = (data as Document[])[0]
        setSelectedDocId(firstDoc.id)
        setEditContent(firstDoc.content || '')
      }
    } catch {
      toast('error', t('document.toast.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [projectId, toast, selectedDocId, t])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const handleSelectDoc = async (docId: string) => {
    setSelectedDocId(docId)
    try {
      const doc = await ipcInvoke('document:get', docId)
      if (doc) {
        setEditContent((doc as Document).content || '')
      }
    } catch {
      toast('error', t('document.toast.getFailed'))
    }
  }

  const handleCreate = async () => {
    if (!projectId || !newTitle.trim()) return
    try {
      const created = await ipcInvoke('document:create', {
        projectId,
        title: newTitle.trim(),
        type: newType,
        template: selectedTemplate
      })
      setDocuments((prev) => [...prev, created as Document])
      setSelectedDocId((created as Document).id)
      setEditContent((created as Document).content || '')
      setNewTitle('')
      setShowCreate(false)
      toast('success', t('document.toast.createSuccess'))
    } catch {
      toast('error', t('document.toast.createFailed'))
    }
  }

  const handleSave = async () => {
    if (!selectedDocId) return
    try {
      const wordCount = editContent.trim().split(/\s+/).filter(Boolean).length
      const updated = await ipcInvoke('document:update', {
        id: selectedDocId,
        content: editContent,
        wordCount
      })
      setDocuments((prev) => prev.map((d) => (d.id === selectedDocId ? (updated as Document) : d)))
      toast('success', t('document.toast.saveSuccess'))
    } catch {
      toast('error', t('document.toast.saveFailed'))
    }
  }

  const handleExport = async (format: string) => {
    if (!selectedDoc) return
    setShowExport(false)

    if (format === 'docx' || format === 'pdf') {
      try {
        // Parse content into sections by splitting on headings
        const lines = editContent.split('\n')
        const sections: { heading: string; level?: number; body?: string }[] = []
        let currentBody = ''

        for (const line of lines) {
          const trimmed = line.trim()
          // Detect heading-like lines (all caps, or short lines followed by content)
          if (trimmed.length > 0 && trimmed.length < 80 && !trimmed.includes('.') && trimmed === trimmed.replace(/[a-z]/g, '').trim()) {
            if (currentBody || sections.length > 0) {
              if (sections.length > 0) {
                sections[sections.length - 1].body = currentBody.trim()
              }
              currentBody = ''
            }
            sections.push({ heading: trimmed, level: 1 })
          } else {
            currentBody += line + '\n'
          }
        }
        // Handle remaining content
        if (sections.length > 0) {
          sections[sections.length - 1].body = currentBody.trim()
        } else {
          sections.push({ heading: selectedDoc.title, level: 1, body: editContent })
        }

        const templateMap: Record<string, string> = {
          'IMRAD': 'paper-imrad',
          'IEEE': 'paper-imrad',
          'ACM': 'paper-imrad',
          'APA': 'paper-imrad'
        }

        const channel = format === 'docx' ? 'doc:export-docx' : 'doc:export-pdf'
        const result = await ipcInvoke(channel as 'doc:export-docx', {
          content: {
            title: selectedDoc.title,
            date: new Date().toISOString().slice(0, 10),
            sections
          },
          template: templateMap[selectedDoc.template || selectedTemplate]
        })

        if (result) {
          toast('success', t('document.toast.exportSuccess'))
        }
      } catch {
        toast('error', t('document.toast.exportFailed'))
      }
    } else if (format === 'markdown') {
      await navigator.clipboard.writeText(editContent)
      toast('success', t('document.toast.copiedMarkdown'))
    }
  }

  const handleAiAction = async (actionId: string) => {
    if (!selectedDoc || !editContent.trim()) {
      toast('warning', t('document.toast.noContent'))
      return
    }

    const prompts: Record<string, string> = {
      draft: `You are an academic writing assistant. Draft the next section for this document titled "${selectedDoc.title}". Current content:\n\n${editContent.slice(0, 2000)}`,
      paraphrase: `Paraphrase the following text to improve clarity while maintaining the original meaning:\n\n${editContent.slice(0, 2000)}`,
      academic: `Rewrite the following text in formal academic tone suitable for a research paper:\n\n${editContent.slice(0, 2000)}`,
      logic: `Review the following academic text for logical consistency, argument flow, and potential issues. Provide specific suggestions:\n\n${editContent.slice(0, 2000)}`
    }

    const systemPrompt = 'You are an expert academic writing assistant. Help researchers write clear, well-structured academic papers.'

    useUiStore.getState().setChatPanelOpen(true)
    await useChatStore.getState().sendMessage(prompts[actionId], systemPrompt)
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
  }

  const handleDelete = async (id: string) => {
    try {
      await ipcInvoke('document:delete', id)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
      if (selectedDocId === id) {
        const remaining = documents.filter((d) => d.id !== id)
        setSelectedDocId(remaining.length > 0 ? remaining[0].id : null)
        setEditContent(remaining.length > 0 ? remaining[0].content || '' : '')
      }
      toast('success', t('document.toast.deleteSuccess'))
    } catch {
      toast('error', t('document.toast.deleteFailed'))
    }
  }

  if (!projectId) {
    return <EmptyState icon={FileText} title={t('document.empty.selectProject')} description={t('document.empty.selectProjectDesc')} />
  }

  if (loading) {
    return <LoadingState message={t('document.loading.documents')} />
  }

  const selectedDoc = documents.find((d) => d.id === selectedDocId)
  const totalWords = selectedDoc?.wordCount ?? editContent.trim().split(/\s+/).filter(Boolean).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t('document.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Template Selector */}
          <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5">
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl}
                onClick={() => setSelectedTemplate(tmpl)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                  selectedTemplate === tmpl
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-muted-foreground'
                )}
              >
                {tmpl}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('document.button.new')}
          </button>

          {/* Export */}
          <div className="relative">
            <button
              onClick={() => setShowExport(!showExport)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {t('document.button.export')}
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-popover shadow-lg z-20 py-1">
                {EXPORT_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => handleExport(f.id)}
                  >
                    <f.icon className="w-4 h-4 text-muted-foreground" />
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-6 py-3 border-b border-border bg-card space-y-2">
          <div className="flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('document.placeholder.title')}
              className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background outline-none focus:border-blue-500"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as Document['type'])}
              className="px-3 py-1.5 text-sm rounded-md border border-border bg-background"
            >
              <option value="paper">{t('document.type.paper')}</option>
              <option value="note">{t('document.type.note')}</option>
              <option value="report">{t('document.type.report')}</option>
              <option value="proposal">{t('document.type.proposal')}</option>
              <option value="patent">{t('document.type.patent')}</option>
              <option value="presentation">{t('document.type.presentation')}</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground">{t('document.button.create')}</button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs rounded-md bg-secondary">{t('document.button.cancel')}</button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Section Navigation Sidebar */}
        <div className="w-56 border-r border-border overflow-y-auto p-3">
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            {t('document.label.documents')}
          </h3>
          <div className="space-y-0.5">
            {documents.length === 0 ? (
              <div className="px-2 py-2 text-muted-foreground">
                <p className="text-xs font-medium">{t('document.empty.noDocuments')}</p>
                <p className="text-[11px] mt-1">{t('document.empty.noDocumentsDescription')}</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-1">
                  <button
                    onClick={() => handleSelectDoc(doc.id)}
                    className={cn(
                      'flex-1 flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors',
                      selectedDocId === doc.id
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent/50'
                    )}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <ChevronRight className={cn(
                        'w-3 h-3 transition-transform shrink-0',
                        selectedDocId === doc.id && 'rotate-90'
                      )} />
                      <span className="truncate">{doc.title}</span>
                    </span>
                    <span className={cn(
                      'text-[10px] font-medium shrink-0',
                      doc.wordCount > 0 ? 'text-emerald-500' : 'text-muted-foreground/40'
                    )}>
                      {doc.wordCount > 0 ? doc.wordCount : '--'}
                    </span>
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1 rounded hover:bg-accent text-destructive shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Stats */}
          {selectedDoc && (
            <div className="mt-6 p-3 rounded-lg bg-muted">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {t('document.label.documentStats')}
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('document.stat.words')}</span>
                  <span className="font-medium">{totalWords.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('document.stat.type')}</span>
                  <span className="font-medium capitalize">{selectedDoc.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('document.stat.status')}</span>
                  <span className="font-medium capitalize">{selectedDoc.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('document.stat.template')}</span>
                  <span className="font-medium">{selectedDoc.template || selectedTemplate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('document.stat.version')}</span>
                  <span className="font-medium">{selectedDoc.version}</span>
                </div>
              </div>
            </div>
          )}

          {/* AI Actions */}
          <div className="mt-4">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              {t('document.label.aiAssist')}
            </h4>
            <div className="space-y-1">
              {AI_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-xs font-medium hover:bg-accent transition-colors"
                  title={action.description}
                  onClick={() => handleAiAction(action.id)}
                >
                  <action.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  {action.label}
                  <Sparkles className="w-3 h-3 text-blue-500 ml-auto" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedDoc ? (
            <>
              {/* Formatting Toolbar */}
              <div className="flex items-center gap-0.5 px-4 py-2 border-b border-border flex-wrap">
                <button className="p-1.5 rounded hover:bg-accent transition-colors" title={t('document.toolbar.undo')} onClick={() => execCommand('undo')}>
                  <Undo className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors" title={t('document.toolbar.redo')} onClick={() => execCommand('redo')}>
                  <Redo className="w-4 h-4 text-muted-foreground" />
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('formatBlock', 'h1')}>
                  <Heading1 className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('formatBlock', 'h2')}>
                  <Heading2 className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('formatBlock', 'h3')}>
                  <Heading3 className="w-4 h-4 text-muted-foreground" />
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('bold')}>
                  <Bold className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('italic')}>
                  <Italic className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('underline')}>
                  <Underline className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('strikeThrough')}>
                  <Strikethrough className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('subscript')}>
                  <Subscript className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('superscript')}>
                  <Superscript className="w-4 h-4 text-muted-foreground" />
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('insertUnorderedList')}>
                  <List className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('insertOrderedList')}>
                  <ListOrdered className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('formatBlock', 'blockquote')}>
                  <Quote className="w-4 h-4 text-muted-foreground" />
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('justifyLeft')}>
                  <AlignLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('justifyCenter')}>
                  <AlignCenter className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('justifyRight')}>
                  <AlignRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => { const url = prompt('URL:'); if (url) execCommand('createLink', url) }}>
                  <Link className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors">
                  <Image className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('insertHTML', '<table border="1"><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></table>')}>
                  <Table className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded hover:bg-accent transition-colors" onClick={() => execCommand('formatBlock', 'pre')}>
                  <Code className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Editor Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-12 py-8">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none min-h-[400px] focus:outline-none"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setEditContent(e.currentTarget.innerText)}
                    dangerouslySetInnerHTML={{ __html: editContent || `<p>${t('document.placeholder.startWriting')}</p>` }}
                  />
                </div>
              </div>

              {/* Status Bar */}
              <div className="flex items-center justify-between px-4 py-1.5 border-t border-border text-[10px] text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>{t('document.statusBar.document')}: {selectedDoc.title}</span>
                  <span>{totalWords.toLocaleString()} {t('document.statusBar.words')}</span>
                  <span className="capitalize">{selectedDoc.status}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span>{selectedDoc.template || selectedTemplate} {t('document.statusBar.template')}</span>
                  <button onClick={handleSave} className="text-primary hover:text-primary/80 font-medium">{t('document.button.save')}</button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={FileText}
              title={t('document.empty.selectDocument')}
              description={t('document.empty.selectDocumentDesc')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
