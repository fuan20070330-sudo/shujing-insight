# 数镜 · Shujing Insight

> 可验证自动数据洞察与叙事平台 —— 从数据到证据，再到可复核的结论。

数镜是面向中国大学生计算机设计大赛“大数据应用”“信息可视化”“软件应用与开发”方向设计的纯软件作品。它将 CSV / XLSX 导入、字段画像、数据质量检查、统计检验、异常与变点检测、洞察排序、图表推荐、追问下钻和报告导出整合在一条可追溯的分析路径中。

**核心计算全部在浏览器内完成。GitHub Pages 只托管静态资源，不依赖后端、GPU 或外部 AI API。**

## 1. 作品亮点

- **证据优先**：每条洞察同时展示筛选条件、有效样本量、方法、效应量、p 值、证据表和解释边界。
- **相关不等于因果**：相关性洞察始终明确标注非因果；变点与分组差异同样要求结合业务事件和混杂因素复核。
- **静态站完整可用**：CSV/XLSX 前端解析，Web Worker 执行分析，ECharts 渲染图表，报告在浏览器中生成并下载。
- **可追问的叙事**：洞察不只是静态卡片。点击追问会生成新筛选条件，重新计算全部证据，并保留追问链。
- **质量闸门**：缺失与 IQR 异常不会被静默忽略，既进入数据质量清单，也可能成为排序洞察。
- **响应式演示**：包含首页叙事、空态、解析/分析态、错误态、大数据模式、桌面与移动布局。

## 2. 功能清单

| 模块 | 能力 | 实现方式 |
| --- | --- | --- |
| 数据输入 | 示例数据、CSV、XLSX/XLS | `Papa Parse` + `SheetJS`，浏览器本地解析 |
| 字段画像 | 数值/类别/日期/文本推断、缺失率、唯一值、均值/中位数/四分位、高频值 | `src/lib/analysis.ts` |
| 质量检查 | 缺失审计、Tukey IQR 异常检测、质量问题排序 | 1.5×IQR 栅栏 |
| 自动洞察 | 相关性、分组差异、时间变点、异常记录、数据质量 | 项目内统计实现，不依赖外部 AI |
| 洞察排序 | 综合显著性、效应量、证据强度与质量风险 | 0–100 排序分 |
| 图表推荐 | 散点图、条形图、折线图及推荐理由 | ECharts |
| 证据抽屉 | 方法、n、效应量、p 值、筛选条件、证据表、边界、复制证据链 | React 组件 |
| 追问下钻 | 分组/区间/时间筛选，重新分析并保留追问历史 | 可序列化 `FilterCondition[]` |
| 报告导出 | Markdown 审计报告、可打印 HTML 报告 | 浏览器 Blob 下载 |
| 大数据状态 | > 5,000 条启用大样本提示，散点图确定性抽样展示 | Web Worker + 视图抽样 |
| 工程保障 | TypeScript、Vitest 单元测试、Playwright E2E、GitHub Actions Pages | CI 配置见 `.github/workflows/pages.yml` |

## 3. 架构

```text
┌──────────────────────────────────────────────────────────────┐
│ React + TypeScript 静态应用                                  │
│                                                              │
│  首页叙事 / 工作台 / 证据抽屉 / 字段画像 / 质量检查          │
│        │                                                     │
│        ├── Papa Parse / SheetJS ── CSV / XLSX 本地解析       │
│        ├── Web Worker ── 字段画像、统计检验、洞察排序         │
│        ├── ECharts ── 推荐图表与大数据抽样展示                │
│        └── Blob ── Markdown / HTML 审计报告                   │
│                                                              │
│  纯函数分析引擎：相关 / Welch / ANOVA / 变点 / IQR            │
└──────────────────────────────────────────────────────────────┘
          │
          └── GitHub Pages：仅静态 HTML/CSS/JS/Worker/示例数据

可选增强（未配置也可完整运行）：
VITE_WS_GATEWAY_URL ── AI 解释 / 多人协作 / 远程分析（非 GitHub Pages）
```

### 数据流

1. 用户加载示例或选择本地文件。
2. 导入器统一空值、日期与字段名，限制文件 20 MB、分析上限 50,000 行。
3. 主线程将数据与筛选条件发送给 Web Worker。
4. 分析引擎推断字段类型、生成画像和质量问题，运行统计检验并排序洞察。
5. UI 展示推荐图表、方法指标和证据表；追问会扩展现有筛选条件并重新执行步骤 3–5。
6. 报告导出器把当前数据集、筛选条件、洞察与证据表固化为 Markdown 或 HTML。

## 4. 统计方法与解释边界

| 方法 | 使用场景 | 关键输出 |
| --- | --- | --- |
| Pearson 相关检验 | 两个连续字段的线性同步变化 | `r`、双侧 p 值、有效 n |
| Welch t 检验 | 两类别组的均值差异 | Cohen's d、p 值、组统计 |
| 单因素 ANOVA | 三个及以上类别组的均值差异 | η²、p 值、组统计 |
| 单变点扫描 + 置换检验 | 日期序列的均值结构变化 | 候选变点、前后均值差、Cohen's d、99 次置换 p 值 |
| Tukey IQR | 单字段极端值复核 | Q1/Q3、1.5×IQR 栅栏、越界记录 |
| 缺失审计 | 数据质量与样本完整性 | 缺失数、缺失率、涉及字段 |

解释边界：

- 自动洞察只描述关联、差异或结构变化，不自动给出因果结论。
- “未检出”不等于“不存在”；结果受样本量、测量口径、筛选条件和预设阈值影响。
- 异常值不自动删除，缺失值不自动插补。
- 变点检测固定随机种子 `20261021`，用于结果复现，但不替代业务事件核验。
- 多重比较未做全族错误率校正；当前流程通过最小效应量和证据排序控制展示优先级，正式研究应进一步校正。

## 5. 项目结构

```text
src/
  App.tsx                     # 页面状态、导入、筛选、追问与导出编排
  components/
    ChartView.tsx             # ECharts 图表推荐与渲染
    DataPanels.tsx            # 字段画像、质量检查、方法说明
    EvidenceDrawer.tsx        # 证据抽屉与可复制证据链
    FilterBar.tsx             # 可追溯筛选条件
  lib/
    analysis.ts               # 纯函数分析引擎与统计实现
    importer.ts               # CSV/XLSX 本地解析
    runner.ts                 # Web Worker 调度与降级
    report.ts                 # Markdown / HTML 报告生成
  workers/analysis.worker.ts  # 浏览器分析线程
public/demo/                  # 合成 CSV / XLSX 演示数据及说明
tests/app.spec.ts             # Playwright 端到端测试
docs/                         # 答辩功能清单与 3 分钟演示脚本
.github/workflows/pages.yml   # GitHub Actions Pages 部署
```

## 6. 本地运行

要求 Node.js **20.19+**（推荐 22 LTS）。系统若安装的是旧版 Node，请切换到新版本后再执行。

```bash
npm install
npm run dev
```

默认开发地址由 Vite 输出，通常为 `http://127.0.0.1:5173`。

生产构建与预览：

```bash
npm run build
npm run preview -- --port 4174
```

## 7. 测试

```bash
# TypeScript 类型检查
npm run typecheck

# Vitest 单元测试
npm test

# Playwright 端到端测试（自动构建预览）
npm run build
npm run test:e2e
```

测试覆盖：

- 演示数据 CSV 解析、字段类型推断、缺失与证据结构；
- 相关性、分组差异、异常与质量洞察生成；
- 筛选条件传播与追问后的样本量变化；
- 小样本不生成高置信因果结论；
- Markdown / HTML 报告导出与 HTML 转义；
- 桌面端完整演示流程、证据抽屉、字段画像、报告下载；
- XLSX 浏览器导入、不可用 CSV 错误态；
- 移动端质量检查页与页面横向溢出检查。

E2E 使用独立端口 `4174`，避免与其他本地项目冲突。

## 8. GitHub Pages 部署

1. 创建公开仓库 `shujing-insight` 并推送 `main` 分支。
2. 打开仓库 **Settings → Pages**。
3. 在 **Build and deployment → Source** 选择 **GitHub Actions**。
4. 推送后，`.github/workflows/pages.yml` 会依次执行 `npm ci`、单元测试、构建和 Pages 部署。
5. 部署地址通常为：

```text
https://<github-username>.github.io/shujing-insight/
```

说明：

- `.github/workflows/pages.yml` 是唯一定义的 Pages 部署入口。
- Vite 使用相对 `base: './'`，适配项目型 GitHub Pages 路径。
- 工作流在 Node 22 上运行。
- 如果仓库尚未启用 Pages，工作流中的 `configure-pages` / `deploy-pages` 会在权限和 Pages 开关就绪后完成部署。
- 本项目没有服务端；GitHub Pages 不能托管 WebSocket 服务。

## 9. 可选 WebSocket 网关

复制 `.env.example` 为 `.env.local`，按需设置：

```bash
VITE_WS_GATEWAY_URL=wss://your-gateway.example.com
```

未配置时：

- 所有核心静态功能完整可用；
- 页面明确显示“可选 WebSocket 网关：未配置（静态功能完整可用）”；
- 不发起任何 WebSocket 连接。

后续若接入网关，只应作为 AI 解释、多人协作或远程分析的增强能力，不能成为导入、统计、洞察、图表和报告导出的前置条件。

## 10. 演示数据

演示数据位于：

- `public/demo/smart-community-demo.csv`
- `public/demo/smart-community-demo.xlsx`
- `public/demo/README.md`

数据为固定随机种子生成的合成城市社区指标，包含缺失、极端值、组间差异、相关关系和结构变化，不包含真实个人或机构信息。

答辩材料：

- [`docs/ANSWER_FEATURE_CHECKLIST.md`](docs/ANSWER_FEATURE_CHECKLIST.md)
- [`docs/3-MINUTE-DEMO-SCRIPT.md`](docs/3-MINUTE-DEMO-SCRIPT.md)

## 11. 隐私与安全

- 文件解析和统计计算均在当前浏览器完成。
- 示例数据来自静态资源；用户导入文件不会上传到服务器。
- 刷新页面即清除内存中的当前数据视图。
- 报告由浏览器 Blob 下载，不经过远程服务。
- 项目不提交 token、密钥、个人数据或未授权数据。
- ECharts 与 SheetJS 使用本地打包依赖，不依赖运行时 CDN。

## 12. 已知限制

1. 分析上限为 50,000 行、文件上限 20 MB；超大文件需外部预处理。
2. 类别字段自动识别最多展示 30 个高频类别；复杂文本不做自然语言语义理解。
3. 自动洞察采用固定阈值和有限方法族，未覆盖所有统计模型，也未进行全族多重比较校正。
4. 时间变点先按日期聚合均值，再扫描单变点；不适用于高频、多季节或强自相关序列的正式时序推断。
5. 图表推荐以字段类型和洞察类型为依据，不替代专业可视化设计。
6. 报告导出为 Markdown 与 HTML；如需 PDF，请在浏览器打开 HTML 后使用“打印为 PDF”。
7. 静态站不支持多人协作、服务端持久化和远程分析；这些能力只能作为可选网关增强。
8. 本作品不输出因果结论；任何业务行动仍需领域专家结合外部信息判断。

## 13. 开发约定

- 不要把敏感数据写入仓库或测试夹具。
- 新增统计方法时，必须同时提供方法说明、效应量/不确定性、证据表与解释边界。
- 新增洞察类型时，更新 `InsightKind`、排序逻辑、图表推荐、证据抽屉和测试。
- 不要把远程 AI 调用设为主流程依赖。
- 修改 UI 后至少运行 `npm run typecheck && npm test && npm run test:e2e`。
- 发布前运行 `npm run build` 并检查 `dist/` 不含 `.env` 或个人数据。

## 14. 许可

代码采用 MIT License。演示数据为程序生成的合成数据。
