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

test('client contribution exposes its seats and debug internals', async () => {
  const { captured, plugin } = await loadClient()
  assert.equal(captured.id, 'dsh-sticky-notes')
  assert.equal(typeof plugin.apply, 'function')
  // The array comes from another VM realm, so compare its contents, not identity.
  assert.deepEqual(Array.from(plugin.inject), ['slots', 'remote', 'locale', 'sessions', 'sidebarRightTabs', 'sidebarRight', 'uiSession'])
  assert.equal(typeof plugin.__internals.renderMarkdown, 'function')
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

test('titleOfText strips markdown markers and bounds the title', async () => {
  const { plugin } = await loadClient()
  const titleOf = plugin.__internals.titleOfText
  assert.equal(titleOf('## 一、问题列表\n正文'), '一、问题列表')
  assert.equal(titleOf('- 只有列表项'), '只有列表项')
  assert.equal(titleOf(''), '便签')
  assert.equal(titleOf(`${'x'.repeat(200)}`).length, 80)
})
