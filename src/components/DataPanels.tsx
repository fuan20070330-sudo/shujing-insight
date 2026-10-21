import { useMemo, useState } from 'react'
import type { AnalysisResult, ColumnType } from '../types'

const typeLabels: Record<ColumnType, string> = {
  number: '数值',
  category: '类别',
  date: '日期',
  text: '文本',
}

function formatStat(value?: number): string {
  if (value === undefined) return '—'
  if (Math.abs(value) >= 10000) return Math.round(value).toLocaleString('zh-CN')
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function FieldProfilePanel({ analysis }: { analysis: AnalysisResult }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'all' | ColumnType>('all')
  const filtered = useMemo(
    () => analysis.fields.filter((field) => (type === 'all' || field.type === type) && field.name.toLowerCase().includes(query.toLowerCase())),
    [analysis.fields, query, type],
  )
  return (
    <section className="data-panel" id="profile">
      <div className="panel-heading">
        <div>
          <p className="mini-label">FIELD PROFILING / 字段画像</p>
          <h2>先理解数据，再相信结论</h2>
          <p>自动识别数值、类别、日期与文本字段，并给出缺失率、分布与代表值。</p>
        </div>
        <div className="panel-tools">
          <label className="search-field">
            <span className="sr-only">搜索字段</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索字段…" />
          </label>
          <select aria-label="字段类型筛选" value={type} onChange={(event) => setType(event.target.value as 'all' | ColumnType)}>
            <option value="all">全部类型</option>
            <option value="number">数值</option>
            <option value="category">类别</option>
            <option value="date">日期</option>
            <option value="text">文本</option>
          </select>
        </div>
      </div>
      <div className="profile-table-wrap">
        <table className="profile-table">
          <thead>
            <tr><th>字段</th><th>类型</th><th>有效 / 缺失</th><th>唯一值</th><th>统计画像</th><th>高频值</th></tr>
          </thead>
          <tbody>
            {filtered.map((field) => (
              <tr key={field.name}>
                <td><strong>{field.name}</strong></td>
                <td><span className={`type-pill type-${field.type}`}>{typeLabels[field.type]}</span></td>
                <td><span>{field.nonNull.toLocaleString()}</span><small>{field.missing ? ` / ${field.missing} 缺失` : ' / 完整'}</small></td>
                <td>{field.unique.toLocaleString()}</td>
                <td>
                  {field.type === 'number' ? (
                    <span className="stat-inline">均值 <b>{formatStat(field.mean)}</b> · 中位 <b>{formatStat(field.median)}</b> · 范围 <b>{formatStat(field.min)}–{formatStat(field.max)}</b></span>
                  ) : field.type === 'date' ? (
                    <span className="stat-inline">{field.minDate ?? '—'} → {field.maxDate ?? '—'}</span>
                  ) : (
                    <span className="stat-inline muted">类别字段，按频次概览</span>
                  )}
                </td>
                <td>
                  <div className="value-pills">
                    {field.topValues?.slice(0, 3).map((item) => <span key={item.value}>{item.value}<small>{item.count}</small></span>)}
                    {!field.topValues?.length && <span>—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <div className="table-empty">没有匹配的字段。</div>}
      </div>
    </section>
  )
}

export function QualityPanel({ analysis }: { analysis: AnalysisResult }) {
  const missingIssues = analysis.quality.issues.filter((issue) => issue.type === 'missing')
  const outlierIssues = analysis.quality.issues.filter((issue) => issue.type === 'outlier')
  return (
    <section className="data-panel" id="quality">
      <div className="panel-heading">
        <div>
          <p className="mini-label">QUALITY GATE / 质量闸门</p>
          <h2>把脏数据问题摆到结论前面</h2>
          <p>缺失和异常不会被静默忽略，它们既进入质量清单，也可能成为优先洞察。</p>
        </div>
      </div>
      <div className="quality-summary-grid">
        <article>
          <span>缺失单元格</span>
          <strong>{analysis.quality.missingCells.toLocaleString()}</strong>
          <small>{(analysis.quality.missingRate * 100).toFixed(2)}% of cells</small>
        </article>
        <article>
          <span>涉及缺失字段</span>
          <strong>{missingIssues.length}</strong>
          <small>阈值 ≥ 0.5%</small>
        </article>
        <article>
          <span>IQR 异常单元格</span>
          <strong>{analysis.quality.outlierCells.toLocaleString()}</strong>
          <small>{analysis.quality.outlierFields} 个字段</small>
        </article>
        <article>
          <span>当前样本量</span>
          <strong>{analysis.filteredRowCount.toLocaleString()}</strong>
          <small>完整数据 {analysis.totalRowCount.toLocaleString()}</small>
        </article>
      </div>
      <div className="quality-columns">
        <div>
          <h3>缺失检查</h3>
          {missingIssues.length ? missingIssues.map((issue) => (
            <div className="quality-row" key={`missing-${issue.field}`}>
              <span className="quality-mark missing">M</span>
              <div><strong>{issue.field}</strong><p>{issue.detail}</p></div>
              <b>{issue.count}</b>
            </div>
          )) : <p className="muted">未发现超过 0.5% 阈值的字段缺失。</p>}
        </div>
        <div>
          <h3>异常检查</h3>
          {outlierIssues.length ? outlierIssues.map((issue) => (
            <div className="quality-row" key={`outlier-${issue.field}`}>
              <span className="quality-mark outlier">!</span>
              <div><strong>{issue.field}</strong><p>{issue.detail}</p></div>
              <b>{issue.count}</b>
            </div>
          )) : <p className="muted">当前字段未检出 IQR 异常。</p>}
        </div>
      </div>
      <div className="quality-note">
        <strong>处理建议</strong>
        <span>异常不自动删除；缺失不自动插补。请结合原始采集口径判断是错误、特殊事件，还是真实差异。</span>
      </div>
    </section>
  )
}

export function MethodPanel() {
  return (
    <section className="method-section" id="method">
      <div className="method-intro">
        <p className="mini-label">METHODOLOGY / 方法透明</p>
        <h2>不是“AI 说什么就是什么”</h2>
        <p>数镜把推荐逻辑写成可检查、可复现的统计规则。每条洞察都保留样本量、检验方法、效应量与证据表。</p>
      </div>
      <div className="method-cards">
        <article><span>01</span><h3>相关关系</h3><p>Pearson 相关系数 + 双侧显著性检验。始终标注“相关不等同因果”。</p></article>
        <article><span>02</span><h3>分组差异</h3><p>两组使用 Welch t 检验；多组使用 ANOVA，并同时报告 Cohen's d 或 η²。</p></article>
        <article><span>03</span><h3>结构变化</h3><p>时间聚合后进行单变点扫描，用 99 次固定种子置换检验控制“挑最大点”的偏差。</p></article>
        <article><span>04</span><h3>异常复核</h3><p>Tukey IQR 栅栏识别越界记录；只提示复核，不自动判定为错误。</p></article>
      </div>
    </section>
  )
}

export function DataPanels({ mode, analysis }: { mode: 'profile' | 'quality'; analysis: AnalysisResult }) {
  return mode === 'profile' ? <FieldProfilePanel analysis={analysis} /> : <QualityPanel analysis={analysis} />
}
