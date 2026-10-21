import { analyzeDataset } from '../lib/analysis'
import type { AnalysisRequest } from '../types'

const workerScope = self as unknown as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  try {
    workerScope.postMessage({ type: 'progress', message: '正在画像字段并执行统计检验…' })
    const result = analyzeDataset(event.data.rows, event.data.filters, event.data.totalRowCount, event.data.datasetName)
    workerScope.postMessage({ type: 'success', result })
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : '分析线程发生未知错误。',
    })
  }
}
