import { useEffect, useMemo, useState } from 'react'
import type { FieldProfile, FilterCondition } from '../types'
import { getCategoryValues } from '../lib/importer'
import type { DataRow } from '../types'

interface FilterBarProps {
  fields: FieldProfile[]
  rows: DataRow[]
  filters: FilterCondition[]
  filteredCount: number
  totalCount: number
  onAdd: (filter: FilterCondition) => void
  onRemove: (index: number) => void
  onReset: () => void
}

export function FilterBar({ fields, rows, filters, filteredCount, totalCount, onAdd, onRemove, onReset }: FilterBarProps) {
  const categoryFields = useMemo(
    () => fields.filter((field) => field.type === 'category' && field.unique <= 40),
    [fields],
  )
  const [field, setField] = useState(categoryFields[0]?.name ?? '')
  const values = useMemo(() => (field ? getCategoryValues(rows, field) : []), [rows, field])
  const [value, setValue] = useState(values[0] ?? '')

  useEffect(() => {
    if (!categoryFields.some((item) => item.name === field)) setField(categoryFields[0]?.name ?? '')
  }, [categoryFields, field])

  useEffect(() => {
    if (!values.includes(value)) setValue(values[0] ?? '')
  }, [values, value])

  const addFilter = () => {
    if (!field || value === '') return
    onAdd({
      field,
      operator: 'equals',
      value,
      label: `${field} = ${value}`,
    })
  }

  return (
    <div className="filter-bar">
      <div className="filter-builder">
        <span className="filter-icon" aria-hidden="true">⌁</span>
        <div>
          <p className="mini-label">TRACEABLE FILTER / 筛选即证据</p>
          <strong>从当前视图继续下钻</strong>
        </div>
        {categoryFields.length > 0 && (
          <>
            <select aria-label="选择筛选字段" value={field} onChange={(event) => setField(event.target.value)}>
              {categoryFields.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
            <select aria-label="选择筛选值" value={value} onChange={(event) => setValue(event.target.value)}>
              {values.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button className="button button-small button-dark" onClick={addFilter}>添加条件</button>
          </>
        )}
      </div>
      <div className="filter-status">
        <div className="filter-chips">
          {filters.length ? filters.map((filter, index) => (
            <button key={`${filter.field}-${index}`} className="filter-chip" onClick={() => onRemove(index)} title="移除筛选">
              {filter.label}<span aria-hidden="true">×</span>
            </button>
          )) : <span className="filter-empty">当前使用完整数据视图</span>}
        </div>
        <div className="filter-count">
          <b>{filteredCount.toLocaleString()}</b> / {totalCount.toLocaleString()} 条
          {filters.length > 0 && <button onClick={onReset}>清除全部</button>}
        </div>
      </div>
    </div>
  )
}
