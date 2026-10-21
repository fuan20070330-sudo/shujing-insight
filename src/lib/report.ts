import type { AnalysisResult, DatasetInfo } from '../types'
import { insightKindLabel } from './analysis'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tableToMarkdown(table: AnalysisResult['insights'][number]['evidence']): string {
  if (!table.rows.length) return '_无可展示的证据明细_'
  const header = `| ${table.columns.map((column) => column.label).join(' | ')} |`
  const divider = `| ${table.columns.map(() => '---').join(' | ')} |`
  const rows = table.rows.map((row) => `| ${table.columns.map((column) => String(row[column.key] ?? '—')).join(' | ')} |`)
  return [header, divider, ...rows].join('\n')
}

export function exportMarkdownReport(dataset: DatasetInfo, analysis: AnalysisResult): string {
  const lines = [
    '# 数镜 · 自动数据洞察报告',
    '',
    `- 数据集：${dataset.name}`,
    `- 数据来源：${dataset.source.toUpperCase()}`,
    `- 生成时间：${new Date(analysis.generatedAt).toLocaleString('zh-CN')}`,
    `- 分析记录：${analysis.filteredRowCount} / ${analysis.totalRowCount}`,
    `- 字段数量：${analysis.fields.length}`,
    `- 计算位置：浏览器 Web Worker（本地执行）`,
    '',
    '> 本报告仅陈述数据中可复核的统计关联与差异，不自动推断因果。证据表、样本量、方法、效应量和 p 值随每条洞察一并列出。',
    '',
    '## 一、筛选条件与证据链',
    '',
    analysis.filters.length ? analysis.filters.map((filter) => `- ${filter.label}`).join('\n') : '- 无筛选，使用完整分析视图',
    '',
    '## 二、洞察排序',
    '',
  ]
  analysis.insights.forEach((insight, index) => {
    lines.push(
      `### ${index + 1}. ${insight.title}`,
      '',
      `**类型：** ${insightKindLabel(insight.kind)}　**置信标记：** ${insight.confidence}　**排序分：** ${insight.score.toFixed(1)}`,
      '',
      insight.summary,
      '',
      `- 方法：${insight.method}`,
      `- 样本量：${insight.sampleSize}`,
      `- ${insight.effectLabel}：${insight.effectValue}`,
      `- 显著性：${insight.pValue === undefined ? '未进行显著性检验' : insight.pValue < 0.001 ? 'p < 0.001' : `p = ${insight.pValue.toFixed(3)}`}`,
      `- 变量：${insight.variables.filter(Boolean).join('、')}`,
      `- 边界：${insight.caveat}`,
      '',
      '**证据表**',
      '',
      tableToMarkdown(insight.evidence),
      '',
    )
  })
  lines.push('## 三、字段画像', '', '| 字段 | 类型 | 有效值 | 缺失率 | 唯一值 |', '| --- | --- | ---: | ---: | ---: |')
  analysis.fields.forEach((field) => {
    lines.push(`| ${field.name} | ${field.type} | ${field.nonNull} | ${(field.missingRate * 100).toFixed(2)}% | ${field.unique} |`)
  })
  lines.push(
    '',
    '## 四、数据质量',
    '',
    `- 缺失单元格：${analysis.quality.missingCells}（${(analysis.quality.missingRate * 100).toFixed(2)}%）`,
    `- 异常单元格：${analysis.quality.outlierCells}，涉及 ${analysis.quality.outlierFields} 个数值字段`,
    '',
    analysis.quality.issues.length
      ? analysis.quality.issues.map((issue) => `- ${issue.field}：${issue.detail}`).join('\n')
      : '- 未发现超过当前阈值的质量提示',
    '',
    '## 五、复现说明',
    '',
    '数镜按同一份数据、同一组筛选条件和内置统计规则在浏览器中重算全部结果。变点检测使用固定随机种子进行置换检验。若需审计，请重新导入原始文件并应用上述筛选条件。',
    '',
  )
  return lines.join('\n')
}

export function exportHtmlReport(dataset: DatasetInfo, analysis: AnalysisResult): string {
  const insightHtml = analysis.insights
    .map(
      (insight, index) => `
      <section class="insight">
        <div class="eyebrow">洞察 ${String(index + 1).padStart(2, '0')} · ${escapeHtml(insightKindLabel(insight.kind))}</div>
        <h2>${escapeHtml(insight.title)}</h2>
        <p class="summary">${escapeHtml(insight.summary)}</p>
        <div class="metrics">
          <span>n = ${insight.sampleSize}</span>
          <span>${escapeHtml(insight.effectLabel)} = ${escapeHtml(insight.effectValue)}</span>
          <span>${insight.pValue === undefined ? '未检验显著性' : insight.pValue < 0.001 ? 'p &lt; 0.001' : `p = ${insight.pValue.toFixed(3)}`}</span>
          <span>${escapeHtml(insight.confidence)} confidence</span>
        </div>
        <dl>
          <dt>方法</dt><dd>${escapeHtml(insight.method)}</dd>
          <dt>边界</dt><dd>${escapeHtml(insight.caveat)}</dd>
        </dl>
        <table>
          <thead><tr>${insight.evidence.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead>
          <tbody>${insight.evidence.rows.map((row) => `<tr>${insight.evidence.columns.map((column) => `<td>${escapeHtml(row[column.key] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </section>`,
    )
    .join('')
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>数镜洞察报告 · ${escapeHtml(dataset.name)}</title>
<style>
:root{--ink:#17212b;--muted:#68747f;--line:#dce4e8;--accent:#087f73;--paper:#f6f8f7}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.7 "Noto Sans SC","Microsoft YaHei",sans-serif}
main{max-width:980px;margin:0 auto;padding:48px 28px}h1{font-size:40px;line-height:1.2;margin:8px 0 12px}
.hero{padding:28px 32px;background:#102b31;color:#fff;border-radius:18px;margin-bottom:26px}
.eyebrow{font:700 11px/1.2 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#0a7c70}
.hero .eyebrow{color:#7fded1}.meta{color:#b9cbc9;font-size:13px}
.insight{background:#fff;border:1px solid var(--line);border-radius:16px;padding:24px 26px;margin:18px 0}
.insight h2{font-size:23px;line-height:1.35;margin:8px 0 10px}.summary{font-size:16px}
.metrics{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.metrics span{background:#e9f5f2;color:#075f57;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700}
dl{display:grid;grid-template-columns:70px 1fr;gap:6px 12px;color:var(--muted);font-size:13px}dt{font-weight:700}dd{margin:0}
table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}th,td{text-align:left;padding:8px 9px;border-bottom:1px solid var(--line)}th{background:#f2f6f5;color:#45535d}
footer{color:var(--muted);font-size:12px;margin-top:30px}@media print{body{background:#fff}main{padding:0}.insight{break-inside:avoid}.hero{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><main>
<div class="hero"><div class="eyebrow">SHUJING INSIGHT / VERIFIABLE REPORT</div><h1>${escapeHtml(dataset.name)}</h1>
<div class="meta">${new Date(analysis.generatedAt).toLocaleString('zh-CN')} · ${analysis.filteredRowCount} / ${analysis.totalRowCount} 条记录 · 浏览器本地计算</div></div>
<p><strong>筛选条件：</strong>${analysis.filters.length ? analysis.filters.map((filter) => escapeHtml(filter.label)).join('；') : '无筛选，使用完整分析视图'}</p>
<p>本报告仅陈述数据中可复核的统计关联与差异，不自动推断因果。</p>
${insightHtml}
<footer>数镜 · 可验证自动数据洞察与叙事平台 · 所有统计结果均可回到原始数据与筛选条件复核。</footer>
</main></body></html>`
}

export function downloadTextFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
