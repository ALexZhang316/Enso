# Enso MVP 验收清单（中文）

更新时间：2026-03-08

## 一、自动验收结果（已执行）

1. Node 版本：通过  
   结果：`v20.20.0`
2. npm 版本：通过  
   结果：`10.8.2`
3. 构建检查：通过  
   命令：`npm run build`
4. 核心集成测试：通过  
   命令：`npm run test:mvp`
5. Electron UI 验收：通过  
   命令：`npm run test:mvp:ui`
6. 全量自动验收：通过  
   命令：`npm run test:mvp:all`

## 二、MVP 停止条件对照

1. app launches：通过（Electron UI 自动验收）
2. three-panel UI works：通过（Playwright 验证左 / 中 / 右三栏）
3. modes switch：通过（Playwright 验证深度对话 / 决策 / 研究）
4. requests can be submitted and answered：通过（自动提交请求并校验助手回复）
5. state and audit summaries are visible：通过（自动校验右栏状态与审计摘要）
6. file import + minimal retrieval are wired：通过（自动导入知识文件并校验检索结果）
7. main single-request flow runs end-to-end：通过（集成测试 + UI 验收）

## 三、自动验收覆盖内容

1. 本地配置创建、保存、重新加载
2. SQLite 会话、消息、状态、审计持久化
3. 知识导入、切块、最小检索链路
4. 检索 + 计算主链
5. 动作型请求只读门控
6. Electron 三栏 UI 启动与渲染
7. 模式切换、新建会话、发送请求
8. 设置保存、审计记录展示、门控确认清除

## 四、保留的人工复查项

1. 系统原生文件选择器窗口本身未做点击级自动化，UI 验收走的是测试注入文件路径
2. 若需人工复查，可执行：
   - `npm run start`
   - `npm run test:mvp:all`

## 五、常见问题

1. `better-sqlite3` 原生模块错误：执行 `npm run rebuild:native`
2. 端口占用导致 `dev` 启动失败：执行  
   `Get-Process electron,node -ErrorAction SilentlyContinue | Stop-Process -Force`
