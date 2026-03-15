import { llmService } from '../services/openai'

// --- Agent Role Definitions ---

interface AgentRole {
  name: string
  description: string
  systemPrompt: string
  capabilities: string[]
}

const AGENT_ROLES: Record<string, AgentRole> = {
  researcher: {
    name: 'Researcher',
    description: 'Searches and analyzes academic literature, identifies key findings and gaps',
    systemPrompt: `You are a Research Agent specializing in academic literature analysis.

Your responsibilities:
- Search and analyze academic papers across multiple databases
- Identify key findings, methodologies, and research gaps
- Synthesize information from multiple sources
- Provide evidence-based summaries with proper citations
- Suggest related papers and research directions

Always cite specific papers when making claims. Be thorough but concise.
Use structured output with clear sections for findings, methodology notes, and gaps identified.`,
    capabilities: ['literature_search', 'paper_analysis', 'gap_identification', 'citation_mapping']
  },

  analyst: {
    name: 'Analyst',
    description: 'Performs statistical analysis, data interpretation, and visualization planning',
    systemPrompt: `You are a Data Analysis Agent specializing in research data analysis.

Your responsibilities:
- Plan and execute statistical analyses appropriate for the data and research question
- Interpret results in the context of the research hypothesis
- Identify potential confounds and limitations
- Suggest appropriate visualizations for findings
- Verify statistical assumptions are met

Always specify:
1. The test used and why it's appropriate
2. Key assumptions checked
3. Effect sizes alongside p-values
4. Practical significance, not just statistical significance
5. Limitations of the analysis`,
    capabilities: ['descriptive_stats', 'hypothesis_testing', 'correlation', 'regression', 'visualization_planning']
  },

  writer: {
    name: 'Writer',
    description: 'Drafts and refines academic documents, papers, patents, and reports',
    systemPrompt: `You are an Academic Writing Agent specializing in scientific and technical writing.

Your responsibilities:
- Draft sections of academic papers following standard formats (IMRAD, etc.)
- Write clear, precise, and well-structured prose
- Maintain consistent academic tone and style
- Integrate citations properly
- Adapt writing to different document types (papers, patents, reports, proposals)

Guidelines:
- Use active voice where appropriate
- Be concise but thorough
- Define technical terms on first use
- Ensure logical flow between paragraphs and sections
- Follow the specified template format strictly`,
    capabilities: ['paper_drafting', 'patent_writing', 'report_writing', 'editing', 'formatting']
  },

  reviewer: {
    name: 'Reviewer',
    description: 'Reviews documents for quality, methodology, and provides constructive feedback',
    systemPrompt: `You are a Peer Review Agent simulating expert academic review.

Your responsibilities:
- Evaluate research methodology for rigor and appropriateness
- Assess statistical analyses for correctness
- Check logical consistency of arguments
- Identify strengths and weaknesses
- Provide constructive, specific suggestions for improvement
- Rate on standard review criteria (novelty, significance, clarity, methodology)

Review structure:
1. Summary of the work
2. Major strengths (2-3 points)
3. Major weaknesses (2-3 points)
4. Minor issues (itemized)
5. Specific suggestions for improvement
6. Overall assessment and confidence level`,
    capabilities: ['methodology_review', 'statistics_review', 'writing_review', 'novelty_assessment']
  },

  planner: {
    name: 'Planner',
    description: 'Creates research plans, task breakdowns, and project timelines',
    systemPrompt: `You are a Research Planning Agent specializing in project management for research.

Your responsibilities:
- Break down research goals into actionable tasks
- Create realistic timelines and milestones
- Identify dependencies between tasks
- Suggest resource allocation
- Plan experimental designs
- Monitor progress and suggest adjustments

Output format:
- Clear task hierarchy with parent-child relationships
- Time estimates for each task
- Dependencies between tasks
- Priority levels (critical path items highlighted)
- Risk factors and mitigation strategies`,
    capabilities: ['task_planning', 'timeline_creation', 'risk_assessment', 'resource_planning', 'sprint_planning']
  }
}

// --- Workflow Task Types ---

interface WorkflowTask {
  type: string
  description: string
  context?: Record<string, unknown>
  projectId?: string
}

interface WorkflowStep {
  agent: string
  action: string
  input: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  output?: string
  error?: string
}

interface WorkflowResult {
  taskType: string
  steps: WorkflowStep[]
  finalOutput: string
  success: boolean
}

type ProgressCallback = (step: WorkflowStep, stepIndex: number, totalSteps: number) => void

// --- Orchestrator ---

export class AgentOrchestrator {
  /**
   * Route a task to the appropriate agent(s) and execute the workflow
   */
  async runWorkflow(
    task: WorkflowTask,
    onProgress?: ProgressCallback
  ): Promise<WorkflowResult> {
    const plan = this.planWorkflow(task)

    const steps: WorkflowStep[] = plan.map((p) => ({
      agent: p.agent,
      action: p.action,
      input: p.input,
      status: 'pending' as const
    }))

    let lastOutput = ''

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      step.status = 'in_progress'
      onProgress?.(step, i, steps.length)

      try {
        const agent = AGENT_ROLES[step.agent]
        if (!agent) {
          throw new Error(`Unknown agent role: ${step.agent}`)
        }

        // Build the prompt with context from previous steps
        const prompt = this.buildStepPrompt(step, lastOutput, task.context)

        const response = await llmService.chat({
          messages: [{ role: 'user', content: prompt }],
          systemPrompt: agent.systemPrompt,
          temperature: 0.7
        })

        step.output = response.content
        step.status = 'completed'
        lastOutput = response.content
      } catch (error) {
        step.status = 'failed'
        step.error = error instanceof Error ? error.message : 'Unknown error'
        // Continue with remaining steps if possible; use whatever output we have
      }

      onProgress?.(step, i, steps.length)
    }

    const success = steps.every((s) => s.status === 'completed')
    const finalOutput = this.synthesizeFinalOutput(steps, task)

    return {
      taskType: task.type,
      steps,
      finalOutput,
      success
    }
  }

  /**
   * Plan the workflow steps based on the task type
   */
  private planWorkflow(
    task: WorkflowTask
  ): Array<{ agent: string; action: string; input: string }> {
    switch (task.type) {
      case 'literature_review':
        return [
          {
            agent: 'researcher',
            action: 'search_and_analyze',
            input: `Conduct a literature review on: ${task.description}`
          },
          {
            agent: 'analyst',
            action: 'synthesize_findings',
            input: 'Analyze and synthesize the key findings from the literature review above.'
          },
          {
            agent: 'writer',
            action: 'draft_review',
            input: 'Draft a structured literature review based on the research and analysis above.'
          }
        ]

      case 'hypothesis_generation':
        return [
          {
            agent: 'researcher',
            action: 'identify_gaps',
            input: `Identify research gaps related to: ${task.description}`
          },
          {
            agent: 'planner',
            action: 'formulate_hypotheses',
            input: 'Based on the identified gaps, formulate testable hypotheses with null and alternative forms.'
          }
        ]

      case 'experiment_design':
        return [
          {
            agent: 'planner',
            action: 'design_experiment',
            input: `Design an experiment to test: ${task.description}`
          },
          {
            agent: 'analyst',
            action: 'plan_analysis',
            input: 'Plan the statistical analysis for the experiment design above, including sample size estimation.'
          },
          {
            agent: 'reviewer',
            action: 'review_design',
            input: 'Review the experiment design and analysis plan for methodological rigor.'
          }
        ]

      case 'data_analysis':
        return [
          {
            agent: 'analyst',
            action: 'analyze_data',
            input: `Analyze the data and provide interpretation: ${task.description}`
          },
          {
            agent: 'writer',
            action: 'write_results',
            input: 'Write up the results section based on the analysis above.'
          }
        ]

      case 'paper_drafting':
        return [
          {
            agent: 'planner',
            action: 'outline_paper',
            input: `Create a detailed outline for a paper on: ${task.description}`
          },
          {
            agent: 'writer',
            action: 'draft_paper',
            input: 'Draft the full paper based on the outline above.'
          },
          {
            agent: 'reviewer',
            action: 'review_draft',
            input: 'Review the paper draft and provide detailed feedback.'
          },
          {
            agent: 'writer',
            action: 'revise_paper',
            input: 'Revise the paper incorporating the review feedback above.'
          }
        ]

      case 'patent_drafting':
        return [
          {
            agent: 'researcher',
            action: 'prior_art_search',
            input: `Search for prior art related to: ${task.description}`
          },
          {
            agent: 'writer',
            action: 'draft_patent',
            input: 'Draft patent claims and description based on the prior art search above.'
          },
          {
            agent: 'reviewer',
            action: 'review_patent',
            input: 'Review the patent draft for claim strength, novelty, and completeness.'
          }
        ]

      case 'peer_review':
        return [
          {
            agent: 'reviewer',
            action: 'full_review',
            input: `Provide a comprehensive peer review of: ${task.description}`
          }
        ]

      case 'project_planning':
        return [
          {
            agent: 'planner',
            action: 'create_plan',
            input: `Create a detailed research project plan for: ${task.description}`
          }
        ]

      case 'general':
      default:
        // For general tasks, use the planner to decide on agents
        return [
          {
            agent: 'planner',
            action: 'plan_and_delegate',
            input: `Analyze and respond to the following task: ${task.description}`
          }
        ]
    }
  }

  /**
   * Build the prompt for a workflow step, including context
   */
  private buildStepPrompt(
    step: WorkflowStep,
    previousOutput: string,
    context?: Record<string, unknown>
  ): string {
    let prompt = step.input

    if (previousOutput) {
      prompt += `\n\n--- Previous Step Output ---\n${previousOutput}`
    }

    if (context) {
      const contextStr = Object.entries(context)
        .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
        .join('\n')
      prompt += `\n\n--- Project Context ---\n${contextStr}`
    }

    return prompt
  }

  /**
   * Combine outputs from all steps into a final result
   */
  private synthesizeFinalOutput(steps: WorkflowStep[], task: WorkflowTask): string {
    const completedSteps = steps.filter((s) => s.status === 'completed')

    if (completedSteps.length === 0) {
      return 'Workflow failed: no steps completed successfully.'
    }

    // For single-step workflows, just return that output
    if (completedSteps.length === 1) {
      return completedSteps[0].output || ''
    }

    // For multi-step workflows, return the last step's output
    // (which should already incorporate previous steps)
    const lastStep = completedSteps[completedSteps.length - 1]
    return lastStep.output || ''
  }

  /**
   * Get available agent roles
   */
  getAgentRoles(): Array<{ name: string; description: string; capabilities: string[] }> {
    return Object.values(AGENT_ROLES).map((role) => ({
      name: role.name,
      description: role.description,
      capabilities: role.capabilities
    }))
  }

  /**
   * Get supported workflow types
   */
  getWorkflowTypes(): Array<{ type: string; description: string; agents: string[] }> {
    return [
      {
        type: 'literature_review',
        description: 'Search, analyze, and synthesize academic literature',
        agents: ['researcher', 'analyst', 'writer']
      },
      {
        type: 'hypothesis_generation',
        description: 'Identify research gaps and formulate testable hypotheses',
        agents: ['researcher', 'planner']
      },
      {
        type: 'experiment_design',
        description: 'Design experiments with analysis plans and methodology review',
        agents: ['planner', 'analyst', 'reviewer']
      },
      {
        type: 'data_analysis',
        description: 'Analyze data and write up results',
        agents: ['analyst', 'writer']
      },
      {
        type: 'paper_drafting',
        description: 'Outline, draft, review, and revise an academic paper',
        agents: ['planner', 'writer', 'reviewer']
      },
      {
        type: 'patent_drafting',
        description: 'Prior art search, draft, and review patent documents',
        agents: ['researcher', 'writer', 'reviewer']
      },
      {
        type: 'peer_review',
        description: 'Comprehensive peer review of a document',
        agents: ['reviewer']
      },
      {
        type: 'project_planning',
        description: 'Create detailed research project plan with tasks and timeline',
        agents: ['planner']
      },
      {
        type: 'general',
        description: 'General task handled by the planner agent',
        agents: ['planner']
      }
    ]
  }
}

// Singleton instance
export const orchestrator = new AgentOrchestrator()
