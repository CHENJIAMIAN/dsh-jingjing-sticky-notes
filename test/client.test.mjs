// Browser-half smoke tests: evaluate client.js with a stub module loader and
// exercise the pure helpers it exports under __internals.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))

/** Load the module in a VM and return the contribution it registers. */
async function loadClient() {
  const source = await readFile(join(here, '..', 'client.js'), 'utf8')
  let captured = null
  const sandbox = {
    window: { __ModuleLoader__: { load: (definition) => { captured = definition } } },
    console,
  }
  vm.runInNewContext(source, sandbox, { filename: 'client.js' })
  assert.ok(captured !== null, 'client.js did not call window.__ModuleLoader__.load')
  const React = {
    createElement: () => null,
    useState: () => [null, () => {}],
    useEffect: () => {},
    useMemo: (factory) => factory(),
    useRef: () => ({ current: null }),
    useCallback: (callback) => callback,
    useSyncExternalStore: () => null,
  }
  const plugin = captured.factory((name) => {
    assert.equal(name, 'react')
    return React
  })
  return { captured, plugin }
}

/** Minimal DOM node for the DOM→Markdown converter tests. */
function textNode(value) {
  return { nodeType: 3, nodeValue: value }
}

/** Minimal element node; children get a parentElement so ancestor context works. */
function element(tag, attributes = {}, ...children) {
  const node = {
    nodeType: 1,
    nodeName: tag.toUpperCase(),
    childNodes: children,
    children: children.filter((child) => child.nodeType === 1),
    getAttribute: (name) => (attributes[name] === undefined || attributes[name] === false ? null : String(attributes[name])),
  }
  if (attributes.checked !== undefined) node.checked = attributes.checked
  for (const child of children) child.parentElement = node
  return node
}

/** Clipper that accepts every node; text is taken verbatim. */
const FULL_CLIP = {
  contains: () => true,
  textOf: (node) => (node.nodeType === 3 ? String(node.nodeValue ?? '') : ''),
}

/** Run the converter against a fake DOM tree. */
function markdownOf(plugin, root, clipper = FULL_CLIP) {
  return plugin.__internals.domToMarkdown(root, clipper)
}

test('client contribution exposes its seats and debug internals', async () => {
  const { captured, plugin } = await loadClient()
  assert.equal(captured.id, 'dsh-sticky-notes')
  assert.equal(typeof plugin.apply, 'function')
  // The array comes from another VM realm, so compare its contents, not identity.
  assert.deepEqual(Array.from(plugin.inject), ['slots', 'remote', 'locale', 'sessions', 'sidebarRightTabs', 'sidebarRight', 'uiSession'])
  assert.equal(typeof plugin.__internals.renderMarkdown, 'function')
  assert.equal(typeof plugin.__internals.selectionToMarkdown, 'function')
  assert.equal(typeof plugin.__internals.domToMarkdown, 'function')
  assert.equal(typeof plugin.__internals.titleOfText, 'function')
  assert.equal(typeof plugin.__internals.insertIntoComposer, 'function')
})

test('renderMarkdown covers the shapes the panel relies on', async () => {
  const { plugin } = await loadClient()
  const render = plugin.__internals.renderMarkdown

  const html = render('# 标题\n\n**粗体** 和 `code`\n\n- [x] 完成\n- 待办\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n```js\nconst a = 1\n```\n')
  assert.match(html, /<h1>标题<\/h1>/)
  assert.match(html, /<strong>粗体<\/strong>/)
  assert.match(html, /<code>code<\/code>/)
  assert.match(html, /<span class="dsn-task">☑<\/span>/)
  assert.match(html, /<table>/)
  assert.match(html, /<pre><code data-lang="js">const a = 1<\/code><\/pre>/)

  // Raw HTML in note bodies stays escaped, and unsafe links stay inert.
  assert.match(render('<script>alert(1)</script>'), /&lt;script&gt;/)
  assert.doesNotMatch(render('<script>alert(1)</script>'), /<script>/)
  assert.match(render('[bad](javascript:alert(1))'), /\[bad\]\(javascript:alert\(1\)\)/)
  assert.match(render('[ok](https://example.com)'), /<a href="https:\/\/example\.com"/)
})

test('domToMarkdown rebuilds headings, emphasis, code and links from rendered HTML', async () => {
  const { plugin } = await loadClient()
  const doc = element(
    'div',
    {},
    element('h2', {}, textNode('问题列表')),
    element(
      'p',
      {},
      textNode('结论是 '),
      element('strong', {}, textNode('先重启')),
      textNode('，然后执行 '),
      element('code', {}, textNode('pnpm test')),
      textNode('。'),
    ),
    element('p', {}, element('a', { href: 'https://example.com/doc' }, textNode('文档'))),
  )
  assert.equal(markdownOf(plugin, doc), '## 问题列表\n\n结论是 **先重启**，然后执行 `pnpm test`。\n\n[文档](https://example.com/doc)')
})

test('domToMarkdown keeps task lists and ordered numbering', async () => {
  const { plugin } = await loadClient()
  const doc = element(
    'div',
    {},
    element(
      'ul',
      {},
      element('li', {}, element('input', { type: 'checkbox', checked: true }), textNode('完成项')),
      element('li', {}, element('input', { type: 'checkbox', checked: false }), textNode('待办项')),
    ),
    element('ol', { start: 3 }, element('li', {}, textNode('第三')), element('li', {}, textNode('第四'))),
  )
  assert.equal(markdownOf(plugin, doc), '- [x] 完成项\n- [ ] 待办项\n\n3. 第三\n4. 第四')
})

test('domToMarkdown keeps tables and code fences', async () => {
  const { plugin } = await loadClient()
  const table = element(
    'div',
    { class: 'md-table-wide' },
    element(
      'table',
      {},
      element('thead', {}, element('tr', {}, element('th', {}, textNode('名称')), element('th', {}, textNode('数量')))),
      element('tbody', {}, element('tr', {}, element('td', {}, textNode('苹果')), element('td', {}, textNode('2')))),
    ),
  )
  assert.equal(markdownOf(plugin, table), '| 名称 | 数量 |\n| --- | --- |\n| 苹果 | 2 |')

  const code = element(
    'div',
    { class: 'md-code-block' },
    element(
      'div',
      { 'data-code-block-banner': '' },
      element('div', { class: '_infostring_abc_1' }, textNode('js')),
      element('button', {}, textNode('复制')),
    ),
    element('div', { 'data-code-block-content': '' }, element('pre', { class: 'shiki' }, element('code', {}, textNode('const a = 1\n')))),
  )
  assert.equal(markdownOf(plugin, code), '```js\nconst a = 1\n```')
})

test('domToMarkdown keeps block quote bodies and drops message chrome', async () => {
  const { plugin } = await loadClient()
  const quote = element('blockquote', {}, element('p', {}, textNode('引用')), element('p', {}, textNode('第二段')))
  assert.equal(markdownOf(plugin, quote), '> 引用\n>\n> 第二段')

  const chrome = element(
    'div',
    {},
    element('p', {}, textNode('正文')),
    element('div', { 'data-turn-tail': 4 }, textNode('14:20')),
    element('button', {}, textNode('复制')),
  )
  assert.equal(markdownOf(plugin, chrome), '正文')
})

test('domToMarkdown clips a partial selection and keeps ancestor context', async () => {
  const { plugin } = await loadClient()
  const paragraph = element('p', {}, textNode('你好世界'))
  const clipped = {
    contains: () => true,
    textOf: (node) => (node.nodeType === 3 ? String(node.nodeValue).slice(2, 4) : ''),
  }
  assert.equal(markdownOf(plugin, paragraph, clipped), '世界')

  const quoted = element('p', {}, textNode('引用段落'))
  element('blockquote', {}, quoted)
  assert.equal(markdownOf(plugin, quoted), '> 引用段落')

  const second = element('li', {}, textNode('第二项'))
  element('ol', { start: 2 }, element('li', {}, textNode('第一项')), second)
  assert.equal(markdownOf(plugin, second), '3. 第二项')
})

test('domToMarkdown clips code blocks to the selected lines', async () => {
  const { plugin } = await loadClient()
  const dropped = textNode('a = 1\n')
  const kept = textNode('b = 2\n')
  const pre = element('pre', {}, element('code', {}, dropped, kept))
  const clipper = {
    contains: (node) => node !== dropped,
    textOf: (node) => (node.nodeType === 3 ? String(node.nodeValue) : ''),
  }
  assert.equal(markdownOf(plugin, pre, clipper), '```\nb = 2\n```')
})

test('selectionToMarkdown only rebuilds selections inside the chat transcript', async () => {
  const { plugin } = await loadClient()
  const root = element('div', {}, element('p', {}, textNode('正文')))
  const range = {
    commonAncestorContainer: root,
    startContainer: root,
    startOffset: 0,
    endContainer: root,
    endOffset: 0,
    intersectsNode: () => true,
  }
  root.closest = () => null
  assert.equal(plugin.__internals.selectionToMarkdown(range), '')
  root.closest = () => ({})
  assert.equal(plugin.__internals.selectionToMarkdown(range), '正文')
})

test('titleOfText strips markdown markers and bounds the title', async () => {
  const { plugin } = await loadClient()
  const titleOf = plugin.__internals.titleOfText
  assert.equal(titleOf('## 一、问题列表\n正文'), '一、问题列表')
  assert.equal(titleOf('- 只有列表项'), '只有列表项')
  assert.equal(titleOf(''), '便签')
  assert.equal(titleOf('', 'Note'), 'Note')
  assert.equal(titleOf(`${'x'.repeat(200)}`).length, 80)
})

test('failureText prefers the localized code over the Host message', async () => {
  const { plugin } = await loadClient()
  const failureText = plugin.__internals.failureText
  const t = (key) => (key === 'error.code.not-found' ? 'This note no longer exists' : key)
  assert.equal(failureText({ ok: false, error: { code: 'not-found', message: '便签已不存在' } }, t), 'This note no longer exists')
  // Unknown codes fall back to the Host message, then to the generic key.
  assert.equal(failureText({ ok: false, error: { code: 'future-code', message: 'raw detail' } }, t), 'raw detail')
  assert.equal(failureText({ ok: false }, t), 'error.generic')
})

test('client dictionaries stay balanced across zh and en', async () => {
  const source = await readFile(join(here, '..', 'client.js'), 'utf8')
  const keys = (name) => {
    const start = source.indexOf(`const ${name} = {`)
    assert.ok(start >= 0, `${name} dictionary not found`)
    const end = source.indexOf('\n    }', start)
    return [...source.slice(start, end).matchAll(/^\s{6}'([^']+)':/gm)].map((match) => match[1])
  }
  const zh = keys('zh')
  const en = keys('en')
  assert.ok(zh.length > 50, 'unexpectedly small dictionary')
  assert.deepEqual(
    zh.filter((key) => !en.includes(key)),
    [],
    'keys missing in en',
  )
  assert.deepEqual(
    en.filter((key) => !zh.includes(key)),
    [],
    'keys missing in zh',
  )
})
