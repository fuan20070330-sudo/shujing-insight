import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnalysisResult, DataRow, DatasetInfo, FollowUp, ImportResult, Insight } from './types'
import { applyFilters, insightKindLabel, makeFilterLabel } from './lib/analysis'
import { importFile, loadDemoDataset } from './lib/importer'
import { runAnalysis } from './lib/runner'
import { downloadTextFile, exportHtmlReport, exportMarkdownReport } from './lib/report'
import { ChartView } from './components/ChartView'
import { DataPanels, MethodPanel } from './components/DataPanels'
import { EvidenceDrawer } from './components/EvidenceDrawer'
import { FilterBar } from './components/FilterBar'

type AppStatus = 'idle' | 'loading' | 'analyzing' | 'ready' | 'error'
type WorkspaceTab = 'insights' | 'profile' | 'quality'

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 42 42" focusable="false">
        <path d="M8 9.5 21 4l13 5.5v23L21 38 8 32.5z" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <path d="M14 26.5 19.2 19l4.7 3.9L29 14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="29" cy="14" r="2.4" fill="currentColor" />
      </svg>
    </span>
  )
}

function SiteHeader({ onImport, hasData }: { onImport: () => void; hasData: boolean }) {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="数镜首页">
        <BrandMark />
        <span className="brand-copy"><b>数镜</b><small>SHUJING INSIGHT</small></span>
      </a>
      <nav aria-label="主导航">
        <a href={hasData ? '#workspace' : '#flow'}>演示流程</a>
        <a href="#method">方法透明</a>
        <a href="#about">关于作品</a>
      </nav>
      <div className="header-actions">
        <span className="privacy-pill"><i />浏览器本地计算</span>
        <button className="button button-small button-outline" onClick={onImport}>导入数据</button>
      </div>
    </header>
  )
}

function Hero({ onDemo, onImport, onFile, busy }: { onDemo: () => void; onImport: () => void; onFile: (file: File) => void; busy: boolean }) {
  const [dragging, setDragging] = useState(false)
  return (
    <main className="landing" id="top">
      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow"><span>2026 中国大学生计算机设计大赛</span><i />大数据应用 · 信息可视化</div>
          <h1>让每一个结论，<br /><em>都有一条回家的路。</em></h1>
          <p className="hero-lead">数镜从原始表格出发，自动完成字段画像、异常检查、统计检验与图表推荐。每一条洞察都能回到筛选条件、样本量、方法和证据表。</p>
          <div className="hero-actions">
            <button className="button button-primary button-large" onClick={onDemo} disabled={busy}>
              <span className="button-spark" aria-hidden="true">↗</span>载入示例数据
            </button>
            <button className="button button-ghost button-large" onClick={onImport} disabled={busy}>导入 CSV / XLSX</button>
          </div>
          <p className="hero-footnote"><span>●</span> 无需账号 · 无需 GPU · 无必需外部 AI API · 数据不离开浏览器</p>
        </div>
        <div className="hero-visual" aria-label="证据链洞察示例">
          <div className="visual-orbit orbit-one" />
          <div className="visual-orbit orbit-two" />
          <div className="insight-preview">
            <div className="preview-top"><span>INSIGHT / 01</span><b>置信度 高</b></div>
            <p className="preview-kicker">结构变化 · 时间序列</p>
            <h2>商业活力指数在 2024-06 前后出现均值上升</h2>
            <div className="mini-bars" aria-hidden="true">
              {[32, 36, 34, 41, 45, 43, 49, 66, 72, 78, 74, 83].map((height, index) => (
                <span key={index} className={index === 7 ? 'turning' : ''} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="preview-evidence">
              <div><small>样本量</small><strong>720</strong></div>
              <div><small>置换检验</small><strong>p &lt; .01</strong></div>
              <div><small>效应量</small><strong>d = 1.42</strong></div>
            </div>
            <button className="preview-link" tabIndex={-1}>查看完整证据表 <span>→</span></button>
          </div>
          <div className="floating-card floating-card-top"><span>TRACE</span><b>筛选 → 检验 → 结论</b></div>
          <div className="floating-card floating-card-bottom"><i>✓</i><span>相关关系已标注<br /><b>非因果</b></span></div>
        </div>
      </section>

      <section className="trust-strip" aria-label="作品特性">
        <div><strong>100%</strong><span>浏览器内计算</span></div>
        <div><strong>8</strong><span>类自动证据检查</span></div>
        <div><strong>0</strong><span>必需外部 AI 服务</span></div>
        <div><strong>∞</strong><span>结论可追问次数</span></div>
      </section>

      <section className="flow-section" id="flow">
        <div className="section-intro">
          <p className="mini-label">FROM DATA TO EVIDENCE / 从数据到证据</p>
          <h2>一条可以被复核的分析路径</h2>
          <p>不是一键生成“看起来正确”的结论，而是把每一步计算摊开给你看。</p>
        </div>
        <div className="flow-grid">
          <article className="flow-card flow-card-dark">
            <span className="flow-number">01</span>
            <div className="flow-icon">↓</div>
            <h3>输入原始数据</h3>
            <p>拖入 CSV / XLSX，或使用合成演示数据。解析、画像和计算全部发生在当前浏览器。</p>
            <div className="flow-tags"><span>CSV</span><span>XLSX</span><span>自动类型</span></div>
          </article>
          <article className="flow-card">
            <span className="flow-number">02</span>
            <div className="flow-icon">⌁</div>
            <h3>让证据浮出水面</h3>
            <p>缺失、异常、相关性、分组差异与时间变点统一进入证据池，再按强度与可复核性排序。</p>
            <div className="flow-tags"><span>p 值</span><span>效应量</span><span>样本量</span></div>
          </article>
          <article className="flow-card">
            <span className="flow-number">03</span>
            <div className="flow-icon">◎</div>
            <h3>叙事、追问与导出</h3>
            <p>用推荐图表讲清结论，沿追问链继续下钻，并把完整证据报告导出为 Markdown 或 HTML。</p>
            <div className="flow-tags"><span>图表推荐</span><span>追问下钻</span><span>报告</span></div>
          </article>
        </div>
      </section>

      <section
        className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const file = event.dataTransfer.files[0]
          if (file) onFile(file)
        }}
      >
        <div className="drop-visual"><span>CSV</span><span>XLSX</span></div>
        <div>
          <h2>把你的数据放到这里</h2>
          <p>支持 .csv、.xlsx、.xls，最大 20 MB。字段越多、样本越充分，可复核的洞察越丰富。</p>
        </div>
        <button className="button button-outline" onClick={onImport}>选择本地文件</button>
        <p className="drop-safety">本地解析 · 不上传服务器 · 刷新即清除</p>
      </section>
    </main>
  )
}

function ProcessingScreen({ status, message }: { status: AppStatus; message: string }) {
  return (
    <main className="processing-screen" id="top">
      <div className="processing-card">
        <div className="processing-symbol"><BrandMark /><span className="processing-pulse" /></div>
        <p className="mini-label">SHUJING ENGINE / 正在分析</p>
        <h1>{status === 'loading' ? '正在读取并解析数据' : '正在构建可复核的证据链'}</h1>
        <p>{message || '启动浏览器分析线程…'}</p>
        <div className="process-steps">
          <span className={status === 'loading' ? 'active' : 'done'}>解析文件</span>
          <i />
          <span className={status === 'analyzing' ? 'active' : ''}>字段画像</span>
          <i />
          <span>统计检验</span>
          <i />
          <span>洞察排序</span>
        </div>
        <div className="indeterminate-bar"><span /></div>
        <small>大文件分析会在 Web Worker 中进行，界面保持响应。</small>
      </div>
    </main>
  )
}

function ErrorScreen({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <main className="error-screen" id="top">
      <div className="error-card">
        <div className="error-mark">!</div>
        <p className="mini-label">ANALYSIS HALTED / 分析中断</p>
        <h1>这份数据暂时没能通过分析入口</h1>
        <p>{message}</p>
        <div className="error-actions">
          <button className="button button-primary" onClick={onReset}>返回首页</button>
          <a className="button button-ghost" href="#flow">查看导入说明</a>
        </div>
        <small>请确认文件未损坏、至少包含两列数据，并且不超过 20 MB。</small>
      </div>
    </main>
  )
}

function formatP(value?: number): string {
  if (value === undefined) return '未检验'
  if (value < 0.001) return 'p < 0.001'
  return `p = ${value.toFixed(3)}`
}

function InsightWorkbench({
  analysis,
  rows,
  selectedInsight,
  onSelect,
  onOpenEvidence,
  onFollowUp,
  followupHistory,
}: {
  analysis: AnalysisResult
  rows: DataRow[]
  selectedInsight: Insight | null
  onSelect: (insight: Insight) => void
  onOpenEvidence: () => void
  onFollowUp: (followUp: FollowUp) => void
  followupHistory: string[]
}) {
  if (!analysis.insights.length) {
    return (
      <div className="no-insights">
        <span>∅</span>
        <h3>当前筛选下没有可展示的洞察</h3>
        <p>可能是筛选后样本量不足，或没有结果通过 p 值与效应量的双重阈值。请清除筛选或导入更充分的数据。</p>
      </div>
    )
  }

  return (
    <div className="insight-workbench">
      <aside className="insight-list" aria-label="洞察排序列表">
        <div className="insight-list-heading">
          <p className="mini-label">RANKED EVIDENCE / 洞察排序</p>
          <span>{analysis.insights.length} 条通过阈值</span>
        </div>
        {analysis.insights.map((insight, index) => (
          <button
            key={insight.id}
            className={`insight-card ${selectedInsight?.id === insight.id ? 'is-active' : ''}`}
            onClick={() => onSelect(insight)}
            aria-pressed={selectedInsight?.id === insight.id}
            data-testid="insight-card"
          >
            <span className="insight-rank">{String(index + 1).padStart(2, '0')}</span>
            <span className="insight-card-body">
              <span className={`kind-badge kind-${insight.kind}`}>{insightKindLabel(insight.kind)}</span>
              <strong>{insight.title}</strong>
              <small>{insight.sampleSize.toLocaleString()} 条证据 · {insight.effectLabel} {insight.effectValue}</small>
              <span className="score-track"><i style={{ width: `${Math.min(100, insight.score)}%` }} /></span>
            </span>
            <span className="insight-score">{Math.round(insight.score)}<small>score</small></span>
          </button>
        ))}
      </aside>

      {selectedInsight && (
        <div className="insight-main">
          <div className="insight-narrative">
            <div className="narrative-topline">
              <span className={`kind-badge kind-${selectedInsight.kind}`}>{insightKindLabel(selectedInsight.kind)}</span>
              <span className={`confidence confidence-${selectedInsight.confidence}`}>置信标记 · {selectedInsight.confidence === 'high' ? '高' : selectedInsight.confidence === 'medium' ? '中' : '低'}</span>
            </div>
            <h2>{selectedInsight.title}</h2>
            <p>{selectedInsight.summary}</p>
            <div className="evidence-metrics">
              <div><small>样本量 n</small><strong>{selectedInsight.sampleSize.toLocaleString()}</strong></div>
              <div><small>{selectedInsight.effectLabel}</small><strong>{selectedInsight.effectValue}</strong></div>
              <div><small>显著性</small><strong>{formatP(selectedInsight.pValue)}</strong></div>
              <div><small>排序分</small><strong>{selectedInsight.score.toFixed(1)}</strong></div>
            </div>
          </div>

          <ChartView insight={selectedInsight} analysis={analysis} rows={rows} />

          <div className="trace-strip">
            <div><b>01</b><span>数据视图</span><strong>{analysis.filteredRowCount.toLocaleString()} 条</strong></div>
            <i>→</i>
            <div><b>02</b><span>统计方法</span><strong>{selectedInsight.method}</strong></div>
            <i>→</i>
            <div><b>03</b><span>证据口径</span><strong>{selectedInsight.effectLabel} + {formatP(selectedInsight.pValue)}</strong></div>
          </div>

          <div className="followup-area">
            <div>
              <p className="mini-label">FOLLOW-UP / 追问式下钻</p>
              <h3>结论不是终点，继续问下去</h3>
              <p>每次追问都会生成一个新的筛选条件，并重新计算全部统计证据。</p>
            </div>
            <div className="followup-actions">
              {selectedInsight.followUps.map((followUp) => (
                <button key={followUp.label} onClick={() => onFollowUp(followUp)}>
                  {followUp.label}<span>→</span>
                </button>
              ))}
              <button className="evidence-cta" onClick={onOpenEvidence}>打开完整证据抽屉 <span>↗</span></button>
            </div>
          </div>

          {followupHistory.length > 0 && (
            <div className="followup-history">
              <span>追问链</span>
              {followupHistory.map((prompt, index) => (
                <div key={`${prompt}-${index}`}><b>{String(index + 1).padStart(2, '0')}</b><p>{prompt}</p></div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Dashboard({
  dataset,
  rows,
  analysis,
  filters,
  selectedInsight,
  followupHistory,
  status,
  progress,
  activeTab,
  onTabChange,
  onAddFilter,
  onRemoveFilter,
  onResetFilters,
  onSelectInsight,
  onFollowUp,
  onOpenEvidence,
  onImport,
  onExport,
  onNew,
}: {
  dataset: DatasetInfo
  rows: DataRow[]
  analysis: AnalysisResult
  filters: AnalysisResult['filters']
  selectedInsight: Insight | null
  followupHistory: string[]
  status: AppStatus
  progress: string
  activeTab: WorkspaceTab
  onTabChange: (tab: WorkspaceTab) => void
  onAddFilter: (filter: AnalysisResult['filters'][number]) => void
  onRemoveFilter: (index: number) => void
  onResetFilters: () => void
  onSelectInsight: (insight: Insight) => void
  onFollowUp: (followUp: FollowUp) => void
  onOpenEvidence: () => void
  onImport: () => void
  onExport: (format: 'markdown' | 'html') => void
  onNew: () => void
}) {
  const visibleRows = useMemo(() => applyFilters(rows, filters), [rows, filters])
  return (
    <main className="dashboard" id="top">
      <section className="dashboard-head" id="workspace">
        <div className="dashboard-breadcrumb">
          <span>数镜工作台</span><i>/</i><span>{dataset.source === 'demo' ? '合成演示数据' : '本地导入数据'}</span>
        </div>
        <div className="dashboard-title-row">
          <div>
            <div className="dataset-title-tags">
              <span className="data-source-pill">{dataset.source.toUpperCase()}</span>
              <span>{dataset.fields.length} 个字段</span>
              <span>{dataset.originalRowCount.toLocaleString()} 条原始记录</span>
            </div>
            <h1>{dataset.name}</h1>
            <p>分析完成于 {new Date(analysis.generatedAt).toLocaleString('zh-CN')} · 用时 {analysis.durationMs} ms · 浏览器 Web Worker</p>
          </div>
          <div className="dashboard-actions">
            <button className="button button-ghost" onClick={onNew}>新建分析</button>
            <button className="button button-ghost" onClick={onImport}>更换数据</button>
            <button className="button button-primary" onClick={() => onExport('html')} data-testid="export-report">导出报告</button>
            <button className="button button-icon-text" onClick={() => onExport('markdown')}>MD</button>
          </div>
        </div>

        {dataset.warnings.length > 0 && (
          <div className="data-warning">
            <span>i</span>
            <p>{dataset.warnings.join(' ')}</p>
          </div>
        )}

        {analysis.largeDataMode && (
          <div className="large-data-banner">
            <span>LARGE DATA MODE</span>
            <p>已启用大样本模式：统计在 Worker 中执行，散点图采用确定性抽样展示，分析结论仍基于完整当前视图。</p>
          </div>
        )}

        <div className="overview-grid">
          <article><span>当前记录</span><strong>{analysis.filteredRowCount.toLocaleString()}</strong><small>完整数据 {analysis.totalRowCount.toLocaleString()} 条</small></article>
          <article><span>字段画像</span><strong>{analysis.fields.length}</strong><small>{analysis.fields.filter((field) => field.type === 'number').length} 个数值字段</small></article>
          <article><span>数据缺失</span><strong>{(analysis.quality.missingRate * 100).toFixed(2)}%</strong><small>{analysis.quality.missingCells.toLocaleString()} 个单元格</small></article>
          <article className="accent-metric"><span>可复核洞察</span><strong>{analysis.insights.length}</strong><small>已通过显著性 + 效应量阈值</small></article>
        </div>
      </section>

      <section className="analysis-surface" aria-busy={status === 'analyzing'}>
        <FilterBar
          fields={analysis.fields}
          rows={rows}
          filters={filters}
          filteredCount={analysis.filteredRowCount}
          totalCount={analysis.totalRowCount}
          onAdd={onAddFilter}
          onRemove={onRemoveFilter}
          onReset={onResetFilters}
        />

        <div className="workspace-tabs" role="tablist" aria-label="分析工作区">
          <button role="tab" aria-selected={activeTab === 'insights'} className={activeTab === 'insights' ? 'active' : ''} onClick={() => onTabChange('insights')}>洞察工作台 <span>{analysis.insights.length}</span></button>
          <button role="tab" aria-selected={activeTab === 'profile'} className={activeTab === 'profile' ? 'active' : ''} onClick={() => onTabChange('profile')}>字段画像 <span>{analysis.fields.length}</span></button>
          <button role="tab" aria-selected={activeTab === 'quality'} className={activeTab === 'quality' ? 'active' : ''} onClick={() => onTabChange('quality')}>质量检查 <span>{analysis.quality.issues.length}</span></button>
          {status === 'analyzing' && <span className="inline-processing"><i />{progress}</span>}
        </div>

        {activeTab === 'insights' && (
          <InsightWorkbench
            analysis={analysis}
            rows={visibleRows}
            selectedInsight={selectedInsight}
            onSelect={onSelectInsight}
            onOpenEvidence={onOpenEvidence}
            onFollowUp={onFollowUp}
            followupHistory={followupHistory}
          />
        )}
        {activeTab === 'profile' && <DataPanels mode="profile" analysis={analysis} />}
        {activeTab === 'quality' && <DataPanels mode="quality" analysis={analysis} />}
      </section>

      <MethodPanel />
    </main>
  )
}

function SiteFooter() {
  const gatewayConfigured = Boolean(import.meta.env.VITE_WS_GATEWAY_URL)
  return (
    <footer className="site-footer" id="about">
      <div className="footer-brand">
        <BrandMark />
        <div><b>数镜 · Shujing Insight</b><p>可验证自动数据洞察与叙事平台</p></div>
      </div>
      <div className="footer-copy">
        <p>面向前端静态部署设计。核心分析与报告生成在浏览器内完成，GitHub Pages 仅托管静态资源。</p>
        <p><span>可选 WebSocket 网关：{gatewayConfigured ? '已配置（增强模式）' : '未配置（静态功能完整可用）'}</span><span>无外部 AI API 依赖</span></p>
      </div>
      <div className="footer-signature">
        <span>DATA → EVIDENCE → NARRATIVE</span>
        <small>中国大学生计算机设计大赛参赛作品</small>
      </div>
    </footer>
  )
}

export default function App() {
  const [status, setStatus] = useState<AppStatus>('idle')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [rows, setRows] = useState<DataRow[]>([])
  const [dataset, setDataset] = useState<DatasetInfo | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [filters, setFilters] = useState<AnalysisResult['filters']>([])
  const [selectedId, setSelectedId] = useState('')
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [followupHistory, setFollowupHistory] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('insights')
  const [toast, setToast] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 3000)
  }, [])

  useEffect(() => () => {
    abortRef.current?.abort()
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
  }, [])

  const performAnalysis = useCallback(async (sourceRows: DataRow[], nextFilters: AnalysisResult['filters'], sourceDataset: DatasetInfo) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('analyzing')
    setProgress('正在启动浏览器分析线程…')
    try {
      const result = await runAnalysis(
        {
          rows: sourceRows,
          filters: nextFilters,
          totalRowCount: sourceRows.length,
          datasetName: sourceDataset.name,
        },
        (message) => setProgress(message),
        controller.signal,
      )
      if (controller.signal.aborted) return
      setAnalysis(result)
      setFilters(nextFilters)
      setStatus('ready')
      setProgress('')
      setSelectedId((current) => result.insights.some((insight) => insight.id === current) ? current : result.insights[0]?.id ?? '')
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setError(caught instanceof Error ? caught.message : '分析过程中发生未知错误。')
      setStatus('error')
    }
  }, [])

  const acceptImport = useCallback(async (result: ImportResult) => {
    const info: DatasetInfo = {
      name: result.name,
      source: result.source,
      importedAt: new Date().toISOString(),
      originalRowCount: result.rows.length,
      warnings: result.warnings,
      fields: result.fields,
    }
    setRows(result.rows)
    setDataset(info)
    setAnalysis(null)
    setFilters([])
    setFollowupHistory([])
    setSelectedId('')
    setEvidenceOpen(false)
    setActiveTab('insights')
    await performAnalysis(result.rows, [], info)
  }, [performAnalysis])

  const handleDemo = useCallback(async () => {
    setStatus('loading')
    setProgress('正在读取合成演示数据…')
    setError('')
    try {
      const result = await loadDemoDataset()
      await acceptImport(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '示例数据加载失败。')
      setStatus('error')
    }
  }, [acceptImport])

  const handleFile = useCallback(async (file: File) => {
    setStatus('loading')
    setProgress(`正在解析 ${file.name}…`)
    setError('')
    try {
      const result = await importFile(file)
      await acceptImport(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '文件导入失败。')
      setStatus('error')
    }
  }, [acceptImport])

  const reset = () => {
    abortRef.current?.abort()
    setStatus('idle')
    setProgress('')
    setError('')
    setRows([])
    setDataset(null)
    setAnalysis(null)
    setFilters([])
    setSelectedId('')
    setEvidenceOpen(false)
    setFollowupHistory([])
    setActiveTab('insights')
    if (inputRef.current) inputRef.current.value = ''
  }

  const addFilter = (filter: AnalysisResult['filters'][number]) => {
    if (!dataset) return
    const next = [...filters, filter]
    void performAnalysis(rows, next, dataset)
  }

  const removeFilter = (index: number) => {
    if (!dataset) return
    const next = filters.filter((_, filterIndex) => filterIndex !== index)
    void performAnalysis(rows, next, dataset)
  }

  const clearFilters = () => {
    if (!dataset) return
    setFollowupHistory([])
    void performAnalysis(rows, [], dataset)
  }

  const handleFollowUp = (followUp: FollowUp) => {
    if (!dataset) return
    if (!followUp.filter) {
      showToast(followUp.prompt)
      return
    }
    const label = makeFilterLabel(followUp.filter)
    const nextFilter = { ...followUp.filter, label }
    const next = [...filters, nextFilter]
    setFollowupHistory((history) => [...history, followUp.prompt])
    setEvidenceOpen(false)
    void performAnalysis(rows, next, dataset)
  }

  const selectedInsight = useMemo(
    () => analysis?.insights.find((insight) => insight.id === selectedId) ?? analysis?.insights[0] ?? null,
    [analysis, selectedId],
  )

  const handleExport = (format: 'markdown' | 'html') => {
    if (!analysis || !dataset) return
    const safeName = dataset.name.replace(/[\\/:*?"<>|]/g, '-').slice(0, 48)
    const stamp = new Date().toISOString().slice(0, 10)
    if (format === 'markdown') {
      downloadTextFile(exportMarkdownReport(dataset, analysis), `数镜-洞察报告-${safeName}-${stamp}.md`, 'text/markdown')
      showToast('Markdown 报告已导出')
    } else {
      downloadTextFile(exportHtmlReport(dataset, analysis), `数镜-洞察报告-${safeName}-${stamp}.html`, 'text/html')
      showToast('HTML 报告已导出，可用浏览器打开或打印为 PDF')
    }
  }

  const openFilePicker = () => inputRef.current?.click()
  const appBusy = status === 'loading' || status === 'analyzing'

  return (
    <div className="app-shell">
      <SiteHeader onImport={openFilePicker} hasData={Boolean(analysis)} />
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.xlsx,.xls,text/csv"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
          event.target.value = ''
        }}
        aria-label="选择 CSV 或 Excel 数据文件"
      />

      {status === 'idle' && (
        <Hero onDemo={() => void handleDemo()} onImport={openFilePicker} onFile={(file) => void handleFile(file)} busy={appBusy} />
      )}
      {status === 'loading' || status === 'analyzing' ? <ProcessingScreen status={status} message={progress} /> : null}
      {status === 'error' && <ErrorScreen message={error} onReset={reset} />}
      {status === 'ready' && analysis && dataset && (
        <Dashboard
          dataset={dataset}
          rows={rows}
          analysis={analysis}
          filters={filters}
          selectedInsight={selectedInsight}
          followupHistory={followupHistory}
          status={status}
          progress={progress}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onAddFilter={addFilter}
          onRemoveFilter={removeFilter}
          onResetFilters={clearFilters}
          onSelectInsight={(insight) => setSelectedId(insight.id)}
          onFollowUp={handleFollowUp}
          onOpenEvidence={() => setEvidenceOpen(true)}
          onImport={openFilePicker}
          onExport={handleExport}
          onNew={reset}
        />
      )}

      {(status === 'idle' || status === 'ready') && <SiteFooter />}

      {status === 'ready' && selectedInsight && dataset && (
        <EvidenceDrawer
          insight={evidenceOpen ? selectedInsight : null}
          dataset={dataset}
          onClose={() => setEvidenceOpen(false)}
          onFollowUp={handleFollowUp}
        />
      )}

      <div className={`toast ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite">{toast}</div>
    </div>
  )
}
