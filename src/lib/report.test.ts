import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeDataset } from './analysis'
import { parseCsvText } from './importer'
import { exportHtmlReport, exportMarkdownReport } from './report'
import type { DatasetInfo } from '../types'

const text = readFileSync(new URL('../../public/demo/smart-community-demo.csv', import.meta.url), 'utf8')

describe('report exporter', () => {
  const parsed = parseCsvText(text)
  const analysis = analyzeDataset(parsed.rows)
  const dataset: DatasetInfo = {
    name: '城市社区活力与公共服务（合成演示）',
    source: 'demo',
    importedAt: new Date().toISOString(),
    originalRowCount: 720,
    warnings: [],
    fields: parsed.fields,
  }

  it('exports a Markdown report with methods, evidence and caveats', () => {
    const report = exportMarkdownReport(dataset, analysis)
    expect(report).toContain('# 数镜 · 自动数据洞察报告')
    expect(report).toContain('证据表')
    expect(report).toContain('不自动推断因果')
    expect(report).toContain('样本量')
    expect(report).toContain(analysis.insights[0].method)
  })

  it('exports a printable HTML report with escaped content', () => {
    const report = exportHtmlReport({ ...dataset, name: '<script>alert(1)</script>' }, analysis)
    expect(report).toContain('<!doctype html>')
    expect(report).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(report).not.toContain('<script>alert(1)</script>')
    expect(report).toContain('均可回到原始数据')
  })
})
