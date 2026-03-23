# Permission Spec

> Opus 负责维护本文件。Codex 负责实现并反馈可行性。

## 范围

定义 Enso 的权限模型、风险分级、门控行为、审计要求。

## 操作员边界

- 单用户系统，一个 Enso profile 内的操作员是可信的
- 不设计为敌对多租户边界
- 如需多信任边界，在 OS 用户/profile/runtime 级别拆分

## Action Types

四种 action type，每种有独立的 permission level：

| Action Type | 含义 | 默认级别 |
|-------------|------|---------|
| `workspace_write` | 向 Enso 工作区写入文件 | confirm |
| `host_exec_readonly` | 在工作区内执行只读命令 | confirm |
| `host_exec_destructive` | 破坏性命令（删除、修改系统） | block |
| `external_network` | 远程网络请求（模型调用、web 检索） | block |

隐式允许（无需门控）：
- 工作区读取（无副作用）
- 纯对话和只读检索/计算

## Permission Levels

| Level | 行为 |
|-------|------|
| `allow` | 直接执行，不中断。仍必须记录在 trace 中 |
| `confirm` | 转为 proposal，暂停执行，等待用户单次确认后执行 |
| `block` | 代码级拒绝，不可执行。不调用模型生成 proposal |

## 门控时机

门控检查发生在执行序列的第 10 步（gate check），位于验证之后、响应格式化之前。

特殊前置门控：
- `workspace_write = block` -> 在生成 proposal 之前即拒绝
- `external_network = block` -> 在发送远程模型调用之前即拒绝
- `host_exec_readonly = block` -> 在执行命令之前即拒绝

## Proposal 契约

当 permission level = confirm 时，系统产出 PendingAction：

```typescript
type PendingAction =
  | { kind: "workspace_write"; summary: string; targetPath: string; content: string }
  | { kind: "host_exec"; summary: string; command: string; workingDirectory: string };
```

Proposal 在 UI 右侧面板显示，用户点击确认按钮后执行。

## 确认后重验证

用户确认 pending action 后，执行前必须：
1. 重新加载最新配置
2. 检查对应 action type 的当前 permission level
3. 如果 level 已变为 `block` -> 拒绝执行，记录 trace
4. 否则执行动作

这防止用户在确认前修改了配置但系统仍使用旧权限执行。

## Host Exec 安全边界

允许的命令白名单（只读）：
- `ls`, `dir`, `cat`, `type`, `head`, `tail`, `find`, `where`, `tree`, `wc`, `file`, `stat`, `echo`, `pwd`

额外验证：
- 命令的工作目录必须在 Enso 工作区内
- 命令参数中的路径必须解析到工作区内
- 包含 `$(` 或反引号的参数 -> 拒绝
- 绝对路径参数解析后不在工作区内 -> 拒绝
- 包含 `..` 的相对路径解析后不在工作区内 -> 拒绝

## 配置持久化

权限配置存储在 TOML config 中：

```toml
[permissions]
workspace_write = "confirm"
host_exec_readonly = "confirm"
host_exec_destructive = "block"
external_network = "block"
```

用户可在设置面板中修改。修改即时生效（下一次请求使用新值）。

## 审计要求

每次门控检查必须记录在 trace 中，包含：
- action type
- permission level
- 决定（allow/confirm/block）
- 时间戳

每次 action 执行（无论是直接执行还是确认后执行）必须产出 audit summary。

## 验收标准

1. 每种 action type 的三个 level 都必须有对应的运行时行为
2. block 级别必须在调用模型/执行命令之前拒绝
3. confirm 级别必须产出 PendingAction 并暂停
4. allow 级别必须直接执行但记录 trace
5. 确认后执行必须重新验证权限
6. host exec 必须验证命令白名单和路径边界
7. 权限变更通过 TOML 配置生效，无需重启

## Implementation Note (2026-03-23)

- `host_exec_readonly` may allow additional inspection commands beyond the original minimal list, but they must remain read-only and inside the Enso workspace boundary.
- Safe Git coverage is restricted to inspection forms only: `git status`, `git log`, `git diff` without `--output`, `git show` without `--output`, branch listing flags, and remote listing flags.
- Git branch creation/deletion, remote mutation, and diff/show file-writing variants are blocked at the command validator before execution.
