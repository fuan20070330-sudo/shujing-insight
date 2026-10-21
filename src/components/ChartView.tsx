import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import type { AnalysisResult, DataRow, Insight } from '../types'
import { toNumber } from '../lib/analysis'

interface ChartViewProps {
  insight: Insight
  analysis: AnalysisResult
  rows: DataRow[]
}

const palette = ['#0a8578', '#e8763a', '#3f6fa5', '#d5a32f', '#6d5aa8', '#8f9b4b']

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  if (!sorted.length) return 0
  const position = (sorted.length - 1) * q
  const base = Math.floor(position)
  const rest = position - base
  return sorted[base] * (1 - rest) + (sorted[Math.min(base + 1, sorted.length - 1)] ?? 0) * rest
}

function buildChartOption(insight: Insight, rows: DataRow[]): { option: EChartsOption; note: string } {
  const base: EChartsOption = {
    color: palette,
    animationDuration: 520,
    textStyle: { fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif', color: '#52616c' },
    tooltip: {
      trigger: insight.chart.type === 'scatter' ? 'item' : 'axis',
      backgroundColor: '#132a30',
      borderWidth: 0,
      textStyle: { color: '#f4fbfa', fontSize: 12 },
      padding: [10, 12],
    },
    grid: { left: 18, right: 22, top: 30, bottom: 20, containLabel: true },
  }

  if (insight.chart.type === 'bar') {
    let labels: string[] = []
    let values: number[] = []
    let valueLabel = insight.chart.yField ?? '均值'
    if (insight.kind === 'group_difference' && insight.evidence.rows.some((row) => '分组' in row && '均值' in row)) {
      const sorted = [...insight.evidence.rows].sort((a, b) => Number(b['均值']) - Number(a['均值']))
      labels = sorted.map((row) => String(row['分组'] ?? '—'))
      values = sorted.map((row) => Number(row['均值'] ?? 0))
      valueLabel = `${insight.chart.yField ?? '指标'}均值`
    } else if (insight.kind === 'missing') {
      const sorted = [...insight.evidence.rows].sort((a, b) => Number(b['缺失率']) - Number(a['缺失率'])).slice(0, 8)
      labels = sorted.map((row) => String(row['字段'] ?? '—'))
      values = sorted.map((row) => Number(row['缺失率'] ?? 0))
      valueLabel = '缺失率 (%)'
    } else if (insight.chart.yField) {
      const groups = new Map<string, number[]>()
      for (const row of rows) {
        const group = String(row[insight.chart.xField] ?? '未分类')
        const value = toNumber(row[insight.chart.yField])
        if (value === null) continue
        groups.set(group, [...(groups.get(group) ?? []), value])
      }
      const grouped = [...groups.entries()].map(([group, groupValues]) => ({ group, value: average(groupValues) })).sort((a, b) => b.value - a.value)
      labels = grouped.map((entry) => entry.group)
      values = grouped.map((entry) => Number(entry.value.toFixed(2)))
    }
    return {
      note: `展示 ${labels.length} 个分组的聚合值`,
      option: {
        ...base,
        xAxis: {
          type: 'category',
          data: labels,
          axisLabel: { interval: 0, rotate: labels.length > 6 ? 24 : 0, color: '#68747f', fontSize: 11 },
          axisLine: { lineStyle: { color: '#d9e2e3' } },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'value',
          name: valueLabel,
          nameTextStyle: { color: '#83909a', align: 'left' },
          splitLine: { lineStyle: { color: '#edf1f1', type: 'dashed' } },
          axisLabel: { color: '#83909a' },
        },
        series: [
          {
            type: 'bar',
            data: values,
            barMaxWidth: 48,
            itemStyle: {
              borderRadius: [8, 8, 2, 2],
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#0b9c8d' },
                { offset: 1, color: '#0a7067' },
              ]),
            },
            label: { show: labels.length <= 8, position: 'top', color: '#34454f', fontSize: 11 },
          },
        ],
      },
    }
  }

  if (insight.chart.type === 'line' && insight.chart.yField) {
    const buckets = new Map<string, number[]>()
    for (const row of rows) {
      const label = String(row[insight.chart.xField] ?? '')
      const value = toNumber(row[insight.chart.yField])
      if (!label || value === null) continue
      buckets.set(label, [...(buckets.get(label) ?? []), value])
    }
    const series = [...buckets.entries()]
      .map(([label, values]) => ({ label, value: average(values) }))
      .sort((a, b) => a.label.localeCompare(b.label))
    const pointCount = series.length > 80 ? 80 : series.length
    const stride = Math.max(1, Math.floor(series.length / pointCount))
    const sampled = series.filter((_, index) => index % stride === 0)
    return {
      note: series.length > 80 ? `为保持可读性，展示 ${sampled.length} / ${series.length} 个时间点` : `按 ${insight.chart.xField} 聚合 ${series.length} 个时间点`,
      option: {
        ...base,
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: sampled.map((point) => point.label),
          axisLabel: { color: '#68747f', hideOverlap: true, fontSize: 11 },
          axisLine: { lineStyle: { color: '#d9e2e3' } },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'value',
          scale: true,
          name: insight.chart.yField,
          nameTextStyle: { color: '#83909a' },
          splitLine: { lineStyle: { color: '#edf1f1', type: 'dashed' } },
          axisLabel: { color: '#83909a' },
        },
        series: [
          {
            type: 'line',
            data: sampled.map((point) => Number(point.value.toFixed(3))),
            smooth: 0.28,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { width: 3, color: '#0a8578' },
            itemStyle: { color: '#ffffff', borderColor: '#0a8578', borderWidth: 2 },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(10,133,120,0.24)' },
                { offset: 1, color: 'rgba(10,133,120,0.01)' },
              ]),
            },
          },
        ],
      },
    }
  }

  if (insight.chart.type === 'scatter') {
    const yField = insight.chart.yField
    if (!yField) return { note: '暂无可绘制的数值字段', option: base }
    const points: Array<{ value: [string | number, number]; itemStyle?: { color: string; opacity: number } }> = []
    const yValues: number[] = []
    for (const row of rows) {
      const xRaw = row[insight.chart.xField]
      const y = toNumber(row[yField])
      if (y === null || xRaw === null || xRaw === undefined || String(xRaw).trim() === '') continue
      const xNumeric = toNumber(xRaw)
      const x = xNumeric === null ? String(xRaw) : xNumeric
      yValues.push(y)
      points.push({ value: [x, y] })
    }
    const maxPoints = 2500
    const stride = Math.max(1, Math.ceil(points.length / maxPoints))
    const sampled = points.filter((_, index) => index % stride === 0)
    const q1 = quantile(yValues, 0.25)
    const q3 = quantile(yValues, 0.75)
    const iqr = q3 - q1
    const lower = q1 - 1.5 * iqr
    const upper = q3 + 1.5 * iqr
    const xNumeric = sampled.every((point) => typeof point.value[0] === 'number')
    return {
      note: points.length > maxPoints ? `大数据模式：抽样展示 ${sampled.length} / ${points.length} 个点` : `展示 ${points.length} 个有效数据点`,
      option: {
        ...base,
        xAxis: {
          type: xNumeric ? 'value' : 'category',
          name: insight.chart.xField,
          nameLocation: 'middle',
          nameGap: 34,
          nameTextStyle: { color: '#83909a' },
          axisLabel: { color: '#68747f', hideOverlap: true, fontSize: 11 },
          axisLine: { lineStyle: { color: '#d9e2e3' } },
          splitLine: { show: xNumeric, lineStyle: { color: '#f0f3f3', type: 'dashed' } },
        },
        yAxis: {
          type: 'value',
          scale: true,
          name: yField,
          nameTextStyle: { color: '#83909a' },
          splitLine: { lineStyle: { color: '#edf1f1', type: 'dashed' } },
          axisLabel: { color: '#83909a' },
        },
        series: [
          {
            type: 'scatter',
            data: sampled.map((point) => ({
              ...point,
              itemStyle: {
                color: point.value[1] < lower || point.value[1] > upper ? '#e8763a' : '#0a8578',
                opacity: point.value[1] < lower || point.value[1] > upper ? 0.9 : 0.52,
              },
            })),
            symbolSize: insight.kind === 'anomaly' ? 9 : 7,
            emphasis: { focus: 'series', scale: 1.5 },
          },
        ],
      },
    }
  }

  return { note: '当前推荐暂无可视化配置', option: base }
}

export function ChartView({ insight, rows }: ChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const { option, note } = useMemo(() => buildChartOption(insight, rows), [insight, rows])

  useEffect(() => {
    if (!containerRef.current) return
    const chart = chartRef.current ?? echarts.init(containerRef.current, undefined, { renderer: 'canvas' })
    chartRef.current = chart
    chart.setOption(option, true)
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [option])

  useEffect(
    () => () => {
      chartRef.current?.dispose()
      chartRef.current = null
    },
    [],
  )

  return (
    <div className="chart-stage">
      <div className="chart-stage__header">
        <div>
          <p className="mini-label">推荐视图 · {insight.chart.type.toUpperCase()}</p>
          <h3>{insight.chart.title}</h3>
        </div>
        <span className="chart-note">{note}</span>
      </div>
      <div ref={containerRef} className="chart-canvas" role="img" aria-label={`${insight.chart.title} 图表`} />
      <p className="chart-rationale"><span>为什么用这张图</span>{insight.chart.reason}</p>
    </div>
  )
}
