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
async function loadClient(globals = {}) {
  const source = await readFile(join(here, '..', 'client.js'), 'utf8')
  let captured = null
  const sandbox = {
    window: { __ModuleLoader__: { load: (definition) => { captured = definition } } },
    console,
    ...globals,
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
  assert.equal(captured.id, 'dsh-jingjing-sticky-notes')
  assert.equal(typeof plugin.apply, 'function')
  // The array comes from another VM realm, so compare its contents, not identity.
  assert.deepEqual(Array.from(plugin.inject), ['slots', 'remote', 'locale', 'sessions', 'sidebarRightTabs', 'sidebarRight', 'uiSession'])
  assert.equal(typeof plugin.__internals.renderMarkdown, 'function')
  assert.equal(typeof plugin.__internals.selectionToMarkdown, 'function')
  assert.equal(typeof plugin.__internals.domToMarkdown, 'function')
  assert.equal(typeof plugin.__internals.titleOfText, 'function')
  assert.equal(typeof plugin.__internals.insertIntoComposer, 'function')
  assert.equal(typeof plugin.__internals.noteAddressOf, 'function')
  assert.equal(typeof plugin.__internals.noteIdOfAddress, 'function')
  assert.equal(typeof plugin.__internals.floatingNoteTabIds, 'function')
})

test('note tab addresses round-trip and reject foreign or malformed addresses', async () => {
  const { plugin } = await loadClient()
  const { noteAddressOf, noteIdOfAddress, floatingNoteTabIds } = plugin.__internals

  assert.equal(noteAddressOf('7f3a9c1d2e4b'), 'dsh-resource://sticky-note/7f3a9c1d2e4b')
  assert.equal(noteIdOfAddress(noteAddressOf('7f3a9c1d2e4b')), '7f3a9c1d2e4b')
  assert.equal(noteIdOfAddress('dsh-resource://sticky-note/'), null)
  assert.equal(noteIdOfAddress('dsh-resource://sticky-note/a/b'), null)
  assert.equal(noteIdOfAddress('dsh-resource://sticky-note/a%20b'), null)
  assert.equal(noteIdOfAddress('dsh-resource://file/a.md'), null)
  assert.equal(noteIdOfAddress('sidebar://sticky-notes'), null)
  assert.equal(noteIdOfAddress(null), null)

  // No DOM in this VM: the float enumeration must degrade to an empty list.
  assert.deepEqual(Array.from(floatingNoteTabIds()), [])
})

test('floating note enumeration only returns note viewers inside float hosts', async () => {
  const element = (attributes, floating) => ({
    closest: (selector) => {
      if (selector === '[data-dockkit-float], [data-dockkit-host="float"]') return floating ? {} : null
      if (selector === '[data-sidebar-right-session]') return { getAttribute: () => attributes.session }
      if (selector === '[data-dockkit-content]') return { getAttribute: () => attributes.tab }
      return null
    },
  })
  const views = [
    element({ session: 's1', tab: 'tab-float' }, true),
    element({ session: 's1', tab: 'tab-docked' }, false),
    element({ session: 's2', tab: 'tab-other-session' }, true),
  ]
  const documentStub = { querySelectorAll: (selector) => (selector === '[data-dsn-note-view]' ? views : []) }
  const { plugin } = await loadClient({ document: documentStub })

  assert.deepEqual(Array.from(plugin.__internals.floatingNoteTabIds('s1')), ['tab-float'])
  assert.deepEqual(Array.from(plugin.__internals.floatingNoteTabIds()), ['tab-float', 'tab-other-session'])
  assert.deepEqual(Array.from(plugin.__internals.floatingNoteTabIds('s3')), [])
})

test('openNoteTab targets the note address and asks for a float', async () => {
  const { plugin } = await loadClient()
  const calls = []
  const ctx = {
    get: (name) =>
      name === 'sidebarRight'
        ? { openResource: (address, options) => calls.push({ address, options }) }
        : undefined,
  }
  plugin.__internals.openNoteTab(ctx, 'abc123', true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].address, 'dsh-resource://sticky-note/abc123')
  assert.equal(calls[0].options.kind, 'sticky-note')
  assert.equal(calls[0].options.params.float, true)

  plugin.__internals.openNoteTab(ctx, 'abc123', false)
  assert.equal(calls[1].options.params, undefined)
})

test('closeAllNoteFloats closes only the floating note tabs of the given session', async () => {
  const element = (attributes, floating) => ({
    closest: (selector) => {
      if (selector === '[data-dockkit-float], [data-dockkit-host="float"]') return floating ? {} : null
      if (selector === '[data-sidebar-right-session]') return { getAttribute: () => attributes.session }
      if (selector === '[data-dockkit-content]') return { getAttribute: () => attributes.tab }
      return null
    },
  })
  const views = [
    element({ session: 's1', tab: 'tab-float' }, true),
    element({ session: 's1', tab: 'tab-docked' }, false),
    element({ session: 's2', tab: 'tab-other-session' }, true),
  ]
  const { plugin } = await loadClient({ document: { querySelectorAll: () => views } })
  const closed = []
  const ctx = {
    get: (name) => (name === 'sidebarRight' ? { close: (tabId) => closed.push(tabId) } : undefined),
  }

  assert.equal(plugin.__internals.closeAllNoteFloats(ctx, 's1'), 1)
  assert.deepEqual(closed, ['tab-float'])
  assert.equal(plugin.__internals.closeAllNoteFloats(ctx, null), 2)
  assert.deepEqual(closed, ['tab-float', 'tab-float', 'tab-other-session'])
})



test('apply registers the note resource tab, its body, and its live title', async () => {
  const styles = []
  const documentStub = {
    createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
    head: { appendChild: (tag) => styles.push(tag) },
  }
  const { plugin } = await loadClient({ document: documentStub })
  const definitions = []
  const bodies = []
  const titles = []
  const ctx = {
    effect: (register) => register(),
    locale: { register: () => {}, bind: () => (key) => key },
    slots: {
      inject: (_name, factory) => factory(),
      register: (config, component) => {
        if (config.name === 'sidebar.right.pane.tab') bodies.push({ config, component })
        else if (config.name === 'sidebar.right.pane.tab.title') titles.push({ config, component })
        return () => {}
      },
    },
    remote: { $mount: async () => {} },
    get: (name) => (name === 'remote.stickyNotes' ? {} : undefined),
    sidebarRightTabs: { register: (definition) => { definitions.push(definition); return () => {} } },
  }

  await plugin.apply(ctx)

  const noteType = definitions.find((definition) => definition.kind === 'sticky-note')
  assert.ok(noteType, 'note tab type was not registered')
  assert.equal(noteType.id, 'dsh-jingjing-sticky-notes/note')
  assert.equal(noteType.canOpen('dsh-resource://sticky-note/abc123'), true)
  assert.equal(noteType.canOpen('dsh-resource://file/abc123'), false)
  assert.equal(noteType.title('dsh-resource://sticky-note/abc123'), 'default.title')
  assert.ok(bodies.some((entry) => entry.config.key === 'dsh-jingjing-sticky-notes/note'))
  assert.ok(titles.some((entry) => entry.config.key === 'dsh-jingjing-sticky-notes/note'))
  assert.equal(styles.length, 1)
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

test('groupWorkspaceNotes groups by source chat and sinks archived groups last', async () => {
  const { plugin } = await loadClient()
  const group = plugin.__internals.groupWorkspaceNotes
  const notes = [
    { id: 'a', sessionId: 's1', updatedAt: 10, scope: 'session' },
    { id: 'b', sessionId: 's2', updatedAt: 30, scope: 'session' },
    { id: 'c', sessionId: 's1', updatedAt: 20, scope: 'session' },
    { id: 'd', sessionId: 's2', updatedAt: 40, scope: 'session' },
    { id: 'e', sessionId: null, updatedAt: 5, scope: 'session' },
  ]
  const groups = group(notes, ['s2'])
  // Active groups by newest note, then the archived one, then the unfiled one.
  assert.deepEqual(Array.from(groups, (entry) => entry.sessionId), ['s1', null, 's2'])
  assert.deepEqual(Array.from(groups[0].notes, (note) => note.id), ['a', 'c'])
  assert.deepEqual(Array.from(groups[2].notes, (note) => note.id), ['b', 'd'])
  assert.equal(groups[2].archived, true)
  assert.equal(groups[0].archived, false)

  // Without archive data every group stays active and sorts by newest note.
  const plain = group(notes, null)
  assert.deepEqual(Array.from(plain, (entry) => entry.sessionId), ['s2', 's1', null])
})

test('archivedNoteCount only counts workspace notes from archived chats', async () => {
  const { plugin } = await loadClient()
  const count = plugin.__internals.archivedNoteCount
  const notes = [
    { id: 'a', scope: 'session', sessionId: 's1' },
    { id: 'b', scope: 'session', sessionId: 's2' },
    { id: 'c', scope: 'global', sessionId: 's2' },
    { id: 'd', scope: 'session', sessionId: null },
  ]
  assert.equal(count(notes, ['s2']), 1)
  assert.equal(count(notes, []), 0)
  assert.equal(count(notes, null), 0)
})

test('sessionDisplayTitle reads the catalog display title', async () => {
  const { plugin } = await loadClient()
  const title = plugin.__internals.sessionDisplayTitle
  const catalog = { byId: { s1: { displayTitle: '会话标题' }, s2: { displayTitle: '' } } }
  assert.equal(title(catalog, 's1'), '会话标题')
  assert.equal(title(catalog, 's2'), null)
  assert.equal(title(catalog, 'missing'), null)
  assert.equal(title(null, 's1'), null)
  assert.equal(title(catalog, null), null)
})

test('renderMarkdown renders inline and display LaTeX through KaTeX', async () => {
  const { plugin } = await loadClient()
  const { renderMarkdown } = plugin.__internals

  const inline = renderMarkdown('质能方程 $E=mc^2$，以及 \\( \\pi r^2 \\)。')
  assert.match(inline, /class="katex"/)
  assert.doesNotMatch(inline, /\$E=mc\^2\$/)

  const display = renderMarkdown('推导：\n\n$$\n\\int_{0}^{1} x^{2}\\,dx = \\frac{1}{3}\n$$')
  assert.match(display, /dsn-math-block/)
  assert.match(display, /katex-display/)

  // 代码里的美元符号是字面量，不该被当成公式
  const code = renderMarkdown('用 `$x$` 表示变量。')
  assert.doesNotMatch(code, /class="katex"/)
  assert.match(code, /<code>\$x\$<\/code>/)
})

test('renderMarkdown keeps money and bare dollar signs literal', async () => {
  const { plugin } = await loadClient()
  const { renderMarkdown } = plugin.__internals

  for (const source of ['价格 $5 和 $6 不算公式。', '区间是 $5-$10。', '从 $3 到 $20 都是。']) {
    assert.doesNotMatch(renderMarkdown(source), /class="katex"/, source)
  }
})

test('renderMarkdown keeps an unclosed display fence from swallowing the rest', async () => {
  const { plugin } = await loadClient()
  const { renderMarkdown } = plugin.__internals

  const html = renderMarkdown('$$\n没闭合的公式\n\n# 后面的标题\n\n正文段落')
  assert.match(html, /<h1>后面的标题<\/h1>/)
  assert.match(html, /正文段落/)
  assert.doesNotMatch(html, /dsn-math-block/)
})

test('renderMarkdown breaks a display formula out of the paragraph around it', async () => {
  const { plugin } = await loadClient()
  const { renderMarkdown } = plugin.__internals

  const html = renderMarkdown('前文$$x^2$$后文')
  assert.match(html, /<p>前文<\/p>/)
  assert.match(html, /<div class="dsn-math-block">/)
  assert.match(html, /<p>后文<\/p>/)
})

test('renderMarkdown refuses to typeset an oversized formula', async () => {
  const { plugin } = await loadClient()
  const { renderMarkdown } = plugin.__internals

  const huge = 'x+'.repeat(1500)
  const html = renderMarkdown('$$' + huge + '$$')
  assert.match(html, /dsn-math-error/)
  assert.doesNotMatch(html, /class="katex"/)
})
