# 便签 · Sticky Notes

<p align="center"><img src="icon.svg" width="88" height="88" alt="dsh-sticky-notes"></p>

<p align="center">
  <b>把对话里重要的内容固定成 Markdown，随用随取。</b>
</p>

<p align="center">
  <a href="README.en.md">English</a> · 简体中文
</p>

---

把 DeepSeek Harness 对话里重要的回复、任意选区，甚至整段对话，收藏成本地 Markdown 便签。
便签常驻右侧栏，可以随时打开、对比、改标题，需要时再整段或按选区插回输入框。

长对话里反复往上翻表格、问题清单、结论时，这个面板就是你的「随手贴」。

## 功能

### 收藏
- **收藏整条回复**：每条助手回复下方的便签图标，Host 直接从会话日志取原文，不靠 DOM 截取，Markdown 原样保留；
- **收藏选中片段**：选中对话文字后浮出的「存为便签」，只保存选中的那一段；
- **收藏整段对话**：便签页工具栏一键把当前会话的用户 / 助手文字整理成一篇摘录。

### 便签页（右侧栏）
- 默认只看**当前会话**，切「全局」查看所有全局便签；支持搜索和数量显示；
- 每条便签是一张胶囊卡片：左侧是标题 + 一行摘要 + 会话/时间，右侧是 2×2 操作区，两者之间用一条竖向虚线分隔；
- **列表内直接操作**：收藏、插入会话、切换可见性、删除（需两次点击确认，3 秒自动复位），不用点开详情；
- **收藏置顶**：收藏的便签排在最前，其余按修改时间倒序。

### 详情页
- 操作条在顶部：插入全文、插入选中、以文件插入、复制、设为全局/会话、删除；
- 可编辑标题与正文（带 Markdown 预览、可见性切换）；
- 支持深色 / 浅色主题，跟随 DSH 界面。

### 插回会话
- **插入全文**：把 `## 标题` + 正文追加到输入框；
- **插入选中**：只追加详情里选中的片段；
- **以文件插入**：追加便签文件的绝对路径，让模型按文件读取。

### 其它
- 每条便签就是一个本地 `.md` 文件（带 frontmatter），可以直接用编辑器改、用 Git 管；
- Markdown 渲染：标题、列表、任务勾选、表格、代码块、引用、链接、粗斜体；内容先转义再渲染，链接只允许 `http(s)://`、`mailto:`、`#`、`/` 开头；
- **多语言**：界面文案跟随 DSH 的「设置 → 通用 → 语言」在中文 / 英文间实时切换，无需刷新；错误提示与「收藏整段对话」生成的内容也按当前语言生成；
- **键盘与无障碍**：Tab 聚焦、`aria-label` / `aria-pressed`、可见焦点环、遵循 `prefers-reduced-motion`。

## 界面预览

```
┌─────────────────────────┊────────────┐
│ 便签标题                 ┊  ☆     ↓   │
│ 一行摘要                  ┊            │
│ [会话] 14:20            ┊  ⊕     🗑   │
└─────────────────────────┴────────────┘
   ⊙ 收藏（置顶）
   ↓ 插入到输入框
   ⊕ 切换全局 / 会话
   🗑 删除（二次确认）
```

## 安装

要求：DeepSeek Harness 桌面端 0.2.x（开发环境为 `0.2.1-rc.2`），无需安装额外依赖。

### 插件管理器（推荐）

在应用内「插件管理器」中选择本目录安装，然后**完全重启客户端**。

### 命令行

```sh
dsh plugin --profile desktop add link:/absolute/path/to/dsh-sticky-notes
```

> Windows 下路径写作 `link:D:/path/to/dsh-sticky-notes`。
> 桌面端如果没有把 `dsh` 加进 PATH，用插件管理器安装效果相同。

安装后：Host 半需要完全重启客户端才会加载；Client 半刷新页面即可。

## 使用

1. 打开便签页：点会话标题右侧的便签图标，或右侧栏的「便签」标签；
2. 收藏内容：回复下方图标 / 选中文字后的浮钮 / 工具栏「收藏整段对话」；
3. 在列表里直接操作，或点开卡片查看完整 Markdown；
4. 需要参考时用「插入全文 / 插入选中 / 以文件插入」放回输入框。

## 存储

便签分两处存放：

| 类型 | 位置 | 说明 |
|---|---|---|
| 会话便签（`scope: session`） | `<会话工作目录>/.dsh-notes/` | 跟着项目走，可随项目备份、纳入版本管理 |
| 全局便签（`scope: global`） | `~/.dsh/sticky-notes/notes/` | 所有项目共享 |

会话工作目录取自会话头（`SessionHeader.cwd`，即创建会话时的工作区路径）。
列表 = 当前项目的会话便签 + 全局便签；「设为全局 / 设为会话」会把文件在两个目录之间移动。

```
D:\Projects\某个项目\.dsh-notes\             # 项目便签（目录名可配置）
└── 2026-10-21-问题列表-7f3a9c1d2e4b.md

C:\Users\<你>\.dsh\sticky-notes\notes\        # 全局便签
└── 2026-10-21-通用约定-9a1c2b3d4e5f.md
```

### 文件格式

```markdown
---
id: "7f3a9c1d2e4b"
title: "问题列表"
scope: session
favorite: false
sessionId: "session-...."
sessionTitle: null
createdAt: 1761000000000
updatedAt: 1761000000000
---

正文（原样保存的 Markdown）
```

- `scope`：`session` | `global`；
- `favorite`：`true` 时排在列表最前，旧文件没有该键时按 `false` 处理；
- `sessionId`：来源会话，便于回溯；即使改为 `global` 也会保留；
- 手改 frontmatter 后，下次刷新列表即生效；损坏的文件会被跳过，不影响其它便签；
- 旧版本把会话便签也存在全局目录里，这些便签照常显示（按 `sessionId` 归属），改动或切换可见性时会自动落到项目目录；
- 建议把 `.dsh-notes/` 加进项目的 `.gitignore`（想随项目提交就别加）。

### 配置

在 profile 的 `cordis.patch.yml` 里覆盖这一行（patch 会整体替换 `config`，所以键要写全）：

```yaml
- id: sticky-notes
  config:
    directory: ''                    # 全局便签目录；留空 = $DSH_HOME/sticky-notes/notes
    projectDirectory: '.dsh-notes'   # 会话便签目录，相对会话工作目录
    maxNotes: 2000
```

| 键 | 默认值 | 说明 |
|---|---|---|
| `directory` | `''` | 全局便签目录；留空用 `$DSH_HOME/sticky-notes/notes` |
| `projectDirectory` | `.dsh-notes` | 会话便签目录，相对会话工作目录；只接受相对路径 |
| `maxNotes` | `2000` | 便签数量上限（写入时检查） |

`projectDirectory` 若写成绝对路径或包含 `..`，会回落到默认的 `.dsh-notes`。

## 开发

本目录就是源码仓库，profile 里以 `link:` 方式安装，修改这里的文件即修改运行中的插件。

| 文件 | 作用 |
|---|---|
| `index.js` | Host 半：便签服务（9 个 Typert Remote 接口）、项目目录解析、会话日志抓取 |
| `client.js` | Client 半：右侧栏便签页、收藏入口、Markdown 渲染、插回输入框、样式与文案 |
| `lib/store.js` | Markdown 便签存储：frontmatter 解析/序列化、排序、目录读写 |
| `lib/schemas.js` | 手写的零依赖请求校验（不引入 zod，避免拖垮 Host 启动） |
| `lib/typert.host.js` | Host 侧 Typert 接口清单 |
| `cordis.patch.yml` | bundle 声明：插件行与默认配置 |
| `locale/*.json` | 插件元数据的中英文标题 / 描述 |
| `test/*.mjs` | 单元测试与客户端冒烟测试 |

- **Host 半**（`index.js`、`lib/*.js`、`cordis.patch.yml`、`package.json`）改动后需要**完全重启客户端**；
- **Client 半**（`client.js`）改动后刷新页面即可；窗口内刷新不触发插件重载时，重开会话页；
- 无构建步骤：Client 半是纯 JavaScript，由 Host 原样提供给页面；
- 跑测试：`node --test`（或 `pnpm test`），只依赖 Node 内置的 `node:test`，不需要安装依赖。

## 兼容性

- 面向 DeepSeek Harness 桌面端 0.2.x（开发环境 `0.2.1-rc.2`）；
- Host 侧只使用 Node 内置模块与宿主提供的 peer 依赖（`@deepseek-ai/cordis`、`dsh-session`、`dsh-typert-protocol`）；
- Client 侧只依赖宿主注入的 `react`，不额外打包。

## 已知边界

- 便签页在右侧栏内就地展开，不是独立浮窗；右侧栏自身的「浮动 / 分栏」按钮可以把整个便签页拖成浮窗；
- 同一项目的不同会话：便签文件物理上同在一个 `.dsh-notes/` 目录，但列表按 `sessionId` 过滤，会话便签仍互不可见，除非设为全局；
- 会话工作目录不可写（只读挂载、权限不足）时，写便签会报错；工作目录缺失或查不到会话头时，会话便签回落到全局目录，不会丢失；
- 会话日志读取依赖宿主的 `sessionPersistence`；极新的、尚未落盘的会话可能暂时读不到回复原文，先发一条消息再收藏即可；
- 「收藏整段对话」把用户与助手的可见文字拼成一篇，跳过思考、工具调用与工具输出；
- 便签内容本身不会随界面语言翻译——已存下的文件保持原样。
