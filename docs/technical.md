# 技术细节

[English](technical.en.md) | 中文

[README](../README.md) 只保留简介、安装、预览与使用；本文档收录存储布局、文件格式、配置项、开发方式、兼容性与已知边界。

## 卡片操作区示意

```
┌─────────────────────────┊──────────────┐
│ 便签标题                 ┊  ☆    ⧉    ↓   │
│ 一行摘要                  ┊  ⊕    🗑        │
│ [工作区] 14:20          ┊                │
└─────────────────────────┴──────────────┘
   ☆ 收藏（同组内置顶）
   ⧉ 浮窗打开（可拖动 / 缩放）
   ↓ 插入到输入框
   ⊕ 切换全局 / 工作区
   🗑 移到回收站（二次确认）
```

## 存储

便签分两处存放，各自带一个回收站：

| 类型 | 位置 | 说明 |
|---|---|---|
| 工作区便签（`scope: session`） | `<会话工作目录>/.dsh-notes/` | 整个工作区共享，可随项目备份、纳入版本管理 |
| 全局便签（`scope: global`） | `~/.dsh/sticky-notes/notes/` | 所有项目共享 |
| 工作区回收站 | `<会话工作目录>/.dsh-notes/.trash/` | 本工作区删除的便签，只有本工作区可见 |
| 全局回收站 | `~/.dsh/sticky-notes/notes/.trash/` | 全局删除的便签，所有项目可见 |

> 1.7.0 起包名改为 `dsh-jingjing-sticky-notes`；上表的存储目录和插件内部 id 保持不变，已有便签不受影响。

会话工作目录取自会话头（`SessionHeader.cwd`，即创建会话时的工作区路径）。

- **工作区视图**：当前工作区目录下**所有会话**的便签（不再按 `sessionId` 过滤），外加旧版本落在全局目录、但按来源会话能定位到本工作区的便签；
- **会话视图**：再按 `sessionId` 过滤到当前会话；
- **全局视图**：只显示 `scope: global` 的便签；
- 「设为全局 / 工作区」会把文件在两个目录之间移动；归档标记来自 DSH 工作区注册表的 `archivedSessionIds`（已归档会话 ID 集合），这个环境读不到时不显示标记、也不提供批量清理。

```
D:\Projects\某个项目\.dsh-notes\             # 工作区便签（目录名可配置）
├── 2026-10-21-问题列表-7f3a9c1d2e4b.md
└── .trash\                                 # 本工作区回收站
    └── 2026-10-20-旧便签-4c2e1a9b8d7f.md

C:\Users\<你>\.dsh\sticky-notes\notes\        # 全局便签
├── 2026-10-21-通用约定-9a1c2b3d4e5f.md
└── .trash\                                 # 全局回收站
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
trashedAt: 1761000009999
---

正文（原样保存的 Markdown）
```

- `scope`：`session`（工作区可见）| `global`（全局可见）；
- `favorite`：`true` 时在同一分组内排最前，旧文件没有该键时按 `false` 处理；
- `sessionId`：来源会话，用于分组与「已归档」标记；即使改为 `global` 也会保留；
- `trashedAt`：只在回收站里的文件上出现，表示移入回收站的时间；恢复时自动移除；
- 手改 frontmatter 后，下次刷新列表即生效；损坏的文件会被跳过，不影响其它便签；
- 旧版本把工作区便签也存在全局目录里，这些便签照常显示（当前会话可见，能定位工作区时并入工作区视图），改动或切换可见性时会自动落到项目目录；
- 建议把 `.dsh-notes/` 加进项目的 `.gitignore`（想随项目提交就别加；回收站也在里面）。

### 配置

在 profile 的 `cordis.patch.yml` 里覆盖这一行（patch 会整体替换 `config`，所以键要写全）：

```yaml
- id: sticky-notes
  config:
    directory: ''                    # 全局便签目录；留空 = $DSH_HOME/sticky-notes/notes
    projectDirectory: '.dsh-notes'   # 工作区便签目录（scope: session），相对会话工作目录
    maxNotes: 2000
```

| 键 | 默认值 | 说明 |
|---|---|---|
| `directory` | `''` | 全局便签目录；留空用 `$DSH_HOME/sticky-notes/notes` |
| `projectDirectory` | `.dsh-notes` | 工作区便签目录（`scope: session`），相对会话工作目录；只接受相对路径 |
| `maxNotes` | `2000` | 便签数量上限（写入时检查） |

`projectDirectory` 若写成绝对路径或包含 `..`，会回落到默认的 `.dsh-notes`。

## 开发

源码仓库：<https://github.com/tryqylz/dsh-jingjing-sticky-notes>

本地开发时把仓库 clone 下来，以 `link:` 方式装进 profile，修改这里的文件即修改运行中的插件：

```sh
git clone https://github.com/tryqylz/dsh-jingjing-sticky-notes.git
dsh plugin --profile desktop add link:D:/path/to/dsh-jingjing-sticky-notes
```

| 文件 | 作用 |
|---|---|
| `index.js` | Host 半：便签服务（13 个 Typert Remote 接口）、项目目录解析、会话日志抓取、回收站与归档清理 |
| `client.js` | Client 半：右侧栏便签页（工作区分组 / 回收站）、便签浮窗标签页、收藏入口、Markdown 渲染与选区重建、插回输入框、样式与文案 |
| `lib/store.js` | Markdown 便签存储：frontmatter 解析/序列化、排序、目录与回收站读写 |
| `lib/schemas.js` | 手写的零依赖请求校验（不引入 zod，避免拖垮 Host 启动） |
| `lib/typert.host.js` | Host 侧 Typert 接口清单 |
| `cordis.patch.yml` | bundle 声明：插件行与默认配置 |
| `locale/*.json` | 插件元数据的中英文标题 / 描述 |
| `test/*.mjs` | 单元测试、Host/Client 契约测试与客户端冒烟测试 |

- **Host 半**（`index.js`、`lib/*.js`、`cordis.patch.yml`、`package.json`）改动后需要**完全重启客户端**；
- **Client 半**（`client.js`）改动后刷新页面即可；窗口内刷新不触发插件重载时，重开会话页；
- 无构建步骤：Client 半是纯 JavaScript，由 Host 原样提供给页面；
- 跑测试：`node --test`（或 `pnpm test`），只依赖 Node 内置的 `node:test`，不需要安装依赖。

## 兼容性

- 面向 DeepSeek Harness 0.2.x（桌面端 / Web 端，开发环境 `0.2.1-rc.2`）；
- Host 侧只使用 Node 内置模块与宿主提供的 peer 依赖（`@deepseek-ai/cordis`、`dsh-session`、`dsh-typert-protocol`）；
- Client 侧只依赖宿主注入的 `react`，不额外打包。

## 已知边界

- 便签浮窗是 DSH 的应用内浮层（floating pane），不是操作系统窗口：不能拖出 DSH 主窗口、不能用 Alt-Tab 切换、不能放到第二块屏幕；
- 浮窗按会话保存：切换会话或打开设置等全局页面时隐藏，切回原会话后恢复；
- 浮窗内只读，不写便签文件；同一条便签在列表/详情里编辑后，浮窗会自动重新读取并更新，也可以点浮窗工具栏的刷新按钮手动重读；
- 「关闭全部浮窗」只关闭当前会话的便签浮窗，不会关闭便签页（管理列表）本身；
- 浮窗由 DSH 右侧栏的停靠布局（dockkit）提供；宿主版本不提供 `openResource` / `float` 能力时，浮窗按钮自动隐藏，现有列表和详情不受影响；
- **工作区视图**会显示同一工作区所有会话的便签（这是相对旧版「会话间互不可见」的可见性变化）；只想看当前会话时切「会话」视图；
- 「已归档」标记与工作区顶部的「移入回收站」批量操作只作用于工作区视图；全局视图不参与批量清理，全局便签按普通便签单独删除；
- 归档状态由 DSH 工作区注册表提供，环境读不到时（例如没有工作区功能的宿主）不显示归档标记，批量清理会报错；
- 归档可以随时取消，但便签移到回收站后只有在清空前才能恢复；「清空」会真实 `unlink`（删除文件），不可找回；
- 工作区回收站只在该工作区可见（跟着项目目录走）；全局回收站所有工作区可见；
- 会话工作目录不可写（只读挂载、权限不足）时，写便签会报错；工作目录缺失或查不到会话头时，会话便签回落到全局目录，不会丢失；
- 会话日志读取依赖宿主的 `sessionPersistence`；极新的、尚未落盘的会话可能暂时读不到回复原文，先发一条消息再收藏即可；
- 「收藏整段对话」把用户与助手的可见文字拼成一篇，跳过思考、工具调用与工具输出；
- 「存为便签」的 Markdown 是从渲染后的 DOM **重建**的：标题、列表、代码块、表格等结构会保留，但原文的标记写法（`*` 与 `_`、引用式链接、脚注、原始 HTML）会被归一化或退化；选区首尾的半块会补上所在标题 / 列表 / 引用 / 代码块的标记。要精确原文请用回复下方的收藏按钮；
- 便签内容本身不会随界面语言翻译——已存下的文件保持原样。
