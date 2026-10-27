# 第三方组件声明

`client.js` 内联打包了以下第三方组件；它们不随 `package.json` 出现在运行时依赖里，而是直接编进浏览器端文件。

## KaTeX 0.16.47

- 项目主页：<https://katex.org/>
- 源码仓库：<https://github.com/KaTeX/KaTeX>
- 用途：把便签里的标准 LaTeX（`$…$`、`$$…$$`、`\(…\)`、`\[…\]`）渲染成 HTML。
- 打包内容：`dist/katex.min.js`、`dist/katex.min.css`，以及 `dist/fonts/` 下 20 个 `.woff2` 字体（以 base64 data URI 形式内嵌，保证断网可用）。
- 体积：约 640 KB（未压缩），使 `client.js` 从约 140 KB 增至约 780 KB。

许可证：MIT

```text
The MIT License (MIT)

Copyright (c) 2013-2020 Khan Academy and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

KaTeX 随附的 Computer Modern 系字体来自 Donald Knuth 的 TeX 项目，按 SIL Open Font License 1.1 授权；字体文件名沿用 KaTeX 的 `KaTeX_*.woff2` 命名。
