import { useState, useCallback, useEffect, useRef } from 'react'
import type { SkillProps } from '../../types/skill'
import { cn } from '../../lib/utils'
import { ipcInvoke } from '../../lib/ipc-client'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toaster'
import { useT } from '../../i18n'
import {
  Workflow,
  Plus,
  MousePointer2,
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize,
  Camera,
  Download,
  Undo,
  Redo,
  BookOpen,
  Lightbulb,
  FlaskConical,
  Database,
  StickyNote,
  HelpCircle,
  Bot,
  Group,
  ArrowRight,
  GitFork,
  Link,
  Minus,
  LayoutGrid,
  Orbit,
  Network,
  Layers,
  Trash2,
  Save
} from 'lucide-react'

interface CanvasState {
  id: string
  projectId: string
  name: string
  nodes: unknown[]
  edges: unknown[]
  viewport: { x: number; y: number; zoom: number }
  createdAt: string
  updatedAt: string
}

interface CanvasNode {
  id: string
  type: string
  label: string
  x: number
  y: number
  color: string
}

interface CanvasEdge {
  from: string
  to: string
}

interface HistoryEntry {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

// Tailwind bg class to hex color mapping for node types
const COLOR_MAP: Record<string, string> = {
  'bg-blue-500': '#3b82f6',
  'bg-amber-500': '#f59e0b',
  'bg-emerald-500': '#10b981',
  'bg-violet-500': '#8b5cf6',
  'bg-orange-500': '#f97316',
  'bg-rose-500': '#f43f5e',
  'bg-cyan-500': '#06b6d4',
  'bg-gray-500': '#6b7280'
}

export function CanvasSkill({ projectId }: SkillProps) {
  const { toast } = useToast()
  const t = useT()
  const [canvasList, setCanvasList] = useState<CanvasState[]>([])
  const [loading, setLoading] = useState(false)
  const [currentCanvasId, setCurrentCanvasId] = useState<string | null>(null)
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [edges, setEdges] = useState<CanvasEdge[]>([])
  const [selectedTool, setSelectedTool] = useState<string>('select')
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null)
  const [selectedEdgeType, setSelectedEdgeType] = useState<string>('default')
  const [showToolbar, setShowToolbar] = useState(true)

  // New interaction state
  const [history, setHistory] = useState<HistoryEntry[]>([{ nodes: [], edges: [] }])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [viewOffset, setViewOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const canvasRef = useRef<HTMLDivElement>(null)

  const NODE_TYPES = [
    { id: 'paper', label: t('canvas.node.paper'), icon: BookOpen, color: 'bg-blue-500' },
    { id: 'hypothesis', label: t('canvas.node.hypothesis'), icon: Lightbulb, color: 'bg-amber-500' },
    { id: 'experiment', label: t('canvas.node.experiment'), icon: FlaskConical, color: 'bg-emerald-500' },
    { id: 'data', label: t('canvas.node.data'), icon: Database, color: 'bg-violet-500' },
    { id: 'note', label: t('canvas.node.note'), icon: StickyNote, color: 'bg-orange-500' },
    { id: 'rq', label: t('canvas.node.rq'), icon: HelpCircle, color: 'bg-rose-500' },
    { id: 'agent', label: t('canvas.node.agent'), icon: Bot, color: 'bg-cyan-500' },
    { id: 'group', label: t('canvas.node.group'), icon: Group, color: 'bg-gray-500' }
  ]

  const EDGE_TYPES = [
    { id: 'default', label: t('canvas.edge.default'), icon: ArrowRight },
    { id: 'supports', label: t('canvas.edge.supports'), icon: Link },
    { id: 'contradicts', label: t('canvas.edge.contradicts'), icon: Minus },
    { id: 'derives', label: t('canvas.edge.derives'), icon: GitFork }
  ]

  const LAYOUT_OPTIONS = [
    { id: 'hierarchical', label: t('canvas.layout.hierarchical'), icon: Layers },
    { id: 'force', label: t('canvas.layout.forceDirected'), icon: Orbit },
    { id: 'radial', label: t('canvas.layout.radial'), icon: Network }
  ]

  // --- History helpers ---

  const pushHistory = useCallback((newNodes: CanvasNode[], newEdges: CanvasEdge[]) => {
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndex + 1)
      const next = [...truncated, { nodes: newNodes, edges: newEdges }]
      return next
    })
    setHistoryIndex((prev) => prev + 1)
  }, [historyIndex])

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    setHistoryIndex(newIndex)
    setHistory((prev) => {
      const entry = prev[newIndex]
      if (entry) {
        setNodes(entry.nodes)
        setEdges(entry.edges)
      }
      return prev
    })
  }, [historyIndex])

  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      if (historyIndex >= prev.length - 1) return prev
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      const entry = prev[newIndex]
      if (entry) {
        setNodes(entry.nodes)
        setEdges(entry.edges)
      }
      return prev
    })
  }, [historyIndex])

  // --- Canvas click: add node ---

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle clicks directly on the canvas background, not on child nodes
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).closest('svg')) return

    if (selectedTool === 'add' && selectedNodeType) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = (e.clientX - rect.left - viewOffset.x) / zoom
      const y = (e.clientY - rect.top - viewOffset.y) / zoom

      const nodeType = NODE_TYPES.find((nt) => nt.id === selectedNodeType)
      if (!nodeType) return

      const newNode: CanvasNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: selectedNodeType,
        label: nodeType.label,
        x,
        y,
        color: COLOR_MAP[nodeType.color] || '#6b7280'
      }

      const newNodes = [...nodes, newNode]
      setNodes(newNodes)
      pushHistory(newNodes, edges)
    }
  }, [selectedTool, selectedNodeType, nodes, edges, zoom, viewOffset, pushHistory, NODE_TYPES])

  // --- Node dragging ---

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (selectedTool !== 'select') return
    e.stopPropagation()
    e.preventDefault()

    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = (e.clientX - rect.left - viewOffset.x) / zoom
    const mouseY = (e.clientY - rect.top - viewOffset.y) / zoom

    setDraggingNodeId(nodeId)
    setDragOffset({ x: mouseX - node.x, y: mouseY - node.y })
  }, [selectedTool, nodes, zoom, viewOffset])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingNodeId) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const mouseX = (e.clientX - rect.left - viewOffset.x) / zoom
      const mouseY = (e.clientY - rect.top - viewOffset.y) / zoom

      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggingNodeId
            ? { ...n, x: mouseX - dragOffset.x, y: mouseY - dragOffset.y }
            : n
        )
      )
    } else if (isPanning) {
      const dx = e.clientX - panStart.x
      const dy = e.clientY - panStart.y
      setPanStart({ x: e.clientX, y: e.clientY })
      setViewOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
    }
  }, [draggingNodeId, dragOffset, zoom, viewOffset, isPanning, panStart])

  const handleCanvasMouseUp = useCallback(() => {
    if (draggingNodeId) {
      setDraggingNodeId(null)
      // Push history after drag ends
      setNodes((currentNodes) => {
        pushHistory(currentNodes, edges)
        return currentNodes
      })
    }
    if (isPanning) {
      setIsPanning(false)
    }
  }, [draggingNodeId, edges, pushHistory, isPanning])

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool === 'pan') {
      // Only start panning if clicking the background
      if (e.target === e.currentTarget || (e.target as HTMLElement).closest('svg')) {
        e.preventDefault()
        setIsPanning(true)
        setPanStart({ x: e.clientX, y: e.clientY })
      }
    }
  }, [selectedTool])

  // --- Zoom controls ---

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev * 1.2, 5))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev / 1.2, 0.1))
  }, [])

  const handleFitView = useCallback(() => {
    setZoom(1)
    setViewOffset({ x: 0, y: 0 })
  }, [])

  // --- Auto-layout ---

  const handleLayout = useCallback((layoutId: string) => {
    if (nodes.length === 0) return

    let newNodes: CanvasNode[]

    if (layoutId === 'hierarchical') {
      // Build adjacency for tree layout
      const childrenMap: Record<string, string[]> = {}
      const hasParent = new Set<string>()
      for (const edge of edges) {
        if (!childrenMap[edge.from]) childrenMap[edge.from] = []
        childrenMap[edge.from].push(edge.to)
        hasParent.add(edge.to)
      }
      // Find roots (nodes with no incoming edges)
      const roots = nodes.filter((n) => !hasParent.has(n.id))
      if (roots.length === 0) {
        // Fallback: use first node as root
        roots.push(nodes[0])
      }

      const positions: Record<string, { x: number; y: number }> = {}
      const LEVEL_HEIGHT = 120
      const NODE_SPACING = 180

      // BFS level assignment
      const levels: Record<string, number> = {}
      const queue: string[] = []
      for (const root of roots) {
        levels[root.id] = 0
        queue.push(root.id)
      }
      while (queue.length > 0) {
        const current = queue.shift()!
        const children = childrenMap[current] || []
        for (const child of children) {
          if (levels[child] === undefined) {
            levels[child] = levels[current] + 1
            queue.push(child)
          }
        }
      }

      // Assign unvisited nodes to level 0
      for (const node of nodes) {
        if (levels[node.id] === undefined) levels[node.id] = 0
      }

      // Group by level
      const byLevel: Record<number, string[]> = {}
      for (const node of nodes) {
        const lvl = levels[node.id]
        if (!byLevel[lvl]) byLevel[lvl] = []
        byLevel[lvl].push(node.id)
      }

      const canvasWidth = canvasRef.current?.clientWidth || 800
      for (const [lvlStr, ids] of Object.entries(byLevel)) {
        const lvl = parseInt(lvlStr)
        const totalWidth = ids.length * NODE_SPACING
        const startX = (canvasWidth - totalWidth) / 2 + NODE_SPACING / 2
        ids.forEach((id, i) => {
          positions[id] = { x: startX + i * NODE_SPACING, y: 80 + lvl * LEVEL_HEIGHT }
        })
      }

      newNodes = nodes.map((n) => ({
        ...n,
        x: positions[n.id]?.x ?? n.x,
        y: positions[n.id]?.y ?? n.y
      }))
    } else if (layoutId === 'force') {
      // Simple spring-based force simulation
      const pos: Record<string, { x: number; y: number }> = {}
      const canvasW = canvasRef.current?.clientWidth || 800
      const canvasH = canvasRef.current?.clientHeight || 600

      // Initialize positions
      for (const node of nodes) {
        pos[node.id] = { x: node.x, y: node.y }
      }

      const ITERATIONS = 100
      const REPULSION = 8000
      const ATTRACTION = 0.005
      const IDEAL_LENGTH = 200
      const DAMPING = 0.9
      const CENTER_GRAVITY = 0.01

      const vel: Record<string, { x: number; y: number }> = {}
      for (const node of nodes) {
        vel[node.id] = { x: 0, y: 0 }
      }

      const cx = canvasW / 2
      const cy = canvasH / 2

      for (let iter = 0; iter < ITERATIONS; iter++) {
        // Repulsion between all pairs
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i].id
            const b = nodes[j].id
            const dx = pos[a].x - pos[b].x
            const dy = pos[a].y - pos[b].y
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
            const force = REPULSION / (dist * dist)
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            vel[a].x += fx
            vel[a].y += fy
            vel[b].x -= fx
            vel[b].y -= fy
          }
        }

        // Attraction along edges
        for (const edge of edges) {
          const a = edge.from
          const b = edge.to
          if (!pos[a] || !pos[b]) continue
          const dx = pos[b].x - pos[a].x
          const dy = pos[b].y - pos[a].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const force = ATTRACTION * (dist - IDEAL_LENGTH)
          const fx = (dx / Math.max(dist, 1)) * force
          const fy = (dy / Math.max(dist, 1)) * force
          vel[a].x += fx
          vel[a].y += fy
          vel[b].x -= fx
          vel[b].y -= fy
        }

        // Center gravity
        for (const node of nodes) {
          vel[node.id].x += (cx - pos[node.id].x) * CENTER_GRAVITY
          vel[node.id].y += (cy - pos[node.id].y) * CENTER_GRAVITY
        }

        // Apply velocities
        for (const node of nodes) {
          vel[node.id].x *= DAMPING
          vel[node.id].y *= DAMPING
          pos[node.id].x += vel[node.id].x
          pos[node.id].y += vel[node.id].y
        }
      }

      newNodes = nodes.map((n) => ({
        ...n,
        x: pos[n.id]?.x ?? n.x,
        y: pos[n.id]?.y ?? n.y
      }))
    } else if (layoutId === 'radial') {
      // Arrange nodes in a circle
      const canvasW = canvasRef.current?.clientWidth || 800
      const canvasH = canvasRef.current?.clientHeight || 600
      const cx = canvasW / 2
      const cy = canvasH / 2
      const radius = Math.min(canvasW, canvasH) * 0.35

      newNodes = nodes.map((n, i) => {
        const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2
        return {
          ...n,
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle)
        }
      })
    } else {
      return
    }

    setNodes(newNodes)
    pushHistory(newNodes, edges)
  }, [nodes, edges, pushHistory])

  // --- Export as PNG ---

  const handleExport = useCallback(async () => {
    const container = canvasRef.current
    if (!container) return

    try {
      const canvasW = container.clientWidth
      const canvasH = container.clientHeight

      // Create an offscreen canvas
      const offscreen = document.createElement('canvas')
      offscreen.width = canvasW * 2 // 2x for retina
      offscreen.height = canvasH * 2
      const ctx = offscreen.getContext('2d')
      if (!ctx) return

      ctx.scale(2, 2)

      // Background
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, canvasW, canvasH)

      // Draw grid dots
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      for (let gx = 0; gx < canvasW; gx += 20) {
        for (let gy = 0; gy < canvasH; gy += 20) {
          ctx.beginPath()
          ctx.arc(gx, gy, 0.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Apply transform
      ctx.save()
      ctx.translate(viewOffset.x, viewOffset.y)
      ctx.scale(zoom, zoom)

      // Draw edges
      ctx.strokeStyle = 'rgba(150, 150, 170, 0.3)'
      ctx.lineWidth = 1
      for (const edge of edges) {
        const from = nodes.find((n) => n.id === edge.from)
        const to = nodes.find((n) => n.id === edge.to)
        if (!from || !to) continue
        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.lineTo(to.x, to.y)
        ctx.stroke()

        // Arrowhead
        const angle = Math.atan2(to.y - from.y, to.x - from.x)
        const headLen = 10
        ctx.beginPath()
        ctx.moveTo(to.x, to.y)
        ctx.lineTo(
          to.x - headLen * Math.cos(angle - Math.PI / 6),
          to.y - headLen * Math.sin(angle - Math.PI / 6)
        )
        ctx.lineTo(
          to.x - headLen * Math.cos(angle + Math.PI / 6),
          to.y - headLen * Math.sin(angle + Math.PI / 6)
        )
        ctx.closePath()
        ctx.fillStyle = 'rgba(150, 150, 170, 0.3)'
        ctx.fill()
      }

      // Draw nodes
      for (const node of nodes) {
        const nodeW = 160
        const nodeH = 36
        const nx = node.x - nodeW / 2
        const ny = node.y - nodeH / 2

        // Card background
        ctx.fillStyle = 'rgba(30, 30, 50, 0.95)'
        ctx.strokeStyle = 'rgba(100, 100, 120, 0.3)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(nx, ny, nodeW, nodeH, 8)
        ctx.fill()
        ctx.stroke()

        // Color indicator
        ctx.fillStyle = node.color + '33'
        ctx.beginPath()
        ctx.roundRect(nx + 8, ny + 6, 24, 24, 4)
        ctx.fill()

        // Icon dot
        ctx.fillStyle = node.color
        ctx.beginPath()
        ctx.arc(nx + 20, ny + 18, 5, 0, Math.PI * 2)
        ctx.fill()

        // Label
        ctx.fillStyle = '#e0e0e0'
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif'
        ctx.textBaseline = 'middle'
        const maxTextW = nodeW - 48
        let label = node.label
        while (ctx.measureText(label).width > maxTextW && label.length > 1) {
          label = label.slice(0, -1)
        }
        if (label !== node.label) label += '\u2026'
        ctx.fillText(label, nx + 40, ny + nodeH / 2)
      }

      ctx.restore()

      // Convert to blob and download
      offscreen.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `canvas-${Date.now()}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 'image/png')

      toast('success', t('canvas.toast.exportSuccess'))
    } catch {
      toast('error', t('canvas.toast.exportFailed'))
    }
  }, [nodes, edges, zoom, viewOffset, toast, t])

  // --- Data loading ---

  const loadCanvasList = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await ipcInvoke('canvas:list', { projectId })
      setCanvasList(data as CanvasState[])
      if ((data as CanvasState[]).length > 0 && !currentCanvasId) {
        const first = (data as CanvasState[])[0]
        setCurrentCanvasId(first.id)
        const loadedNodes = (first.nodes || []) as CanvasNode[]
        const loadedEdges = (first.edges || []) as CanvasEdge[]
        setNodes(loadedNodes)
        setEdges(loadedEdges)
        setHistory([{ nodes: loadedNodes, edges: loadedEdges }])
        setHistoryIndex(0)
      }
    } catch {
      toast('error', t('canvas.toast.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [projectId, toast, currentCanvasId, t])

  useEffect(() => {
    loadCanvasList()
  }, [loadCanvasList])

  const handleLoadCanvas = async (canvasId: string) => {
    try {
      const data = await ipcInvoke('canvas:get', canvasId)
      if (data) {
        const canvas = data as CanvasState
        setCurrentCanvasId(canvas.id)
        const loadedNodes = (canvas.nodes || []) as CanvasNode[]
        const loadedEdges = (canvas.edges || []) as CanvasEdge[]
        setNodes(loadedNodes)
        setEdges(loadedEdges)
        setHistory([{ nodes: loadedNodes, edges: loadedEdges }])
        setHistoryIndex(0)
      }
    } catch {
      toast('error', t('canvas.toast.loadFailed'))
    }
  }

  const handleSave = async () => {
    if (!projectId) return
    try {
      const saved = await ipcInvoke('canvas:save', {
        id: currentCanvasId ?? undefined,
        projectId,
        name: canvasList.find((c) => c.id === currentCanvasId)?.name ?? t('canvas.label.untitledCanvas'),
        nodes: nodes as unknown[],
        edges: edges as unknown[],
        viewport: { x: viewOffset.x, y: viewOffset.y, zoom }
      })
      const savedCanvas = saved as CanvasState
      if (!currentCanvasId) {
        setCurrentCanvasId(savedCanvas.id)
        setCanvasList((prev) => [...prev, savedCanvas])
      } else {
        setCanvasList((prev) => prev.map((c) => (c.id === savedCanvas.id ? savedCanvas : c)))
      }
      toast('success', t('canvas.toast.saveSuccess'))
    } catch {
      toast('error', t('canvas.toast.saveFailed'))
    }
  }

  const handleNewCanvas = async () => {
    if (!projectId) return
    try {
      const created = await ipcInvoke('canvas:save', {
        projectId,
        name: t('canvas.label.newCanvas'),
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      })
      const canvas = created as CanvasState
      setCanvasList((prev) => [...prev, canvas])
      setCurrentCanvasId(canvas.id)
      setNodes([])
      setEdges([])
      setHistory([{ nodes: [], edges: [] }])
      setHistoryIndex(0)
      setZoom(1)
      setViewOffset({ x: 0, y: 0 })
      toast('success', t('canvas.toast.createSuccess'))
    } catch {
      toast('error', t('canvas.toast.createFailed'))
    }
  }

  const handleDeleteCanvas = async (id: string) => {
    try {
      await ipcInvoke('canvas:delete', id)
      setCanvasList((prev) => prev.filter((c) => c.id !== id))
      if (currentCanvasId === id) {
        setCurrentCanvasId(null)
        setNodes([])
        setEdges([])
        setHistory([{ nodes: [], edges: [] }])
        setHistoryIndex(0)
      }
      toast('success', t('canvas.toast.deleteSuccess'))
    } catch {
      toast('error', t('canvas.toast.deleteFailed'))
    }
  }

  if (!projectId) {
    return <EmptyState icon={Workflow} title={t('canvas.empty.selectProject')} description={t('canvas.empty.selectProjectDesc')} />
  }

  if (loading) {
    return <LoadingState message={t('canvas.loading.canvas')} />
  }

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <Workflow className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-sm font-semibold">{t('canvas.title')}</h1>
          {/* Canvas selector */}
          {canvasList.length > 0 && (
            <select
              value={currentCanvasId || ''}
              onChange={(e) => handleLoadCanvas(e.target.value)}
              className="px-2 py-1 text-xs rounded-md border border-border bg-background"
            >
              {canvasList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Tool Selector */}
          <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5 mr-2">
            <button
              onClick={() => { setSelectedTool('select'); setSelectedNodeType(null) }}
              className={cn(
                'p-1.5 rounded transition-colors',
                selectedTool === 'select' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              )}
              title={t('canvas.tooltip.select')}
            >
              <MousePointer2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setSelectedTool('pan'); setSelectedNodeType(null) }}
              className={cn(
                'p-1.5 rounded transition-colors',
                selectedTool === 'pan' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              )}
              title={t('canvas.tooltip.pan')}
            >
              <Hand className="w-4 h-4" />
            </button>
          </div>

          {/* Undo/Redo */}
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className={cn(
              'p-1.5 rounded transition-colors',
              canUndo ? 'hover:bg-accent' : 'opacity-30 cursor-not-allowed'
            )}
            title={t('canvas.tooltip.undo')}
          >
            <Undo className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className={cn(
              'p-1.5 rounded transition-colors',
              canRedo ? 'hover:bg-accent' : 'opacity-30 cursor-not-allowed'
            )}
            title={t('canvas.tooltip.redo')}
          >
            <Redo className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="w-px h-5 bg-border mx-1" />

          {/* Zoom Controls */}
          <button onClick={handleZoomIn} className="p-1.5 rounded hover:bg-accent transition-colors" title={t('canvas.tooltip.zoomIn')}>
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={handleZoomOut} className="p-1.5 rounded hover:bg-accent transition-colors" title={t('canvas.tooltip.zoomOut')}>
            <ZoomOut className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={handleFitView} className="p-1.5 rounded hover:bg-accent transition-colors" title={t('canvas.tooltip.fitView')}>
            <Maximize className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-[10px] text-muted-foreground min-w-[36px] text-center">
            {Math.round(zoom * 100)}%
          </span>

          <div className="w-px h-5 bg-border mx-1" />

          {/* Layout Buttons */}
          {LAYOUT_OPTIONS.map((layout) => (
            <button
              key={layout.id}
              onClick={() => handleLayout(layout.id)}
              className="p-1.5 rounded hover:bg-accent transition-colors"
              title={`Auto Layout: ${layout.label}`}
            >
              <layout.icon className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}

          <div className="w-px h-5 bg-border mx-1" />

          {/* Save / New / Export */}
          <button onClick={handleSave} className="p-1.5 rounded hover:bg-accent transition-colors" title={t('canvas.tooltip.save')}>
            <Save className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={handleNewCanvas} className="p-1.5 rounded hover:bg-accent transition-colors" title={t('canvas.tooltip.newCanvas')}>
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
          <button className="p-1.5 rounded hover:bg-accent transition-colors" title={t('canvas.tooltip.snapshot')}>
            <Camera className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={handleExport} className="p-1.5 rounded hover:bg-accent transition-colors" title={t('canvas.tooltip.export')}>
            <Download className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={canvasRef}
        className={cn(
          'flex-1 relative overflow-hidden bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] bg-[size:20px_20px]',
          selectedTool === 'pan' ? 'cursor-grab' : '',
          selectedTool === 'add' ? 'cursor-crosshair' : '',
          isPanning ? 'cursor-grabbing' : ''
        )}
        onClick={handleCanvasClick}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
      >
        {/* Transform wrapper for zoom + pan */}
        <div
          style={{
            transform: `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        >
          {/* Rendered nodes */}
          {nodes.map((node) => {
            const nodeType = NODE_TYPES.find((nt) => nt.id === node.type)
            const Icon = nodeType?.icon ?? StickyNote
            return (
              <div
                key={node.id}
                className={cn(
                  'absolute flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card shadow-sm cursor-move hover:shadow-md transition-shadow select-none',
                  draggingNodeId === node.id ? 'shadow-lg ring-2 ring-primary/50' : ''
                )}
                style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)' }}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              >
                <div
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ backgroundColor: node.color + '20' }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: node.color }} />
                </div>
                <span className="text-xs font-medium whitespace-nowrap max-w-[140px] truncate">
                  {node.label}
                </span>
              </div>
            )
          })}

          {/* SVG edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
            {edges.map((edge) => {
              const from = nodes.find((n) => n.id === edge.from)
              const to = nodes.find((n) => n.id === edge.to)
              if (!from || !to) return null
              return (
                <line
                  key={`${edge.from}-${edge.to}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="1"
                  strokeOpacity="0.3"
                  markerEnd="url(#arrowhead)"
                />
              )
            })}
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity="0.3"
                />
              </marker>
            </defs>
          </svg>
        </div>

        {/* Empty state for canvas */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-muted-foreground">
              <Workflow className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">{t('canvas.empty.emptyCanvas')}</p>
              <p className="text-xs mt-1">{t('canvas.empty.useNodePalette')}</p>
            </div>
          </div>
        )}

        {/* Minimap */}
        {nodes.length > 0 && (
          <div className="absolute bottom-4 right-4 w-48 h-32 rounded-lg border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="p-1">
              <div className="text-[8px] text-muted-foreground px-1 mb-0.5 font-medium">{t('canvas.label.minimap')}</div>
              <div className="relative w-full h-24 bg-muted/30 rounded">
                {nodes.map((node) => (
                  <div
                    key={node.id}
                    className="absolute w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: node.color,
                      left: `${Math.min(95, Math.max(5, (node.x / 800) * 100))}%`,
                      top: `${Math.min(95, Math.max(5, (node.y / 550) * 100))}%`
                    }}
                  />
                ))}
                <div className="absolute border border-blue-500/50 rounded bg-blue-500/5"
                  style={{ left: '10%', top: '5%', width: '80%', height: '85%' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Left sidebar: Node type palette */}
      {showToolbar && (
        <div className="absolute left-4 top-16 w-44 rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {t('canvas.label.addNode')}
            </p>
          </div>
          <div className="p-1.5 space-y-0.5">
            {NODE_TYPES.map((nt) => (
              <button
                key={nt.id}
                onClick={() => {
                  setSelectedTool('add')
                  setSelectedNodeType(nt.id)
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                  selectedNodeType === nt.id ? 'bg-accent' : 'hover:bg-accent/50'
                )}
              >
                <div className={cn('w-5 h-5 rounded flex items-center justify-center text-white', nt.color)}>
                  <nt.icon className="w-3 h-3" />
                </div>
                {nt.label}
              </button>
            ))}
          </div>

          <div className="p-2 border-t border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
              {t('canvas.label.edgeType')}
            </p>
            <div className="space-y-0.5">
              {EDGE_TYPES.map((et) => (
                <button
                  key={et.id}
                  onClick={() => setSelectedEdgeType(et.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                    selectedEdgeType === et.id ? 'bg-accent' : 'hover:bg-accent/50'
                  )}
                >
                  <et.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  {et.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
