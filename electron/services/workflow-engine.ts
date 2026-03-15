import { getDb } from './database'

type TriggerEvent =
  | 'paper_added'
  | 'paper_reviewed'
  | 'hypothesis_created'
  | 'hypothesis_updated'
  | 'experiment_completed'
  | 'task_completed'
  | 'document_status_changed'
  | 'dataset_imported'
  | 'sprint_started'
  | 'sprint_completed'
  | 'review_completed'

interface WorkflowCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in'
  value: unknown
}

interface WorkflowAction {
  type: 'create_task' | 'update_status' | 'send_notification' | 'run_analysis' | 'generate_document' | 'execute_custom'
  params: Record<string, unknown>
}

interface WorkflowRule {
  id?: string
  projectId: string
  name: string
  description?: string
  triggerEvent: TriggerEvent
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  enabled?: boolean
}

interface EventData {
  projectId: string
  entityId?: string
  entityType?: string
  [key: string]: unknown
}

interface ExecutionResult {
  ruleId: string
  ruleName: string
  actionsExecuted: number
  results: Array<{
    actionType: string
    success: boolean
    message?: string
  }>
}

export class WorkflowEngine {
  private actionHandlers = new Map<string, (params: Record<string, unknown>, eventData: EventData) => Promise<{ success: boolean; message?: string }>>()

  constructor() {
    this.registerDefaultActionHandlers()
  }

  registerRule(rule: WorkflowRule): string {
    const db = getDb()
    const id = rule.id || crypto.randomUUID()

    db.prepare(`
      INSERT INTO workflow_rules (id, project_id, name, description, trigger_event, conditions, actions, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      rule.projectId,
      rule.name,
      rule.description || null,
      rule.triggerEvent,
      JSON.stringify(rule.conditions),
      JSON.stringify(rule.actions),
      rule.enabled !== false ? 1 : 0
    )

    console.log(`[workflow] Registered rule: ${rule.name} (${id})`)
    return id
  }

  updateRule(ruleId: string, updates: Partial<WorkflowRule>): void {
    const db = getDb()
    const setClauses: string[] = []
    const params: unknown[] = []

    if (updates.name !== undefined) {
      setClauses.push('name = ?')
      params.push(updates.name)
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?')
      params.push(updates.description)
    }
    if (updates.triggerEvent !== undefined) {
      setClauses.push('trigger_event = ?')
      params.push(updates.triggerEvent)
    }
    if (updates.conditions !== undefined) {
      setClauses.push('conditions = ?')
      params.push(JSON.stringify(updates.conditions))
    }
    if (updates.actions !== undefined) {
      setClauses.push('actions = ?')
      params.push(JSON.stringify(updates.actions))
    }
    if (updates.enabled !== undefined) {
      setClauses.push('enabled = ?')
      params.push(updates.enabled ? 1 : 0)
    }

    if (setClauses.length === 0) return

    setClauses.push("updated_at = datetime('now')")
    params.push(ruleId)

    db.prepare(`UPDATE workflow_rules SET ${setClauses.join(', ')} WHERE id = ?`).run(...params)
  }

  deleteRule(ruleId: string): void {
    const db = getDb()
    db.prepare('DELETE FROM workflow_rules WHERE id = ?').run(ruleId)
  }

  async triggerEvent(event: TriggerEvent, data: EventData): Promise<ExecutionResult[]> {
    const db = getDb()

    // Find all enabled rules matching this event and project
    const rules = db.prepare(`
      SELECT * FROM workflow_rules
      WHERE trigger_event = ? AND project_id = ? AND enabled = 1
    `).all(event, data.projectId) as Array<{
      id: string
      name: string
      conditions: string
      actions: string
    }>

    const results: ExecutionResult[] = []

    for (const rule of rules) {
      const conditions: WorkflowCondition[] = JSON.parse(rule.conditions)
      const actions: WorkflowAction[] = JSON.parse(rule.actions)

      // Check if all conditions are met
      if (!this.evaluateConditions(conditions, data)) {
        continue
      }

      // Execute all actions for this rule
      const actionResults: Array<{ actionType: string; success: boolean; message?: string }> = []

      for (const action of actions) {
        try {
          const result = await this.executeAction(action, data)
          actionResults.push({
            actionType: action.type,
            ...result
          })
        } catch (error) {
          actionResults.push({
            actionType: action.type,
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // Update execution count
      db.prepare(`
        UPDATE workflow_rules
        SET execution_count = execution_count + 1, last_executed_at = datetime('now')
        WHERE id = ?
      `).run(rule.id)

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        actionsExecuted: actionResults.filter((r) => r.success).length,
        results: actionResults
      })
    }

    return results
  }

  getActiveRules(projectId: string): WorkflowRule[] {
    const db = getDb()
    const rows = db.prepare(`
      SELECT * FROM workflow_rules
      WHERE project_id = ? AND enabled = 1
      ORDER BY created_at ASC
    `).all(projectId) as Array<{
      id: string
      project_id: string
      name: string
      description: string | null
      trigger_event: string
      conditions: string
      actions: string
      enabled: number
    }>

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description || undefined,
      triggerEvent: row.trigger_event as TriggerEvent,
      conditions: JSON.parse(row.conditions),
      actions: JSON.parse(row.actions),
      enabled: row.enabled === 1
    }))
  }

  getAllRules(projectId: string): WorkflowRule[] {
    const db = getDb()
    const rows = db.prepare(`
      SELECT * FROM workflow_rules
      WHERE project_id = ?
      ORDER BY created_at ASC
    `).all(projectId) as Array<{
      id: string
      project_id: string
      name: string
      description: string | null
      trigger_event: string
      conditions: string
      actions: string
      enabled: number
    }>

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description || undefined,
      triggerEvent: row.trigger_event as TriggerEvent,
      conditions: JSON.parse(row.conditions),
      actions: JSON.parse(row.actions),
      enabled: row.enabled === 1
    }))
  }

  // Register a custom action handler
  registerActionHandler(
    actionType: string,
    handler: (params: Record<string, unknown>, eventData: EventData) => Promise<{ success: boolean; message?: string }>
  ): void {
    this.actionHandlers.set(actionType, handler)
  }

  // --- Private methods ---

  private evaluateConditions(conditions: WorkflowCondition[], data: EventData): boolean {
    for (const condition of conditions) {
      const value = data[condition.field]
      if (!this.evaluateCondition(condition, value)) {
        return false
      }
    }
    return true
  }

  private evaluateCondition(condition: WorkflowCondition, actualValue: unknown): boolean {
    const { operator, value: expectedValue } = condition

    switch (operator) {
      case 'equals':
        return actualValue === expectedValue
      case 'not_equals':
        return actualValue !== expectedValue
      case 'contains':
        return typeof actualValue === 'string' && actualValue.includes(String(expectedValue))
      case 'gt':
        return Number(actualValue) > Number(expectedValue)
      case 'lt':
        return Number(actualValue) < Number(expectedValue)
      case 'gte':
        return Number(actualValue) >= Number(expectedValue)
      case 'lte':
        return Number(actualValue) <= Number(expectedValue)
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(actualValue)
      default:
        return false
    }
  }

  private async executeAction(
    action: WorkflowAction,
    eventData: EventData
  ): Promise<{ success: boolean; message?: string }> {
    const handler = this.actionHandlers.get(action.type)
    if (!handler) {
      return { success: false, message: `No handler for action type: ${action.type}` }
    }

    return handler(action.params, eventData)
  }

  private registerDefaultActionHandlers(): void {
    // Create a task
    this.registerActionHandler('create_task', async (params, eventData) => {
      const db = getDb()
      const id = crypto.randomUUID()

      db.prepare(`
        INSERT INTO tasks (id, project_id, title, description, status, priority)
        VALUES (?, ?, ?, ?, 'todo', ?)
      `).run(
        id,
        eventData.projectId,
        params.title || 'Auto-generated task',
        params.description || null,
        params.priority || 'medium'
      )

      return { success: true, message: `Task created: ${id}` }
    })

    // Update entity status
    this.registerActionHandler('update_status', async (params, eventData) => {
      const db = getDb()
      const table = params.table as string
      const newStatus = params.status as string
      const entityId = params.entityId || eventData.entityId

      if (!table || !newStatus || !entityId) {
        return { success: false, message: 'Missing table, status, or entityId' }
      }

      // Only allow known tables
      const allowedTables = ['tasks', 'hypotheses', 'experiments', 'documents', 'papers']
      if (!allowedTables.includes(table)) {
        return { success: false, message: `Table not allowed: ${table}` }
      }

      db.prepare(`UPDATE ${table} SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
        newStatus,
        entityId
      )

      return { success: true, message: `Updated ${table} ${entityId} status to ${newStatus}` }
    })

    // Send notification
    this.registerActionHandler('send_notification', async (params, eventData) => {
      const db = getDb()
      const id = crypto.randomUUID()

      db.prepare(`
        INSERT INTO notifications (id, project_id, title, message, type)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        id,
        eventData.projectId,
        params.title || 'Notification',
        params.message || null,
        params.notificationType || 'info'
      )

      return { success: true, message: `Notification created: ${id}` }
    })

    // Run analysis placeholder
    this.registerActionHandler('run_analysis', async (params, _eventData) => {
      console.log(`[workflow] Run analysis action triggered with params:`, params)
      return { success: true, message: 'Analysis action logged (requires integration)' }
    })

    // Generate document placeholder
    this.registerActionHandler('generate_document', async (params, _eventData) => {
      console.log(`[workflow] Generate document action triggered with params:`, params)
      return { success: true, message: 'Document generation action logged (requires integration)' }
    })

    // Custom handler placeholder
    this.registerActionHandler('execute_custom', async (params, _eventData) => {
      console.log(`[workflow] Custom action triggered with params:`, params)
      return { success: true, message: 'Custom action executed' }
    })
  }
}

// Singleton instance
export const workflowEngine = new WorkflowEngine()
