import type { SkillDefinition } from '../types/skill'
import { DashboardSkill } from './dashboard/DashboardSkill'
import { LiteratureSkill } from './literature/LiteratureSkill'
import { ResearchQuestionSkill } from './research-question/ResearchQuestionSkill'
import { HypothesisSkill } from './hypothesis/HypothesisSkill'
import { ExperimentSkill } from './experiment/ExperimentSkill'
import { AnalysisSkill } from './analysis/AnalysisSkill'
import { ImprovementSkill } from './improvement/ImprovementSkill'
import { CanvasSkill } from './canvas/CanvasSkill'
import { DocumentSkill } from './documents/DocumentSkill'
import { PatentSkill } from './patent/PatentSkill'
import { ReportSkill } from './report/ReportSkill'
import { TimelineSkill } from './timeline/TimelineSkill'
import { DevProcessSkill } from './dev-process/DevProcessSkill'
import { KnowledgeGraphSkill } from './knowledge-graph/KnowledgeGraphSkill'
import { SkillWorkshopSkill } from './skill-workshop/SkillWorkshopSkill'

export const builtinSkills: SkillDefinition[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    nameKey: 'skill.dashboard.name',
    description: 'Project overview, progress, and recent activity',
    descriptionKey: 'skill.dashboard.description',
    icon: 'LayoutDashboard',
    category: 'management',
    order: 0,
    enabled: true,
    systemPrompt: 'You are a research project management assistant. Help users understand their research progress, suggest next steps, and provide project summaries.',
    tools: [],
    component: DashboardSkill
  },
  {
    id: 'literature',
    name: 'Literature Explorer',
    nameKey: 'skill.literature.name',
    description: 'Search papers, citation graphs, systematic review',
    descriptionKey: 'skill.literature.description',
    icon: 'BookOpen',
    category: 'research',
    order: 1,
    enabled: true,
    systemPrompt: 'You are a literature review expert. Help users search for papers, analyze citation networks, identify research gaps, and conduct systematic reviews. Use STORM methodology for multi-perspective question generation.',
    tools: [
      { name: 'search_papers', description: 'Search academic papers across multiple databases', parameters: { type: 'object', properties: { query: { type: 'string' }, source: { type: 'string', enum: ['semantic_scholar', 'crossref', 'arxiv', 'pubmed', 'all'] }, limit: { type: 'number' } }, required: ['query'] } },
      { name: 'summarize_paper', description: 'Generate a concise summary of a paper', parameters: { type: 'object', properties: { title: { type: 'string' }, abstract: { type: 'string' } }, required: ['title', 'abstract'] } },
      { name: 'find_research_gaps', description: 'Identify gaps in the literature based on collected papers', parameters: { type: 'object', properties: { topic: { type: 'string' }, papers: { type: 'array', items: { type: 'string' } } }, required: ['topic'] } }
    ],
    component: LiteratureSkill
  },
  {
    id: 'research-question',
    name: 'Research Question',
    nameKey: 'skill.researchQuestion.name',
    description: 'Formulate research questions using PICO, FINER, SPIDER',
    descriptionKey: 'skill.researchQuestion.description',
    icon: 'HelpCircle',
    category: 'research',
    order: 2,
    enabled: true,
    systemPrompt: 'You are a research methodology expert specializing in research question formulation. Guide users through PICO, FINER, SPIDER, and PEO frameworks. Evaluate research questions for specificity, novelty, and feasibility.',
    tools: [
      { name: 'formulate_rq', description: 'Generate a research question using a specific framework', parameters: { type: 'object', properties: { framework: { type: 'string', enum: ['PICO', 'FINER', 'SPIDER', 'PEO'] }, elements: { type: 'object' } }, required: ['framework', 'elements'] } },
      { name: 'evaluate_rq', description: 'Evaluate a research question for quality', parameters: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] } }
    ],
    component: ResearchQuestionSkill
  },
  {
    id: 'hypothesis',
    name: 'Hypothesis Lab',
    nameKey: 'skill.hypothesis.name',
    description: 'AI-assisted hypothesis generation and evaluation',
    descriptionKey: 'skill.hypothesis.description',
    icon: 'Lightbulb',
    category: 'research',
    order: 3,
    enabled: true,
    systemPrompt: 'You are a research hypothesis expert. Help users generate testable hypotheses from literature and data, formulate null and alternative hypotheses, identify variables, and evaluate hypothesis quality.',
    tools: [
      { name: 'generate_hypotheses', description: 'Generate research hypotheses based on context', parameters: { type: 'object', properties: { context: { type: 'string' }, researchQuestion: { type: 'string' } }, required: ['context'] } },
      { name: 'evaluate_hypothesis', description: 'Evaluate a hypothesis for testability and novelty', parameters: { type: 'object', properties: { hypothesis: { type: 'string' } }, required: ['hypothesis'] } }
    ],
    component: HypothesisSkill
  },
  {
    id: 'experiment',
    name: 'Experiment Designer',
    nameKey: 'skill.experiment.name',
    description: 'Design experiments, protocols, and verification methods',
    descriptionKey: 'skill.experiment.description',
    icon: 'FlaskConical',
    category: 'research',
    order: 4,
    enabled: true,
    systemPrompt: 'You are an experimental design expert. Help users design experiments, select appropriate methodologies, calculate sample sizes, create protocols, and choose statistical tests.',
    tools: [
      { name: 'design_experiment', description: 'Create an experiment design based on hypothesis', parameters: { type: 'object', properties: { hypothesis: { type: 'string' }, type: { type: 'string', enum: ['RCT', 'quasi-experimental', 'observational', 'computational'] } }, required: ['hypothesis'] } },
      { name: 'select_statistical_test', description: 'Recommend appropriate statistical tests', parameters: { type: 'object', properties: { dataType: { type: 'string' }, groups: { type: 'number' }, paired: { type: 'boolean' } }, required: ['dataType'] } }
    ],
    component: ExperimentSkill
  },
  {
    id: 'analysis',
    name: 'Data Analyzer',
    nameKey: 'skill.analysis.name',
    description: 'Import data, statistical analysis, and visualization',
    descriptionKey: 'skill.analysis.description',
    icon: 'BarChart3',
    category: 'analysis',
    order: 5,
    enabled: true,
    systemPrompt: 'You are a data analysis expert. Help users import, clean, and analyze data. Recommend appropriate statistical methods, interpret results, generate visualizations, and write analysis code in Python/R.',
    tools: [
      { name: 'recommend_method', description: 'Recommend statistical analysis methods for given data', parameters: { type: 'object', properties: { description: { type: 'string' }, sampleSize: { type: 'number' }, variables: { type: 'array', items: { type: 'string' } } }, required: ['description'] } },
      { name: 'interpret_results', description: 'Interpret statistical analysis results', parameters: { type: 'object', properties: { test: { type: 'string' }, pValue: { type: 'number' }, effectSize: { type: 'number' } }, required: ['test', 'pValue'] } }
    ],
    component: AnalysisSkill
  },
  {
    id: 'improvement',
    name: 'Improvement Advisor',
    nameKey: 'skill.improvement.name',
    description: 'Research quality review, PDCA tracking, peer review simulation',
    descriptionKey: 'skill.improvement.description',
    icon: 'Sparkles',
    category: 'analysis',
    order: 6,
    enabled: true,
    systemPrompt: 'You are a research quality improvement expert. Review research methodology, assess bias risks, suggest improvements, simulate peer reviews from multiple perspectives, and track PDCA improvement cycles.',
    tools: [
      { name: 'simulate_peer_review', description: 'Simulate a peer review from a specific perspective', parameters: { type: 'object', properties: { content: { type: 'string' }, perspective: { type: 'string', enum: ['methodology', 'domain', 'statistics'] } }, required: ['content', 'perspective'] } },
      { name: 'suggest_improvements', description: 'Analyze research and suggest improvements', parameters: { type: 'object', properties: { area: { type: 'string' }, currentState: { type: 'string' } }, required: ['area', 'currentState'] } }
    ],
    component: ImprovementSkill
  },
  {
    id: 'canvas',
    name: 'Research Canvas',
    nameKey: 'skill.canvas.name',
    description: 'Visual research mapping with React Flow',
    descriptionKey: 'skill.canvas.description',
    icon: 'Workflow',
    category: 'research',
    order: 7,
    enabled: true,
    systemPrompt: 'You are a research visualization expert. Help users organize their research concepts, relationships, and workflow on a visual canvas. Suggest connections between concepts and identify gaps.',
    tools: [],
    component: CanvasSkill
  },
  {
    id: 'documents',
    name: 'Document Studio',
    nameKey: 'skill.documents.name',
    description: 'AI-assisted academic paper writing',
    descriptionKey: 'skill.documents.description',
    icon: 'FileText',
    category: 'writing',
    order: 8,
    enabled: true,
    systemPrompt: 'You are an academic writing expert. Help users draft research papers following IMRAD structure, paraphrase text, improve academic tone, check logical flow, and manage citations. Support IEEE, ACM, APA formats.',
    tools: [
      { name: 'draft_section', description: 'Draft a paper section', parameters: { type: 'object', properties: { section: { type: 'string', enum: ['introduction', 'methods', 'results', 'discussion', 'conclusion', 'abstract'] }, context: { type: 'string' } }, required: ['section', 'context'] } },
      { name: 'academic_tone', description: 'Improve text to academic tone', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } }
    ],
    component: DocumentSkill
  },
  {
    id: 'patent',
    name: 'Patent Studio',
    nameKey: 'skill.patent.name',
    description: 'AI-assisted patent document creation',
    descriptionKey: 'skill.patent.description',
    icon: 'Scale',
    category: 'writing',
    order: 9,
    enabled: true,
    systemPrompt: 'You are a patent drafting expert. Help users structure inventions, generate independent and dependent claims, draft specifications, analyze prior art, and create claim charts. Support both Japanese and US patent formats.',
    tools: [
      { name: 'generate_claims', description: 'Generate patent claims from invention description', parameters: { type: 'object', properties: { invention: { type: 'string' }, type: { type: 'string', enum: ['independent', 'dependent'] } }, required: ['invention'] } },
      { name: 'analyze_prior_art', description: 'Compare invention with prior art', parameters: { type: 'object', properties: { invention: { type: 'string' }, priorArt: { type: 'array', items: { type: 'string' } } }, required: ['invention'] } }
    ],
    component: PatentSkill
  },
  {
    id: 'report',
    name: 'Report Studio',
    nameKey: 'skill.report.name',
    description: 'Progress reports, final reports, grant proposals',
    descriptionKey: 'skill.report.description',
    icon: 'ClipboardList',
    category: 'writing',
    order: 10,
    enabled: true,
    systemPrompt: 'You are a report writing expert. Help users create progress reports, final reports, technical reports, research proposals, and grant applications. Pull data from project context to auto-generate content.',
    tools: [
      { name: 'draft_report', description: 'Generate a report draft', parameters: { type: 'object', properties: { type: { type: 'string', enum: ['progress', 'final', 'technical', 'proposal', 'grant'] }, context: { type: 'string' } }, required: ['type', 'context'] } }
    ],
    component: ReportSkill
  },
  {
    id: 'timeline',
    name: 'Timeline',
    nameKey: 'skill.timeline.name',
    description: 'Gantt chart, milestones, and schedule management',
    descriptionKey: 'skill.timeline.description',
    icon: 'Calendar',
    category: 'management',
    order: 11,
    enabled: true,
    systemPrompt: 'You are a research project scheduling expert. Help users create research timelines, estimate task durations, identify dependencies and critical paths, detect bottlenecks, and manage milestones.',
    tools: [
      { name: 'generate_schedule', description: 'Auto-generate a research schedule', parameters: { type: 'object', properties: { projectDescription: { type: 'string' }, durationWeeks: { type: 'number' } }, required: ['projectDescription'] } },
      { name: 'identify_risks', description: 'Identify schedule risks', parameters: { type: 'object', properties: { tasks: { type: 'array', items: { type: 'string' } } }, required: ['tasks'] } }
    ],
    component: TimelineSkill
  },
  {
    id: 'dev-process',
    name: 'Dev Process',
    nameKey: 'skill.devProcess.name',
    description: 'DSR, Agile, Kanban, WBS, sprint management',
    descriptionKey: 'skill.devProcess.description',
    icon: 'GitBranch',
    category: 'management',
    order: 12,
    enabled: true,
    systemPrompt: 'You are a research development process expert. Help users manage research projects using Design Science Research (DSR), Agile Research, Stage-Gate, and PDCA frameworks. Create WBS, plan sprints, track progress, and assess risks.',
    tools: [
      { name: 'generate_wbs', description: 'Generate a Work Breakdown Structure', parameters: { type: 'object', properties: { projectDescription: { type: 'string' } }, required: ['projectDescription'] } },
      { name: 'recommend_framework', description: 'Recommend a development framework for the project', parameters: { type: 'object', properties: { projectType: { type: 'string' }, teamSize: { type: 'number' } }, required: ['projectType'] } }
    ],
    component: DevProcessSkill
  },
  {
    id: 'knowledge-graph',
    name: 'Knowledge Graph',
    nameKey: 'skill.knowledgeGraph.name',
    description: 'Entity extraction, relation inference, knowledge visualization',
    descriptionKey: 'skill.knowledgeGraph.description',
    icon: 'Network',
    category: 'analysis',
    order: 13,
    enabled: true,
    systemPrompt: 'You are a knowledge graph expert. Help users extract entities and relations from text, build domain knowledge graphs, identify hidden connections, and find knowledge gaps.',
    tools: [
      { name: 'extract_entities', description: 'Extract entities from text', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
      { name: 'infer_relations', description: 'Infer relations between entities', parameters: { type: 'object', properties: { entities: { type: 'array', items: { type: 'string' } } }, required: ['entities'] } }
    ],
    component: KnowledgeGraphSkill
  },
  {
    id: 'skill-workshop',
    name: 'Skill Workshop',
    nameKey: 'skill.skillWorkshop.name',
    description: 'Create, edit, and manage custom skills',
    descriptionKey: 'skill.skillWorkshop.description',
    icon: 'Wrench',
    category: 'custom',
    order: 14,
    enabled: true,
    systemPrompt: 'You are a skill creation assistant. Help users design custom AI skills with system prompts, tool definitions, and UI templates.',
    tools: [],
    component: SkillWorkshopSkill
  }
]
