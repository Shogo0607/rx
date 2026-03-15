import type { BrowserWindow } from 'electron'
import { getDb } from './database'
import { llmService } from './openai'
import { patentSearchApiService } from './patent-search-api'
import { randomUUID } from 'crypto'

type PipelineStatus = 'pending' | 'researching' | 'analyzing' | 'generating_ideas' | 'drafting_claims' | 'drafting_spec' | 'generating_diagrams' | 'exporting' | 'completed' | 'failed' | 'paused'

interface PipelineRun {
  id: string
  projectId: string
  status: PipelineStatus
  mode: 'auto' | 'semi-auto'
  inventionDescription: string
  template: string
  jurisdiction: string
  currentStep: number
  totalSteps: number
  researchResults: unknown
  gapAnalysis: unknown
  generatedIdeas: unknown
  generatedClaims: unknown
  generatedSpec: unknown
  generatedDiagrams: unknown
}

const STEPS: { step: number; status: PipelineStatus; label: string }[] = [
  { step: 1, status: 'researching', label: 'Prior Art Research' },
  { step: 2, status: 'analyzing', label: 'Gap Analysis' },
  { step: 3, status: 'generating_ideas', label: 'Idea Generation' },
  { step: 4, status: 'drafting_claims', label: 'Claims Drafting' },
  { step: 5, status: 'drafting_spec', label: 'Specification Drafting' },
  { step: 6, status: 'generating_diagrams', label: 'Diagram Generation' },
  { step: 7, status: 'exporting', label: 'Document Assembly' }
]

export class PatentPipelineService {
  private loadRun(runId: string): PipelineRun {
    const db = getDb()
    const row = db.prepare('SELECT * FROM patent_pipeline_runs WHERE id = ?').get(runId) as Record<string, unknown> | undefined
    if (!row) throw new Error(`Pipeline run ${runId} not found`)

    return {
      id: row.id as string,
      projectId: row.project_id as string,
      status: row.status as PipelineStatus,
      mode: row.mode as 'auto' | 'semi-auto',
      inventionDescription: row.invention_description as string,
      template: row.template as string,
      jurisdiction: (row.jurisdiction as string) || 'all',
      currentStep: row.current_step as number,
      totalSteps: row.total_steps as number,
      researchResults: row.research_results ? JSON.parse(row.research_results as string) : null,
      gapAnalysis: row.gap_analysis ? JSON.parse(row.gap_analysis as string) : null,
      generatedIdeas: row.generated_ideas ? JSON.parse(row.generated_ideas as string) : null,
      generatedClaims: row.generated_claims ? JSON.parse(row.generated_claims as string) : null,
      generatedSpec: row.generated_spec ? JSON.parse(row.generated_spec as string) : null,
      generatedDiagrams: row.generated_diagrams ? JSON.parse(row.generated_diagrams as string) : null
    }
  }

  private updateRun(runId: string, updates: Record<string, unknown>): void {
    const db = getDb()
    const sets: string[] = []
    const values: unknown[] = []

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
      if (typeof value === 'object' && value !== null) {
        sets.push(`${snakeKey} = ?`)
        values.push(JSON.stringify(value))
      } else {
        sets.push(`${snakeKey} = ?`)
        values.push(value)
      }
    }

    sets.push("updated_at = datetime('now')")
    values.push(runId)
    db.prepare(`UPDATE patent_pipeline_runs SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  }

  private sendProgress(window: BrowserWindow, runId: string, step: number, status: string, data?: unknown): void {
    try {
      window.webContents.send('pipeline:progress', { runId, step, status, data })
    } catch {
      // Window may be closed
    }
  }

  private summarizeGapAnalysis(gapAnalysis: unknown): string {
    const ga = gapAnalysis as Record<string, unknown> | null
    if (!ga) return 'No gap analysis available'
    const parts: string[] = []
    if (Array.isArray(ga.novelAspects)) {
      parts.push('Novel aspects: ' + (ga.novelAspects as Array<{ aspect: string }>).map(a => a.aspect || String(a)).join('; '))
    }
    if (Array.isArray(ga.technicalAdvantages)) {
      parts.push('Technical advantages: ' + (ga.technicalAdvantages as string[]).join('; '))
    }
    if (typeof ga.overallAssessment === 'string') {
      parts.push('Assessment: ' + ga.overallAssessment)
    }
    if (Array.isArray(ga.coveredAspects)) {
      parts.push('Covered by prior art: ' + (ga.coveredAspects as Array<{ aspect: string }>).map(a => a.aspect || String(a)).join('; '))
    }
    if (Array.isArray(ga.patentabilityConcerns)) {
      parts.push('Concerns: ' + (ga.patentabilityConcerns as Array<{ concern: string }>).map(a => a.concern || String(a)).join('; '))
    }
    return parts.length > 0 ? parts.join('\n') : JSON.stringify(ga).slice(0, 2000)
  }

  private summarizeIdeas(generatedIdeas: unknown): string {
    const ideas = generatedIdeas as Record<string, unknown> | null
    if (!ideas) return 'No ideas available'
    const parts: string[] = []
    if (Array.isArray(ideas.coreNovelty)) {
      for (const idea of ideas.coreNovelty as Array<{ title: string; description: string; technicalEffect: string }>) {
        parts.push(`[Core] ${idea.title}: ${idea.description} (Effect: ${idea.technicalEffect})`)
      }
    }
    if (Array.isArray(ideas.embodiments)) {
      for (const idea of ideas.embodiments as Array<{ title: string; description: string }>) {
        parts.push(`[Embodiment] ${idea.title}: ${idea.description}`)
      }
    }
    if (Array.isArray(ideas.alternatives)) {
      for (const idea of ideas.alternatives as Array<{ title: string; description: string }>) {
        parts.push(`[Alternative] ${idea.title}: ${idea.description}`)
      }
    }
    return parts.length > 0 ? parts.join('\n') : JSON.stringify(ideas).slice(0, 2000)
  }

  private isPaused(runId: string): boolean {
    const db = getDb()
    const row = db.prepare('SELECT status FROM patent_pipeline_runs WHERE id = ?').get(runId) as { status: string } | undefined
    return row?.status === 'paused'
  }

  async startPipeline(runId: string, window: BrowserWindow): Promise<void> {
    const run = this.loadRun(runId)

    this.updateRun(runId, {
      status: 'researching',
      startedAt: new Date().toISOString(),
      currentStep: 1
    })

    // Execute from step 1
    await this.executeFromStep(runId, 1, window)
  }

  async resumePipeline(runId: string, window: BrowserWindow): Promise<void> {
    const run = this.loadRun(runId)
    const nextStep = run.currentStep + 1

    if (nextStep > 7) {
      this.updateRun(runId, { status: 'completed', completedAt: new Date().toISOString() })
      this.sendProgress(window, runId, 7, 'completed')
      return
    }

    await this.executeFromStep(runId, nextStep, window)
  }

  private async executeFromStep(runId: string, fromStep: number, window: BrowserWindow): Promise<void> {
    for (let step = fromStep; step <= 7; step++) {
      // Check if paused before each step
      if (this.isPaused(runId)) {
        this.sendProgress(window, runId, step, 'paused')
        return
      }

      const stepInfo = STEPS[step - 1]
      this.updateRun(runId, { status: stepInfo.status, currentStep: step })
      this.sendProgress(window, runId, step, stepInfo.status, { label: stepInfo.label })

      try {
        console.log(`[pipeline] Step ${step} (${stepInfo.label}) starting for run ${runId}`)
        await this.executeStep(runId, step, window)
        console.log(`[pipeline] Step ${step} (${stepInfo.label}) completed for run ${runId}`)
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        const errorDetail = `Step ${step} (${stepInfo.label}) failed: ${errorObj.message}`
        console.error(`[pipeline] ${errorDetail}`)
        console.error(`[pipeline] Stack trace:`, errorObj.stack)
        this.updateRun(runId, { status: 'failed', errorMessage: errorDetail })
        this.sendProgress(window, runId, step, 'failed', { error: errorDetail })
        return
      }

      // In semi-auto mode, pause after each step
      const run = this.loadRun(runId)
      if (run.mode === 'semi-auto' && step < 7) {
        this.updateRun(runId, { status: 'paused' })
        this.sendProgress(window, runId, step, 'step_completed', { label: stepInfo.label })
        return
      }
    }

    // Pipeline completed
    this.updateRun(runId, { status: 'completed', completedAt: new Date().toISOString() })
    this.sendProgress(window, runId, 7, 'completed')
  }

  private async executeStep(runId: string, step: number, window: BrowserWindow): Promise<void> {
    switch (step) {
      case 1: return this.stepResearch(runId, window)
      case 2: return this.stepGapAnalysis(runId, window)
      case 3: return this.stepIdeaGeneration(runId, window)
      case 4: return this.stepClaimsDrafting(runId, window)
      case 5: return this.stepSpecDrafting(runId, window)
      case 6: return this.stepDiagramGeneration(runId, window)
      case 7: return this.stepExport(runId, window)
    }
  }

  // ── Step 1: Prior Art Research ──

  private async stepResearch(runId: string, window: BrowserWindow): Promise<void> {
    const run = this.loadRun(runId)
    const db = getDb()

    const jurisdictionLabel = run.jurisdiction === 'JP' ? 'Japanese (JP)' : run.jurisdiction === 'US' ? 'US' : 'global'

    // Initialize EPO credentials (if available)
    try {
      const keyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('epo_consumer_key') as { value: string } | undefined
      const secretRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('epo_consumer_secret') as { value: string } | undefined
      if (keyRow?.value && secretRow?.value) {
        patentSearchApiService.setCredentials(keyRow.value, secretRow.value)
      }
    } catch { /* credentials may not be set */ }

    const hasAuth = patentSearchApiService.hasEpoCredentials()

    // Round 2: Execute searches
    const allPatents: Array<{
      patentNumber: string; title: string; abstract: string | null
      applicant: string | null; inventors: string[]; filingDate: string | null
      publicationDate: string | null; jurisdiction: string | null
      classificationCodes: string[]; url: string | null; source: string
    }> = []
    let searchQueries: Array<{ query: string; aspect: string; language?: string }> = []

    if (hasAuth) {
      // ── Auth mode: Use EPO OPS / USPTO APIs ──
      const jurisdictionHint = run.jurisdiction === 'JP'
        ? 'Focus on Japanese patent terminology. Generate queries using both Japanese technical terms and their English equivalents that would appear in Japanese patent documents indexed by EPO.'
        : run.jurisdiction === 'US'
          ? 'Focus on US patent terminology and English technical terms.'
          : 'Generate queries in both English and Japanese technical terms.'

      const queryResult = await llmService.structuredOutput({
        prompt: `Analyze the following invention description and generate 3-5 patent search queries that would find relevant prior art. The queries should cover different aspects of the invention. Use technical terms that would appear in patent documents.
Target jurisdiction: ${jurisdictionLabel}

Invention Description:
${run.inventionDescription}`,
        systemPrompt: `You are a patent search expert. ${jurisdictionHint}`,
        schema: {
          type: 'object',
          properties: {
            queries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  aspect: { type: 'string' },
                  language: { type: 'string' }
                },
                required: ['query', 'aspect', 'language'],
                additionalProperties: false
              }
            }
          },
          required: ['queries'],
          additionalProperties: false
        }
      }) as { queries: Array<{ query: string; aspect: string; language: string }> }

      searchQueries = queryResult.queries
      this.sendProgress(window, runId, 1, 'researching', { phase: 'searching', queriesGenerated: queryResult.queries.length })

      const searchOptions = { limit: 10, jurisdiction: run.jurisdiction !== 'all' ? run.jurisdiction : undefined }

      for (const q of queryResult.queries) {
        try {
          let results: { patents: typeof allPatents; total: number }

          if (run.jurisdiction === 'JP') {
            results = await patentSearchApiService.searchEpo(q.query, searchOptions)
          } else if (run.jurisdiction === 'US') {
            const [epoResults, usptoResults] = await Promise.allSettled([
              patentSearchApiService.searchEpo(q.query, searchOptions),
              patentSearchApiService.searchUspto(q.query, { limit: 10 })
            ])
            results = { patents: [], total: 0 }
            if (epoResults.status === 'fulfilled') {
              results.patents.push(...epoResults.value.patents)
              results.total += epoResults.value.total
            }
            if (usptoResults.status === 'fulfilled') {
              results.patents.push(...usptoResults.value.patents)
              results.total += usptoResults.value.total
            }
          } else {
            results = await patentSearchApiService.searchAll(q.query, { limit: 10 })
          }

          allPatents.push(...results.patents)
          this.sendProgress(window, runId, 1, 'researching', {
            phase: 'searching',
            query: q.query,
            found: results.patents.length
          })
        } catch (err) {
          console.warn(`[patent-pipeline] Search failed for query "${q.query}": ${err}`)
        }
      }
    } else {
      // ── No-auth mode: LLM identifies patents → verify via Google Patents ──
      this.sendProgress(window, runId, 1, 'researching', { phase: 'identifying', mode: 'no-auth' })

      const jurisdictionInstruction = run.jurisdiction === 'JP'
        ? 'Focus exclusively on Japanese patent publications. Use the format JP followed by the publication number and kind code (e.g., JP2020123456A, JP6789012B2, JPH10123456A). Include both recent and older relevant patents.'
        : run.jurisdiction === 'US'
          ? 'Focus on US patent publications. Use the format US followed by the patent number (e.g., US10123456B2, US2020012345A1).'
          : 'Include patents from all major jurisdictions (JP, US, EP, WO, CN, KR). Use standard patent number formats.'

      const identifyResult = await llmService.structuredOutput({
        prompt: `You are a patent search expert. Based on the following invention description, identify 15-25 specific real patent publication numbers that are likely to be relevant prior art.

${jurisdictionInstruction}

IMPORTANT:
- Provide REAL patent numbers that actually exist
- Cover different technical aspects of the invention
- Include the most relevant/closest prior art first
- For each patent, explain briefly why it might be relevant

Invention Description:
${run.inventionDescription}`,
        systemPrompt: 'You are a patent prior art search specialist with deep knowledge of patent databases. Identify specific real patent numbers that are relevant to the given invention.',
        schema: {
          type: 'object',
          properties: {
            patents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  patentNumber: { type: 'string' },
                  expectedTitle: { type: 'string' },
                  relevanceReason: { type: 'string' },
                  aspect: { type: 'string' }
                },
                required: ['patentNumber', 'expectedTitle', 'relevanceReason', 'aspect'],
                additionalProperties: false
              }
            }
          },
          required: ['patents'],
          additionalProperties: false
        }
      }) as { patents: Array<{ patentNumber: string; expectedTitle: string; relevanceReason: string; aspect: string }> }

      searchQueries = identifyResult.patents.map(p => ({ query: p.patentNumber, aspect: p.aspect }))
      this.sendProgress(window, runId, 1, 'researching', {
        phase: 'verifying',
        identified: identifyResult.patents.length
      })

      // Verify each patent via Google Patents (no auth)
      for (const identified of identifyResult.patents) {
        try {
          const patent = await patentSearchApiService.fetchPatentFromGoogle(identified.patentNumber)
          if (patent) {
            allPatents.push(patent)
            this.sendProgress(window, runId, 1, 'researching', {
              phase: 'verifying',
              verified: identified.patentNumber,
              found: allPatents.length
            })
          } else {
            // If Google Patents doesn't have it, still save LLM-identified data
            const countryMatch = identified.patentNumber.match(/^([A-Z]{2})/)
            allPatents.push({
              patentNumber: identified.patentNumber,
              title: identified.expectedTitle,
              abstract: identified.relevanceReason,
              applicant: null,
              inventors: [],
              filingDate: null,
              publicationDate: null,
              jurisdiction: countryMatch ? countryMatch[1] : null,
              classificationCodes: [],
              url: `https://patents.google.com/patent/${identified.patentNumber.replace(/\s+/g, '')}`,
              source: 'google'
            })
          }
        } catch (err) {
          console.warn(`[patent-pipeline] Google Patents fetch failed for ${identified.patentNumber}: ${err}`)
          // Still save LLM-identified data as fallback
          const countryMatch = identified.patentNumber.match(/^([A-Z]{2})/)
          allPatents.push({
            patentNumber: identified.patentNumber,
            title: identified.expectedTitle,
            abstract: identified.relevanceReason,
            applicant: null,
            inventors: [],
            filingDate: null,
            publicationDate: null,
            jurisdiction: countryMatch ? countryMatch[1] : null,
            classificationCodes: [],
            url: `https://patents.google.com/patent/${identified.patentNumber.replace(/\s+/g, '')}`,
            source: 'google'
          })
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>()
    const uniquePatents = allPatents.filter((p) => {
      const key = p.patentNumber.replace(/\s/g, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Round 3: Score relevance with LLM
    const scoringPrompt = `Score the relevance of each prior art patent to the following invention. Rate each 0-100 (100 = most relevant) and categorize.

Invention:
${run.inventionDescription}

Patents found:
${uniquePatents.map((p, i) => `[${i + 1}] ${p.patentNumber} - ${p.title}${p.abstract ? ` - ${p.abstract.slice(0, 200)}` : ''}`).join('\n')}

For each patent, provide a relevance score and a brief note explaining the relevance.`

    let scoredPatents: Array<{ index: number; score: number; notes: string; category: string }> = []

    if (uniquePatents.length > 0) {
      const scoring = await llmService.structuredOutput({
        prompt: scoringPrompt,
        systemPrompt: 'You are a patent analyst. Score patent relevance accurately.',
        schema: {
          type: 'object',
          properties: {
            patents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'number' },
                  score: { type: 'number' },
                  notes: { type: 'string' },
                  category: { type: 'string' }
                },
                required: ['index', 'score', 'notes', 'category'],
                additionalProperties: false
              }
            }
          },
          required: ['patents'],
          additionalProperties: false
        }
      }) as { patents: Array<{ index: number; score: number; notes: string; category: string }> }

      scoredPatents = scoring.patents
    }

    // Save to DB
    for (const patent of uniquePatents) {
      const idx = uniquePatents.indexOf(patent)
      const scoreData = scoredPatents.find((s) => s.index === idx + 1)

      db.prepare(`
        INSERT INTO prior_art_patents (id, project_id, pipeline_run_id, patent_number, title, abstract, applicant, inventors, filing_date, publication_date, jurisdiction, classification_codes, url, source, relevance_score, relevance_notes, category, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        randomUUID(), run.projectId, runId,
        patent.patentNumber, patent.title, patent.abstract,
        patent.applicant, JSON.stringify(patent.inventors),
        patent.filingDate, patent.publicationDate,
        patent.jurisdiction, JSON.stringify(patent.classificationCodes),
        patent.url, patent.source,
        scoreData?.score ?? null, scoreData?.notes ?? null, scoreData?.category ?? null
      )
    }

    this.updateRun(runId, {
      researchResults: {
        queries: searchQueries,
        totalFound: uniquePatents.length,
        scored: scoredPatents.length
      }
    })
  }

  // ── Step 2: Gap Analysis ──

  private async stepGapAnalysis(runId: string, window: BrowserWindow): Promise<void> {
    const run = this.loadRun(runId)
    const db = getDb()

    // Get stored prior art
    const priorArt = db.prepare(
      'SELECT patent_number, title, abstract, relevance_score, relevance_notes, category FROM prior_art_patents WHERE pipeline_run_id = ? ORDER BY relevance_score DESC LIMIT 20'
    ).all(runId) as Array<Record<string, unknown>>

    const priorArtSummary = priorArt.map((p, i) =>
      `[${i + 1}] ${p.patent_number} - ${p.title}\nAbstract: ${(p.abstract as string || 'N/A').slice(0, 300)}\nRelevance: ${p.relevance_score}/100 - ${p.relevance_notes}`
    ).join('\n\n')

    this.sendProgress(window, runId, 2, 'analyzing', { priorArtCount: priorArt.length })

    const gapAnalysis = await llmService.structuredOutput({
      prompt: `Perform a detailed gap analysis between the following invention and the prior art found.

INVENTION:
${run.inventionDescription}

PRIOR ART:
${priorArtSummary}

Identify:
1. What aspects of the invention are already covered by prior art (and which patents cover them)
2. What aspects are novel (not found in any prior art)
3. Technical advantages of the invention over prior art
4. Potential patentability concerns`,
      systemPrompt: 'You are a patent attorney specialized in novelty analysis and patentability assessment. Be thorough and precise.',
      schema: {
        type: 'object',
        properties: {
          coveredAspects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                aspect: { type: 'string' },
                coveredBy: { type: 'array', items: { type: 'string' } },
                details: { type: 'string' }
              },
              required: ['aspect', 'coveredBy', 'details'],
              additionalProperties: false
            }
          },
          novelAspects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                aspect: { type: 'string' },
                noveltyReason: { type: 'string' },
                strength: { type: 'string' }
              },
              required: ['aspect', 'noveltyReason', 'strength'],
              additionalProperties: false
            }
          },
          technicalAdvantages: {
            type: 'array',
            items: { type: 'string' }
          },
          patentabilityConcerns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                concern: { type: 'string' },
                severity: { type: 'string' },
                mitigation: { type: 'string' }
              },
              required: ['concern', 'severity', 'mitigation'],
              additionalProperties: false
            }
          },
          overallAssessment: { type: 'string' }
        },
        required: ['coveredAspects', 'novelAspects', 'technicalAdvantages', 'patentabilityConcerns', 'overallAssessment'],
        additionalProperties: false
      }
    })

    this.updateRun(runId, { gapAnalysis })
  }

  // ── Step 3: Idea Generation ──

  private async stepIdeaGeneration(runId: string, window: BrowserWindow): Promise<void> {
    const run = this.loadRun(runId)

    this.sendProgress(window, runId, 3, 'generating_ideas')

    const ideas = await llmService.structuredOutput({
      prompt: `Based on the invention description and the gap analysis results, generate patentable ideas that strengthen the patent application.

INVENTION:
${run.inventionDescription}

GAP ANALYSIS:
${this.summarizeGapAnalysis(run.gapAnalysis)}

Generate ideas in these categories:
1. Core Novelty - The primary novel aspects that form the basis of independent claims
2. Specific Embodiments - Concrete implementations for dependent claims
3. Alternative Implementations - Different ways to achieve the same result, broadening protection`,
      systemPrompt: 'You are a patent strategist. Generate ideas that maximize patent protection while being technically sound and patentable.',
      schema: {
        type: 'object',
        properties: {
          coreNovelty: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                technicalEffect: { type: 'string' },
                differentiators: { type: 'array', items: { type: 'string' } }
              },
              required: ['id', 'title', 'description', 'technicalEffect', 'differentiators'],
              additionalProperties: false
            }
          },
          embodiments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                relatedCoreId: { type: 'string' }
              },
              required: ['id', 'title', 'description', 'relatedCoreId'],
              additionalProperties: false
            }
          },
          alternatives: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                relatedCoreId: { type: 'string' }
              },
              required: ['id', 'title', 'description', 'relatedCoreId'],
              additionalProperties: false
            }
          }
        },
        required: ['coreNovelty', 'embodiments', 'alternatives'],
        additionalProperties: false
      }
    })

    this.updateRun(runId, { generatedIdeas: ideas })
  }

  // ── Step 4: Claims Drafting ──

  private async stepClaimsDrafting(runId: string, window: BrowserWindow): Promise<void> {
    const run = this.loadRun(runId)
    const db = getDb()
    const isJp = run.template === 'jp-patent'

    this.sendProgress(window, runId, 4, 'drafting_claims', { phase: 'generating' })

    const claimsResult = await llmService.structuredOutput({
      prompt: `Draft patent claims based on the following invention and generated ideas.

INVENTION:
${run.inventionDescription}

NOVEL IDEAS:
${this.summarizeIdeas(run.generatedIdeas)}

GAP ANALYSIS SUMMARY:
${this.summarizeGapAnalysis(run.gapAnalysis)}

Requirements:
- Format: ${isJp ? 'Japanese Patent (JPO)' : 'US Patent (USPTO)'}
- Language: ${isJp ? 'Japanese (日本語)' : 'English'}
- Generate independent claims covering core novelty
- Generate dependent claims for specific embodiments
- Use proper patent claim language and structure
- ${isJp ? 'Use 「〜であって」「〜を特徴とする」 etc. for JP style claims' : 'Use "A method comprising..." or "An apparatus comprising..." for US style claims'}
- Number claims sequentially
- Each dependent claim must reference its parent claim number`,
      systemPrompt: isJp
        ? 'あなたは日本の特許弁理士です。特許庁（JPO）の要件に準拠した特許請求の範囲を作成してください。'
        : 'You are a US patent attorney. Draft claims compliant with USPTO requirements.',
      schema: {
        type: 'object',
        properties: {
          claims: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                claimNumber: { type: 'number' },
                claimType: { type: 'string' },
                parentClaimNumber: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                claimText: { type: 'string' }
              },
              required: ['claimNumber', 'claimType', 'parentClaimNumber', 'claimText'],
              additionalProperties: false
            }
          }
        },
        required: ['claims'],
        additionalProperties: false
      }
    }) as { claims: Array<{ claimNumber: number; claimType: string; claimText: string; parentClaimNumber?: number }> }

    this.sendProgress(window, runId, 4, 'drafting_claims', { phase: 'refining', claimCount: claimsResult.claims.length })

    // Self-review pass
    const reviewedClaims = await llmService.structuredOutput({
      prompt: `Review and improve the following patent claims. Check for:
1. Claim scope - are independent claims broad enough?
2. Claim dependencies - are dependent claims properly narrowing?
3. Technical accuracy
4. Legal sufficiency
5. ${isJp ? 'JPO形式への準拠' : 'USPTO format compliance'}

Current Claims:
${claimsResult.claims.map(c => `Claim ${c.claimNumber} (${c.claimType}): ${c.claimText}`).join('\n\n')}

Return the improved claims.`,
      systemPrompt: isJp
        ? 'あなたは特許請求の範囲の審査専門家です。改善された請求項を返してください。'
        : 'You are a patent claims review expert. Return improved claims.',
      schema: {
        type: 'object',
        properties: {
          claims: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                claimNumber: { type: 'number' },
                claimType: { type: 'string' },
                parentClaimNumber: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                claimText: { type: 'string' }
              },
              required: ['claimNumber', 'claimType', 'parentClaimNumber', 'claimText'],
              additionalProperties: false
            }
          }
        },
        required: ['claims'],
        additionalProperties: false
      }
    }) as { claims: Array<{ claimNumber: number; claimType: string; claimText: string; parentClaimNumber?: number }> }

    // Save claims to DB with run_id - build parent ID map
    const claimIdMap = new Map<number, string>()

    // First pass: create independent claims
    for (const claim of reviewedClaims.claims) {
      if (claim.claimType === 'independent') {
        const id = randomUUID()
        claimIdMap.set(claim.claimNumber, id)

        db.prepare(`
          INSERT INTO patent_claims (id, project_id, pipeline_run_id, claim_number, claim_type, claim_text, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'independent', ?, 'draft', datetime('now'), datetime('now'))
        `).run(id, run.projectId, runId, claim.claimNumber, claim.claimText)
      }
    }

    // Second pass: create dependent claims with parent references
    for (const claim of reviewedClaims.claims) {
      if (claim.claimType === 'dependent') {
        const id = randomUUID()
        claimIdMap.set(claim.claimNumber, id)
        const parentId = claim.parentClaimNumber ? claimIdMap.get(claim.parentClaimNumber) || null : null

        db.prepare(`
          INSERT INTO patent_claims (id, project_id, pipeline_run_id, claim_number, claim_type, parent_claim_id, claim_text, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'dependent', ?, ?, 'draft', datetime('now'), datetime('now'))
        `).run(id, run.projectId, runId, claim.claimNumber, parentId, claim.claimText)
      }
    }

    this.updateRun(runId, { generatedClaims: reviewedClaims.claims })
  }

  // ── Step 5: Specification Drafting (with detailed embodiments) ──

  private async stepSpecDrafting(runId: string, window: BrowserWindow): Promise<void> {
    const run = this.loadRun(runId)
    const isJp = run.template === 'jp-patent'

    // Sections EXCLUDING embodiment — embodiments are generated separately with much more detail
    const baseSections = isJp
      ? ['技術分野', '背景技術', '発明が解決しようとする課題', '課題を解決するための手段', '発明の効果']
      : ['Technical Field', 'Background Art', 'Summary of Invention', 'Brief Description of Drawings']

    // Pre-build context strings
    const claims = Array.isArray(run.generatedClaims)
      ? (run.generatedClaims as Array<{ claimNumber: number; claimText: string }>).map(c => `Claim ${c.claimNumber}: ${c.claimText}`).join('\n')
      : 'No claims available'

    const gapSummary = this.summarizeGapAnalysis(run.gapAnalysis)
    const ideasSummary = this.summarizeIdeas(run.generatedIdeas)

    const spec: Record<string, string> = {}

    // ── Phase 1: Draft base sections ──
    for (let i = 0; i < baseSections.length; i++) {
      const section = baseSections[i]
      console.log(`[pipeline] Step 5: Drafting section ${i + 1}/${baseSections.length}: "${section}"`)
      this.sendProgress(window, runId, 5, 'drafting_spec', { phase: 'section', sectionIndex: i, sectionName: section, totalSections: baseSections.length })

      const prompt = `Draft the "${section}" section for a ${isJp ? 'Japanese (JPO)' : 'US'} patent specification.

INVENTION:
${run.inventionDescription}

CLAIMS:
${claims}

GAP ANALYSIS:
${gapSummary}

${isJp ? 'この明細書セクションを日本語で書いてください。特許庁の書式に従ってください。' : 'Write this specification section in formal patent language following USPTO conventions.'}

Write ONLY the content for the "${section}" section. Do not include the section heading.`

      const result = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: isJp
          ? 'あなたは日本の特許明細書作成の専門家です。特許庁の要件に準拠した明細書を作成してください。'
          : 'You are a patent specification drafting expert. Write formal patent specification text.',
        temperature: 0.4
      })

      spec[section] = result.content
    }

    // ── Phase 2: Generate detailed embodiments with inline figures ──
    console.log('[pipeline] Step 5: Generating detailed embodiments')
    this.sendProgress(window, runId, 5, 'drafting_spec', { phase: 'embodiments', message: isJp ? '詳細な実施形態を生成中...' : 'Generating detailed embodiments...' })

    const embodimentPlan = await llmService.structuredOutput({
      prompt: `Based on the following invention, claims, and ideas, plan detailed embodiments (実施形態/実施例) for the patent specification.

INVENTION:
${run.inventionDescription}

CLAIMS:
${claims}

IDEAS & EMBODIMENTS FROM ANALYSIS:
${ideasSummary}

GAP ANALYSIS:
${gapSummary}

Plan 3-5 detailed embodiments. Each embodiment should:
- Cover a different aspect or implementation of the invention
- Be detailed enough for a person skilled in the art to reproduce
- Reference specific claim numbers where applicable
- Include what figures/diagrams would be needed to illustrate it

${isJp ? '実施形態のタイトルと概要は日本語で記述してください。' : 'Write titles and summaries in English.'}`,
      systemPrompt: isJp
        ? 'あなたは日本の特許明細書作成の専門家です。発明の実施形態を計画してください。各実施形態は十分に詳細であり、当業者が再現可能なレベルにしてください。'
        : 'You are a patent specification expert. Plan embodiments that are detailed enough for a person skilled in the art to reproduce the invention.',
      schema: {
        type: 'object',
        properties: {
          embodiments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                summary: { type: 'string' },
                relatedClaims: { type: 'array', items: { type: 'number' } },
                figuresNeeded: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      diagramType: { type: 'string' },
                      description: { type: 'string' }
                    },
                    required: ['label', 'diagramType', 'description'],
                    additionalProperties: false
                  }
                }
              },
              required: ['id', 'title', 'summary', 'relatedClaims', 'figuresNeeded'],
              additionalProperties: false
            }
          }
        },
        required: ['embodiments'],
        additionalProperties: false
      }
    }) as {
      embodiments: Array<{
        id: string
        title: string
        summary: string
        relatedClaims: number[]
        figuresNeeded: Array<{ label: string; diagramType: string; description: string }>
      }>
    }

    // ── Phase 3: For each embodiment, generate detailed description + Mermaid diagrams ──
    let globalFigureNumber = 1
    const detailedEmbodiments: Array<{
      id: string
      title: string
      description: string
      examples: Array<{ exampleNumber: number; title: string; content: string }>
      figures: Array<{ figureNumber: number; label: string; description: string; mermaidCode: string }>
    }> = []

    for (let ei = 0; ei < embodimentPlan.embodiments.length; ei++) {
      const emb = embodimentPlan.embodiments[ei]
      console.log(`[pipeline] Step 5: Generating embodiment ${ei + 1}/${embodimentPlan.embodiments.length}: "${emb.title}"`)
      this.sendProgress(window, runId, 5, 'drafting_spec', {
        phase: 'embodiment_detail',
        embodimentIndex: ei,
        embodimentTitle: emb.title,
        totalEmbodiments: embodimentPlan.embodiments.length
      })

      // Generate the detailed text for this embodiment
      const figureRefs = emb.figuresNeeded.map((f, fi) => `【図${globalFigureNumber + fi}】${f.label}: ${f.description}`).join('\n')

      const detailPrompt = isJp
        ? `以下の特許出願における実施形態「${emb.title}」について、詳細な説明を記述してください。

発明の説明:
${run.inventionDescription}

請求項:
${claims}

この実施形態の概要:
${emb.summary}

関連する請求項: ${emb.relatedClaims.map(n => `請求項${n}`).join('、')}

参照する図面:
${figureRefs}

以下の要件に従って詳細に記述してください：
1. 当業者が実施可能な程度に詳細に記述すること
2. 各構成要素の具体的な構造、材料、寸法、動作条件等を可能な限り具体的に記述すること
3. 図面の参照番号（【図X】）を適切に参照すること
4. 請求項の各構成要件がどのように実現されるかを明確に説明すること
5. 変形例や代替構成についても言及すること
6. 数値範囲、好ましい範囲、具体的な実施例の数値を含めること
7. 動作原理や効果の技術的根拠を説明すること
8. 最低でも2000文字以上の詳細な記述とすること

セクションの見出しは含めず、本文のみを記述してください。`
        : `Write a detailed description of the embodiment "${emb.title}" for this patent application.

INVENTION:
${run.inventionDescription}

CLAIMS:
${claims}

EMBODIMENT SUMMARY:
${emb.summary}

Related claims: ${emb.relatedClaims.map(n => `Claim ${n}`).join(', ')}

Figures to reference:
${figureRefs}

Requirements:
1. Write in sufficient detail for a person skilled in the art to reproduce the invention
2. Include specific structures, materials, dimensions, and operating conditions where possible
3. Reference figure numbers (FIG. X) appropriately
4. Explain how each claim element is realized in this embodiment
5. Mention variations and alternative configurations
6. Include numerical ranges, preferred ranges, and specific example values
7. Explain operating principles and technical rationale for effects
8. The description should be at least 800 words

Write ONLY the body text, no section heading.`

      const detailResult = await llmService.chat({
        messages: [{ role: 'user', content: detailPrompt }],
        systemPrompt: isJp
          ? 'あなたは日本の特許明細書作成の専門家です。実施形態の詳細な説明を記述してください。特許庁の審査基準における「実施可能要件」を満たす十分な詳細さで記述してください。'
          : 'You are a patent specification expert. Write detailed embodiment descriptions that satisfy the enablement requirement.',
        temperature: 0.4
      })

      // Generate concrete examples (実施例) for this embodiment
      console.log(`[pipeline] Step 5: Generating examples for embodiment ${ei + 1}`)
      this.sendProgress(window, runId, 5, 'drafting_spec', {
        phase: 'examples',
        embodimentIndex: ei,
        embodimentTitle: emb.title
      })

      const examplesResult = await llmService.structuredOutput({
        prompt: isJp
          ? `以下の実施形態に基づいて、具体的な実施例を2-3件生成してください。

実施形態「${emb.title}」の説明:
${detailResult.content.slice(0, 3000)}

請求項:
${claims}

各実施例には以下を含めてください：
1. 具体的な数値条件（温度、圧力、濃度、寸法、処理時間等）
2. 使用する材料・装置の具体的な名称や型番
3. 実験結果や評価結果（数値データ）
4. 比較例との対比（可能な場合）
5. 効果の定量的な記述

各実施例は500文字以上で詳細に記述してください。`
          : `Based on the following embodiment description, generate 2-3 concrete working examples.

Embodiment "${emb.title}":
${detailResult.content.slice(0, 3000)}

Claims:
${claims}

Each example should include:
1. Specific numerical conditions (temperature, pressure, dimensions, etc.)
2. Specific materials, equipment names, or model numbers
3. Experimental results and evaluation data
4. Comparison with comparative examples where applicable
5. Quantitative description of effects

Each example should be at least 300 words.`,
        systemPrompt: isJp
          ? 'あなたは特許明細書の実施例記述の専門家です。具体的な数値データと条件を含む詳細な実施例を作成してください。'
          : 'You are a patent specification expert specializing in concrete working examples with specific numerical data.',
        schema: {
          type: 'object',
          properties: {
            examples: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' }
                },
                required: ['title', 'content'],
                additionalProperties: false
              }
            }
          },
          required: ['examples'],
          additionalProperties: false
        }
      }) as { examples: Array<{ title: string; content: string }> }

      const examples = examplesResult.examples.map((ex, exi) => ({
        exampleNumber: exi + 1,
        title: ex.title,
        content: ex.content
      }))

      // Generate Mermaid diagrams for this embodiment's figures
      const figures: Array<{ figureNumber: number; label: string; description: string; mermaidCode: string }> = []

      if (emb.figuresNeeded.length > 0) {
        const diagramResult = await llmService.structuredOutput({
          prompt: `Generate Mermaid diagram code for the following patent figures that illustrate embodiment "${emb.title}".

INVENTION:
${run.inventionDescription}

EMBODIMENT DESCRIPTION:
${detailResult.content.slice(0, 3000)}

Figures to generate:
${emb.figuresNeeded.map((f, fi) => `Figure ${globalFigureNumber + fi} - ${f.label} (${f.diagramType}): ${f.description}`).join('\n')}

Requirements:
- Use valid Mermaid syntax (flowchart, sequenceDiagram, classDiagram, stateDiagram, etc.)
- ${isJp ? 'ラベルは日本語で記述。ノードIDは英数字のみ使用。' : 'Use clear English labels.'}
- CRITICAL: Do NOT use half-width parentheses () inside node labels like [text] or {text}. Use fullwidth （）instead, e.g. A[データ取得（API経由）] not A[データ取得(API経由)]. Half-width parentheses break Mermaid parsing.
- Make diagrams detailed and suitable for patent figures
- Include reference numbers/labels that match the embodiment description
- Do NOT use markdown code fences

IMPORTANT: Return ONLY valid Mermaid syntax for each diagram.`,
          systemPrompt: 'You are an expert in creating patent figures using Mermaid diagram syntax. Generate clear, technically accurate diagrams.',
          schema: {
            type: 'object',
            properties: {
              diagrams: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    mermaidCode: { type: 'string' },
                    description: { type: 'string' }
                  },
                  required: ['label', 'mermaidCode', 'description'],
                  additionalProperties: false
                }
              }
            },
            required: ['diagrams'],
            additionalProperties: false
          }
        }) as { diagrams: Array<{ label: string; mermaidCode: string; description: string }> }

        for (let fi = 0; fi < diagramResult.diagrams.length; fi++) {
          const d = diagramResult.diagrams[fi]
          figures.push({
            figureNumber: globalFigureNumber + fi,
            label: d.label,
            description: d.description,
            mermaidCode: d.mermaidCode
          })
        }
      }

      detailedEmbodiments.push({
        id: emb.id,
        title: emb.title,
        description: detailResult.content,
        examples,
        figures
      })

      globalFigureNumber += emb.figuresNeeded.length
    }

    // Store in the new structured format
    this.updateRun(runId, {
      generatedSpec: {
        sections: spec,
        embodiments: detailedEmbodiments
      }
    })
  }

  // ── Step 6: Diagram Generation (overview + embodiment diagrams combined) ──

  private async stepDiagramGeneration(runId: string, window: BrowserWindow): Promise<void> {
    const run = this.loadRun(runId)
    const isJp = run.template === 'jp-patent'

    this.sendProgress(window, runId, 6, 'generating_diagrams')

    // Generate overview diagrams (system architecture, process flow)
    const diagrams = await llmService.structuredOutput({
      prompt: `Generate Mermaid diagram code for patent overview figures based on the following invention.

INVENTION:
${run.inventionDescription}

CLAIMS:
${Array.isArray(run.generatedClaims) ? (run.generatedClaims as Array<{ claimNumber: number; claimText: string }>).map(c => `Claim ${c.claimNumber}: ${c.claimText}`).join('\n') : ''}

Generate 2-3 overview diagrams:
1. System architecture / block diagram (flowchart TD or LR)
2. Process flow / method steps (flowchart or sequence diagram)
3. Component relationship diagram (if applicable)

Each diagram should:
- Use clear, concise labels
- ${isJp ? 'ラベルは日本語で記述' : 'Use English labels'}
- CRITICAL: Do NOT use half-width parentheses () inside node labels like [text] or {text}. Use fullwidth （）instead. Half-width parentheses break Mermaid parsing.
- Be suitable for a patent figure
- Use proper Mermaid syntax

IMPORTANT: Return ONLY valid Mermaid syntax. Do not use markdown code blocks.`,
      systemPrompt: 'You are an expert in creating patent figures using Mermaid diagram syntax. Generate clear, professional diagrams.',
      schema: {
        type: 'object',
        properties: {
          diagrams: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                type: { type: 'string' },
                mermaidCode: { type: 'string' }
              },
              required: ['id', 'label', 'type', 'mermaidCode'],
              additionalProperties: false
            }
          }
        },
        required: ['diagrams'],
        additionalProperties: false
      }
    }) as { diagrams: Array<{ id: string; label: string; type: string; mermaidCode: string }> }

    // Also collect all embodiment figures into the top-level diagrams list for the drawings tab
    const specData = run.generatedSpec as { sections?: Record<string, string>; embodiments?: Array<{ figures: Array<{ figureNumber: number; label: string; mermaidCode: string }> }> } | null
    const embFigures: Array<{ id: string; label: string; type: string; mermaidCode: string }> = []
    if (specData?.embodiments) {
      for (const emb of specData.embodiments) {
        for (const fig of emb.figures || []) {
          embFigures.push({
            id: `emb-fig-${fig.figureNumber}`,
            label: isJp ? `【図${fig.figureNumber}】${fig.label}` : `FIG. ${fig.figureNumber} - ${fig.label}`,
            type: 'embodiment',
            mermaidCode: fig.mermaidCode
          })
        }
      }
    }

    this.updateRun(runId, { generatedDiagrams: [...diagrams.diagrams, ...embFigures] })
  }

  // ── Step 7: Export / Assembly ──

  private async stepExport(runId: string, window: BrowserWindow): Promise<void> {
    const run = this.loadRun(runId)

    this.sendProgress(window, runId, 7, 'exporting', { phase: 'assembling' })

    // The actual DOCX/PDF export will be triggered by the frontend
    // because Mermaid rendering (SVG→PNG) must happen in the renderer process.
    // This step just marks the pipeline as ready for export.

    // Generate abstract
    const isJp = run.template === 'jp-patent'

    // Handle both old (flat Record) and new (structured) spec formats
    const specData = run.generatedSpec as { sections?: Record<string, string>; embodiments?: unknown[] } | Record<string, string> | null
    const specSections = (specData && 'sections' in specData) ? specData.sections || {} : (specData as Record<string, string>) || {}

    const abstractResult = await llmService.chat({
      messages: [{
        role: 'user',
        content: `Generate a patent abstract (max 150 words) for the following invention.

CLAIMS:
${Array.isArray(run.generatedClaims) ? (run.generatedClaims as Array<{ claimNumber: number; claimText: string }>).map(c => `Claim ${c.claimNumber}: ${c.claimText}`).join('\n') : ''}

SPECIFICATION SUMMARY:
${Object.entries(specSections).map(([k, v]) => `${k}: ${(v as string).slice(0, 200)}`).join('\n')}

${isJp ? '日本語で要約を書いてください（150語以内）。' : 'Write the abstract in English (max 150 words).'}
Write ONLY the abstract text, no heading.`
      }],
      systemPrompt: isJp
        ? 'あなたは特許要約の作成専門家です。'
        : 'You are a patent abstract writing expert.',
      temperature: 0.3,
      maxTokens: 500
    })

    // Store the abstract with the spec — handle both old and new formats
    let specWithAbstract: unknown
    if (specData && 'sections' in specData) {
      specWithAbstract = { ...specData, _abstract: abstractResult.content }
    } else {
      specWithAbstract = { ...(specData as Record<string, string> || {}), _abstract: abstractResult.content }
    }

    this.updateRun(runId, { generatedSpec: specWithAbstract })
    this.sendProgress(window, runId, 7, 'ready_to_export')
  }
}

// Singleton instance
export const patentPipelineService = new PatentPipelineService()
