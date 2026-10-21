import { useEffect, useState } from 'react'
import type { DatasetInfo, FollowUp, Insight } from '../types'
import { insightKindLabel } from '../lib/analysis'

interface EvidenceDrawerProps {
  insight: Insight | null
  dataset: DatasetInfo
  onClose: () => void
  onFollowUp: (followUp: FollowUp) => void
}

function formatP(value?: number): string {
  if (value === undefined) return '未检验'
  if (value < 0.001) return 'p < 0.001'
  return `p = ${value.toFixed(3)}`
}

export function EvidenceDrawer({ insight, dataset, onClose, onFollowUp }: EvidenceDrawerProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!insight) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('drawer-open')
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('drawer-open')
    }
  }, [insight, onClose])

  if (!insight) return null

  const copyEvidence = async () => {
    const trace = {
      dataset: dataset.name,
      generatedAt: new Date().toISOString(),
      insight: {
        title: insight.title,
        kind: insight.kind,
        sampleSize: insight.sampleSize,
        method: insight.method,
        effect: { label: insight.effectLabel, value: insight.effectValue },
        pValue: insight.pValue ?? null,
        filters: insight.filters.map((filter) => filter.label),
        caveat: insight.caveat,
        evidence: insight.evidence.rows,
      },
    }
    await navigator.clipboard.writeText(JSON.stringify(trace, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="drawer-layer" role="presentation">
      <button className="drawer-scrim" onClick={onClose} aria-label="关闭证据抽屉" />
      <aside className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="evidence-title">
        <div className="drawer-top">
          <div>
            <p className="mini-label">PROVENANCE / 证据链</p>
            <h2 id="evidence-title">这项结论如何得出？</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭证据抽屉">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="trace-chain" aria-label="证据追溯链">
          <div><b>01</b><span>数据</span><small>{dataset.name}</small></div>
          <i aria-hidden="true">→</i>
          <div><b>02</b><span>证据</span><small>{insight.method}</small></div>
          <i aria-hidden="true">→</i>
          <div><b>03</b><span>结论</span><small>{insightKindLabel(insight.kind)}</small></div>
        </div>

        <section className="drawer-section drawer-insight">
          <span className={`kind-badge kind-${insight.kind}`}>{insightKindLabel(insight.kind)}</span>
          <h3>{insight.title}</h3>
          <p>{insight.summary}</p>
        </section>

        <section className="drawer-section">
          <h4>统计口径</h4>
          <dl className="evidence-meta">
            <div><dt>方法</dt><dd>{insight.method}</dd></div>
            <div><dt>样本量</dt><dd>{insight.sampleSize.toLocaleString()} 条有效记录</dd></div>
            <div><dt>{insight.effectLabel}</dt><dd>{insight.effectValue}</dd></div>
            <div><dt>显著性</dt><dd>{formatP(insight.pValue)}</dd></div>
            <div><dt>涉及变量</dt><dd>{insight.variables.filter(Boolean).join('、')}</dd></div>
          </dl>
        </section>

        <section className="drawer-section">
          <h4>筛选条件</h4>
          {insight.filters.length ? (
            <div className="filter-chips">
              {insight.filters.map((filter, index) => <span key={`${filter.field}-${index}`}>{filter.label}</span>)}
            </div>
          ) : (
            <p className="muted">无筛选，使用完整分析视图。</p>
          )}
        </section>

        <section className="drawer-section">
          <div className="section-heading-row">
            <h4>证据表</h4>
            <span>{insight.evidence.rows.length} 行摘要</span>
          </div>
          <div className="evidence-table-wrap">
            <table className="evidence-table">
              <thead>
                <tr>{insight.evidence.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
              </thead>
              <tbody>
                {insight.evidence.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {insight.evidence.columns.map((column) => <td key={column.key}>{String(row[column.key] ?? '—')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="drawer-section caveat-box">
          <h4>解释边界</h4>
          <p>{insight.caveat}</p>
        </section>

        {insight.followUps.length > 0 && (
          <section className="drawer-section">
            <h4>继续追问</h4>
            <div className="followup-stack">
              {insight.followUps.map((followUp) => (
                <button key={followUp.label} onClick={() => onFollowUp(followUp)}>{followUp.label}<span>→</span></button>
              ))}
            </div>
          </section>
        )}

        <div className="drawer-actions">
          <button className="button button-primary" onClick={copyEvidence}>{copied ? '已复制证据链' : '复制可审计证据链'}</button>
          <button className="button button-ghost" onClick={onClose}>返回洞察</button>
        </div>
      </aside>
    </div>
  )
}
