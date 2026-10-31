<p align="center">
  <img src="https://raw.githubusercontent.com/tryqylz/dsh-jingjing-sticky-notes/main/icon.svg" width="88" height="88" alt="鲸鲸便签图标">
</p>

<h1 align="center">鲸鲸便签 · Jingjing Sticky Notes</h1>

<p align="center">
  <b>把对话里重要的内容固定成 Markdown，随用随取。</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-jingjing-sticky-notes"><img src="https://img.shields.io/npm/v/dsh-jingjing-sticky-notes.svg" alt="npm version"></a>
  <a href="https://github.com/tryqylz/dsh-jingjing-sticky-notes"><img src="https://img.shields.io/github/stars/tryqylz/dsh-jingjing-sticky-notes?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/tryqylz/dsh-jingjing-sticky-notes/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/DSH-0.2.x-4D6BFE.svg" alt="DeepSeek Harness 0.2.x"></a>
</p>

<p align="center">
  <a href="https://github.com/tryqylz/dsh-jingjing-sticky-notes">GitHub</a> ·
  <a href="https://www.npmjs.com/package/dsh-jingjing-sticky-notes">npm</a> ·
  <a href="https://github.com/tryqylz/dsh-jingjing-sticky-notes/issues">问题反馈</a> ·
  <a href="https://github.com/tryqylz/dsh-jingjing-sticky-notes/blob/main/README.en.md">English</a> · 简体中文
</p>

> **代码来源**：本插件代码基本全部由 `deepseek-flash-v4.1-1017`（鲸鲸）编写。

---

把 DeepSeek Harness 对话里重要的回复、任意选区，甚至整段对话，收藏成本地 Markdown 便签。
便签常驻右侧栏，可以随时打开、对比、改标题；也能把每条便签浮成可拖动、缩放的应用内小窗，同时对照多份内容，需要时再整段或按选区插回输入框。

长对话里反复往上翻表格、问题清单、结论时，这个面板就是你的「随手贴」。

## 安装

要求 DeepSeek Harness 0.2.x（桌面端 / Web 端，开发环境 `0.2.1-rc.2`），无额外运行时依赖。

```sh
# 桌面端
dsh plugin --profile desktop add dsh-jingjing-sticky-notes

# Web 端（dsh web）
dsh plugin --profile web add dsh-jingjing-sticky-notes
```

也可以在应用内「插件 → 添加插件」输入包名 `dsh-jingjing-sticky-notes` 安装。

也可以从 GitHub 安装同一份代码（例如想跟仓库最新提交，或 npm 暂时不可用时）：

```sh
dsh plugin --profile desktop add "git+https://github.com/tryqylz/dsh-jingjing-sticky-notes.git#main"
```

本地源码开发、存储布局、配置项等细节见 [技术细节](https://github.com/tryqylz/dsh-jingjing-sticky-notes/blob/main/docs/technical.md)。

## 界面预览

![动图演示：存为便签、侧边栏查看、浮窗对照、插回会话](https://raw.githubusercontent.com/tryqylz/dsh-jingjing-sticky-notes/main/docs/images/demo.gif)

*动图演示：存为便签 → 侧边栏查看 → 浮窗对照 → 插回会话。*

### 便签列表与对话同屏

![聊天对话页面与右侧栏中的便签列表](https://raw.githubusercontent.com/tryqylz/dsh-jingjing-sticky-notes/main/docs/images/notes-panel.png)

*左侧对话、右侧便签列表：工作区 / 会话 / 全局三个视图，卡片上可直接完成收藏、浮窗、插入、切换可见性和删除。*

### 便签详情

![便签详情与插回会话操作条](https://raw.githubusercontent.com/tryqylz/dsh-jingjing-sticky-notes/main/docs/images/note-detail.png)

*详情页可编辑标题与正文；顶部操作条支持插入全文、插入选中、以文件插入、复制、设为全局和移到回收站。*

### 双浮窗对照

![两个便签浮窗悬浮在对话上方](https://raw.githubusercontent.com/tryqylz/dsh-jingjing-sticky-notes/main/docs/images/floating-notes.png)

*同时打开多个浮窗对照长内容；浮窗可拖动、缩放，也能停靠回右侧栏。*

## 功能

### 收藏
- **收藏整条回复**：每条助手回复下方的便签图标，Host 直接从会话日志取原文，不靠 DOM 截取，Markdown 原样保留；
- **收藏选中片段**：选中对话文字后浮出的「存为便签」，只保存选中的那一段；对话区内的选区会按渲染后的 DOM 重建 Markdown（标题、列表、任务勾选、代码块、表格、引用、链接与行内格式），需要 100% 原文时请收藏整条回复；
- **收藏整段对话**：便签页工具栏一键把当前会话的用户 / 助手文字整理成一篇摘录。

### 便签页（右侧栏）
- 三个视图：**工作区**（默认，按来源会话分组显示整个工作区收集的便签）、**会话**（只看当前会话）、**全局**（跨会话、跨工作区）；支持搜索和数量显示；
- 工作区视图里，来源会话已归档的分组沉到底部并标上「已归档」；列表上方出现汇总条，可把这些便签一键移入回收站；
- 每条便签是一张胶囊卡片：左侧是标题 + 一行摘要 + 时间，右侧是 3×2 操作区，两者之间用一条竖向虚线分隔；
- **列表内直接操作**：收藏、浮窗打开、插入会话、切换可见性、移到回收站（需两次点击确认，3 秒自动复位），不用点开详情；
- **收藏置顶**：收藏的便签在同一分组内排最前，其余按修改时间倒序；分组之间按最近修改排序，已归档分组排最后；
- 列表底部有「回收站」入口。

### 详情页
- 操作条在顶部：插入全文、插入选中、以文件插入、复制、设为全局/工作区、移到回收站；
- 可编辑标题与正文（带 Markdown 预览、可见性切换）；
- 标题栏的「浮窗打开」按钮可以把这条便签变成独立浮窗；
- 支持深色 / 浅色主题，跟随 DSH 界面。

### 公式（新增）
- 便签正文里的标准 LaTeX 会排版成公式：行内 `$…$`、`\(…\)`，块级 `$$…$$`、`\[…\]`，支持矩阵、分段函数、`aligned` 等环境；
- 代码块和行内代码里的 `$` 保持字面量；`$5-$10`、`价格 $5 和 $6` 这类金额不会被误判成公式；
- 未闭合的 `$$` 只按普通文字处理它自己那一行，不会把后面的正文一起吞掉；紧贴文字的 `$$…$$` 会独占一块；单条公式源码超过 2000 字符时按原文显示，避免长公式拖住面板；
- KaTeX 运行时（`katex.min.js`）内联在 `client.js` 里，排版样式和字体直接用宿主页面已全局加载的那一套（两者同版本），断网、切换深浅色主题都能正常排版；
- 代价是 `client.js` 增大约 270 KB（约 140 KB → 410 KB）；插件仍然零运行时依赖，第三方许可见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

### 浮窗（新增）
- 列表卡片或详情页的「浮窗打开」按钮，会把便签作为独立标签页打开，并浮在对话窗口上方；也可以直接把便签标签页拖出右侧栏得到浮窗；
- 浮窗可拖动标题栏移动、拖右下角缩放，右上角的停靠按钮可放回右侧栏，关闭按钮移除该浮窗；位置和尺寸由 DSH 按会话保存，刷新/重启后恢复；
- 可以同时打开多条便签浮窗，用来对照长内容；浮窗内**只读**，仍支持复制、插入全文和插入选中，编辑请回详情页；
- 便签页工具栏新增「关闭全部浮窗」按钮：一次关掉当前会话的所有便签浮窗，专门用于浮窗被拖出可视区后找不回来的情况；
- 浮窗只在当前会话显示；切换会话或打开设置等全局页面时会隐藏，切回来恢复。

### 回收站
- 删除便签先进入回收站：工作区便签进对应工作区的 `.trash/`，全局便签进全局目录的 `.trash/`；可以逐条恢复；
- 「清空」会永久删除回收站里的便签，确认框会明确提示不可找回——这是便签唯一不可逆的操作。

### 插回会话
- **插入全文**：把 `## 标题` + 正文追加到输入框；
- **插入选中**：只追加详情里选中的片段；
- **以文件插入**：追加便签文件的绝对路径，让模型按文件读取。

### 其它
- 每条便签就是一个本地 `.md` 文件（带 frontmatter），可以直接用编辑器改、用 Git 管；
- Markdown 渲染：标题、列表、任务勾选、表格、代码块、引用、链接、粗斜体；内容先转义再渲染，链接只允许 `http(s)://`、`mailto:`、`#`、`/` 开头；
- **多语言**：界面文案跟随 DSH 的「设置 → 通用 → 语言」在中文 / 英文间实时切换，无需刷新；错误提示与「收藏整段对话」生成的内容也按当前语言生成；
- **键盘与无障碍**：Tab 聚焦、`aria-label` / `aria-pressed`、可见焦点环、遵循 `prefers-reduced-motion`。

## 使用

1. 打开便签页：点会话标题右侧的便签图标，或右侧栏的「便签」标签；
2. 收藏内容：回复下方图标 / 选中文字后的浮钮 / 工具栏「收藏整段对话」；
3. 在列表里直接操作，或点开卡片查看完整 Markdown；工作区视图按来源会话分组，已归档会话的分组带「已归档」标记；
4. 需要参考时用「插入全文 / 插入选中 / 以文件插入」放回输入框；
5. 想同时看多条便签，点卡片上的「浮窗打开」；浮窗可拖动、缩放、停靠回侧栏；
6. 浮窗被拖到看不见的位置时，回便签页点工具栏的「关闭全部浮窗」；
7. 删除的便签在列表底部的「回收站」里，可逐条恢复，或确认后永久清空。

## 更多文档

- [技术细节](https://github.com/tryqylz/dsh-jingjing-sticky-notes/blob/main/docs/technical.md)：存储布局、文件格式、配置项、开发方式、兼容性与已知边界

## 反馈

- 遇到问题或有功能建议：<https://github.com/tryqylz/dsh-jingjing-sticky-notes/issues>
- 如果这个插件对你有帮助，欢迎点个 Star ⭐

## 许可证

[MIT](https://github.com/tryqylz/dsh-jingjing-sticky-notes/blob/main/LICENSE) © 2026 tryqylz

可以自由使用、修改、商用与再分发，保留版权声明与许可证文本即可。
