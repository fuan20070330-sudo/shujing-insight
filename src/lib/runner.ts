import type { AnalysisRequest, AnalysisResult } from '../types'
import { analyzeDataset } from './analysis'

export interface AnalysisProgress {
  type: 'progress'
  message: string
}

export interface AnalysisSuccess {
  type: 'success'
  result: AnalysisResult
}

export interface AnalysisFailure {
  type: 'error'
  message: string
}

export type AnalysisResponse = AnalysisProgress | AnalysisSuccess | AnalysisFailure

export function runAnalysis(
  request: AnalysisRequest,
  onProgress?: (message: string) => void,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  if (typeof Worker === 'undefined') {
    onProgress?.('当前环境不支持 Worker，已切换主线程分析…')
    return Promise.resolve(analyzeDataset(request.rows, request.filters, request.totalRowCount, request.datasetName))
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' })
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      worker.terminate()
      callback()
    }
    worker.onmessage = (event: MessageEvent<AnalysisResponse>) => {
      const message = event.data
      if (message.type === 'progress') onProgress?.(message.message)
      if (message.type === 'success') finish(() => resolve(message.result))
      if (message.type === 'error') finish(() => reject(new Error(message.message)))
    }
    worker.onerror = (event) => finish(() => reject(new Error(event.message || '分析 Worker 加载失败。')))
    signal?.addEventListener('abort', () => finish(() => reject(new DOMException('分析已取消', 'AbortError'))), { once: true })
    onProgress?.('正在启动浏览器分析线程…')
    worker.postMessage(request)
  })
}
