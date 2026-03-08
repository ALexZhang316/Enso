# Enso MVP 验收清单（中文）

更新时间：2026-03-08

## 一、自动验收结果（已执行）

1. Node 版本：通过  
   结果：`v20.20.0`
2. npm 版本：通过  
   结果：`10.8.2`
3. 构建检查：通过  
   命令：`npm run build`
4. 启动烟测：通过  
   命令：`npm run start`

## 二、MVP 停止条件对照

1. app launches：通过（自动验证）
2. three-panel UI works：需手工确认
3. modes switch：需手工确认
4. requests can be submitted and answered：需手工确认
5. state and audit summaries are visible：需手工确认
6. file import + minimal retrieval are wired：需手工确认
7. main single-request flow runs end-to-end：需手工确认

## 三、手工验收步骤

1. 进入项目目录：`cd D:\Enso`
2. 启动开发模式：`npm run dev`
3. 检查三栏布局：左/中/右三栏是否固定存在
4. 切换模式：点击“深度对话 / 决策 / 研究”，确认即时切换
5. 新建会话并发送普通请求：确认收到助手回复
6. 检查右栏“当前状态 / 审计摘要”：发送后是否更新
7. 导入知识文件并提问“根据我导入的文件……”：确认出现检索证据
8. 发送动作型请求（如“删除 xx”）：确认进入只读门控并可“确认并清除门控”
9. 打开设置页修改并保存：确认显示“设置已保存”，重载后仍保留
10. 关闭再启动应用：确认会话、消息、状态、审计、知识来源可恢复

## 四、常见问题

1. `better-sqlite3` 原生模块错误：执行 `npm run rebuild:native`
2. 端口占用导致 `dev` 启动失败：执行  
   `Get-Process electron,node -ErrorAction SilentlyContinue | Stop-Process -Force`
