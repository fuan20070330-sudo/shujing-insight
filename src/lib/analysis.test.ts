import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeDataset, applyFilters, makeFilterLabel } from './analysis'
import { parseCsvText } from './importer'
import type { DataRow } from '../types'

const demoText = readFileSync(new URL('../../public/demo/smart-community-demo.csv', import.meta.url), 'utf8')

describe('data analysis engine', () => {
  it('parses the reproducible demo and profiles field types', () => {
    const parsed = parseCsvText(demoText)
    expect(parsed.rows).toHaveLength(720)
    expect(parsed.fields).toHaveLength(10)
    const analysis = analyzeDataset(parsed.rows, [], parsed.rows.length, parsed.name)
    expect(analysis.fields.find((field) => field.name === '区')?.type).toBe('category')
    expect(analysis.fields.find((field) => field.name === '日期')?.type).toBe('date')
    expect(analysis.fields.find((field) => field.name === '商业活力指数')?.type).toBe('number')
    expect(analysis.quality.missingCells).toBeGreaterThan(0)
  })

  it('detects multiple traceable insight kinds in the demo dataset', () => {
    const parsed = parseCsvText(demoText)
    const analysis = analyzeDataset(parsed.rows, [], parsed.rows.length, parsed.name)
    expect(analysis.insights.length).toBeGreaterThanOrEqual(5)
    const kinds = new Set(analysis.insights.map((insight) => insight.kind))
    expect(kinds.has('correlation')).toBe(true)
    expect(kinds.has('group_difference')).toBe(true)
    expect(analysis.insights.every((insight) => insight.sampleSize > 0)).toBe(true)
    expect(analysis.insights.every((insight) => insight.method.length > 0)).toBe(true)
    expect(analysis.insights.every((insight) => insight.evidence.columns.length > 0)).toBe(true)
    expect(analysis.insights.every((insight) => insight.evidence.rows.length > 0)).toBe(true)
    expect(analysis.insights.every((insight) => insight.caveat.length > 0)).toBe(true)
  })

  it('filters rows and preserves filter provenance in every result', () => {
    const parsed = parseCsvText(demoText)
    const filter = {
      field: '区',
      operator: 'equals' as const,
      value: '武昌区',
      label: makeFilterLabel({ field: '区', operator: 'equals', value: '武昌区' }),
    }
    const filteredRows = applyFilters(parsed.rows, [filter])
    expect(filteredRows.length).toBe(120)
    const analysis = analyzeDataset(parsed.rows, [filter], parsed.rows.length, parsed.name)
    expect(analysis.filteredRowCount).toBe(120)
    expect(analysis.filters).toEqual([filter])
    expect(analysis.insights.every((insight) => insight.filters[0]?.label === filter.label)).toBe(true)
  })

  it('handles empty and undersized views without inventing a causal conclusion', () => {
    const parsed = parseCsvText(demoText)
    const rows: DataRow[] = parsed.rows.slice(0, 5)
    const analysis = analyzeDataset(rows, [], rows.length, 'tiny')
    expect(analysis.filteredRowCount).toBe(5)
    expect(analysis.insights.every((insight) => insight.confidence !== 'high')).toBe(true)
  })
})
