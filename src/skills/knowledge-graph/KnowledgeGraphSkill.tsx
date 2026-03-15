import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
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
  Network,
  Plus,
  Sparkles,
  Search,
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  Eye,
  EyeOff,
  ChevronRight,
  Circle,
  ArrowRight,
  Link2,
  Unlink,
  Hash,
  BookOpen,
  Cpu,
  User,
  Building,
  Database,
  Brain,
  Lightbulb,
  FlaskConical,
  Trash2
} from 'lucide-react'

type EntityType = 'concept' | 'theory' | 'method' | 'tech' | 'person' | 'org' | 'dataset'

interface KgEntity {
  id: string
  projectId: string
  name: string
  entityType: string
  properties: Record<string, unknown> | null
  sourceId: string | null
  sourceType: string | null
  createdAt: string
  updatedAt: string
}

interface KgRelation {
  id: string
  projectId: string
  sourceEntityId: string
  targetEntityId: string
  relationType: string
  properties: Record<string, unknown> | null
  weight: number | null
  createdAt: string
  updatedAt: string
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  entityId: string
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  relationId: string
}

export function KnowledgeGraphSkill({ projectId }: SkillProps) {
  const { toast } = useToast()
  const t = useT()
  const [entities, setEntities] = useState<KgEntity[]>([])
  const [relations, setRelations] = useState<KgRelation[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null)

  // D3 force simulation state
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity)

  const ENTITY_TYPES = [
    { id: 'concept', label: t('kg.entityType.concept'), icon: Brain, color: '#3b82f6' },
    { id: 'theory', label: t('kg.entityType.theory'), icon: Lightbulb, color: '#8b5cf6' },
    { id: 'method', label: t('kg.entityType.method'), icon: FlaskConical, color: '#10b981' },
    { id: 'tech', label: t('kg.entityType.technology'), icon: Cpu, color: '#f59e0b' },
    { id: 'person', label: t('kg.entityType.person'), icon: User, color: '#ec4899' },
    { id: 'org', label: t('kg.entityType.organization'), icon: Building, color: '#06b6d4' },
    { id: 'dataset', label: t('kg.entityType.dataset'), icon: Database, color: '#ef4444' }
  ] as const

  const RELATION_TYPES = [
    { id: 'is_a', label: t('kg.relationType.isA'), color: '#6366f1' },
    { id: 'part_of', label: t('kg.relationType.partOf'), color: '#8b5cf6' },
    { id: 'causes', label: t('kg.relationType.causes'), color: '#ef4444' },
    { id: 'correlates', label: t('kg.relationType.correlates'), color: '#f59e0b' },
    { id: 'contradicts', label: t('kg.relationType.contradicts'), color: '#dc2626' },
    { id: 'extends', label: t('kg.relationType.extends'), color: '#10b981' }
  ] as const

  const [activeEntityFilters, setActiveEntityFilters] = useState<Set<string>>(new Set(ENTITY_TYPES.map(t => t.id)))
  const [activeRelationFilters, setActiveRelationFilters] = useState<Set<string>>(new Set(RELATION_TYPES.map(t => t.id)))

  // Create entity form
  const [showCreateEntity, setShowCreateEntity] = useState(false)
  const [newEntityName, setNewEntityName] = useState('')
  const [newEntityType, setNewEntityType] = useState<string>('concept')

  const loadData = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [entityList, relationList] = await Promise.all([
        ipcInvoke('kg:list-entities', { projectId }),
        ipcInvoke('kg:list-relations', { projectId })
      ])
      setEntities(entityList as KgEntity[])
      setRelations(relationList as KgRelation[])
      if ((entityList as KgEntity[]).length > 0 && !selectedEntity) {
        setSelectedEntity((entityList as KgEntity[])[0].id)
      }
    } catch {
      toast('error', t('kg.toast.loadError'))
    } finally {
      setLoading(false)
    }
  }, [projectId, toast, selectedEntity, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateEntity = async () => {
    if (!projectId || !newEntityName.trim()) return
    try {
      const created = await ipcInvoke('kg:create-entity', {
        projectId,
        name: newEntityName.trim(),
        entityType: newEntityType
      })
      setEntities((prev) => [...prev, created as KgEntity])
      setSelectedEntity((created as KgEntity).id)
      setNewEntityName('')
      setShowCreateEntity(false)
      toast('success', t('kg.toast.createEntitySuccess'))
    } catch {
      toast('error', t('kg.toast.createEntityError'))
    }
  }

  const handleDeleteEntity = async (id: string) => {
    try {
      await ipcInvoke('kg:delete-entity', id)
      setEntities((prev) => prev.filter((e) => e.id !== id))
      setRelations((prev) => prev.filter((r) => r.sourceEntityId !== id && r.targetEntityId !== id))
      if (selectedEntity === id) {
        setSelectedEntity(entities.find((e) => e.id !== id)?.id ?? null)
      }
      toast('success', t('kg.toast.deleteEntitySuccess'))
    } catch {
      toast('error', t('kg.toast.deleteEntityError'))
    }
  }

  const handleDeleteRelation = async (id: string) => {
    try {
      await ipcInvoke('kg:delete-relation', id)
      setRelations((prev) => prev.filter((r) => r.id !== id))
      toast('success', t('kg.toast.deleteRelationSuccess'))
    } catch {
      toast('error', t('kg.toast.deleteRelationError'))
    }
  }

  const toggleEntityFilter = (type: string) => {
    const next = new Set(activeEntityFilters)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    setActiveEntityFilters(next)
  }

  const filteredEntities = useMemo(
    () => entities.filter(e => activeEntityFilters.has(e.entityType)),
    [entities, activeEntityFilters]
  )
  const filteredRelations = useMemo(() => {
    return relations.filter(r => {
      const fromEntity = entities.find(e => e.id === r.sourceEntityId)
      const toEntity = entities.find(e => e.id === r.targetEntityId)
      return fromEntity && toEntity &&
        activeEntityFilters.has(fromEntity.entityType) &&
        activeEntityFilters.has(toEntity.entityType) &&
        activeRelationFilters.has(r.relationType)
    })
  }, [relations, entities, activeEntityFilters, activeRelationFilters])

  // ---- D3 Force Simulation ----
  useEffect(() => {
    if (filteredEntities.length === 0) {
      if (simulationRef.current) {
        simulationRef.current.stop()
        simulationRef.current = null
      }
      setNodePositions(new Map())
      return
    }

    const width = containerRef.current?.clientWidth ?? 700
    const height = containerRef.current?.clientHeight ?? 560

    // Build simulation nodes, preserving existing positions
    const nodes: SimNode[] = filteredEntities.map((e) => {
      const existing = nodePositions.get(e.id)
      return {
        id: e.id,
        entityId: e.id,
        x: existing?.x ?? width / 2 + (Math.random() - 0.5) * 200,
        y: existing?.y ?? height / 2 + (Math.random() - 0.5) * 200
      }
    })

    const nodeById = new Map(nodes.map(n => [n.id, n]))

    const links: SimLink[] = filteredRelations
      .filter(r => nodeById.has(r.sourceEntityId) && nodeById.has(r.targetEntityId))
      .map(r => ({
        source: r.sourceEntityId,
        target: r.targetEntityId,
        relationId: r.id
      }))

    // Stop previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop()
    }

    const simulation = d3.forceSimulation<SimNode, SimLink>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).id(d => d.id).distance(140))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(60))
      .alphaDecay(0.03)

    simulation.on('tick', () => {
      const next = new Map<string, { x: number; y: number }>()
      for (const node of nodes) {
        next.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 })
      }
      setNodePositions(next)
    })

    simulationRef.current = simulation

    return () => {
      simulation.stop()
    }
    // We intentionally only re-run when the filtered data identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredEntities.map(e => e.id).join(','), filteredRelations.map(r => r.id).join(',')])

  // ---- D3 Zoom/Pan ----
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        transformRef.current = event.transform
        setTransform(event.transform)
      })

    d3.select(svg).call(zoomBehavior)
    zoomRef.current = zoomBehavior

    return () => {
      d3.select(svg).on('.zoom', null)
    }
  }, [])

  // ---- Toolbar handlers ----
  const handleZoomIn = () => {
    const svg = svgRef.current
    if (!svg || !zoomRef.current) return
    d3.select(svg).transition().duration(300).call(zoomRef.current.scaleBy, 1.3)
  }

  const handleZoomOut = () => {
    const svg = svgRef.current
    if (!svg || !zoomRef.current) return
    d3.select(svg).transition().duration(300).call(zoomRef.current.scaleBy, 0.7)
  }

  const handleFitView = () => {
    const svg = svgRef.current
    if (!svg || !zoomRef.current || nodePositions.size === 0) return

    const width = containerRef.current?.clientWidth ?? 700
    const height = containerRef.current?.clientHeight ?? 560

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const pos of nodePositions.values()) {
      if (pos.x < minX) minX = pos.x
      if (pos.y < minY) minY = pos.y
      if (pos.x > maxX) maxX = pos.x
      if (pos.y > maxY) maxY = pos.y
    }

    const padding = 80
    const dx = maxX - minX + padding * 2
    const dy = maxY - minY + padding * 2
    const scale = Math.min(width / dx, height / dy, 2)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    const newTransform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-cx, -cy)

    d3.select(svg).transition().duration(500).call(zoomRef.current.transform, newTransform)
  }

  const handleExport = () => {
    const svg = svgRef.current
    if (!svg) return

    const width = containerRef.current?.clientWidth ?? 700
    const height = containerRef.current?.clientHeight ?? 560

    // Clone SVG and embed node labels into it for export
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement
    clonedSvg.setAttribute('width', String(width))
    clonedSvg.setAttribute('height', String(height))
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

    // Add entity node circles and labels to the cloned SVG for export
    const g = clonedSvg.querySelector('g')
    if (g) {
      for (const entity of filteredEntities) {
        const pos = nodePositions.get(entity.id)
        if (!pos) continue
        const type = ENTITY_TYPES.find(et => et.id === entity.entityType)
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        circle.setAttribute('cx', String(pos.x))
        circle.setAttribute('cy', String(pos.y))
        circle.setAttribute('r', '20')
        circle.setAttribute('fill', (type?.color ?? '#3b82f6') + '40')
        circle.setAttribute('stroke', type?.color ?? '#3b82f6')
        circle.setAttribute('stroke-width', '2')
        g.appendChild(circle)

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        label.setAttribute('x', String(pos.x))
        label.setAttribute('y', String(pos.y + 30))
        label.setAttribute('text-anchor', 'middle')
        label.setAttribute('font-size', '10')
        label.setAttribute('fill', '#ccc')
        label.textContent = entity.name
        g.appendChild(label)
      }
    }

    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(clonedSvg)
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    const canvas = document.createElement('canvas')
    canvas.width = width * 2
    canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)

      const pngUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = 'knowledge-graph.png'
      link.href = pngUrl
      link.click()
    }
    img.src = url
  }

  // ---- AI action handlers ----
  const handleExtractEntities = () => {
    const { sendMessage } = useChatStore.getState()
    const { setChatPanelOpen } = useUiStore.getState()
    setChatPanelOpen(true)
    sendMessage(
      'Extract key entities (concepts, theories, methods, technologies, people, organizations, datasets) from this project. For each entity, provide: name, type, and a brief description. Format as a structured list.',
      'You are a knowledge graph assistant. Analyze the project data and extract named entities that would be relevant for a knowledge graph. Categorize each entity as one of: concept, theory, method, tech, person, org, dataset. Be thorough but precise.'
    )
  }

  const handleInferRelations = () => {
    const { sendMessage } = useChatStore.getState()
    const { setChatPanelOpen } = useUiStore.getState()
    setChatPanelOpen(true)

    const entityNames = entities.map(e => `${e.name} (${e.entityType})`).join(', ')
    sendMessage(
      `Given these entities in the knowledge graph: [${entityNames}], infer meaningful relations between them. Use relation types: is_a, part_of, causes, correlates, contradicts, extends. For each relation, provide: source entity, relation type, target entity, and confidence level.`,
      'You are a knowledge graph assistant. Analyze the given entities and infer logical, factual relations between them. Only suggest relations you are reasonably confident about. Use the specified relation types.'
    )
  }

  const handleFindRelated = () => {
    if (!selectedEntity) return
    const entity = entities.find(e => e.id === selectedEntity)
    if (!entity) return

    const { sendMessage } = useChatStore.getState()
    const { setChatPanelOpen } = useUiStore.getState()
    setChatPanelOpen(true)
    sendMessage(
      `Find entities related to "${entity.name}" (${entity.entityType}) that are not yet in the knowledge graph. Suggest new entities and their relations to "${entity.name}".`,
      'You are a knowledge graph assistant. Given an entity, suggest related entities that would expand the knowledge graph meaningfully. For each suggestion, provide: name, type, relation to the given entity, and why it is relevant.'
    )
  }

  const handleFindGaps = () => {
    const { sendMessage } = useChatStore.getState()
    const { setChatPanelOpen } = useUiStore.getState()
    setChatPanelOpen(true)

    const entityNames = entities.map(e => `${e.name} (${e.entityType})`).join(', ')
    const relationDescs = relations.map(r => {
      const src = entities.find(e => e.id === r.sourceEntityId)?.name ?? '?'
      const tgt = entities.find(e => e.id === r.targetEntityId)?.name ?? '?'
      return `${src} --${r.relationType}--> ${tgt}`
    }).join(', ')
    sendMessage(
      `Analyze this knowledge graph for gaps and missing connections.\nEntities: [${entityNames}]\nRelations: [${relationDescs}]\n\nIdentify: 1) Missing entities that should exist, 2) Missing relations between existing entities, 3) Isolated entities that should be connected, 4) Areas where the graph is sparse.`,
      'You are a knowledge graph analyst. Examine the graph structure and identify gaps, missing connections, and areas for improvement. Be specific about what is missing and why it matters.'
    )
  }

  if (!projectId) {
    return <EmptyState icon={Network} title={t('common.selectProject')} description={t('common.selectProjectDesc')} />
  }

  if (loading) {
    return <LoadingState message={t('kg.loading.graph')} />
  }

  const selectedEntityData = entities.find(e => e.id === selectedEntity)
  const entityType = selectedEntityData ? ENTITY_TYPES.find(et => et.id === selectedEntityData.entityType) : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Network className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">{t('kg.title')}</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {filteredEntities.length} {t('kg.text.entities')} · {filteredRelations.length} {t('kg.text.relations')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('kg.placeholder.search')}
              className="pl-8 pr-3 py-1.5 rounded-md border border-input bg-background text-sm w-56"
            />
          </div>
          <button
            onClick={handleExtractEntities}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm hover:bg-primary/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t('kg.button.extractEntities')}
          </button>
          <button
            onClick={() => setShowCreateEntity(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('kg.button.addEntity')}
          </button>
        </div>
      </div>

      {/* Create entity form */}
      {showCreateEntity && (
        <div className="px-4 py-2 border-b border-border bg-card flex items-center gap-2">
          <input
            value={newEntityName}
            onChange={(e) => setNewEntityName(e.target.value)}
            placeholder={t('kg.placeholder.entityName')}
            className="flex-1 px-3 py-1.5 rounded-md border border-input bg-background text-sm"
          />
          <select
            value={newEntityType}
            onChange={(e) => setNewEntityType(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-sm"
          >
            {ENTITY_TYPES.map((et) => (
              <option key={et.id} value={et.id}>{et.label}</option>
            ))}
          </select>
          <button onClick={handleCreateEntity} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm">{t('kg.button.create')}</button>
          <button onClick={() => setShowCreateEntity(false)} className="px-3 py-1.5 rounded-md bg-secondary text-sm">{t('kg.button.cancel')}</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Filter panel */}
        <div className="w-52 border-r border-border p-3 overflow-y-auto">
          {/* Entity type filters */}
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">{t('kg.section.entityTypes')}</p>
          <div className="space-y-1 mb-4">
            {ENTITY_TYPES.map((type) => {
              const Icon = type.icon
              const active = activeEntityFilters.has(type.id)
              const count = entities.filter(e => e.entityType === type.id).length
              return (
                <button
                  key={type.id}
                  onClick={() => toggleEntityFilter(type.id)}
                  className={cn(
                    'flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-sm transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground/50'
                  )}
                >
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: active ? type.color : 'transparent', border: `1.5px solid ${type.color}` }} />
                  <Icon className="w-3.5 h-3.5" />
                  <span className="flex-1 text-left">{type.label}</span>
                  <span className="text-[10px] text-muted-foreground">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Relation type filters */}
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">{t('kg.section.relationTypes')}</p>
          <div className="space-y-1">
            {RELATION_TYPES.map((type) => {
              const active = activeRelationFilters.has(type.id)
              return (
                <button
                  key={type.id}
                  onClick={() => {
                    const next = new Set(activeRelationFilters)
                    if (next.has(type.id)) next.delete(type.id)
                    else next.add(type.id)
                    setActiveRelationFilters(next)
                  }}
                  className={cn(
                    'flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-sm transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground/50'
                  )}
                >
                  <div className="w-6 h-0.5 rounded" style={{ backgroundColor: active ? type.color : '#555' }} />
                  <span className="flex-1 text-left">{type.label}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={handleInferRelations}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm bg-primary/10 text-primary hover:bg-primary/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t('kg.button.inferRelations')}
            </button>
            <button
              onClick={handleFindGaps}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm bg-secondary hover:bg-accent mt-2"
            >
              <Search className="w-3.5 h-3.5" />
              {t('kg.button.findGaps')}
            </button>
          </div>
        </div>

        {/* Graph canvas */}
        <div ref={containerRef} className="flex-1 relative bg-muted/10 overflow-hidden">
          {/* Toolbar */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-card/90 backdrop-blur rounded-lg border border-border p-1 shadow-sm">
            <button onClick={handleZoomIn} className="p-1.5 rounded hover:bg-accent" title={t('kg.tooltip.zoomIn')}><ZoomIn className="w-4 h-4" /></button>
            <button onClick={handleZoomOut} className="p-1.5 rounded hover:bg-accent" title={t('kg.tooltip.zoomOut')}><ZoomOut className="w-4 h-4" /></button>
            <button onClick={handleFitView} className="p-1.5 rounded hover:bg-accent" title={t('kg.tooltip.fitView')}><Maximize className="w-4 h-4" /></button>
            <div className="w-px h-5 bg-border mx-1" />
            <button onClick={handleExport} className="p-1.5 rounded hover:bg-accent" title={t('kg.tooltip.export')}><Download className="w-4 h-4" /></button>
          </div>

          {/* SVG canvas for edges + zoom/pan container */}
          <svg ref={svgRef} className="absolute inset-0 w-full h-full" style={{ cursor: 'grab' }}>
            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
              {/* Arrow marker definitions */}
              <defs>
                {RELATION_TYPES.map((rt) => (
                  <marker
                    key={rt.id}
                    id={`arrow-${rt.id}`}
                    viewBox="0 0 10 6"
                    refX="10"
                    refY="3"
                    markerWidth="8"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M0,0 L10,3 L0,6 Z" fill={rt.color} opacity={0.6} />
                  </marker>
                ))}
              </defs>

              {/* Edges */}
              {filteredRelations.map((rel) => {
                const fromPos = nodePositions.get(rel.sourceEntityId)
                const toPos = nodePositions.get(rel.targetEntityId)
                if (!fromPos || !toPos) return null
                const relType = RELATION_TYPES.find(rt => rt.id === rel.relationType)
                return (
                  <g key={rel.id}>
                    <line
                      x1={fromPos.x}
                      y1={fromPos.y}
                      x2={toPos.x}
                      y2={toPos.y}
                      stroke={relType?.color ?? '#666'}
                      strokeWidth={1.5}
                      opacity={0.5}
                      strokeDasharray={rel.relationType === 'contradicts' ? '4 4' : undefined}
                      markerEnd={relType ? `url(#arrow-${relType.id})` : undefined}
                    />
                    <text
                      x={(fromPos.x + toPos.x) / 2}
                      y={(fromPos.y + toPos.y) / 2 - 6}
                      textAnchor="middle"
                      className="text-[9px] fill-muted-foreground"
                    >
                      {relType?.label}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Entity nodes (HTML overlays, transformed with CSS) */}
          {filteredEntities.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center max-w-xs">
                <Network className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">{t('kg.empty.noEntities')}</p>
                <p className="text-xs mt-1">{t('kg.empty.noEntitiesDescription')}</p>
              </div>
            </div>
          ) : (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.k})`,
                transformOrigin: '0 0'
              }}
            >
              {filteredEntities.map((entity) => {
                const type = ENTITY_TYPES.find(et => et.id === entity.entityType)
                const Icon = type?.icon ?? Brain
                const pos = nodePositions.get(entity.id)
                if (!pos) return null
                const isSelected = selectedEntity === entity.id
                return (
                  <div
                    key={entity.id}
                    className={cn(
                      'absolute flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-shadow hover:shadow-md pointer-events-auto',
                      isSelected ? 'border-primary shadow-lg scale-105 bg-card' : 'border-border bg-card/90 hover:bg-card'
                    )}
                    style={{
                      left: pos.x - 60,
                      top: pos.y - 16,
                      borderColor: isSelected ? type?.color : undefined
                    }}
                    onClick={() => setSelectedEntity(entity.id)}
                  >
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: (type?.color ?? '#3b82f6') + '30' }}>
                      <Icon className="w-3 h-3" style={{ color: type?.color ?? '#3b82f6' }} />
                    </div>
                    <span className="text-xs font-medium whitespace-nowrap">{entity.name}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Entity detail panel */}
        {selectedEntityData && entityType && (
          <div className="w-72 border-l border-border p-4 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: entityType.color + '20' }}>
                <entityType.icon className="w-4 h-4" style={{ color: entityType.color }} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{selectedEntityData.name}</h3>
                <span className="text-[10px] text-muted-foreground">{entityType.label}</span>
              </div>
              <button
                onClick={() => handleDeleteEntity(selectedEntityData.id)}
                className="p-1 rounded hover:bg-accent text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4">
              {selectedEntityData.properties && Object.keys(selectedEntityData.properties).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('kg.section.properties')}</p>
                  <div className="text-sm space-y-1">
                    {Object.entries(selectedEntityData.properties).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{key}</span>
                        <span>{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {t('kg.section.connections')} ({relations.filter(r => r.sourceEntityId === selectedEntityData.id || r.targetEntityId === selectedEntityData.id).length})
                </p>
                <div className="space-y-1.5">
                  {relations.filter(r => r.sourceEntityId === selectedEntityData.id || r.targetEntityId === selectedEntityData.id).map((rel) => {
                    const otherEntityId = rel.sourceEntityId === selectedEntityData.id ? rel.targetEntityId : rel.sourceEntityId
                    const otherEntity = entities.find(e => e.id === otherEntityId)
                    const relType = RELATION_TYPES.find(rt => rt.id === rel.relationType)
                    const direction = rel.sourceEntityId === selectedEntityData.id ? '->' : '<-'
                    return (
                      <div key={rel.id} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-accent cursor-pointer group">
                        <span className="text-muted-foreground">{direction}</span>
                        <span className="px-1 py-0.5 rounded text-[10px]" style={{ backgroundColor: (relType?.color ?? '#666') + '20', color: relType?.color }}>{relType?.label}</span>
                        <span className="font-medium flex-1">{otherEntity?.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteRelation(rel.id) }}
                          className="opacity-0 group-hover:opacity-100 text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-border">
                <button
                  onClick={handleFindRelated}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm bg-primary/10 text-primary hover:bg-primary/20"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {t('kg.button.findRelated')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
