import { registerProjectHandlers } from './projects'
import { registerLlmHandlers } from './llm'
import { registerLiteratureHandlers } from './literature'
import { registerSkillHandlers } from './skills'
import { registerDbHandlers } from './db'
import { registerFileHandlers } from './files'
import { registerDocumentHandlers } from './documents'
import { registerTaskHandlers } from './tasks'
import { registerSettingsHandlers } from './settings'
import { registerResearchQuestionHandlers } from './research-questions'
import { registerHypothesisHandlers } from './hypotheses'
import { registerExperimentHandlers } from './experiments'
import { registerDatasetHandlers } from './datasets'
import { registerDocumentCrudHandlers } from './documents-crud'
import { registerCanvasHandlers } from './canvas'
import { registerKnowledgeGraphHandlers } from './knowledge-graph'
import { registerImprovementHandlers } from './improvement'
import { registerPatentClaimHandlers } from './patent-claims'
import { registerSprintHandlers } from './sprints'
import { registerPatentSearchHandlers } from './patent-search'
import { registerPriorArtHandlers } from './prior-art'
import { registerPatentPipelineHandlers } from './patent-pipeline'

export function registerAllHandlers(): void {
  registerProjectHandlers()
  registerLlmHandlers()
  registerLiteratureHandlers()
  registerSkillHandlers()
  registerDbHandlers()
  registerFileHandlers()
  registerDocumentHandlers()
  registerTaskHandlers()
  registerSettingsHandlers()
  registerResearchQuestionHandlers()
  registerHypothesisHandlers()
  registerExperimentHandlers()
  registerDatasetHandlers()
  registerDocumentCrudHandlers()
  registerCanvasHandlers()
  registerKnowledgeGraphHandlers()
  registerImprovementHandlers()
  registerPatentClaimHandlers()
  registerSprintHandlers()
  registerPatentSearchHandlers()
  registerPriorArtHandlers()
  registerPatentPipelineHandlers()

  console.log('[ipc] All handlers registered')
}
