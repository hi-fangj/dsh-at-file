# dsh-at-file

DeepSeek Harness Web GUI 的 Codex 风格 `@` 文件提及插件。在输入框输入 `@`，边输入边智能搜索工作区文件，回车即可把文件附加到提示词中：模型直接收到文件内容，输入框上方的附加条里保留可点击的文件链接，点击即在宿主机打开文件。

```
输入框:   修复 README  @README.  ← 光标处浮出文件选择器
            ┌────────────────────────────┐
            │ README.md                  │
            │ docs/README.zh.md          │
            └────────────────────────────┘
草稿:     修复 README [README.md ×]  ← 草稿中的文件芯片
附加条:   📄 README.md  ×           ← 输入框上方可点击的文件链接
发送后:   修复 README
           <file path="README.md">
           …完整文件内容…
           </file>
```

## 安装

```sh
dsh plugin --profile <name> add file:/path/to/dsh-at-file
```

随后重启 web 服务以加载 host 半部分与新的 client bundle。插件依赖标准 web bundle 组合（`ui-input-trigger` 的 `@` 管线、`api-gateway` client Remote、会话插槽），默认的 `dsh web` profile 均已包含。

## 配置

Host 侧可调参数在 `cordis.yml` 的插件行上：

```yaml
- id: dsh-at-file
  name: dsh-at-file
  config:
    maxIndexedFiles: 5000      # 每个工作区索引文件数上限（到达即停止遍历并如实报告截断）
    maxFileBytes: 262144       # 单个附加文件字节上限；超限文件拒绝附加，绝不截断
    ignoreDirs: ['.git', 'node_modules']   # 遍历时跳过的目录名
```

## 对模型的影响

| 方面 | 效果 |
| --- | --- |
| Token 开销 | 每个附加文件在提交时把完整内容（不超过 `maxFileBytes`）加入用户消息。 |
| 工具调用 | 无 —— 内容已在提示词中，模型无需再调用工具读取。 |
| 消息格式 | 每个附件在用户消息中序列化为 `<file path="<工作区相对路径>">\n<内容>\n</file>`。 |
| 边界 | 附加超过 `maxFileBytes`、二进制文件或目录会以错误提示阻止发送，草稿与芯片保留。 |

## 权限边界

- 选择器只提供会话工作区内的文件（默认跳过 `.git`/`node_modules`，上限 `maxIndexedFiles`）。`read` 接受宿主机进程可读的任意绝对路径：这是用户在自己的会话里使用的选择界面，不是模型能力 —— 模型看不到 `atFile/search` / `atFile/read` 方法。
- 点击打开文件走 harness 自带的 `host.openPath`（本就限制在 loopback）。

## 开发

```sh
pnpm install            # 链接同级 dsh 仓库用于构建与测试
pnpm run check          # typecheck + 测试 + 构建
pnpm run test           # vitest（host 文件系统/运行时，client 源/附加条/装配）
pnpm run build          # esbuild 构建 host/client/invariant 三份 bundle + tsc 声明文件
```

本仓库假设 harness 位于 `../dsh`（相对本仓库），供开发期 `link:` 解析与测试别名使用。

## 已知限制

- 工作区索引按会话缓存 30 秒；此后新建的文件需等下一次菜单打开刷新。
- 粘贴 `@路径` 文本不会升级为芯片（仅支持菜单选择）；手输的 `@` 路径在命中索引文件时会有引用高亮。
- 选择器分组标题显示源名（`at-file`），因为 slash 菜单的标题词典归 harness 所有。

## License

MIT
