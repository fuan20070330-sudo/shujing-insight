export type Cell = string | number | null

export type DataRow = Record<string, Cell>

export type ColumnType = 'number' | 'category' | 'date' | 'text'

export interface FieldProfile {
  name: string
  type: ColumnType
  nonNull: number
  missing: number
  missingRate: number
  unique: number
  mean?: number
  median?: number
  std?: number
  min?: number
  max?: number
  q1?: number
  q3?: number
  topValues?: Array<{ value: string; count: number }>
  minDate?: string
  maxDate?: string
}

export interface FilterCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'gte' | 'lte' | 'between' | 'not_empty'
  value: string | number
  value2?: string | number
  label: string
}

export interface EvidenceColumn {
  key: string
  label: string
  numeric?: boolean
}

export interface EvidenceTable {
  columns: EvidenceColumn[]
  rows: Array<Record<string, string | number | null>>
}

export interface FollowUp {
  label: string
  prompt: string
  filter?: Omit<FilterCondition, 'label'>
  focusField?: string
}

export interface ChartRecommendation {
  type: 'bar' | 'line' | 'scatter' | 'histogram'
  xField: string
  yField?: string
  seriesField?: string
  title: string
  reason: string
}

export type InsightKind = 'correlation' | 'group_difference' | 'change_point' | 'anomaly' | 'missing'

export interface Insight {
  id: string
  kind: InsightKind
  title: string
  summary: string
  score: number
  confidence: 'high' | 'medium' | 'low'
  sampleSize: number
  method: string
  effectLabel: string
  effectValue: string
  pValue?: number
  variables: string[]
  filters: FilterCondition[]
  evidence: EvidenceTable
  chart: ChartRecommendation
  caveat: string
  followUps: FollowUp[]
}

export interface QualityIssue {
  field: string
  type: 'missing' | 'outlier' | 'type'
  count: number
  rate: number
  detail: string
}

export interface DataQuality {
  missingCells: number
  missingRate: number
  outlierCells: number
  outlierFields: number
  issues: QualityIssue[]
}

export interface AnalysisResult {
  totalRowCount: number
  filteredRowCount: number
  fields: FieldProfile[]
  insights: Insight[]
  quality: DataQuality
  filters: FilterCondition[]
  generatedAt: string
  durationMs: number
  largeDataMode: boolean
}

export interface DatasetInfo {
  name: string
  source: 'demo' | 'csv' | 'xlsx'
  importedAt: string
  originalRowCount: number
  warnings: string[]
  fields: string[]
}

export interface AnalysisRequest {
  rows: DataRow[]
  filters: FilterCondition[]
  totalRowCount: number
  datasetName: string
}

export interface ImportResult {
  rows: DataRow[]
  fields: string[]
  warnings: string[]
  name: string
  source: DatasetInfo['source']
}
