import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null

const MIGRATION_SQL = `
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived', 'completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Research questions
CREATE TABLE IF NOT EXISTS research_questions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'primary' CHECK(type IN ('primary', 'secondary', 'exploratory')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'investigating', 'answered', 'revised')),
  answer TEXT,
  evidence_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Papers
CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  authors TEXT NOT NULL DEFAULT '[]',
  abstract TEXT,
  doi TEXT,
  url TEXT,
  year INTEGER,
  citation_count INTEGER,
  source TEXT,
  bibtex TEXT,
  notes TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread', 'reading', 'read', 'reviewed', 'archived')),
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  pdf_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Paper relations (citation graph edges)
CREATE TABLE IF NOT EXISTS paper_relations (
  id TEXT PRIMARY KEY,
  source_paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  target_paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'cites' CHECK(relation_type IN ('cites', 'extends', 'contradicts', 'supports', 'related')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Hypotheses
CREATE TABLE IF NOT EXISTS hypotheses (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES research_questions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  null_hypothesis TEXT,
  alt_hypothesis TEXT,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed', 'testing', 'supported', 'rejected', 'revised')),
  evidence TEXT,
  confidence REAL CHECK(confidence BETWEEN 0 AND 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Experiments
CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  hypothesis_id TEXT REFERENCES hypotheses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  methodology TEXT,
  variables TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'in_progress', 'completed', 'failed', 'cancelled')),
  results TEXT,
  conclusion TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Datasets
CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  experiment_id TEXT REFERENCES experiments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  file_type TEXT,
  row_count INTEGER,
  column_names TEXT NOT NULL DEFAULT '[]',
  summary_stats TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Documents (written outputs)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'note' CHECK(type IN ('note', 'paper', 'patent', 'report', 'proposal', 'presentation')),
  content TEXT NOT NULL DEFAULT '',
  template TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'review', 'revision', 'final', 'published')),
  word_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tasks (project management)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'review', 'done', 'blocked')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
  assignee TEXT,
  due_date TEXT,
  start_date TEXT,
  end_date TEXT,
  estimated_hours REAL,
  actual_hours REAL,
  parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Skills (custom AI skills)
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Sparkles',
  category TEXT NOT NULL DEFAULT 'custom',
  system_prompt TEXT NOT NULL,
  tools TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  skill_id TEXT,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  token_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Canvas states (visual workspace)
CREATE TABLE IF NOT EXISTS canvas_states (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Canvas',
  nodes TEXT NOT NULL DEFAULT '[]',
  edges TEXT NOT NULL DEFAULT '[]',
  viewport TEXT NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Improvement cycles (kaizen / PDCA)
CREATE TABLE IF NOT EXISTS improvement_cycles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cycle_type TEXT NOT NULL DEFAULT 'pdca' CHECK(cycle_type IN ('pdca', 'kaizen', 'retrospective')),
  plan TEXT,
  do_actions TEXT,
  check_results TEXT,
  act_improvements TEXT,
  status TEXT NOT NULL DEFAULT 'plan' CHECK(status IN ('plan', 'do', 'check', 'act', 'completed')),
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Peer reviews
CREATE TABLE IF NOT EXISTS peer_reviews (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  reviewer TEXT NOT NULL DEFAULT 'ai',
  review_type TEXT NOT NULL DEFAULT 'general' CHECK(review_type IN ('general', 'methodology', 'statistics', 'writing', 'novelty')),
  overall_score INTEGER CHECK(overall_score BETWEEN 1 AND 10),
  strengths TEXT,
  weaknesses TEXT,
  suggestions TEXT,
  detailed_comments TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Knowledge graph entities
CREATE TABLE IF NOT EXISTS kg_entities (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  properties TEXT NOT NULL DEFAULT '{}',
  source_id TEXT,
  source_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Knowledge graph relations
CREATE TABLE IF NOT EXISTS kg_relations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_entity_id TEXT NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
  target_entity_id TEXT NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  properties TEXT NOT NULL DEFAULT '{}',
  weight REAL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Workflow automation rules
CREATE TABLE IF NOT EXISTS workflow_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  conditions TEXT NOT NULL DEFAULT '{}',
  actions TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sprints (agile-style research sprints)
CREATE TABLE IF NOT EXISTS sprints (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK(status IN ('planning', 'active', 'review', 'completed')),
  start_date TEXT,
  end_date TEXT,
  velocity REAL,
  retrospective TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sprint tasks (join table)
CREATE TABLE IF NOT EXISTS sprint_tasks (
  id TEXT PRIMARY KEY,
  sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  story_points INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(sprint_id, task_id)
);

-- Patent claims
CREATE TABLE IF NOT EXISTS patent_claims (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pipeline_run_id TEXT REFERENCES patent_pipeline_runs(id) ON DELETE SET NULL,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  claim_number INTEGER NOT NULL,
  claim_type TEXT NOT NULL DEFAULT 'independent' CHECK(claim_type IN ('independent', 'dependent')),
  parent_claim_id TEXT REFERENCES patent_claims(id) ON DELETE SET NULL,
  claim_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'review', 'final', 'filed', 'granted', 'rejected')),
  prior_art_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Framework applications (methodological frameworks)
CREATE TABLE IF NOT EXISTS framework_applications (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  framework_name TEXT NOT NULL,
  framework_type TEXT NOT NULL DEFAULT 'analysis' CHECK(framework_type IN ('analysis', 'design', 'evaluation', 'synthesis')),
  configuration TEXT NOT NULL DEFAULT '{}',
  input_data TEXT,
  output_data TEXT,
  status TEXT NOT NULL DEFAULT 'configured' CHECK(status IN ('configured', 'running', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Attachments (files linked to various entities)
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'info' CHECK(type IN ('info', 'success', 'warning', 'error')),
  read INTEGER NOT NULL DEFAULT 0,
  action_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_papers_project ON papers(project_id);
CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers(doi);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_kg_entities_project ON kg_entities(project_id);
CREATE INDEX IF NOT EXISTS idx_kg_relations_source ON kg_relations(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_relations_target ON kg_relations(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_hypotheses_project ON hypotheses(project_id);
CREATE INDEX IF NOT EXISTS idx_experiments_project ON experiments(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_project ON notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_research_questions_project ON research_questions(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_project ON workflow_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_project ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_patent_claims_project ON patent_claims(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);

-- Prior art patents (patent-specific search results)
CREATE TABLE IF NOT EXISTS prior_art_patents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pipeline_run_id TEXT REFERENCES patent_pipeline_runs(id) ON DELETE SET NULL,
  patent_number TEXT,
  title TEXT NOT NULL,
  abstract TEXT,
  applicant TEXT,
  inventors TEXT NOT NULL DEFAULT '[]',
  filing_date TEXT,
  publication_date TEXT,
  jurisdiction TEXT,
  classification_codes TEXT NOT NULL DEFAULT '[]',
  url TEXT,
  source TEXT NOT NULL DEFAULT 'epo',
  relevance_score REAL,
  relevance_notes TEXT,
  key_claims TEXT,
  category TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prior_art_project ON prior_art_patents(project_id);
CREATE INDEX IF NOT EXISTS idx_prior_art_pipeline ON prior_art_patents(pipeline_run_id);

-- Patent pipeline runs (automated patent generation workflow)
CREATE TABLE IF NOT EXISTS patent_pipeline_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','researching','analyzing','generating_ideas','drafting_claims','drafting_spec','generating_diagrams','exporting','completed','failed','paused')),
  mode TEXT NOT NULL DEFAULT 'auto' CHECK(mode IN ('auto', 'semi-auto')),
  invention_description TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'jp-patent',
  jurisdiction TEXT NOT NULL DEFAULT 'all',
  research_results TEXT,
  gap_analysis TEXT,
  generated_ideas TEXT,
  generated_claims TEXT,
  generated_spec TEXT,
  generated_diagrams TEXT,
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 7,
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pipeline_project ON patent_pipeline_runs(project_id);
`

export async function initDatabase(): Promise<void> {
  const dbPath = join(app.getPath('userData'), 'rx.db')

  db = new Database(dbPath)

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run migrations
  db.exec(MIGRATION_SQL)

  // Schema migrations for existing databases
  const columns = db.prepare("PRAGMA table_info(patent_pipeline_runs)").all() as { name: string }[]
  const columnNames = columns.map(c => c.name)
  if (columns.length > 0 && !columnNames.includes('jurisdiction')) {
    db.exec("ALTER TABLE patent_pipeline_runs ADD COLUMN jurisdiction TEXT NOT NULL DEFAULT 'all'")
  }

  const claimColumns = db.prepare("PRAGMA table_info(patent_claims)").all() as { name: string }[]
  const claimColumnNames = claimColumns.map(c => c.name)
  if (claimColumns.length > 0 && !claimColumnNames.includes('pipeline_run_id')) {
    db.exec("ALTER TABLE patent_claims ADD COLUMN pipeline_run_id TEXT REFERENCES patent_pipeline_runs(id) ON DELETE SET NULL")
  }

  console.log(`[database] Initialized at ${dbPath}`)
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('[database] Closed')
  }
}
