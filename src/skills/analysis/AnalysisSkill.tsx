import { useState, useCallback, useEffect } from 'react'
import type { SkillProps } from '../../types/skill'
import { cn } from '../../lib/utils'
import { ipcInvoke } from '../../lib/ipc-client'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toaster'
import { useT } from '../../i18n'
import {
  BarChart3,
  Upload,
  FileSpreadsheet,
  ScatterChart,
  Sparkles,
  Download,
  Hash,
  Calculator,
  LineChart,
  BoxSelect,
  Sigma,
  PieChart,
  Plus,
  Trash2
} from 'lucide-react'
import {
  ScatterChart as RechartsScatter,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart as RechartsLine,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell
} from 'recharts'

interface Dataset {
  id: string
  projectId: string
  experimentId: string | null
  name: string
  description: string | null
  filePath: string | null
  fileType: string | null
  rowCount: number | null
  columnNames: string[] | null
  summaryStats: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export function AnalysisSkill({ projectId }: SkillProps) {
  const { toast } = useToast()
  const t = useT()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('datasets')
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null)
  const [selectedChart, setSelectedChart] = useState('scatter')
  const [computing, setComputing] = useState(false)

  // Visualization data
  const [chartData, setChartData] = useState<Record<string, string>[]>([])
  const [chartHeaders, setChartHeaders] = useState<string[]>([])
  const [xColumn, setXColumn] = useState<string>('')
  const [yColumn, setYColumn] = useState<string>('')

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')

  const TABS = [
    { id: 'datasets', label: t('analysis.tab.datasets'), icon: FileSpreadsheet },
    { id: 'descriptive', label: t('analysis.tab.descriptive'), icon: Calculator },
    { id: 'visualization', label: t('analysis.tab.visualization'), icon: ScatterChart },
    { id: 'meta-analysis', label: t('analysis.tab.metaAnalysis'), icon: Sigma }
  ] as const

  const CHART_TYPES = [
    { id: 'scatter', label: t('analysis.chart.scatter'), icon: ScatterChart },
    { id: 'bar', label: t('analysis.chart.bar'), icon: BarChart3 },
    { id: 'line', label: t('analysis.chart.line'), icon: LineChart },
    { id: 'histogram', label: t('analysis.chart.histogram'), icon: BarChart3 },
    { id: 'pie', label: t('analysis.chart.pie'), icon: PieChart }
  ]

  const loadDatasets = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await ipcInvoke('dataset:list', { projectId })
      setDatasets(data as Dataset[])
      if ((data as Dataset[]).length > 0 && !selectedDatasetId) {
        setSelectedDatasetId((data as Dataset[])[0].id)
      }
    } catch {
      toast('error', t('analysis.toast.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [projectId, toast, selectedDatasetId, t])

  useEffect(() => {
    loadDatasets()
  }, [loadDatasets])

  // Load chart data when switching to visualization tab or changing dataset
  useEffect(() => {
    if (activeTab === 'visualization' && selectedDatasetId) {
      loadChartData(selectedDatasetId)
    }
  }, [activeTab, selectedDatasetId])

  const loadChartData = async (datasetId: string) => {
    try {
      const data = await ipcInvoke('dataset:get-data', datasetId) as { headers: string[]; rows: Record<string, string>[] }
      setChartHeaders(data.headers)
      setChartData(data.rows)
      if (data.headers.length >= 2 && !xColumn) {
        setXColumn(data.headers[0])
        setYColumn(data.headers[1])
      }
    } catch {
      setChartData([])
      setChartHeaders([])
    }
  }

  const handleImportCsv = async () => {
    if (!projectId) return
    try {
      const filePaths = await ipcInvoke('file:open-dialog', {
        title: 'Import CSV',
        filters: [{ name: 'CSV Files', extensions: ['csv', 'tsv'] }],
        properties: ['openFile']
      })
      if (!filePaths || filePaths.length === 0) return

      const created = await ipcInvoke('dataset:import-csv', {
        projectId,
        filePath: filePaths[0]
      })
      setDatasets((prev) => [...prev, created as Dataset])
      setSelectedDatasetId((created as Dataset).id)
      toast('success', t('analysis.toast.importSuccess'))
    } catch {
      toast('error', t('analysis.toast.importFailed'))
    }
  }

  const handleComputeStats = async (datasetId: string) => {
    setComputing(true)
    try {
      const updated = await ipcInvoke('dataset:compute-stats', datasetId)
      setDatasets((prev) => prev.map((d) => (d.id === datasetId ? (updated as Dataset) : d)))
      setActiveTab('descriptive')
      toast('success', t('analysis.toast.statsComputed'))
    } catch {
      toast('error', t('analysis.toast.statsComputeFailed'))
    } finally {
      setComputing(false)
    }
  }

  const handleCreate = async () => {
    if (!projectId || !newName.trim()) return
    try {
      const created = await ipcInvoke('dataset:create', {
        projectId,
        name: newName.trim(),
        description: newDescription.trim() || undefined
      } as never)
      setDatasets((prev) => [...prev, created as Dataset])
      setSelectedDatasetId((created as Dataset).id)
      setNewName('')
      setNewDescription('')
      setShowCreate(false)
      toast('success', t('analysis.toast.createSuccess'))
    } catch {
      toast('error', t('analysis.toast.createFailed'))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await ipcInvoke('dataset:delete', id)
      setDatasets((prev) => prev.filter((d) => d.id !== id))
      if (selectedDatasetId === id) {
        setSelectedDatasetId(datasets.find((d) => d.id !== id)?.id ?? null)
      }
      toast('success', t('analysis.toast.deleteSuccess'))
    } catch {
      toast('error', t('analysis.toast.deleteFailed'))
    }
  }

  if (!projectId) {
    return <EmptyState icon={BarChart3} title={t('analysis.empty.selectProject')} description={t('analysis.empty.selectProjectDesc')} />
  }

  if (loading) {
    return <LoadingState message={t('analysis.loading.datasets')} />
  }

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId)

  // Prepare chart data for numeric charts
  const numericChartData = chartData
    .map((row) => ({ x: parseFloat(row[xColumn]), y: parseFloat(row[yColumn]), ...row }))
    .filter((d) => !isNaN(d.x) && !isNaN(d.y))

  // Histogram bins
  const histogramData = (() => {
    if (selectedChart !== 'histogram' || !xColumn || chartData.length === 0) return []
    const values = chartData.map((r) => parseFloat(r[xColumn])).filter((v) => !isNaN(v))
    if (values.length === 0) return []
    const min = Math.min(...values)
    const max = Math.max(...values)
    const binCount = Math.min(20, Math.ceil(Math.sqrt(values.length)))
    const binWidth = (max - min) / binCount || 1
    const bins: { range: string; count: number }[] = []
    for (let i = 0; i < binCount; i++) {
      const lo = min + i * binWidth
      const hi = lo + binWidth
      bins.push({ range: lo.toFixed(1), count: values.filter((v) => v >= lo && (i === binCount - 1 ? v <= hi : v < hi)).length })
    }
    return bins
  })()

  // Pie data
  const pieData = (() => {
    if (selectedChart !== 'pie' || !xColumn || chartData.length === 0) return []
    const counts: Record<string, number> = {}
    for (const row of chartData) {
      const val = row[xColumn] || 'N/A'
      counts[val] = (counts[val] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }))
  })()

  const renderChart = () => {
    if (!selectedDataset?.filePath) {
      return (
        <div className="h-80 rounded-xl border border-border bg-card flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <ScatterChart className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">{t('analysis.label.chartPreview')}</p>
            <p className="text-xs mt-1">{t('analysis.label.chartPreviewDesc')}</p>
          </div>
        </div>
      )
    }

    return (
      <div className="h-80 rounded-xl border border-border bg-card p-4">
        <ResponsiveContainer width="100%" height="100%">
          {selectedChart === 'scatter' ? (
            <RechartsScatter data={numericChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="x" name={xColumn} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis dataKey="y" name={yColumn} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Scatter fill="#3b82f6" fillOpacity={0.7} />
            </RechartsScatter>
          ) : selectedChart === 'bar' ? (
            <BarChart data={numericChartData.slice(0, 50)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="x" name={xColumn} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Bar dataKey="y" fill="#3b82f6" fillOpacity={0.8} />
            </BarChart>
          ) : selectedChart === 'line' ? (
            <RechartsLine data={numericChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="x" name={xColumn} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Line type="monotone" dataKey="y" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
            </RechartsLine>
          ) : selectedChart === 'histogram' ? (
            <BarChart data={histogramData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="range" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" fillOpacity={0.8} />
            </BarChart>
          ) : selectedChart === 'pie' ? (
            <RechartsPie>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPie>
          ) : (
            <BarChart data={numericChartData.slice(0, 50)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="x" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Bar dataKey="y" fill="#10b981" fillOpacity={0.8} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t('analysis.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            {t('analysis.button.importCsv')}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('analysis.button.newDataset')}
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {t('analysis.button.exportResults')}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-6 py-3 border-b border-border bg-card space-y-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('analysis.placeholder.datasetName')}
            className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background outline-none focus:border-blue-500"
          />
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder={t('analysis.placeholder.description')}
            className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground">{t('analysis.button.create')}</button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs rounded-md bg-secondary">{t('analysis.button.cancel')}</button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {/* Analysis Tabs */}
          <div className="flex items-center gap-1 px-6 pt-3 border-b border-border">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'datasets' && (
              <div className="space-y-4">
                {datasets.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium text-muted-foreground">{t('analysis.empty.noDatasets')}</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">{t('analysis.empty.noDatasetsDescription')}</p>
                    <button
                      onClick={handleImportCsv}
                      className="mt-4 px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {t('analysis.button.importCsv')}
                    </button>
                  </div>
                ) : (
                  datasets.map((ds) => (
                    <div
                      key={ds.id}
                      className={cn(
                        'p-4 rounded-xl border bg-card cursor-pointer transition-colors',
                        selectedDatasetId === ds.id ? 'border-primary' : 'border-border hover:border-primary/30'
                      )}
                      onClick={() => setSelectedDatasetId(ds.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-semibold">{ds.name}</h4>
                          {ds.description && (
                            <p className="text-xs text-muted-foreground mt-1">{ds.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {ds.rowCount != null && <span>{ds.rowCount} {t('analysis.label.rows')}</span>}
                            {ds.columnNames && <span>{ds.columnNames.length} {t('analysis.label.columns')}</span>}
                            {ds.fileType && <span>{ds.fileType}</span>}
                            <span>{new Date(ds.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {ds.filePath && !ds.summaryStats && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleComputeStats(ds.id) }}
                              disabled={computing}
                              className="p-1.5 rounded hover:bg-accent text-blue-500"
                              title={t('analysis.button.computeStats')}
                            >
                              <Calculator className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(ds.id) }}
                            className="p-1 rounded hover:bg-accent text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {ds.columnNames && ds.columnNames.length > 0 && (
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {ds.columnNames.map((col) => (
                            <span
                              key={col}
                              className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full font-medium bg-blue-500/10 text-blue-500"
                            >
                              <Hash className="w-2.5 h-2.5" />
                              {col}
                            </span>
                          ))}
                        </div>
                      )}

                      {ds.summaryStats && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-500">
                          <Calculator className="w-3 h-3" />
                          {t('analysis.label.statsComputed')}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'descriptive' && (
              <div className="space-y-4">
                {selectedDataset?.summaryStats && Object.keys(selectedDataset.summaryStats).length > 0 ? (
                  Object.entries(selectedDataset.summaryStats).map(([varName, stats]) => {
                    const s = stats as Record<string, number>
                    return (
                      <div key={varName} className="p-4 rounded-xl border border-border bg-card">
                        <h4 className="text-sm font-semibold mb-3">{varName}</h4>
                        <div className="grid grid-cols-5 gap-3">
                          {[
                            { label: 'N', value: s.n ?? '-' },
                            { label: t('analysis.stat.mean'), value: s.mean?.toFixed(3) ?? '-' },
                            { label: t('analysis.stat.median'), value: s.median?.toFixed(3) ?? '-' },
                            { label: t('analysis.stat.sd'), value: s.sd?.toFixed(3) ?? '-' },
                            { label: t('analysis.stat.min'), value: s.min ?? '-' },
                            { label: t('analysis.stat.max'), value: s.max ?? '-' },
                            { label: 'Q1', value: s.q1?.toFixed(3) ?? '-' },
                            { label: 'Q3', value: s.q3?.toFixed(3) ?? '-' },
                            { label: 'Var', value: s.variance?.toFixed(3) ?? '-' },
                            { label: 'Skew', value: s.skewness?.toFixed(3) ?? '-' }
                          ].map((stat) => (
                            <div key={stat.label} className="text-center p-2 rounded-lg bg-muted">
                              <p className="text-sm font-bold">{stat.value}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">{stat.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-12">
                    <Calculator className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-30" />
                    <p className="text-sm font-medium text-muted-foreground">{t('analysis.empty.noStats')}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedDataset ? t('analysis.empty.noSummaryStats') : t('analysis.empty.selectDataset')}
                    </p>
                    {selectedDataset?.filePath && (
                      <button
                        onClick={() => handleComputeStats(selectedDataset.id)}
                        disabled={computing}
                        className="mt-4 px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {computing ? 'Computing...' : t('analysis.button.computeStats')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'visualization' && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  {CHART_TYPES.map((ct) => (
                    <button
                      key={ct.id}
                      onClick={() => setSelectedChart(ct.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
                        selectedChart === ct.id
                          ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                          : 'border-border hover:bg-accent'
                      )}
                    >
                      <ct.icon className="w-3.5 h-3.5" />
                      {ct.label}
                    </button>
                  ))}
                </div>

                {chartHeaders.length > 0 && (
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-muted-foreground">X:</label>
                      <select
                        value={xColumn}
                        onChange={(e) => setXColumn(e.target.value)}
                        className="px-2 py-1 text-xs rounded-md border border-border bg-background"
                      >
                        {chartHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                    {selectedChart !== 'pie' && selectedChart !== 'histogram' && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-muted-foreground">Y:</label>
                        <select
                          value={yColumn}
                          onChange={(e) => setYColumn(e.target.value)}
                          className="px-2 py-1 text-xs rounded-md border border-border bg-background"
                        >
                          {chartHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground">{chartData.length} rows</span>
                  </div>
                )}

                {renderChart()}
              </div>
            )}

            {activeTab === 'meta-analysis' && (
              <div className="p-5 rounded-xl border border-border bg-card text-center">
                <Sigma className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-30" />
                <p className="text-sm font-medium">{t('analysis.label.metaAnalysisModule')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('analysis.label.metaAnalysisDesc')}</p>
                <button className="mt-4 px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground">
                  {t('analysis.button.importStudyResults')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* AI Suggestions Panel */}
        <div className="w-72 border-l border-border overflow-y-auto p-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            {t('analysis.label.aiSuggestions')}
          </h3>
          {selectedDataset ? (
            <div className="space-y-2">
              {selectedDataset.filePath && !selectedDataset.summaryStats && (
                <div
                  className="p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => handleComputeStats(selectedDataset.id)}
                >
                  <h4 className="text-xs font-semibold">{t('analysis.ai.analyzeDataset')}</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                    {`${t('analysis.ai.analyzeDataset')}: ${selectedDataset.name}`}
                  </p>
                </div>
              )}
              {selectedDataset.summaryStats && (
                <div
                  className="p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => setActiveTab('visualization')}
                >
                  <h4 className="text-xs font-semibold">{t('analysis.ai.visualizeData')}</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                    {t('analysis.ai.visualizeDataDesc')}
                  </p>
                </div>
              )}
              {selectedDataset.columnNames && selectedDataset.columnNames.length >= 2 && (
                <div className="p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer">
                  <h4 className="text-xs font-semibold">{t('analysis.ai.exploreCorrelations')}</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                    {t('analysis.ai.checkCorrelations')}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t('analysis.empty.selectForSuggestions')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
