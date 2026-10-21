import Papa from 'papaparse'
import type { Cell, DataRow, ImportResult } from '../types'

export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const MAX_ROWS = 50_000

function normalizeRecord(record: Record<string, unknown>): DataRow {
  const row: DataRow = {}
  for (const [rawKey, rawValue] of Object.entries(record)) {
    const key = rawKey.trim()
    if (!key) continue
    if (rawValue instanceof Date) {
      row[key] = rawValue.toISOString().slice(0, 10)
    } else if (rawValue === null || rawValue === undefined) {
      row[key] = null
    } else if (typeof rawValue === 'number') {
      row[key] = rawValue
    } else {
      row[key] = String(rawValue)
    }
  }
  return row
}

export function parseCsvText(text: string): ImportResult {
  const parsed = Papa.parse<Record<string, unknown>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  })
  const fatal = parsed.errors.find((error) => error.type === 'Quotes')
  if (fatal) throw new Error(`CSV 解析失败：第 ${fatal.row ?? '?'} 行，${fatal.message}`)
  const allRows = parsed.data.map(normalizeRecord).filter((row) => Object.values(row).some((value) => value !== null && String(value).trim() !== ''))
  if (!allRows.length) throw new Error('文件中没有可分析的数据行。')
  const fields = Object.keys(allRows[0]).filter(Boolean)
  if (fields.length < 2) throw new Error('至少需要两列数据才能进行洞察分析。')
  const warnings: string[] = []
  if (parsed.errors.length) warnings.push(`解析器报告 ${parsed.errors.length} 个非阻断警告，已跳过空行并继续分析。`)
  if (allRows.length > MAX_ROWS) warnings.push(`数据超过 ${MAX_ROWS.toLocaleString()} 行，仅分析前 ${MAX_ROWS.toLocaleString()} 行。`)
  return {
    rows: allRows.slice(0, MAX_ROWS),
    fields,
    warnings,
    name: '本地 CSV 数据',
    source: 'csv',
  }
}

async function parseWorkbook(file: File): Promise<ImportResult> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('Excel 文件中没有工作表。')
  const matrix = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], {
    defval: null,
    raw: true,
  })
  const allRows = matrix.map(normalizeRecord).filter((row) => Object.values(row).some((value) => value !== null && String(value).trim() !== ''))
  if (!allRows.length) throw new Error('首个工作表没有可分析的数据行。')
  const fields = Object.keys(allRows[0]).filter(Boolean)
  if (fields.length < 2) throw new Error('至少需要两列数据才能进行洞察分析。')
  const warnings: string[] = []
  if (workbook.SheetNames.length > 1) warnings.push(`工作簿含 ${workbook.SheetNames.length} 个工作表，当前分析首个工作表“${firstSheetName}”。`)
  if (allRows.length > MAX_ROWS) warnings.push(`数据超过 ${MAX_ROWS.toLocaleString()} 行，仅分析前 ${MAX_ROWS.toLocaleString()} 行。`)
  return {
    rows: allRows.slice(0, MAX_ROWS),
    fields,
    warnings,
    name: file.name || '本地 Excel 数据',
    source: 'xlsx',
  }
}

export async function importFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) throw new Error('文件超过 20 MB 限制。请先在本地抽样或压缩字段。')
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'csv' || extension === 'tsv' || file.type === 'text/csv') {
    const result = parseCsvText(await file.text())
    return { ...result, name: file.name || '本地 CSV 数据', source: 'csv' }
  }
  if (extension === 'xlsx' || extension === 'xls') return parseWorkbook(file)
  throw new Error('暂不支持该文件格式。请导入 .csv、.xlsx 或 .xls 文件。')
}

export async function loadDemoDataset(): Promise<ImportResult> {
  const url = new URL('demo/smart-community-demo.csv', document.baseURI)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`示例数据加载失败（HTTP ${response.status}）。`)
  const result = parseCsvText(await response.text())
  return {
    ...result,
    name: '城市社区活力与公共服务（合成演示）',
    source: 'demo',
    warnings: ['示例数据为程序生成的合成数据，不含真实个人或机构信息。'],
  }
}

export function getCategoryValues(rows: DataRow[], field: string, limit = 30): string[] {
  const values = new Set<string>()
  for (const row of rows) {
    const value = row[field]
    if (value !== null && value !== undefined && String(value).trim()) values.add(String(value))
    if (values.size >= limit) break
  }
  return [...values].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

export function initialFieldNames(rows: DataRow[]): string[] {
  return rows.length ? Object.keys(rows[0]) : []
}

export function toCell(value: unknown): Cell {
  if (value === null || value === undefined) return null
  return typeof value === 'number' ? value : String(value)
}
