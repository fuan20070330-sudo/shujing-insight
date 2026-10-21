import type {
  AnalysisResult,
  Cell,
  ChartRecommendation,
  ColumnType,
  DataQuality,
  DataRow,
  EvidenceTable,
  FieldProfile,
  FilterCondition,
  FollowUp,
  Insight,
  InsightKind,
  QualityIssue,
} from '../types'

const NUMERIC_NAME = /(收入|金额|价格|距离|数量|人数|客流|指数|满意度|评分|得分|投诉|年龄|面积|率|百分比|count|amount|income|price|score|rate|distance|value)/i
const DATE_NAME = /(日期|时间|月份|年份|date|time|month|year)/i
const MISSING_TOKENS = new Set(['', 'na', 'n/a', 'null', 'undefined', 'none', '-', '--', '暂无', '缺失'])

export function isMissing(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && MISSING_TOKENS.has(value.trim().toLowerCase()))
}

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (isMissing(value)) return null
  const cleaned = String(value).trim().replace(/[,，￥¥$%\s]/g, '')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDateValue(value: unknown): number | null {
  if (isMissing(value)) return null
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number' && value > 1900 && value < 2100) return Date.UTC(value, 0, 1)
  const text = String(value).trim()
  const normalized = text.replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '').replace(/\./g, '-')
  const timestamp = Date.parse(normalized)
  return Number.isFinite(timestamp) ? timestamp : null
}

function inferType(name: string, values: Cell[]): ColumnType {
  const present = values.filter((value) => !isMissing(value))
  if (!present.length) return 'text'
  const numericCount = present.filter((value) => toNumber(value) !== null).length
  const dateCount = present.filter((value) => parseDateValue(value) !== null).length
  const unique = new Set(present.map((value) => String(value).trim())).size
  if (numericCount / present.length >= 0.82 && !DATE_NAME.test(name)) return 'number'
  if (dateCount / present.length >= 0.8 && (DATE_NAME.test(name) || unique > 2)) return 'date'
  const categoryLimit = Math.max(12, Math.min(30, Math.ceil(Math.sqrt(present.length) * 3)))
  if (unique <= categoryLimit && (unique <= Math.max(8, present.length * 0.25) || NUMERIC_NAME.test(name))) return 'category'
  return 'text'
}

function sortedNumeric(values: number[]): number[] {
  return [...values].sort((a, b) => a - b)
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function variance(values: number[], knownMean = mean(values)): number {
  if (values.length < 2) return 0
  return values.reduce((sum, value) => sum + (value - knownMean) ** 2, 0) / (values.length - 1)
}

function quantileSorted(sorted: number[], q: number): number {
  if (!sorted.length) return 0
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  const weight = position - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

function quantile(values: number[], q: number): number {
  return quantileSorted(sortedNumeric(values), q)
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function pText(value?: number): string {
  if (value === undefined) return '未进行显著性检验'
  if (value < 0.001) return 'p < 0.001'
  return `p = ${value.toFixed(3)}`
}

function confidenceFromP(p: number | undefined, effect: number): Insight['confidence'] {
  if (p === undefined) return effect > 0.3 ? 'medium' : 'low'
  if (p < 0.01 && effect >= 0.25) return 'high'
  if (p < 0.05) return 'medium'
  return 'low'
}

function logGamma(z: number): number {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ]
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  let x = 0.9999999999998099
  const adjusted = z - 1
  for (let i = 0; i < coefficients.length; i += 1) x += coefficients[i] / (adjusted + i + 1)
  const t = adjusted + coefficients.length - 0.5
  return 0.5 * Math.log(2 * Math.PI) + (adjusted + 0.5) * Math.log(t) - t + Math.log(x)
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const maxIterations = 200
  const epsilon = 3e-12
  const fpMin = 1e-30
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < fpMin) d = fpMin
  d = 1 / d
  let h = d
  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpMin) d = fpMin
    c = 1 + aa / c
    if (Math.abs(c) < fpMin) c = fpMin
    d = 1 / d
    h *= d * c
    aa = -((a + m) * (qab + m) * (x)) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpMin) d = fpMin
    c = 1 + aa / c
    if (Math.abs(c) < fpMin) c = fpMin
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < epsilon) break
  }
  return h
}

function regularizedBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (bt * betaContinuedFraction(a, b, x)) / a
  return 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b
}

function studentTTwoSidedP(t: number, degreesFreedom: number): number {
  if (!Number.isFinite(t) || degreesFreedom <= 0) return 1
  return Math.min(1, regularizedBeta(degreesFreedom / (degreesFreedom + t * t), degreesFreedom / 2, 0.5))
}

function fSurvival(f: number, df1: number, df2: number): number {
  if (!Number.isFinite(f) || f <= 0) return 1
  return Math.max(0, Math.min(1, 1 - regularizedBeta((df1 * f) / (df1 * f + df2), df1 / 2, df2 / 2)))
}

function pearson(x: number[], y: number[]): { r: number; p: number; n: number } {
  const n = Math.min(x.length, y.length)
  if (n < 3) return { r: 0, p: 1, n }
  const mx = mean(x)
  const my = mean(y)
  let numerator = 0
  let xss = 0
  let yss = 0
  for (let i = 0; i < n; i += 1) {
    const dx = x[i] - mx
    const dy = y[i] - my
    numerator += dx * dy
    xss += dx * dx
    yss += dy * dy
  }
  if (xss === 0 || yss === 0) return { r: 0, p: 1, n }
  const r = Math.max(-1, Math.min(1, numerator / Math.sqrt(xss * yss)))
  const t = r * Math.sqrt((n - 2) / Math.max(1e-12, 1 - r * r))
  return { r, p: studentTTwoSidedP(t, n - 2), n }
}

function welch(x: number[], y: number[]): { t: number; p: number; df: number; d: number } {
  const vx = variance(x)
  const vy = variance(y)
  const nx = x.length
  const ny = y.length
  const se = Math.sqrt(vx / nx + vy / ny)
  const t = se === 0 ? 0 : (mean(x) - mean(y)) / se
  const numerator = (vx / nx + vy / ny) ** 2
  const denominator = (vx / nx) ** 2 / Math.max(1, nx - 1) + (vy / ny) ** 2 / Math.max(1, ny - 1)
  const df = denominator === 0 ? nx + ny - 2 : numerator / denominator
  const pooled = Math.sqrt(((nx - 1) * vx + (ny - 1) * vy) / Math.max(1, nx + ny - 2))
  return { t, p: studentTTwoSidedP(t, df), df, d: pooled === 0 ? 0 : (mean(x) - mean(y)) / pooled }
}

function oneWayAnova(groups: number[][]): { f: number; p: number; etaSquared: number; df1: number; df2: number } {
  const all = groups.flat()
  const grandMean = mean(all)
  const ssBetween = groups.reduce((sum, group) => sum + group.length * (mean(group) - grandMean) ** 2, 0)
  const ssWithin = groups.reduce((sum, group) => sum + group.reduce((s, value) => s + (value - mean(group)) ** 2, 0), 0)
  const df1 = groups.length - 1
  const df2 = all.length - groups.length
  const f = ssWithin === 0 ? 0 : (ssBetween / df1) / (ssWithin / df2)
  return { f, p: fSurvival(f, df1, df2), etaSquared: ssBetween / Math.max(1e-12, ssBetween + ssWithin), df1, df2 }
}

export function applyFilters(rows: DataRow[], filters: FilterCondition[]): DataRow[] {
  if (!filters.length) return rows
  return rows.filter((row) =>
    filters.every((filter) => {
      const raw = row[filter.field]
      if (filter.operator === 'not_empty') return !isMissing(raw)
      if (isMissing(raw)) return false
      if (filter.operator === 'equals') return String(raw).trim() === String(filter.value).trim()
      if (filter.operator === 'not_equals') return String(raw).trim() !== String(filter.value).trim()
      const numeric = toNumber(raw)
      if (numeric !== null) {
        const left = Number(filter.value)
        const right = Number(filter.value2)
        if (filter.operator === 'gte') return numeric >= left
        if (filter.operator === 'lte') return numeric <= left
        if (filter.operator === 'between') return numeric >= Math.min(left, right) && numeric <= Math.max(left, right)
      }
      const timestamp = parseDateValue(raw)
      if (timestamp !== null) {
        const left = parseDateValue(filter.value) ?? Number(filter.value)
        const right = parseDateValue(filter.value2) ?? Number(filter.value2)
        if (filter.operator === 'gte') return timestamp >= left
        if (filter.operator === 'lte') return timestamp <= left
        if (filter.operator === 'between') return timestamp >= Math.min(left, right) && timestamp <= Math.max(left, right)
      }
      return false
    }),
  )
}

function buildFieldProfile(name: string, rawValues: Cell[], rowCount: number): FieldProfile {
  const type = inferType(name, rawValues)
  const present = rawValues.filter((value) => !isMissing(value))
  const uniqueValues = new Map<string, number>()
  for (const value of present) {
    const key = String(value).trim()
    uniqueValues.set(key, (uniqueValues.get(key) ?? 0) + 1)
  }
  const missing = rowCount - present.length
  const profile: FieldProfile = {
    name,
    type,
    nonNull: present.length,
    missing,
    missingRate: rowCount ? missing / rowCount : 0,
    unique: uniqueValues.size,
  }
  if (type === 'number') {
    const numbers = present.map(toNumber).filter((value): value is number => value !== null)
    const sorted = sortedNumeric(numbers)
    profile.mean = round(mean(numbers), 3)
    profile.median = round(quantileSorted(sorted, 0.5), 3)
    profile.std = round(Math.sqrt(variance(numbers)), 3)
    profile.min = round(sorted[0] ?? 0, 3)
    profile.max = round(sorted.at(-1) ?? 0, 3)
    profile.q1 = round(quantileSorted(sorted, 0.25), 3)
    profile.q3 = round(quantileSorted(sorted, 0.75), 3)
  }
  if (type === 'category' || type === 'text') {
    profile.topValues = [...uniqueValues.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([value, count]) => ({ value, count }))
  }
  if (type === 'date') {
    const dates = present.map(parseDateValue).filter((value): value is number => value !== null)
    if (dates.length) {
      profile.minDate = new Date(Math.min(...dates)).toISOString().slice(0, 10)
      profile.maxDate = new Date(Math.max(...dates)).toISOString().slice(0, 10)
    }
  }
  return profile
}

function buildQuality(rows: DataRow[], fields: FieldProfile[]): DataQuality {
  const issues: QualityIssue[] = []
  let missingCells = 0
  let outlierCells = 0
  let outlierFields = 0
  for (const field of fields) {
    missingCells += field.missing
    if (field.missingRate >= 0.005) {
      issues.push({
        field: field.name,
        type: 'missing',
        count: field.missing,
        rate: field.missingRate,
        detail: `${(field.missingRate * 100).toFixed(1)}% 的单元格为空`,
      })
    }
    if (field.type !== 'number') continue
    const values = rows.map((row) => toNumber(row[field.name])).filter((value): value is number => value !== null)
    const sorted = sortedNumeric(values)
    const q1 = quantileSorted(sorted, 0.25)
    const q3 = quantileSorted(sorted, 0.75)
    const iqr = q3 - q1
    if (iqr <= 0) continue
    const lower = q1 - 1.5 * iqr
    const upper = q3 + 1.5 * iqr
    const count = values.filter((value) => value < lower || value > upper).length
    if (count) {
      outlierCells += count
      outlierFields += 1
      issues.push({
        field: field.name,
        type: 'outlier',
        count,
        rate: count / Math.max(1, values.length),
        detail: `IQR 法识别出 ${count} 个异常值（栅栏 ${round(lower)}–${round(upper)}）`,
      })
    }
  }
  return {
    missingCells,
    missingRate: rows.length && fields.length ? missingCells / (rows.length * fields.length) : 0,
    outlierCells,
    outlierFields,
    issues: issues.sort((a, b) => b.rate - a.rate).slice(0, 24),
  }
}

function correlationEvidence(xValues: number[], yValues: number[]): EvidenceTable {
  const pairs = xValues.map((value, index) => ({ x: value, y: yValues[index] })).filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y))
  pairs.sort((a, b) => a.x - b.x)
  const bins = Math.min(5, Math.max(2, Math.floor(Math.sqrt(pairs.length))))
  const size = Math.ceil(pairs.length / bins)
  const rows = Array.from({ length: bins }, (_, index) => {
    const segment = pairs.slice(index * size, (index + 1) * size)
    const first = segment[0]
    const last = segment.at(-1)
    return {
      区间: `${round(first?.x ?? 0)} – ${round(last?.x ?? 0)}`,
      样本量: segment.length,
      x均值: round(mean(segment.map((pair) => pair.x))),
      y均值: round(mean(segment.map((pair) => pair.y))),
    }
  })
  return {
    columns: [
      { key: '区间', label: 'X 取值区间' },
      { key: '样本量', label: 'n', numeric: true },
      { key: 'x均值', label: 'X 均值', numeric: true },
      { key: 'y均值', label: 'Y 均值', numeric: true },
    ],
    rows,
  }
}

function makeCorrelationInsights(rows: DataRow[], profiles: FieldProfile[], filters: FilterCondition[]): Insight[] {
  const numeric = profiles.filter((profile) => profile.type === 'number' && profile.nonNull >= 30).slice(0, 12)
  const candidates: Insight[] = []
  for (let i = 0; i < numeric.length; i += 1) {
    for (let j = i + 1; j < numeric.length; j += 1) {
      const a = numeric[i]
      const b = numeric[j]
      const xValues: number[] = []
      const yValues: number[] = []
      for (const row of rows) {
        const x = toNumber(row[a.name])
        const y = toNumber(row[b.name])
        if (x !== null && y !== null) {
          xValues.push(x)
          yValues.push(y)
        }
      }
      if (xValues.length < 30) continue
      const result = pearson(xValues, yValues)
      if (result.p >= 0.05 || Math.abs(result.r) < 0.18) continue
      const direction = result.r > 0 ? '正相关' : '负相关'
      const strength = Math.abs(result.r) >= 0.6 ? '较强' : Math.abs(result.r) >= 0.35 ? '中等' : '较弱'
      const medianX = quantile(xValues, 0.5)
      const followUps: FollowUp[] = [
        {
          label: `查看 ${a.name} 高于中位数的记录`,
          prompt: `只看 ${a.name} ≥ ${round(medianX)} 的子集，相关性是否仍然成立？`,
          filter: { field: a.name, operator: 'gte', value: round(medianX) },
        },
      ]
      candidates.push({
        id: `corr-${a.name}-${b.name}`,
        kind: 'correlation',
        title: `${a.name} 与 ${b.name} 呈${strength}${direction}`,
        summary: `在当前 ${xValues.length} 条有效记录中，${a.name} 与 ${b.name} 的 Pearson 相关系数为 ${result.r.toFixed(2)}。该结果描述同步变化，不代表因果关系。`,
        score: Math.min(98, 38 + Math.abs(result.r) * 58 + (1 - result.p) * 6),
        confidence: confidenceFromP(result.p, Math.abs(result.r)),
        sampleSize: result.n,
        method: 'Pearson 相关检验（双侧）',
        effectLabel: '相关系数 r',
        effectValue: result.r.toFixed(3),
        pValue: result.p,
        variables: [a.name, b.name],
        filters: [...filters],
        evidence: correlationEvidence(xValues, yValues),
        chart: {
          type: 'scatter',
          xField: a.name,
          yField: b.name,
          title: `${a.name} × ${b.name}`,
          reason: '两个连续字段适合用散点图检查方向、离散程度和潜在非线性。',
        },
        caveat: '相关性可能受混杂变量、异常值和样本选择影响；不得据此下因果结论。',
        followUps,
      })
    }
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 2)
}

function makeGroupInsights(rows: DataRow[], profiles: FieldProfile[], filters: FilterCondition[]): Insight[] {
  const categories = profiles.filter((profile) => profile.type === 'category' && profile.unique >= 2 && profile.unique <= 12).slice(0, 10)
  const numeric = profiles.filter((profile) => profile.type === 'number' && profile.nonNull >= 30).slice(0, 10)
  const candidates: Insight[] = []
  for (const category of categories) {
    for (const metric of numeric) {
      const grouped = new Map<string, number[]>()
      for (const row of rows) {
        const group = row[category.name]
        const value = toNumber(row[metric.name])
        if (isMissing(group) || value === null) continue
        const key = String(group).trim()
        const values = grouped.get(key) ?? []
        values.push(value)
        grouped.set(key, values)
      }
      const valid = [...grouped.entries()].filter(([, values]) => values.length >= 8)
      if (valid.length < 2 || valid.reduce((sum, [, values]) => sum + values.length, 0) < 30) continue
      const stats = valid
        .map(([group, values]) => ({ group, values, n: values.length, mean: mean(values), sd: Math.sqrt(variance(values)) }))
        .sort((a, b) => b.mean - a.mean)
      let pValue = 1
      let effect = 0
      let method = ''
      let effectLabel = ''
      if (stats.length === 2) {
        const test = welch(stats[0].values, stats[1].values)
        pValue = test.p
        effect = Math.abs(test.d)
        method = 'Welch 双样本 t 检验（双侧，方差不齐）'
        effectLabel = "Cohen's d（绝对效应量）"
      } else {
        const test = oneWayAnova(stats.map((stat) => stat.values))
        pValue = test.p
        effect = test.etaSquared
        method = '单因素方差分析（ANOVA，双侧 p 值）'
        effectLabel = '效应量 η²'
      }
      if (pValue >= 0.05 || effect < (stats.length === 2 ? 0.2 : 0.02)) continue
      const sampleSize = stats.reduce((sum, stat) => sum + stat.n, 0)
      const top = stats[0]
      const bottom = stats.at(-1)!
      const difference = top.mean - bottom.mean
      const evidenceRows = stats.map((stat) => ({
        分组: stat.group,
        样本量: stat.n,
        均值: round(stat.mean),
        标准差: round(stat.sd),
        与最高组差: round(stat.mean - top.mean),
      }))
      candidates.push({
        id: `group-${category.name}-${metric.name}`,
        kind: 'group_difference',
        title: `${category.name} 各组之间的 ${metric.name} 存在差异`,
        summary: `最高组“${top.group}”的 ${metric.name} 均值为 ${round(top.mean)}，最低组“${bottom.group}”为 ${round(bottom.mean)}，差值 ${round(difference)}。${pText(pValue)}，${effectLabel}为 ${effect.toFixed(3)}。`,
        score: Math.min(96, 42 + effect * (stats.length === 2 ? 28 : 140) + (1 - pValue) * 16),
        confidence: confidenceFromP(pValue, effect),
        sampleSize,
        method,
        effectLabel,
        effectValue: effect.toFixed(3),
        pValue,
        variables: [category.name, metric.name],
        filters: [...filters],
        evidence: {
          columns: [
            { key: '分组', label: category.name },
            { key: '样本量', label: 'n', numeric: true },
            { key: '均值', label: `${metric.name}均值`, numeric: true },
            { key: '标准差', label: '标准差', numeric: true },
            { key: '与最高组差', label: '较最高组', numeric: true },
          ],
          rows: evidenceRows,
        },
        chart: {
          type: 'bar',
          xField: category.name,
          yField: metric.name,
          title: `${metric.name}：按${category.name}比较`,
          reason: '分组均值比较适合使用排序条形图，并保留样本量作为证据。',
        },
        caveat: '组间差异不等同于组别造成差异；还需检查混杂因素、多重比较与业务口径。',
        followUps: [
          {
            label: `下钻至最高组：${top.group}`,
            prompt: `仅保留 ${category.name} = ${top.group} 的记录，查看该组的内部结构与异常。`,
            filter: { field: category.name, operator: 'equals', value: top.group },
          },
        ],
      })
    }
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3)
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function maxSplitStatistic(values: number[], minSize: number): { stat: number; split: number } {
  const total = values.reduce((sum, value) => sum + value, 0)
  const totalSq = values.reduce((sum, value) => sum + value * value, 0)
  let leftSum = 0
  let leftSq = 0
  let best = { stat: 0, split: -1 }
  for (let index = minSize; index <= values.length - minSize; index += 1) {
    const value = values[index - 1]
    leftSum += value
    leftSq += value * value
    const leftN = index
    const rightN = values.length - index
    const leftMean = leftSum / leftN
    const rightMean = (total - leftSum) / rightN
    const leftVar = Math.max(0, (leftSq - leftN * leftMean * leftMean) / Math.max(1, leftN - 1))
    const rightSq = totalSq - leftSq
    const rightVar = Math.max(0, (rightSq - rightN * rightMean * rightMean) / Math.max(1, rightN - 1))
    const se = Math.sqrt(leftVar / leftN + rightVar / rightN)
    const stat = se === 0 ? 0 : Math.abs(leftMean - rightMean) / se
    if (stat > best.stat) best = { stat, split: index }
  }
  return best
}

function makeChangePointInsights(rows: DataRow[], profiles: FieldProfile[], filters: FilterCondition[]): Insight[] {
  const dateFields = profiles.filter((profile) => profile.type === 'date')
  if (!dateFields.length) return []
  const numeric = profiles.filter((profile) => profile.type === 'number' && profile.nonNull >= 30).slice(0, 6)
  const dateField = dateFields[0]
  const candidates: Insight[] = []
  for (const metric of numeric) {
    const buckets = new Map<string, { timestamp: number; values: number[] }>()
    for (const row of rows) {
      const timestamp = parseDateValue(row[dateField.name])
      const value = toNumber(row[metric.name])
      if (timestamp === null || value === null) continue
      const key = new Date(timestamp).toISOString().slice(0, 10)
      const bucket = buckets.get(key) ?? { timestamp, values: [] }
      bucket.values.push(value)
      buckets.set(key, bucket)
    }
    const series = [...buckets.entries()]
      .map(([date, bucket]) => ({ date, timestamp: bucket.timestamp, value: mean(bucket.values), observations: bucket.values.length }))
      .sort((a, b) => a.timestamp - b.timestamp)
    if (series.length < 12) continue
    const values = series.map((point) => point.value)
    const minSize = Math.max(4, Math.floor(series.length * 0.2))
    const observed = maxSplitStatistic(values, minSize)
    if (observed.split < 0 || observed.stat < 2.2) continue
    const random = mulberry32(20261021)
    let extreme = 0
    const permutations = 99
    for (let iteration = 0; iteration < permutations; iteration += 1) {
      const shuffled = [...values]
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1))
        ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
      }
      if (maxSplitStatistic(shuffled, minSize).stat >= observed.stat) extreme += 1
    }
    const pValue = (extreme + 1) / (permutations + 1)
    if (pValue >= 0.05) continue
    const before = values.slice(0, observed.split)
    const after = values.slice(observed.split)
    const pooled = Math.sqrt((variance(before) + variance(after)) / 2)
    const effect = pooled === 0 ? 0 : Math.abs(mean(after) - mean(before)) / pooled
    const splitPoint = series[observed.split]
    const change = mean(after) - mean(before)
    const beforeObservations = series.slice(0, observed.split).reduce((sum, point) => sum + point.observations, 0)
    const afterObservations = series.slice(observed.split).reduce((sum, point) => sum + point.observations, 0)
    const direction = change > 0 ? '上升' : '下降'
    candidates.push({
      id: `change-${metric.name}-${splitPoint.date}`,
      kind: 'change_point',
      title: `${metric.name} 在 ${splitPoint.date} 附近出现均值${direction}`,
      summary: `以时间聚合序列进行单变点扫描，${splitPoint.date} 前后 ${metric.name} 的均值由 ${round(mean(before))} 变为 ${round(mean(after))}（Δ ${round(change)}）。置换检验 ${pText(pValue)}。`,
      score: Math.min(94, 45 + Math.min(25, observed.stat * 4) + (1 - pValue) * 20),
      confidence: pValue < 0.01 && effect >= 0.5 ? 'high' : pValue < 0.05 ? 'medium' : 'low',
      sampleSize: beforeObservations + afterObservations,
      method: '时间序列单变点扫描 + 99 次置换检验（固定随机种子）',
      effectLabel: "变化前后 Cohen's d",
      effectValue: effect.toFixed(3),
      pValue,
      variables: [dateField.name, metric.name],
      filters: [...filters],
      evidence: {
        columns: [
          { key: '阶段', label: '阶段' },
          { key: '时间范围', label: '时间范围' },
          { key: '时间点', label: '时间点', numeric: true },
          { key: '样本量', label: '记录数', numeric: true },
          { key: '均值', label: `${metric.name}均值`, numeric: true },
          { key: '标准差', label: '标准差', numeric: true },
        ],
        rows: [
          {
            阶段: '变化前',
            时间范围: `${series[0].date} – ${series[observed.split - 1].date}`,
            时间点: observed.split,
            样本量: beforeObservations,
            均值: round(mean(before)),
            标准差: round(Math.sqrt(variance(before))),
          },
          {
            阶段: '变化后',
            时间范围: `${splitPoint.date} – ${series.at(-1)!.date}`,
            时间点: series.length - observed.split,
            样本量: afterObservations,
            均值: round(mean(after)),
            标准差: round(Math.sqrt(variance(after))),
          },
        ],
      },
      chart: {
        type: 'line',
        xField: dateField.name,
        yField: metric.name,
        title: `${metric.name} 的时间轨迹与变点`,
        reason: '时间序列均值变化使用折线图，并标出候选变点。',
      },
      caveat: '变点表示时间序列均值结构发生变化，需结合业务事件验证，不推断因果。',
      followUps: [
        {
          label: `查看变点后的记录（≥ ${splitPoint.date}）`,
          prompt: `保留 ${dateField.name} ≥ ${splitPoint.date} 的记录，观察变化后的结构。`,
          filter: { field: dateField.name, operator: 'gte', value: splitPoint.date },
        },
      ],
    })
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 2)
}

function makeAnomalyInsights(rows: DataRow[], profiles: FieldProfile[], filters: FilterCondition[]): Insight[] {
  const numeric = profiles.filter((profile) => profile.type === 'number').slice(0, 10)
  const dateField = profiles.find((profile) => profile.type === 'date')?.name
  const categoryField = profiles.find((profile) => profile.type === 'category')?.name
  const candidates: Insight[] = []
  for (const field of numeric) {
    const values = rows.map((row) => toNumber(row[field.name])).filter((value): value is number => value !== null)
    const sorted = sortedNumeric(values)
    const q1 = quantileSorted(sorted, 0.25)
    const q3 = quantileSorted(sorted, 0.75)
    const iqr = q3 - q1
    if (iqr <= 0) continue
    const lower = q1 - 1.5 * iqr
    const upper = q3 + 1.5 * iqr
    const outliers = rows
      .map((row, index) => ({ row, index, value: toNumber(row[field.name]) }))
      .filter((item): item is { row: DataRow; index: number; value: number } => item.value !== null && (item.value < lower || item.value > upper))
    if (!outliers.length || outliers.length / Math.max(1, values.length) > 0.12) continue
    const rate = outliers.length / values.length
    const sampleRows = outliers.slice(0, 8).map((item) => ({
      记录号: item.index + 1,
      时间: dateField ? String(item.row[dateField] ?? '—') : '—',
      分组: categoryField ? String(item.row[categoryField] ?? '—') : '—',
      字段: field.name,
      数值: round(item.value),
      判定: item.value < lower ? `低于下界 ${round(lower)}` : `高于上界 ${round(upper)}`,
    }))
    candidates.push({
      id: `anomaly-${field.name}`,
      kind: 'anomaly',
      title: `${field.name} 检出 ${outliers.length} 个 IQR 异常值`,
      summary: `按 1.5×IQR 规则，${field.name} 的正常参考范围为 ${round(lower)}–${round(upper)}，当前有 ${outliers.length} 条记录越界，占有效样本的 ${(rate * 100).toFixed(1)}%。`,
      score: Math.min(80, 32 + rate * 180 + Math.log10(outliers.length + 1) * 8),
      confidence: outliers.length >= 5 ? 'medium' : 'low',
      sampleSize: values.length,
      method: 'Tukey IQR 异常检测（Q1 − 1.5×IQR，Q3 + 1.5×IQR）',
      effectLabel: '异常记录占比',
      effectValue: `${(rate * 100).toFixed(2)}%`,
      variables: [field.name],
      filters: [...filters],
      evidence: {
        columns: [
          { key: '记录号', label: '记录号', numeric: true },
          { key: '时间', label: '时间' },
          { key: '分组', label: '分组' },
          { key: '字段', label: '字段' },
          { key: '数值', label: '数值', numeric: true },
          { key: '判定', label: '判定依据' },
        ],
        rows: sampleRows,
      },
      chart: {
        type: 'scatter',
        xField: dateField ?? field.name,
        yField: field.name,
        title: `${field.name} 异常分布`,
        reason: '散点图可同时呈现偏离程度和时间位置，便于人工复核。',
      },
      caveat: 'IQR 异常值可能是录入错误，也可能是真实极端事件；需回看原始记录后再处理。',
      followUps: [
        {
          label: `查看高于上界的记录（> ${round(upper)}）`,
          prompt: `筛选 ${field.name} > ${round(upper)} 的记录，定位并复核异常来源。`,
          filter: { field: field.name, operator: 'gte', value: round(upper) },
        },
      ],
    })
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 2)
}

function makeMissingInsights(profiles: FieldProfile[], filters: FilterCondition[], rowCount: number): Insight[] {
  const missingFields = profiles.filter((profile) => profile.missingRate >= 0.005).sort((a, b) => b.missingRate - a.missingRate)
  if (!missingFields.length) return []
  const totalMissing = missingFields.reduce((sum, field) => sum + field.missing, 0)
  const top = missingFields[0]
  return [
    {
      id: `missing-${top.name}`,
      kind: 'missing',
      title: `${top.name} 存在 ${(top.missingRate * 100).toFixed(1)}% 缺失`,
      summary: `当前视图共有 ${totalMissing} 个缺失单元格，涉及 ${missingFields.length} 个字段。缺失最集中的字段是 ${top.name}（${top.missing}/${rowCount}）。`,
      score: Math.min(70, 30 + top.missingRate * 120),
      confidence: rowCount >= 30 ? 'high' : 'medium',
      sampleSize: rowCount,
      method: '字段级缺失率审计（空值、NA、暂无等占位符统一识别）',
      effectLabel: '最高字段缺失率',
      effectValue: `${(top.missingRate * 100).toFixed(2)}%`,
      variables: missingFields.slice(0, 6).map((field) => field.name),
      filters: [...filters],
      evidence: {
        columns: [
          { key: '字段', label: '字段' },
          { key: '类型', label: '推断类型' },
          { key: '缺失数', label: '缺失数', numeric: true },
          { key: '缺失率', label: '缺失率', numeric: true },
          { key: '有效数', label: '有效数', numeric: true },
        ],
        rows: missingFields.slice(0, 10).map((field) => ({
          字段: field.name,
          类型: field.type,
          缺失数: field.missing,
          缺失率: Number((field.missingRate * 100).toFixed(2)),
          有效数: field.nonNull,
        })),
      },
      chart: {
        type: 'bar',
        xField: '字段',
        yField: '缺失率',
        title: '字段缺失率',
        reason: '横向条形图适合比较字段缺失程度并安排清洗优先级。',
      },
      caveat: '缺失机制可能并非完全随机；直接删除或填充前应确认采集流程。',
      followUps: missingFields.slice(0, 3).map((field) => ({
        label: `只看 ${field.name} 非空记录`,
        prompt: `排除 ${field.name} 缺失的记录后重新分析，检查结论是否稳定。`,
        filter: { field: field.name, operator: 'not_empty' as const, value: '' },
      })),
    },
  ]
}

function chartForFallback(profiles: FieldProfile[]): ChartRecommendation | null {
  const category = profiles.find((profile) => profile.type === 'category')
  const numeric = profiles.find((profile) => profile.type === 'number')
  if (category && numeric) {
    return {
      type: 'bar',
      xField: category.name,
      yField: numeric.name,
      title: `${numeric.name} 分组概览`,
      reason: '数据不足以形成显著洞察时，先展示主要分组的描述性均值。',
    }
  }
  return null
}

export function analyzeDataset(
  inputRows: DataRow[],
  filters: FilterCondition[] = [],
  totalRowCount = inputRows.length,
  _datasetName = '',
): AnalysisResult {
  const started = performance.now()
  const rows = applyFilters(inputRows, filters)
  const names = inputRows.length ? Object.keys(inputRows[0]) : []
  const profiles = names.map((name) => buildFieldProfile(name, rows.map((row) => row[name] ?? null), rows.length))
  const quality = buildQuality(rows, profiles)
  const insights: Insight[] = [
    ...makeCorrelationInsights(rows, profiles, filters),
    ...makeGroupInsights(rows, profiles, filters),
    ...makeChangePointInsights(rows, profiles, filters),
    ...makeAnomalyInsights(rows, profiles, filters),
    ...makeMissingInsights(profiles, filters, rows.length),
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
  if (!insights.length) {
    const fallback = chartForFallback(profiles)
    if (fallback) {
      insights.push({
        id: 'descriptive-overview',
        kind: 'group_difference',
        title: '当前视图暂无达到阈值的显著性结论',
        summary: `已在 ${rows.length} 条记录上完成自动检验，但没有洞察通过“p < 0.05 且效应量达到最小阈值”的双重筛选。建议扩大样本或调整筛选条件。`,
        score: 20,
        confidence: 'low',
        sampleSize: rows.length,
        method: '描述性统计 + 显著性阈值筛选',
        effectLabel: '证据等级',
        effectValue: '仅描述',
        variables: [fallback.xField, fallback.yField ?? ''],
        filters: [...filters],
        evidence: {
          columns: [
            { key: '提示', label: '检查建议' },
            { key: '说明', label: '说明' },
          ],
          rows: [
            { 提示: '样本量', 说明: '增加有效样本，尤其是分组后的最小样本量。' },
            { 提示: '字段信息', 说明: '确认类别、日期和数值字段被正确识别。' },
            { 提示: '筛选条件', 说明: '放宽或清除筛选后再次运行。' },
          ],
        },
        chart: fallback,
        caveat: '“未检出”不等于“不存在差异”；当前测试只反映既有数据与预设阈值。',
        followUps: [],
      })
    }
  }
  return {
    totalRowCount,
    filteredRowCount: rows.length,
    fields: profiles,
    insights,
    quality,
    filters,
    generatedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    largeDataMode: inputRows.length > 5000,
  }
}

export function makeFilterLabel(filter: Omit<FilterCondition, 'label'>): string {
  const operatorLabels: Record<FilterCondition['operator'], string> = {
    equals: '=',
    not_equals: '≠',
    gte: '≥',
    lte: '≤',
    between: '介于',
    not_empty: '非空',
  }
  if (filter.operator === 'not_empty') return `${filter.field} 非空`
  if (filter.operator === 'between') return `${filter.field} ${operatorLabels[filter.operator]} ${filter.value}–${filter.value2}`
  return `${filter.field} ${operatorLabels[filter.operator]} ${filter.value}`
}

export function insightKindLabel(kind: InsightKind): string {
  return {
    correlation: '相关关系',
    group_difference: '分组差异',
    change_point: '结构变化',
    anomaly: '异常复核',
    missing: '数据质量',
  }[kind]
}
