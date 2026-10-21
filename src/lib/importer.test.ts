import { describe, expect, it } from 'vitest'
import { parseCsvText } from './importer'

describe('CSV importer', () => {
  it('normalizes quoted Chinese CSV, trims headers and recognizes missing tokens', () => {
    const result = parseCsvText('\uFEFF日期,分组,指标\n2024-01-01,"甲,组",10\n2024-02-01,乙,NA\n2024-03-01,甲,14')
    expect(result.rows).toHaveLength(3)
    expect(result.fields).toEqual(['日期', '分组', '指标'])
    expect(result.rows[0]['分组']).toBe('甲,组')
    expect(result.rows[1]['指标']).toBe('NA')
  })

  it('rejects files with fewer than two analysis columns', () => {
    expect(() => parseCsvText('字段\n1\n2\n3')).toThrow('至少需要两列')
  })

  it('rejects empty files', () => {
    expect(() => parseCsvText('A,B\n,\n')).toThrow('没有可分析的数据行')
  })
})
