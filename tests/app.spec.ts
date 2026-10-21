import path from 'node:path'
import { expect, test } from '@playwright/test'

test('desktop demo exposes ranked evidence, drill-down and report export', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop interaction path')
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('让每一个结论')

  await page.getByRole('button', { name: /载入示例数据/ }).click()
  await expect(page.locator('[data-testid="insight-card"]').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('可复核洞察').first()).toBeVisible()

  await page.locator('[data-testid="insight-card"]').first().click()
  await expect(page.getByText('样本量 n').first()).toBeVisible()
  await page.getByRole('button', { name: /打开完整证据抽屉/ }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('统计口径')).toBeVisible()
  await expect(drawer.getByText('证据表')).toBeVisible()
  await expect(drawer.locator('table tbody tr').first()).toBeVisible()
  await page.locator('.drawer-scrim').click({ position: { x: 10, y: 10 } })

  const followUp = page.locator('.followup-actions > button:not(.evidence-cta)').first()
  if (await followUp.isVisible()) {
    await followUp.click()
    await expect(page.locator('.filter-chip').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-testid="insight-card"]').first()).toBeVisible({ timeout: 30_000 })
  }

  await page.getByRole('tab', { name: /字段画像/ }).click()
  await expect(page.getByText('先理解数据，再相信结论')).toBeVisible()
  await expect(page.locator('.profile-table tbody tr').first()).toBeVisible()
  await page.getByRole('tab', { name: /洞察工作台/ }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('export-report').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/数镜-洞察报告-.*\.html$/)
})

test('mobile dashboard remains readable and exposes quality checks', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile viewport path')
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('让每一个结论')
  await page.getByRole('button', { name: /载入示例数据/ }).click()
  await expect(page.locator('[data-testid="insight-card"]').first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole('tab', { name: /质量检查/ }).click()
  await expect(page.getByText('把脏数据问题摆到结论前面')).toBeVisible()
  await expect(page.locator('.quality-summary-grid article').first()).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
test('desktop imports the XLSX demo through the in-browser parser', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop import path')
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles(path.resolve('public/demo/smart-community-demo.xlsx'))
  await expect(page.locator('[data-testid="insight-card"]').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.data-source-pill')).toHaveText('XLSX')
  await expect(page.getByText('smart-community-demo.xlsx').first()).toBeVisible()
})

test('desktop exposes a clear error state for an unusable CSV', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop error path')
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'broken.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('字段\n1\n2\n3'),
  })
  await expect(page.getByText('这份数据暂时没能通过分析入口')).toBeVisible()
  await expect(page.getByRole('button', { name: '返回首页' })).toBeVisible()
})
