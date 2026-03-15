import type { Project, CreateProjectInput, UpdateProjectInput } from './project'
import type { SkillDefinition } from './skill'

// ── Entity types for new IPC channels ─────────────────────────

export interface ResearchQuestion {
  id: string
  projectId: string
  question: string
  type: 'primary' | 'secondary' | 'exploratory'
  status: 'open' | 'investigating' | 'answered' | 'revised'
  answer: string | null
  evidenceSummary: string | null
  createdAt: string
  updatedAt: string
}

export interface Hypothesis {
  id: string
  projectId: string
  questionId: string | null
  title: string
  description: string | null
  nullHypothesis: string | null
  altHypothesis: string | null
  status: 'proposed' | 'testing' | 'supported' | 'rejected' | 'revised'
  evidence: string | null
  confidence: number | null
  createdAt: string
  updatedAt: string
}

export interface Experiment {
  id: string
  projectId: string
  hypothesisId: string | null
  title: string
  description: string | null
  methodology: string | null
  variables: Record<string, unknown>
  status: 'planned' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  results: string | null
  conclusion: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Dataset {
  id: string
  projectId: string
  experimentId: string | null
  name: string
  description: string | null
  filePath: string | null
  fileType: string | null
  rowCount: number | null
  columnNames: string[]
  summaryStats: string | null
  createdAt: string
  updatedAt: string
}

export interface Document {
  id: string
  projectId: string
  title: string
  type: 'note' | 'paper' | 'patent' | 'report' | 'proposal' | 'presentation'
  content: string
  template: string | null
  version: number
  status: 'draft' | 'review' | 'revision' | 'final' | 'published'
  wordCount: number
  createdAt: string
  updatedAt: string
}

export interface CanvasState {
  id: string
  projectId: string
  name: string
  nodes: unknown[]
  edges: unknown[]
  viewport: { x: number; y: number; zoom: number }
  createdAt: string
  updatedAt: string
}

export interface KgEntity {
  id: string
  projectId: string
  name: string
  entityType: string
  properties: Record<string, unknown>
  sourceId: string | null
  sourceType: string | null
  createdAt: string
}

export interface KgRelation {
  id: string
  projectId: string
  sourceEntityId: string
  targetEntityId: string
  relationType: string
  properties: Record<string, unknown>
  weight: number
  createdAt: string
}

export interface ImprovementCycle {
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

export interface PatentClaim {
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

export interface PriorArtPatent {
  id: string
  projectId: string
  pipelineRunId: string | null
  patentNumber: string | null
  title: string
  abstract: string | null
  applicant: string | null
  inventors: string[]
  filingDate: string | null
  publicationDate: string | null
  jurisdiction: string | null
  classificationCodes: string[]
  url: string | null
  source: string
  relevanceScore: number | null
  relevanceNotes: string | null
  keyClaims: string | null
  category: string | null
  createdAt: string
  updatedAt: string
}

export type PipelineStatus = 'pending' | 'researching' | 'analyzing' | 'generating_ideas' | 'drafting_claims' | 'drafting_spec' | 'generating_diagrams' | 'exporting' | 'completed' | 'failed' | 'paused'

export interface PatentPipelineRun {
  id: string
  projectId: string
  status: PipelineStatus
  mode: 'auto' | 'semi-auto'
  inventionDescription: string
  template: string
  jurisdiction: string
  researchResults: unknown
  gapAnalysis: GapAnalysis | null
  generatedIdeas: GeneratedIdeas | null
  generatedClaims: Array<{ claimNumber: number; claimType: string; claimText: string; parentClaimNumber?: number }> | null
  generatedSpec: GeneratedSpecWithEmbodiments | Record<string, string> | null
  generatedDiagrams: MermaidDiagram[] | null
  currentStep: number
  totalSteps: number
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface GapAnalysis {
  coveredAspects: Array<{ aspect: string; coveredBy: string[]; details: string }>
  novelAspects: Array<{ aspect: string; noveltyReason: string; strength: string }>
  technicalAdvantages: string[]
  patentabilityConcerns: Array<{ concern: string; severity: string; mitigation: string }>
  overallAssessment: string
}

export interface GeneratedIdeas {
  coreNovelty: Array<{ id: string; title: string; description: string; technicalEffect: string; differentiators: string[] }>
  embodiments: Array<{ id: string; title: string; description: string; relatedCoreId: string }>
  alternatives: Array<{ id: string; title: string; description: string; relatedCoreId: string }>
}

export interface MermaidDiagram {
  id: string
  label: string
  type: string
  mermaidCode: string
}

/** A single detailed embodiment with its own figures */
export interface PatentEmbodiment {
  id: string
  title: string
  description: string
  figures: Array<{
    figureNumber: number
    label: string
    description: string
    mermaidCode: string
  }>
}

/** Extended spec structure that includes detailed embodiments */
export interface GeneratedSpecWithEmbodiments {
  sections: Record<string, string>
  embodiments: PatentEmbodiment[]
  _abstract?: string
}

export interface PipelineProgressEvent {
  runId: string
  step: number
  status: string
  data?: unknown
  error?: string
}

export interface Sprint {
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

export interface Task {
  id: string
  projectId: string
  sprintId: string | null
  title: string
  description: string | null
  status: string
  priority: string
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

export interface GanttTask {
  id: string
  name: string
  start: string | null
  end: string | null
  progress: number
  dependencies: string[]
  status: string
  priority: string
}

// ── IPC Channel Map ─────────────────────────────────────────

export interface IpcChannelMap {
  // Projects
  'project:list': { args: void; result: Project[] }
  'project:get': { args: string; result: Project | null }
  'project:create': { args: CreateProjectInput; result: Project }
  'project:update': { args: UpdateProjectInput; result: Project }
  'project:delete': { args: string; result: void }

  // LLM
  'llm:chat': { args: LlmChatInput; result: LlmChatResponse }
  'llm:models': { args: void; result: string[] }

  // Literature
  'lit:search': { args: LitSearchInput; result: Paper[] }
  'lit:get-citations': { args: string; result: Paper[] }
  'lit:get-references': { args: string; result: Paper[] }

  // Skills
  'skill:list-custom': { args: void; result: SkillDefinition[] }
  'skill:create': { args: CreateSkillInput; result: SkillDefinition }
  'skill:delete': { args: string; result: void }

  // Settings
  'settings:get': { args: string; result: string | null }
  'settings:set': { args: { key: string; value: string }; result: void }

  // Database (generic)
  'db:query': { args: DbQueryInput; result: unknown[] }
  'db:execute': { args: DbExecuteInput; result: { changes: number } }

  // Files
  'file:open-dialog': { args: FileDialogOptions; result: string[] | null }
  'file:save-dialog': { args: SaveDialogOptions; result: string | null }

  // Research Questions
  'rq:list': { args: { projectId: string }; result: ResearchQuestion[] }
  'rq:create': { args: RQCreateInput; result: ResearchQuestion }
  'rq:update': { args: RQUpdateInput; result: ResearchQuestion }
  'rq:delete': { args: string; result: void }

  // Hypotheses
  'hypothesis:list': { args: { projectId: string }; result: Hypothesis[] }
  'hypothesis:create': { args: HypothesisCreateInput; result: Hypothesis }
  'hypothesis:update': { args: HypothesisUpdateInput; result: Hypothesis }
  'hypothesis:delete': { args: string; result: void }

  // Experiments
  'experiment:list': { args: { projectId: string }; result: Experiment[] }
  'experiment:create': { args: ExperimentCreateInput; result: Experiment }
  'experiment:update': { args: ExperimentUpdateInput; result: Experiment }
  'experiment:delete': { args: string; result: void }

  // Datasets
  'dataset:list': { args: { projectId: string }; result: Dataset[] }
  'dataset:create': { args: DatasetCreateInput; result: Dataset }
  'dataset:update': { args: DatasetUpdateInput; result: Dataset }
  'dataset:delete': { args: string; result: void }
  'dataset:import-csv': { args: { projectId: string; filePath: string; name?: string }; result: Dataset }
  'dataset:compute-stats': { args: string; result: Dataset }
  'dataset:get-data': { args: string; result: { headers: string[]; rows: Record<string, string>[] } }

  // Documents (CRUD)
  'document:list': { args: DocumentListInput; result: Document[] }
  'document:get': { args: string; result: Document | null }
  'document:create': { args: DocumentCreateInput; result: Document }
  'document:update': { args: DocumentUpdateInput; result: Document }
  'document:delete': { args: string; result: void }

  // Document Export
  'doc:export-docx': { args: ExportInput; result: string | null }
  'doc:export-pdf': { args: ExportInput; result: string | null }

  // Canvas
  'canvas:list': { args: { projectId: string }; result: CanvasState[] }
  'canvas:get': { args: string; result: CanvasState | null }
  'canvas:save': { args: CanvasSaveInput; result: CanvasState }
  'canvas:delete': { args: string; result: void }

  // Knowledge Graph
  'kg:list-entities': { args: { projectId: string }; result: KgEntity[] }
  'kg:create-entity': { args: KgEntityCreateInput; result: KgEntity }
  'kg:delete-entity': { args: string; result: void }
  'kg:list-relations': { args: { projectId: string }; result: KgRelation[] }
  'kg:create-relation': { args: KgRelationCreateInput; result: KgRelation }
  'kg:delete-relation': { args: string; result: void }

  // Improvement Cycles
  'improvement:list': { args: { projectId: string }; result: ImprovementCycle[] }
  'improvement:create': { args: ImprovementCreateInput; result: ImprovementCycle }
  'improvement:update': { args: ImprovementUpdateInput; result: ImprovementCycle }
  'improvement:delete': { args: string; result: void }

  // Patent Claims
  'patent:list-claims': { args: { projectId: string; pipelineRunId?: string }; result: PatentClaim[] }
  'patent:create-claim': { args: PatentClaimCreateInput; result: PatentClaim }
  'patent:update-claim': { args: PatentClaimUpdateInput; result: PatentClaim }
  'patent:delete-claim': { args: string; result: void }

  // Patent Search
  'patent-search:search': { args: PatentSearchInput; result: PatentSearchResponse }
  'patent-search:details': { args: string; result: unknown }
  'patent-search:family': { args: string; result: unknown }

  // Prior Art
  'prior-art:list': { args: { projectId: string; pipelineRunId?: string }; result: PriorArtPatent[] }
  'prior-art:create': { args: PriorArtCreateInput; result: PriorArtPatent }
  'prior-art:update': { args: PriorArtUpdateInput; result: PriorArtPatent }
  'prior-art:delete': { args: string; result: void }

  // Patent Pipeline
  'pipeline:create': { args: PipelineCreateInput; result: PatentPipelineRun }
  'pipeline:get': { args: string; result: PatentPipelineRun | null }
  'pipeline:list': { args: { projectId: string }; result: PatentPipelineRun[] }
  'pipeline:start': { args: string; result: { started: boolean } }
  'pipeline:pause': { args: string; result: { paused: boolean } }
  'pipeline:resume': { args: string; result: { resumed: boolean } }
  'pipeline:update': { args: PipelineUpdateInput; result: PatentPipelineRun }

  // Sprints
  'sprint:list': { args: { projectId: string }; result: Sprint[] }
  'sprint:create': { args: SprintCreateInput; result: Sprint }
  'sprint:update': { args: SprintUpdateInput; result: Sprint }
  'sprint:delete': { args: string; result: void }

  // Tasks
  'task:list': { args: TaskListInput; result: Task[] }
  'task:create': { args: TaskCreateInput; result: Task }
  'task:update': { args: TaskUpdateInput; result: Task }
  'task:gantt-data': { args: string; result: GanttTask[] }
}

// ── Input types ─────────────────────────────────────────────

export interface LlmChatInput {
  messages: Array<{ role: string; content: string }>
  systemPrompt: string
  tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>
  model?: string
  stream?: boolean
}

export interface LlmChatResponse {
  content: string
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>
  usage?: { promptTokens: number; completionTokens: number }
}

export interface LitSearchInput {
  query: string
  source?: 'semantic_scholar' | 'crossref' | 'arxiv' | 'pubmed' | 'all'
  limit?: number
  offset?: number
}

export interface Paper {
  id: string
  title: string
  authors: string[]
  abstract: string | null
  doi: string | null
  url: string | null
  year: number | null
  citationCount: number | null
  source: string
}

export interface CreateSkillInput {
  name: string
  description: string
  icon: string
  category: string
  systemPrompt: string
  tools: string // JSON
}

export interface DbQueryInput {
  sql: string
  params?: unknown[]
}

export interface DbExecuteInput {
  sql: string
  params?: unknown[]
}

export interface FileDialogOptions {
  title?: string
  filters?: Array<{ name: string; extensions: string[] }>
  properties?: string[]
}

export interface SaveDialogOptions {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

// Research Questions
export interface RQCreateInput {
  projectId: string
  question: string
  type?: 'primary' | 'secondary' | 'exploratory'
}

export interface RQUpdateInput {
  id: string
  question?: string
  type?: string
  status?: string
  answer?: string
  evidenceSummary?: string
}

// Hypotheses
export interface HypothesisCreateInput {
  projectId: string
  title: string
  description?: string
  questionId?: string
  nullHypothesis?: string
  altHypothesis?: string
  confidence?: number
}

export interface HypothesisUpdateInput {
  id: string
  title?: string
  description?: string
  nullHypothesis?: string
  altHypothesis?: string
  status?: string
  evidence?: string
  confidence?: number
}

// Experiments
export interface ExperimentCreateInput {
  projectId: string
  title: string
  description?: string
  hypothesisId?: string
  methodology?: string
  variables?: Record<string, unknown>
}

export interface ExperimentUpdateInput {
  id: string
  title?: string
  description?: string
  methodology?: string
  variables?: Record<string, unknown>
  status?: string
  results?: string
  conclusion?: string
  startedAt?: string
  completedAt?: string
}

// Datasets
export interface DatasetCreateInput {
  projectId: string
  name: string
  description?: string
  experimentId?: string
  filePath?: string
  fileType?: string
  rowCount?: number
  columnNames?: string[]
}

export interface DatasetUpdateInput {
  id: string
  name?: string
  description?: string
  filePath?: string
  fileType?: string
  rowCount?: number
  columnNames?: string[]
  summaryStats?: string
}

// Documents
export interface DocumentListInput {
  projectId: string
  type?: string
}

export interface DocumentCreateInput {
  projectId: string
  title: string
  type?: 'note' | 'paper' | 'patent' | 'report' | 'proposal' | 'presentation'
  content?: string
  template?: string
}

export interface DocumentUpdateInput {
  id: string
  title?: string
  content?: string
  status?: string
  template?: string
  wordCount?: number
}

export interface ExportInput {
  content: {
    title: string
    authors?: string[]
    date?: string
    abstract?: string
    keywords?: string[]
    sections: Array<{
      heading: string
      level?: number
      body?: string
      subsections?: Array<{ heading: string; level?: number; body?: string }>
    }>
    references?: string[]
  }
  template?: string
  savePath?: string
}

// Canvas
export interface CanvasSaveInput {
  id?: string
  projectId: string
  name?: string
  nodes?: unknown[]
  edges?: unknown[]
  viewport?: { x: number; y: number; zoom: number }
}

// Knowledge Graph
export interface KgEntityCreateInput {
  projectId: string
  name: string
  entityType: string
  properties?: Record<string, unknown>
  sourceId?: string
  sourceType?: string
}

export interface KgRelationCreateInput {
  projectId: string
  sourceEntityId: string
  targetEntityId: string
  relationType: string
  properties?: Record<string, unknown>
  weight?: number
}

// Improvement Cycles
export interface ImprovementCreateInput {
  projectId: string
  title: string
  cycleType?: 'pdca' | 'kaizen' | 'retrospective'
  plan?: string
}

export interface ImprovementUpdateInput {
  id: string
  title?: string
  plan?: string
  doActions?: string
  checkResults?: string
  actImprovements?: string
  status?: string
  startedAt?: string
  completedAt?: string
}

// Patent Claims
export interface PatentClaimCreateInput {
  projectId: string
  claimNumber: number
  claimText: string
  claimType?: 'independent' | 'dependent'
  documentId?: string
  parentClaimId?: string
}

export interface PatentClaimUpdateInput {
  id: string
  claimText?: string
  claimType?: string
  status?: string
  priorArtNotes?: string
  parentClaimId?: string
}

// Sprints
export interface SprintCreateInput {
  projectId: string
  name: string
  goal?: string
  startDate?: string
  endDate?: string
}

export interface SprintUpdateInput {
  id: string
  name?: string
  goal?: string
  status?: string
  startDate?: string
  endDate?: string
  velocity?: number
  retrospective?: string
}

// Tasks
export interface TaskListInput {
  projectId: string
  status?: string
  sprintId?: string
}

export interface TaskCreateInput {
  projectId: string
  title: string
  description?: string
  status?: string
  priority?: string
  assignee?: string
  dueDate?: string
  startDate?: string
  endDate?: string
  estimatedHours?: number
  parentTaskId?: string
  sprintId?: string
}

export interface TaskUpdateInput {
  id: string
  title?: string
  description?: string
  status?: string
  priority?: string
  assignee?: string
  dueDate?: string
  startDate?: string
  endDate?: string
  estimatedHours?: number
  actualHours?: number
  parentTaskId?: string
  sprintId?: string
  sortOrder?: number
}

// Patent Search
export interface PatentSearchInput {
  query: string
  source?: 'epo' | 'uspto' | 'all'
  limit?: number
  offset?: number
  dateFrom?: string
  dateTo?: string
  jurisdiction?: string
}

export interface PatentSearchResponse {
  patents: Array<{
    patentNumber: string
    title: string
    abstract: string | null
    applicant: string | null
    inventors: string[]
    filingDate: string | null
    publicationDate: string | null
    jurisdiction: string | null
    classificationCodes: string[]
    url: string | null
    source: string
  }>
  total: number
}

// Prior Art
export interface PriorArtCreateInput {
  projectId: string
  pipelineRunId?: string
  patentNumber?: string
  title: string
  abstract?: string
  applicant?: string
  inventors?: string[]
  filingDate?: string
  publicationDate?: string
  jurisdiction?: string
  classificationCodes?: string[]
  url?: string
  source?: string
  relevanceScore?: number
  relevanceNotes?: string
  keyClaims?: string
  category?: string
}

export interface PriorArtUpdateInput {
  id: string
  relevanceScore?: number
  relevanceNotes?: string
  keyClaims?: string
  category?: string
  title?: string
  abstract?: string
}

// Pipeline
export interface PipelineCreateInput {
  projectId: string
  inventionDescription: string
  template?: string
  mode?: 'auto' | 'semi-auto'
  jurisdiction?: string
}

export interface PipelineUpdateInput {
  id: string
  gapAnalysis?: unknown
  generatedIdeas?: unknown
  generatedClaims?: unknown
  generatedSpec?: unknown
  generatedDiagrams?: unknown
}
