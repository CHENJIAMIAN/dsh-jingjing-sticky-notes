// dsh-sticky-notes — browser half.
//
// A right-Sidebar tab that lists the notes of the current Session beside every
// global one, a per-reply capture action, a header shortcut, and a floating
// "save selection" button. Notes are Markdown files owned by the Host half;
// this module only renders and edits them.
//
// Plain JavaScript on purpose: the file is served to the page as-is, so there
// is no build step to keep in sync with the Host half.
window.__ModuleLoader__.load({
  id: 'dsh-sticky-notes',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const useState = React.useState
    const useEffect = React.useEffect
    const useMemo = React.useMemo
    const useRef = React.useRef
    const useCallback = React.useCallback

    const NS = 'stickyNotes'
    const PACKAGE = 'dsh-sticky-notes'
    const TAB_ID = 'dsh-sticky-notes'
    const TAB_KIND = 'sticky-notes'

    // ── Remote contribution ────────────────────────────────────────────────
    //
    // The Host manifest validates both directions strictly. The browser copy
    // only has to satisfy the mount contract: the client checks codec modes and
    // decodes results only when a `decode` is supplied, so an identity schema
    // keeps this no-build module free of a Zod copy.

    const identity = () => ({ parse: (value) => value })
    const codec = (symbol) => ({
      mode: 'strict',
      typeSymbol: `${PACKAGE}#${symbol}`,
      create: identity,
    })
    const request = (symbol) => ({
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: codec(symbol),
    })

    const ENDPOINTS = [
      ['list', 'ListRequest', 'ListResult'],
      ['read', 'ReadRequest', 'NoteResult'],
      ['create', 'CreateRequest', 'NoteResult'],
      ['update', 'UpdateRequest', 'NoteResult'],
      ['removeNote', 'RemoveRequest', 'RemoveResult'],
      ['setFavorite', 'SetFavoriteRequest', 'NoteResult'],
      ['setScope', 'SetScopeRequest', 'NoteResult'],
      ['captureMessage', 'CaptureMessageRequest', 'NoteResult'],
      ['captureSession', 'CaptureSessionRequest', 'NoteResult'],
    ]

    const TYPERT_REMOTE = {
      package: PACKAGE,
      descriptors: ENDPOINTS.map(([method, requestSymbol, resultSymbol]) => ({
        id: `${PACKAGE}#stickyNotes/${method}`,
        service: 'stickyNotes',
        namespace: 'stickyNotes',
        method,
        invocation: { kind: 'direct' },
        parameters: [request(`StickyNotes${requestSymbol}`)],
        result: codec(`StickyNotes${resultSymbol}`),
        sourceLocation: { file: 'client.js', line: 1, column: 1 },
      })),
    }

    // ── styles ─────────────────────────────────────────────────────────────
    // Theme tokens only; the sticky-note accent is the brand token.

    const CSS = `
.dsn-pane{height:100%;min-height:0;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);font-size:13px;font-family:inherit}
.dsn-bar{display:flex;align-items:center;gap:4px;padding:8px 8px 8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.dsn-seg{appearance:none;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;padding:4px 10px;border-radius:8px;cursor:pointer;white-space:nowrap;transition:background 150ms ease,color 150ms ease,border-color 150ms ease}
.dsn-seg:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dsn-seg[data-active]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);font-weight:600}
.dsn-seg:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsn-count{font-size:11px;color:var(--dsw-alias-label-secondary);margin-left:4px;font-variant-numeric:tabular-nums}
.dsn-spacer{flex:1}
.dsn-iconbtn{appearance:none;border:none;background:transparent;color:var(--dsw-alias-label-secondary);width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none;padding:0;transition:background 150ms ease,color 150ms ease}
.dsn-iconbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dsn-iconbtn:disabled{opacity:.45;cursor:default}
.dsn-iconbtn[data-active]{color:var(--dsw-alias-brand-primary)}
.dsn-iconbtn[data-danger]{color:var(--dsw-alias-state-error-primary)}
.dsn-iconbtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsn-search{display:flex;gap:6px;align-items:center;padding:6px 10px;flex:none}
.dsn-search input{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;border-radius:8px;padding:6px 9px;transition:border-color 150ms ease}
.dsn-search input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-1px;border-color:transparent}
.dsn-scroll{flex:1;min-height:0;overflow-y:auto;padding:8px 8px 28px;scrollbar-gutter:stable}
.dsn-row{position:relative;display:flex;align-items:stretch;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;margin:0 0 8px;box-shadow:0 1px 2px rgba(0,0,0,.05);transition:border-color 150ms ease,box-shadow 150ms ease,opacity 150ms ease}
.dsn-row:hover{border-color:var(--dsw-alias-border-l2);box-shadow:0 3px 10px rgba(0,0,0,.10)}
.dsn-row:focus-within{border-color:var(--dsw-alias-border-l2)}
.dsn-row[data-favorite]::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--dsw-alias-brand-primary);border-radius:12px 0 0 12px;pointer-events:none;z-index:1}
.dsn-row[data-busy]{opacity:.75}
/* Left content column; no internal rules — only the dashed split to the rail. */
.dsn-row-open{appearance:none;flex:1;min-width:0;display:flex;flex-direction:column;text-align:left;background:transparent;border:none;color:inherit;font:inherit;padding:0;border-radius:12px 0 0 12px;cursor:pointer}
.dsn-row-open:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dsn-row-head{display:block;padding:10px 12px 2px}
.dsn-title{display:block;font-size:13px;font-weight:600;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsn-snippet{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.45;margin-top:2px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.dsn-row-meta{display:flex;align-items:center;gap:6px;padding:2px 12px 10px;font-size:11px;color:var(--dsw-alias-label-secondary);min-width:0;overflow:hidden}
.dsn-chip{font-size:10.5px;line-height:16px;padding:0 6px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap;flex:none}
.dsn-chip[data-global]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.dsn-time{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Right action rail: a 2x2 grid, separated from the text by one dashed rule. */
.dsn-row-rail{display:grid;grid-template-columns:repeat(2,34px);grid-template-rows:repeat(2,1fr);flex:none;align-self:stretch;border-left:1px dashed var(--dsw-alias-border-l2);border-radius:0 11px 11px 0;overflow:hidden}
.dsn-row-rail .dsn-iconbtn{width:100%;height:100%;min-height:0;border-radius:0;border:none}
.dsn-row-rail .dsn-iconbtn:hover{background:var(--dsw-alias-bg-layer-2)}
.dsn-row-rail .dsn-iconbtn:focus-visible{outline-offset:-2px}
.dsn-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:44px 18px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.8}
.dsn-empty-icon{opacity:.6}
.dsn-empty-text{white-space:pre-line;margin:0}
.dsn-empty-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:2px}
.dsn-error{margin:6px 10px;padding:7px 9px;border-radius:8px;font-size:12px;line-height:1.6;color:var(--dsw-alias-state-error-primary);border:1px solid var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-1)}
.dsn-status{font-size:11px;line-height:18px;padding:0 12px 6px;color:var(--dsw-alias-label-secondary)}
.dsn-status[data-success]{color:var(--dsw-alias-state-success-primary)}
.dsn-status[data-error]{color:var(--dsw-alias-state-error-primary)}
.dsn-detail{flex:1;min-height:0;display:flex;flex-direction:column}
.dsn-detail-head{display:flex;align-items:center;gap:2px;padding:8px;min-height:52px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.dsn-detail-head .dsn-iconbtn{width:36px;height:36px;border-radius:10px}
.dsn-detail-title{flex:1;min-width:0;font-size:15px;font-weight:600;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 6px}
.dsn-detail-body{flex:1;min-height:0;overflow-y:auto;padding:10px 12px 20px;user-select:text}
.dsn-detail-meta{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.6;margin-bottom:8px;word-break:break-all}
.dsn-actions{flex:none;display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.dsn-btn{appearance:none;font:inherit;font-size:13px;line-height:24px;min-height:32px;padding:3px 12px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;transition:background 150ms ease,border-color 150ms ease,color 150ms ease}
.dsn-btn:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.dsn-btn:disabled{opacity:.45;cursor:default}
.dsn-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsn-btn[data-primary]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);font-weight:600}
.dsn-btn[data-primary]:hover{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.dsn-btn[data-danger]{color:var(--dsw-alias-state-error-primary)}
.dsn-btn[data-danger]:hover{border-color:var(--dsw-alias-state-error-primary)}
.dsn-btn[data-active]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.dsn-detail-status{font-size:11px;line-height:20px;padding:0 12px 6px;color:var(--dsw-alias-label-secondary)}
.dsn-detail-status[data-success]{color:var(--dsw-alias-state-success-primary)}
.dsn-detail-status[data-error]{color:var(--dsw-alias-state-error-primary)}
.dsn-editor{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:10px}
.dsn-editor input,.dsn-editor textarea{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:7px 9px;width:100%;box-sizing:border-box}
.dsn-editor input:focus-visible,.dsn-editor textarea:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-1px;border-color:transparent}
.dsn-editor textarea{flex:1;min-height:140px;resize:none;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.65}
.dsn-editor-row{display:flex;gap:6px;align-items:center}
.dsn-preview{flex:1;min-height:0;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 10px;background:var(--dsw-alias-bg-layer-1)}
.dsn-md{font-size:13px;line-height:1.75;word-break:break-word}
.dsn-md>*:first-child{margin-top:0}
.dsn-md h1,.dsn-md h2,.dsn-md h3,.dsn-md h4,.dsn-md h5,.dsn-md h6{margin:14px 0 6px;line-height:1.4;font-weight:600}
.dsn-md h1{font-size:17px}.dsn-md h2{font-size:16px}.dsn-md h3{font-size:14.5px}.dsn-md h4,.dsn-md h5,.dsn-md h6{font-size:13px}
.dsn-md p{margin:6px 0}
.dsn-md ul,.dsn-md ol{margin:6px 0;padding-left:20px}
.dsn-md li{margin:2px 0}
.dsn-md code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;background:var(--dsw-alias-bg-layer-2);border-radius:4px;padding:1px 4px}
.dsn-md pre{margin:8px 0;padding:9px 10px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow-x:auto}
.dsn-md pre code{background:transparent;padding:0;font-size:12px;line-height:1.6;white-space:pre}
.dsn-md blockquote{margin:8px 0;padding:4px 10px;border-left:3px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.dsn-md a{color:var(--dsw-alias-brand-primary);text-decoration:none}
.dsn-md a:hover{text-decoration:underline}
.dsn-md hr{border:none;border-top:1px solid var(--dsw-alias-border-l1);margin:12px 0}
.dsn-md table{border-collapse:collapse;font-size:12px;line-height:1.6;min-width:100%}
.dsn-md th,.dsn-md td{border:1px solid var(--dsw-alias-border-l1);padding:4px 8px;text-align:left;vertical-align:top}
.dsn-md th{background:var(--dsw-alias-bg-layer-2);font-weight:600}
.dsn-table{overflow-x:auto;margin:8px 0;border-radius:8px}
.dsn-task{display:inline-block;width:14px;color:var(--dsw-alias-label-secondary)}
.dsn-action{appearance:none;border:none;background:transparent;color:var(--dsw-alias-label-secondary);width:28px;height:28px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.dsn-action:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dsn-action:disabled{opacity:.45;cursor:default}
.dsn-action[data-done]{color:var(--dsw-alias-brand-primary)}
.dsn-open{appearance:none;border:none;background:transparent;color:var(--dsw-alias-label-secondary);height:26px;padding:0 7px;border-radius:7px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;font:inherit;font-size:12px}
.dsn-open:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dsn-floating{position:fixed;z-index:80;display:flex;align-items:center;gap:6px;padding:4px 6px 4px 8px;border-radius:9px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);box-shadow:0 6px 20px rgba(0,0,0,.18);color:var(--dsw-alias-label-primary);font-size:12px}
.dsn-floating button{appearance:none;border:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;padding:3px 6px;border-radius:6px;white-space:nowrap}
.dsn-floating button:hover{background:var(--dsw-alias-bg-layer-2)}
.dsn-floating-note{color:var(--dsw-alias-label-secondary);font-size:11px;padding:0 4px}
.dsn-action:focus-visible,.dsn-open:focus-visible,.dsn-floating button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
@media (prefers-reduced-motion: reduce){.dsn-pane,.dsn-pane *,.dsn-floating,.dsn-floating *{transition:none !important;animation:none !important}}
`

    /** Insert the plugin stylesheet once per apply; the disposer removes it. */
    function installStyles() {
      const tag = document.createElement('style')
      tag.dataset.plugin = PACKAGE
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        tag.remove()
      }
    }

    // ── copy ───────────────────────────────────────────────────────────────

    const zh = {
      'tab.title': '便签',
      'tab.description': '收藏对话内容为本地 Markdown 便签',
      'filter.session': '当前会话',
      'filter.global': '全局',
      'filter.emptySession': '这个会话还没有便签。\n在回复上点便签图标，或选中文字后点「存为便签」。',
      'filter.emptyGlobal': '还没有全局便签。\n打开一条便签，点「设为全局」即可。',
      'filter.noResults': '没有匹配的便签',
      'list.search': '搜索便签',
      'list.new': '新建便签',
      'list.captureSession': '收藏整段对话',
      'list.refresh': '刷新',
      'list.count': '便签数量',
      'row.global': '全局',
      'row.session': '会话',
      'row.favorite': '收藏',
      'row.unfavorite': '取消收藏',
      'row.insert': '插入会话',
      'row.makeGlobal': '设为全局',
      'row.makeSession': '设为会话',
      'detail.back': '返回',
      'detail.insert': '插入全文',
      'detail.insertSelection': '插入选中',
      'detail.insertFile': '以文件插入',
      'detail.copy': '复制',
      'detail.edit': '编辑',
      'detail.makeGlobal': '设为全局',
      'detail.makeSession': '设为会话',
      'detail.delete': '删除',
      'detail.deleteAgain': '确认删除',
      'editor.newTitle': '新建便签',
      'editor.editTitle': '编辑便签',
      'editor.title': '标题',
      'editor.body': '内容（Markdown）',
      'editor.write': '编辑',
      'editor.preview': '预览',
      'editor.save': '保存',
      'editor.cancel': '取消',
      'status.loading': '加载中…',
      'status.inserted': '已插入输入框',
      'status.copied': '已复制到剪贴板',
      'status.saved': '已保存',
      'status.deleted': '已删除',
      'status.captured': '已收藏为便签',
      'status.saving': '保存中…',
      'status.favorited': '已收藏，已排到最前',
      'status.unfavorited': '已取消收藏',
      'status.scopeGlobal': '已设为全局',
      'status.scopeSession': '已设为会话便签',
      'capture.message': '收藏这条回复为便签',
      'capture.selection': '存为便签',
      'capture.needSession': '请先打开一个会话',
      'capture.needSelection': '请先选中内容',
      'insert.noSession': '当前没有可插入的会话',
      'insert.noComposer': '当前输入框不可用',
      'insert.failed': '插入失败，请重试',
      'error.generic': '操作失败',
      'error.notFound': '便签已不存在',
    }

    const en = {
      'tab.title': 'Sticky Notes',
      'tab.description': 'Collect conversation content as local Markdown notes',
      'filter.session': 'This chat',
      'filter.global': 'Global',
      'filter.emptySession': 'No notes in this chat yet.\nUse the note icon on a reply, or select text and click "Pin note".',
      'filter.emptyGlobal': 'No global notes yet.\nOpen a note and choose "Make global".',
      'filter.noResults': 'No matching notes',
      'list.search': 'Search notes',
      'list.new': 'New note',
      'list.captureSession': 'Save whole chat',
      'list.refresh': 'Refresh',
      'list.count': 'Number of notes',
      'row.global': 'Global',
      'row.session': 'Chat',
      'row.favorite': 'Favorite',
      'row.unfavorite': 'Unfavorite',
      'row.insert': 'Insert into chat',
      'row.makeGlobal': 'Make global',
      'row.makeSession': 'Make private',
      'detail.back': 'Back',
      'detail.insert': 'Insert',
      'detail.insertSelection': 'Insert selection',
      'detail.insertFile': 'Insert as file',
      'detail.copy': 'Copy',
      'detail.edit': 'Edit',
      'detail.makeGlobal': 'Make global',
      'detail.makeSession': 'Make private',
      'detail.delete': 'Delete',
      'detail.deleteAgain': 'Confirm delete',
      'editor.newTitle': 'New note',
      'editor.editTitle': 'Edit note',
      'editor.title': 'Title',
      'editor.body': 'Content (Markdown)',
      'editor.write': 'Write',
      'editor.preview': 'Preview',
      'editor.save': 'Save',
      'editor.cancel': 'Cancel',
      'status.loading': 'Loading…',
      'status.inserted': 'Inserted into the composer',
      'status.copied': 'Copied to clipboard',
      'status.saved': 'Saved',
      'status.deleted': 'Deleted',
      'status.captured': 'Saved as a note',
      'status.saving': 'Saving…',
      'status.favorited': 'Favorited — moved to the top',
      'status.unfavorited': 'Removed from favorites',
      'status.scopeGlobal': 'Now visible everywhere',
      'status.scopeSession': 'Now chat-only',
      'capture.message': 'Save this reply as a note',
      'capture.selection': 'Pin note',
      'capture.needSession': 'Open a chat first',
      'capture.needSelection': 'Select some text first',
      'insert.noSession': 'No chat to insert into',
      'insert.noComposer': 'The composer is unavailable',
      'insert.failed': 'Insert failed, please retry',
      'error.generic': 'Something went wrong',
      'error.notFound': 'The note no longer exists',
    }

    // ── markdown ───────────────────────────────────────────────────────────

    /** Escape text for HTML insertion. */
    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    }

    /** Whether a link target is safe to render. */
    function safeUrl(url) {
      return /^(https?:\/\/|mailto:|#|\/)/i.test(url)
    }

    /** Render inline markdown over already-escaped text. */
    function renderInline(escaped) {
      let out = escaped
      const codes = []
      out = out.replace(/`([^`]+)`/g, (_, value) => {
        codes.push(value)
        return `\u0000${String(codes.length - 1)}\u0000`
      })
      out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) =>
        safeUrl(url) ? `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>` : match,
      )
      out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>')
      out = out.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>')
      return out.replace(/\u0000(\d+)\u0000/g, (_, index) => `<code>${codes[Number(index)]}</code>`)
    }

    /** Split one table row into trimmed cells, dropping the outer pipes. */
    function tableCells(line) {
      let text = line.trim()
      if (text.startsWith('|')) text = text.slice(1)
      if (text.endsWith('|')) text = text.slice(0, -1)
      return text.split('|').map((cell) => cell.trim())
    }

    /** Render a Markdown document to a safe HTML string. */
    function renderMarkdown(markdown) {
      const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n')
      const out = []
      let index = 0
      const isBlockStart = (line) =>
        /^\s*$/.test(line) ||
        /^\s{0,3}(```|~~~)/.test(line) ||
        /^\s{0,3}#{1,6}\s+/.test(line) ||
        /^\s{0,3}>/.test(line) ||
        /^\s{0,3}([-*+]|\d+\.)\s+/.test(line) ||
        /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)

      while (index < lines.length) {
        const line = lines[index]
        if (/^\s*$/.test(line)) {
          index += 1
          continue
        }

        const fence = /^\s{0,3}(```+|~~~+)\s*([\w#+.-]*)\s*$/.exec(line)
        if (fence !== null) {
          const marker = fence[1]
          const language = fence[2]
          const buffer = []
          index += 1
          while (index < lines.length && !new RegExp(`^\\s{0,3}${marker[0]}{${String(marker.length)},}\\s*$`).test(lines[index])) {
            buffer.push(lines[index])
            index += 1
          }
          index += 1
          const attr = language.length > 0 ? ` data-lang="${escapeHtml(language)}"` : ''
          out.push(`<pre><code${attr}>${escapeHtml(buffer.join('\n'))}</code></pre>`)
          continue
        }

        const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
        if (heading !== null) {
          const level = heading[1].length
          out.push(`<h${String(level)}>${renderInline(escapeHtml(heading[2]))}</h${String(level)}>`)
          index += 1
          continue
        }

        if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
          out.push('<hr>')
          index += 1
          continue
        }

        if (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(lines[index + 1])) {
          const header = tableCells(line)
          index += 2
          const rows = []
          while (index < lines.length && lines[index].includes('|') && !/^\s*$/.test(lines[index])) {
            rows.push(tableCells(lines[index]))
            index += 1
          }
          const head = header.map((cell) => `<th>${renderInline(escapeHtml(cell))}</th>`).join('')
          const body = rows
            .map((row) => `<tr>${header.map((_, column) => `<td>${renderInline(escapeHtml(row[column] ?? ''))}</td>`).join('')}</tr>`)
            .join('')
          out.push(`<div class="dsn-table"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`)
          continue
        }

        if (/^\s{0,3}>/.test(line)) {
          const buffer = []
          while (index < lines.length && /^\s{0,3}>/.test(lines[index])) {
            buffer.push(lines[index].replace(/^\s{0,3}>\s?/, ''))
            index += 1
          }
          out.push(`<blockquote>${renderMarkdown(buffer.join('\n'))}</blockquote>`)
          continue
        }

        if (/^\s{0,3}([-*+]|\d+\.)\s+/.test(line)) {
          const ordered = /^\s{0,3}\d+\.\s+/.test(line)
          const items = []
          while (index < lines.length && /^\s{0,3}([-*+]|\d+\.)\s+/.test(lines[index])) {
            let text = lines[index].replace(/^\s{0,3}([-*+]|\d+\.)\s+/, '')
            index += 1
            while (index < lines.length && !isBlockStart(lines[index])) {
              text += ` ${lines[index].trim()}`
              index += 1
            }
            const task = /^\[([ xX])\]\s+/.exec(text)
            if (task !== null) {
              const box = task[1].toLowerCase() === 'x' ? '☑' : '☐'
              text = `<span class="dsn-task">${box}</span>${renderInline(escapeHtml(text.slice(task[0].length)))}`
            } else {
              text = renderInline(escapeHtml(text))
            }
            items.push(`<li>${text}</li>`)
          }
          out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`)
          continue
        }

        const paragraph = []
        while (index < lines.length && !isBlockStart(lines[index])) {
          paragraph.push(lines[index])
          index += 1
        }
        if (paragraph.length === 0) {
          // A line that starts a block we did not handle still has to advance.
          paragraph.push(lines[index])
          index += 1
        }
        out.push(`<p>${renderInline(escapeHtml(paragraph.join('\n'))).replace(/\n/g, '<br>')}</p>`)
      }
      return out.join('\n')
    }

    /** First meaningful line of a selection, for the note title. */
    function titleOfText(text) {
      const line = String(text ?? '')
        .split(/\r?\n/)
        .map((value) => value.replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/, '').trim())
        .find((value) => value.length > 0)
      if (line === undefined) return '便签'
      const plain = line.replace(/[*_~`>|]/g, '').trim()
      return plain.length <= 80 ? plain : `${plain.slice(0, 79)}…`
    }

    // ── helpers ────────────────────────────────────────────────────────────

    /** Local date/time for a note row. */
    function formatTime(time) {
      const date = new Date(time)
      if (Number.isNaN(date.getTime())) return ''
      const pad = (value) => String(value).padStart(2, '0')
      const today = new Date()
      const sameDay =
        date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
      const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`
      return sameDay ? clock : `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock}`
    }

    /** Turn a failed Result into one message. */
    function failureText(result, t) {
      return result?.error?.message || t('error.generic')
    }

    /** The Session currently on screen, when the Client exposes it. */
    function currentSessionId(ctx) {
      try {
        const adapter = ctx.get('uiSession')?.adapter
        const snapshot = adapter?.current?.getSnapshot?.()
        return snapshot?.key ?? snapshot?.sessionId ?? null
      } catch {
        return null
      }
    }

    /** Append text to the current composer draft through the scoped input event. */
    function insertIntoComposer(ctx, sessionId, text) {
      const scope = ctx.sessions?.scope?.(sessionId)
      if (scope === undefined || scope === null) return { ok: false, code: 'no-session' }
      const input = ctx.get('conversation')?.input?.for?.(scope)
      if (input?.state?.getSnapshot === undefined) return { ok: false, code: 'no-composer' }
      const state = input.state.getSnapshot()
      const start = state.draft.length
      const span = { start, end: start, draftRev: state.draftRev }
      const prefix = start > 0 ? '\n\n' : ''
      const applied = scope.bail('slash/input-insert-text', { text: `${prefix}${text}`, span })
      if (applied !== true) return { ok: false, code: 'failed' }
      try {
        input.focus?.()
      } catch {
        // Focus is a courtesy; a failed focus must not undo a successful insert.
      }
      return { ok: true }
    }

    // ── store ──────────────────────────────────────────────────────────────

    const EMPTY_STATE = { status: 'cold', items: [], error: null, sessionId: null, dirty: 0, loadedDirty: 0 }

    /** One in-memory view over the Host note endpoints. */
    function createStore(remote) {
      let state = EMPTY_STATE
      const listeners = new Set()
      const emit = () => {
        for (const listener of listeners) {
          try {
            listener()
          } catch (error) {
            console.error('[sticky-notes] subscriber threw:', error)
          }
        }
      }
      const set = (patch) => {
        state = { ...state, ...patch }
        emit()
      }

      const store = {
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        markDirty() {
          set({ dirty: state.dirty + 1 })
        },
        async load(sessionId, force = false) {
          if (!force && state.status === 'ready' && state.sessionId === sessionId && state.loadedDirty === state.dirty) return
          const startedDirty = state.dirty
          set({ status: state.items.length > 0 ? 'refreshing' : 'loading', sessionId, error: null })
          try {
            const carried = await remote.list({ sessionId })
            if (state.sessionId !== sessionId) return
            if (!carried.ok) {
              set({ status: 'error', error: carried.error?.message ?? 'list failed' })
              return
            }
            const result = carried.value
            if (!result.ok) {
              set({ status: 'error', error: result.error?.message ?? 'list failed' })
              return
            }
            set({ status: 'ready', items: result.value.notes, error: null, loadedDirty: startedDirty })
          } catch (error) {
            set({ status: 'error', error: error instanceof Error ? error.message : String(error) })
          }
        },
        /**
         * Read one note. `sessionId` lets the Host resolve the note's project
         * store; a global note is found in the shared store regardless.
         */
        async read(id, sessionId) {
          const carried = await remote.read({ id, sessionId: sessionId ?? null })
          if (!carried.ok) return { ok: false, message: carried.error?.message ?? 'read failed' }
          return carried.value
        },
        async create(payload) {
          try {
            const carried = await remote.create(payload)
            if (!carried.ok) return { ok: false, error: { code: 'transport', message: carried.error?.message ?? 'failed' } }
            if (carried.value.ok) store.markDirty()
            return carried.value
          } catch (error) {
            return { ok: false, error: { code: 'transport', message: error instanceof Error ? error.message : String(error) } }
          }
        },
        async update(payload) {
          try {
            const carried = await remote.update(payload)
            if (!carried.ok) return { ok: false, error: { code: 'transport', message: carried.error?.message ?? 'failed' } }
            if (carried.value.ok) store.markDirty()
            return carried.value
          } catch (error) {
            return { ok: false, error: { code: 'transport', message: error instanceof Error ? error.message : String(error) } }
          }
        },
        async remove(id, sessionId) {
          try {
            // `remove` is reserved on the Remote namespace service, so the
            // endpoint is `removeNote`.
            const carried = await remote.removeNote({ id, sessionId: sessionId ?? null })
            if (!carried.ok) return { ok: false, error: { code: 'transport', message: carried.error?.message ?? 'failed' } }
            if (carried.value.ok) store.markDirty()
            return carried.value
          } catch (error) {
            return { ok: false, error: { code: 'transport', message: error instanceof Error ? error.message : String(error) } }
          }
        },
        async setFavorite(id, sessionId, favorite) {
          try {
            const carried = await remote.setFavorite({ id, sessionId: sessionId ?? null, favorite })
            if (!carried.ok) return { ok: false, error: { code: 'transport', message: carried.error?.message ?? 'failed' } }
            if (carried.value.ok) store.markDirty()
            return carried.value
          } catch (error) {
            return { ok: false, error: { code: 'transport', message: error instanceof Error ? error.message : String(error) } }
          }
        },
        async setScope(id, sessionId, scope) {
          try {
            const carried = await remote.setScope({ id, sessionId: sessionId ?? null, scope })
            if (!carried.ok) return { ok: false, error: { code: 'transport', message: carried.error?.message ?? 'failed' } }
            if (carried.value.ok) store.markDirty()
            return carried.value
          } catch (error) {
            return { ok: false, error: { code: 'transport', message: error instanceof Error ? error.message : String(error) } }
          }
        },
        async captureMessage(sessionId, messageId) {
          try {
            const carried = await remote.captureMessage({ sessionId, messageId })
            if (!carried.ok) return { ok: false, error: { code: 'transport', message: carried.error?.message ?? 'failed' } }
            if (carried.value.ok) store.markDirty()
            return carried.value
          } catch (error) {
            return { ok: false, error: { code: 'transport', message: error instanceof Error ? error.message : String(error) } }
          }
        },
        async captureSession(sessionId) {
          try {
            const carried = await remote.captureSession({ sessionId })
            if (!carried.ok) return { ok: false, error: { code: 'transport', message: carried.error?.message ?? 'failed' } }
            if (carried.value.ok) store.markDirty()
            return carried.value
          } catch (error) {
            return { ok: false, error: { code: 'transport', message: error instanceof Error ? error.message : String(error) } }
          }
        },
        dispose() {
          listeners.clear()
        },
      }
      return store
    }

    /** Subscribe one component to the store. */
    function useStore(store) {
      return React.useSyncExternalStore(store.subscribe, store.getSnapshot)
    }

    // ── icons ──────────────────────────────────────────────────────────────

    function icon(paths, size = 16, filled = false) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: filled ? 'currentColor' : 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: 'false',
        },
        ...paths.map((d, index) => h('path', { key: index, d })),
      )
    }

    const IconNote = (props) => icon(['M7 3.5h7.5L19 8v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1.5-1.5Z', 'M14.5 3.5V8H19', 'M9 12h6', 'M9 16h4'], props?.size ?? 16)
    const IconPlus = (props) => icon(['M12 5v14', 'M5 12h14'], props?.size ?? 16)
    const IconTrash = (props) => icon(['M4 7h16', 'M9 7V5h6v2', 'M6 7l1 13h10l1-13', 'M10 11v5', 'M14 11v5'], props?.size ?? 16)
    const IconBack = (props) => icon(['M15 5l-7 7 7 7'], props?.size ?? 16)
    const IconCopy = (props) => icon(['M9 9h10v11H9z', 'M5 15V4h10'], props?.size ?? 16)
    const IconInsert = (props) => icon(['M12 4v10', 'M8 10l4 4 4-4', 'M5 18h14'], props?.size ?? 16)
    const IconGlobe = (props) => icon(['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M3.5 12h17', 'M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3Z'], props?.size ?? 16)
    const IconEdit = (props) => icon(['M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4 16.5V20Z', 'M13.5 6.5l3.5 3.5'], props?.size ?? 16)
    const IconRefresh = (props) => icon(['M20 12a8 8 0 1 1-2.3-5.7', 'M20 4v5h-5'], props?.size ?? 16)
    const IconChat = (props) => icon(['M4 5h16v11H9l-4 3V5Z'], props?.size ?? 16)
    const IconStar = (props) =>
      icon(['M12 3.6l2.55 5.17 5.7.83-4.13 4.03.98 5.68L12 16.62l-5.1 2.69.98-5.68L3.75 9.6l5.7-.83L12 3.6Z'], props?.size ?? 16, props?.filled === true)

    // ── list ───────────────────────────────────────────────────────────────

    /**
     * One note card: a full-width open target plus a footer of large inline
     * actions (favorite / insert / visibility / delete), so the list never
     * needs the detail view to do the common operations.
     */
    function NoteRow({ note, t, busy, confirming, onOpen, onInsert, onFavorite, onScope, onDelete }) {
      const favoriteLabel = note.favorite ? t('row.unfavorite') : t('row.favorite')
      const scopeLabel = note.scope === 'global' ? t('row.makeSession') : t('row.makeGlobal')
      const deleteLabel = confirming ? t('detail.deleteAgain') : t('detail.delete')
      return h(
        'div',
        {
          className: 'dsn-row',
          'data-favorite': note.favorite || undefined,
          'data-busy': busy || undefined,
        },
        h(
          'button',
          { type: 'button', className: 'dsn-row-open', onClick: () => onOpen(note.id), title: note.title },
          h(
            'span',
            { className: 'dsn-row-head' },
            h('span', { className: 'dsn-title' }, note.title),
            note.snippet.length > 0 ? h('span', { className: 'dsn-snippet' }, note.snippet) : null,
          ),
          h(
            'span',
            { className: 'dsn-row-meta' },
            h(
              'span',
              { className: 'dsn-chip', 'data-global': note.scope === 'global' || undefined },
              note.scope === 'global' ? t('row.global') : t('row.session'),
            ),
            h('span', { className: 'dsn-time' }, formatTime(note.updatedAt)),
          ),
        ),
        h(
          'div',
          { className: 'dsn-row-rail' },
          h(
            'button',
            {
              type: 'button',
              className: 'dsn-iconbtn',
              'data-active': note.favorite || undefined,
              title: favoriteLabel,
              'aria-label': favoriteLabel,
              'aria-pressed': note.favorite ? 'true' : 'false',
              disabled: busy,
              onClick: () => onFavorite(note),
            },
            h(IconStar, { size: 18, filled: note.favorite }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsn-iconbtn',
              title: t('row.insert'),
              'aria-label': t('row.insert'),
              disabled: busy,
              onClick: () => onInsert(note),
            },
            h(IconInsert, { size: 18 }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsn-iconbtn',
              title: scopeLabel,
              'aria-label': scopeLabel,
              disabled: busy,
              onClick: () => onScope(note),
            },
            h(IconGlobe, { size: 18 }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsn-iconbtn',
              'data-danger': confirming || undefined,
              title: deleteLabel,
              'aria-label': deleteLabel,
              disabled: busy,
              onClick: () => onDelete(note),
            },
            h(IconTrash, { size: 18 }),
          ),
        ),
      )
    }

    /** The tab body: filters, search, the list, and the detail/editor views. */
    function NotesPane(props) {
      const { sessionId, store, t, ctx } = props
      const view = useStore(store)
      const [filter, setFilter] = useState('session')
      const [query, setQuery] = useState('')
      const [openId, setOpenId] = useState(null)
      const [editor, setEditor] = useState(null)
      const [busy, setBusy] = useState(false)
      const [busyId, setBusyId] = useState(null)
      const [confirmId, setConfirmId] = useState(null)
      const [status, setStatus] = useState(null)

      useEffect(() => {
        void store.load(sessionId ?? null)
      }, [sessionId, view.dirty])

      useEffect(() => {
        if (status === null) return undefined
        const timer = setTimeout(() => setStatus(null), 2400)
        return () => clearTimeout(timer)
      }, [status])

      // A pending delete confirmation resets on its own, so a stray click can
      // never leave a row stuck in the danger state.
      useEffect(() => {
        if (confirmId === null) return undefined
        const timer = setTimeout(() => setConfirmId(null), 3200)
        return () => clearTimeout(timer)
      }, [confirmId])

      /** Show one transient status line; `error` switches it to the error tone. */
      const notify = (text, error = false) => setStatus({ text, error })

      const items = useMemo(() => {
        const term = query.trim().toLowerCase()
        return view.items.filter((note) => {
          if (filter === 'global' ? note.scope !== 'global' : note.sessionId !== sessionId) return false
          if (term.length === 0) return true
          return `${note.title} ${note.snippet}`.toLowerCase().includes(term)
        })
      }, [view.items, filter, query, sessionId])

      const open = (id) => {
        setEditor(null)
        setOpenId(id)
      }

      const startNew = () => {
        setOpenId(null)
        setEditor({ mode: 'new', note: { title: '', body: '', scope: filter === 'global' ? 'global' : 'session' } })
      }

      const captureSession = async () => {
        setBusy(true)
        const result = await store.captureSession(sessionId)
        setBusy(false)
        if (!result.ok) {
          notify(failureText(result, t), true)
          return
        }
        notify(t('status.captured'))
        setFilter('session')
      }

      /** Read one note's body and append it to the current composer. */
      const insertNote = async (note) => {
        setBusyId(note.id)
        const detail = await store.read(note.id, sessionId)
        setBusyId(null)
        if (!detail.ok) {
          notify(detail.message ?? t('error.notFound'), true)
          return
        }
        const full = detail.value.note
        const result = insertIntoComposer(ctx, sessionId, `## ${full.title}\n\n${full.body}`)
        if (result.ok) notify(t('status.inserted'))
        else if (result.code === 'no-session') notify(t('insert.noSession'), true)
        else if (result.code === 'no-composer') notify(t('insert.noComposer'), true)
        else notify(t('insert.failed'), true)
      }

      const toggleFavorite = async (note) => {
        setBusyId(note.id)
        const result = await store.setFavorite(note.id, sessionId, !note.favorite)
        setBusyId(null)
        if (!result.ok) {
          notify(failureText(result, t), true)
          return
        }
        notify(note.favorite ? t('status.unfavorited') : t('status.favorited'))
      }

      const toggleScope = async (note) => {
        const next = note.scope === 'global' ? 'session' : 'global'
        setBusyId(note.id)
        const result = await store.setScope(note.id, sessionId, next)
        setBusyId(null)
        if (!result.ok) {
          notify(failureText(result, t), true)
          return
        }
        notify(next === 'global' ? t('status.scopeGlobal') : t('status.scopeSession'))
      }

      /** Two-step delete: the first click arms the row, the second removes it. */
      const deleteNote = async (note) => {
        if (confirmId !== note.id) {
          setConfirmId(note.id)
          return
        }
        setConfirmId(null)
        setBusyId(note.id)
        const result = await store.remove(note.id, sessionId)
        setBusyId(null)
        if (!result.ok) {
          notify(failureText(result, t), true)
          return
        }
        if (openId === note.id) setOpenId(null)
        notify(t('status.deleted'))
      }

      if (editor !== null) {
        return h(NoteEditor, {
          t,
          initial: editor.note,
          mode: editor.mode,
          onCancel: () => setEditor(null),
          onSave: async (draft) => {
            setBusy(true)
            const payload = {
              title: draft.title,
              body: draft.body,
              scope: draft.scope,
              sessionId: draft.scope === 'session' ? sessionId : null,
            }
            const result = editor.mode === 'new'
              ? await store.create(payload)
              : await store.update({
                  id: editor.note.id,
                  title: payload.title,
                  body: payload.body,
                  scope: payload.scope,
                  sessionId,
                })
            setBusy(false)
            if (!result.ok) return failureText(result, t)
            notify(t('status.saved'))
            setEditor(null)
            if (editor.mode !== 'new') setOpenId(editor.note.id)
            return null
          },
          busy,
        })
      }

      if (openId !== null) {
        return h(NoteDetail, {
          key: openId,
          id: openId,
          sessionId,
          store,
          ctx,
          t,
          onBack: () => setOpenId(null),
          onEdit: (note) => {
            setOpenId(null)
            setEditor({ mode: 'edit', note: { id: note.id, title: note.title, body: note.body, scope: note.scope } })
          },
        })
      }

      const emptyText = filter === 'global' ? t('filter.emptyGlobal') : t('filter.emptySession')
      return h(
        'div',
        { className: 'dsn-pane', 'data-dsn-ignore-capture': true },
        h(
          'div',
          { className: 'dsn-bar' },
          h(
            'button',
            { type: 'button', className: 'dsn-seg', 'data-active': filter === 'session' || undefined, onClick: () => setFilter('session') },
            t('filter.session'),
          ),
          h(
            'button',
            { type: 'button', className: 'dsn-seg', 'data-active': filter === 'global' || undefined, onClick: () => setFilter('global') },
            t('filter.global'),
          ),
          h('span', { className: 'dsn-count', title: t('list.count') }, String(items.length)),
          h('span', { className: 'dsn-spacer' }),
          h(
            'button',
            { type: 'button', className: 'dsn-iconbtn', title: t('list.captureSession'), 'aria-label': t('list.captureSession'), disabled: busy, onClick: () => void captureSession() },
            h(IconChat, { size: 16 }),
          ),
          h(
            'button',
            { type: 'button', className: 'dsn-iconbtn', title: t('list.new'), 'aria-label': t('list.new'), onClick: startNew },
            h(IconPlus, { size: 16 }),
          ),
          h(
            'button',
            { type: 'button', className: 'dsn-iconbtn', title: t('list.refresh'), 'aria-label': t('list.refresh'), onClick: () => void store.load(sessionId, true) },
            h(IconRefresh, { size: 15 }),
          ),
        ),
        h(
          'div',
          { className: 'dsn-search' },
          h('input', {
            type: 'search',
            value: query,
            placeholder: t('list.search'),
            'aria-label': t('list.search'),
            onChange: (event) => setQuery(event.target.value),
          }),
        ),
        status !== null
          ? h(
              'div',
              {
                className: 'dsn-status',
                role: 'status',
                'data-success': status.error ? undefined : true,
                'data-error': status.error || undefined,
              },
              status.text,
            )
          : null,
        view.error !== null ? h('div', { className: 'dsn-error', role: 'alert' }, view.error) : null,
        h(
          'div',
          { className: 'dsn-scroll' },
          view.status === 'loading' && view.items.length === 0
            ? h(
                'div',
                { className: 'dsn-empty' },
                h('span', { className: 'dsn-empty-icon' }, h(IconRefresh, { size: 22 })),
                h('p', { className: 'dsn-empty-text' }, t('status.loading')),
              )
            : null,
          view.status !== 'loading' && items.length === 0
            ? h(
                'div',
                { className: 'dsn-empty' },
                h('span', { className: 'dsn-empty-icon' }, h(IconNote, { size: 26 })),
                h('p', { className: 'dsn-empty-text' }, query.trim().length > 0 ? t('filter.noResults') : emptyText),
                query.trim().length === 0
                  ? h(
                      'div',
                      { className: 'dsn-empty-actions' },
                      filter === 'session'
                        ? h(
                            'button',
                            { type: 'button', className: 'dsn-btn', 'data-primary': true, disabled: busy, onClick: () => void captureSession() },
                            h(IconChat, { size: 14 }),
                            t('list.captureSession'),
                          )
                        : null,
                      h(
                        'button',
                        { type: 'button', className: 'dsn-btn', onClick: startNew },
                        h(IconPlus, { size: 14 }),
                        t('list.new'),
                      ),
                    )
                  : null,
              )
            : null,
          items.map((note) =>
            h(NoteRow, {
              key: note.id,
              note,
              t,
              busy: busyId === note.id,
              confirming: confirmId === note.id,
              onOpen: open,
              onInsert: (row) => void insertNote(row),
              onFavorite: (row) => void toggleFavorite(row),
              onScope: (row) => void toggleScope(row),
              onDelete: (row) => void deleteNote(row),
            }),
          ),
        ),
      )
    }

    /** One note opened in place: rendered Markdown plus the actions on it. */
    function NoteDetail({ id, sessionId, store, ctx, t, onBack, onEdit }) {
      const [note, setNote] = useState(null)
      const [error, setError] = useState(null)
      const [status, setStatus] = useState(null)
      const [confirmDelete, setConfirmDelete] = useState(false)
      const [busy, setBusy] = useState(false)
      const bodyRef = useRef(null)

      useEffect(() => {
        let alive = true
        setNote(null)
        setError(null)
        void store.read(id, sessionId).then((result) => {
          if (!alive) return
          if (!result.ok) {
            setError(result.message ?? t('error.notFound'))
            return
          }
          setNote(result.value.note)
        })
        return () => {
          alive = false
        }
      }, [id, sessionId])

      useEffect(() => {
        if (status === null) return undefined
        const timer = setTimeout(() => setStatus(null), 2200)
        return () => clearTimeout(timer)
      }, [status])

      /** Show one transient status line; `error` switches it to the error tone. */
      const notify = (text, error = false) => setStatus({ text, error })

      if (note === null) {
        return h(
          'div',
          { className: 'dsn-pane', 'data-dsn-ignore-capture': true },
          h('div', { className: 'dsn-detail-head' }, h('button', { type: 'button', className: 'dsn-iconbtn', onClick: onBack, title: t('detail.back'), 'aria-label': t('detail.back') }, h(IconBack, { size: 20 }))),
          h('div', { className: 'dsn-empty' }, error ?? t('status.loading')),
        )
      }

      const insert = (text) => {
        const result = insertIntoComposer(ctx, sessionId, text)
        if (result.ok) notify(t('status.inserted'))
        else if (result.code === 'no-session') notify(t('insert.noSession'), true)
        else if (result.code === 'no-composer') notify(t('insert.noComposer'), true)
        else notify(t('insert.failed'), true)
      }

      const insertSelection = () => {
        let text = ''
        try {
          const selection = window.getSelection()
          const range = selection?.rangeCount ? selection.getRangeAt(0) : null
          if (range !== null && bodyRef.current !== null && bodyRef.current.contains(range.commonAncestorContainer)) {
            text = selection.toString()
          }
        } catch {
          text = ''
        }
        if (text.trim().length === 0) {
          notify(t('capture.needSelection'), true)
          return
        }
        insert(text)
      }

      const copy = async () => {
        try {
          await navigator.clipboard.writeText(note.body)
          notify(t('status.copied'))
        } catch {
          notify(t('error.generic'), true)
        }
      }

      const toggleFavorite = async () => {
        setBusy(true)
        const result = await store.setFavorite(note.id, sessionId, !note.favorite)
        setBusy(false)
        if (!result.ok) {
          notify(failureText(result, t), true)
          return
        }
        setNote({ ...note, favorite: !note.favorite })
        notify(!note.favorite ? t('status.favorited') : t('status.unfavorited'))
      }

      const toggleScope = async () => {
        setBusy(true)
        const scope = note.scope === 'global' ? 'session' : 'global'
        const result = await store.setScope(note.id, sessionId, scope)
        setBusy(false)
        if (!result.ok) {
          notify(failureText(result, t), true)
          return
        }
        setNote({ ...note, scope, path: result.value?.note?.path ?? note.path })
        notify(scope === 'global' ? t('status.scopeGlobal') : t('status.scopeSession'))
      }

      const remove = async () => {
        if (!confirmDelete) {
          setConfirmDelete(true)
          return
        }
        setBusy(true)
        const result = await store.remove(note.id, sessionId)
        setBusy(false)
        if (!result.ok) {
          notify(failureText(result, t), true)
          return
        }
        onBack()
      }

      return h(
        'div',
        { className: 'dsn-pane', 'data-dsn-ignore-capture': true },
        h(
          'div',
          { className: 'dsn-detail-head' },
          h('button', { type: 'button', className: 'dsn-iconbtn', onClick: onBack, title: t('detail.back'), 'aria-label': t('detail.back') }, h(IconBack, { size: 20 })),
          h('span', { className: 'dsn-detail-title', title: note.title }, note.title),
          h(
            'button',
            {
              type: 'button',
              className: 'dsn-iconbtn',
              'data-active': note.favorite || undefined,
              title: note.favorite ? t('row.unfavorite') : t('row.favorite'),
              'aria-label': note.favorite ? t('row.unfavorite') : t('row.favorite'),
              'aria-pressed': note.favorite ? 'true' : 'false',
              disabled: busy,
              onClick: () => void toggleFavorite(),
            },
            h(IconStar, { size: 19, filled: note.favorite }),
          ),
          h('button', { type: 'button', className: 'dsn-iconbtn', onClick: () => onEdit(note), title: t('detail.edit'), 'aria-label': t('detail.edit') }, h(IconEdit, { size: 19 })),
        ),
        h(
          'div',
          { className: 'dsn-actions' },
          h('button', { type: 'button', className: 'dsn-btn', 'data-primary': true, onClick: () => insert(`## ${note.title}\n\n${note.body}`), title: t('detail.insert') }, h(IconInsert, { size: 16 }), t('detail.insert')),
          h('button', { type: 'button', className: 'dsn-btn', onClick: insertSelection, title: t('detail.insertSelection') }, t('detail.insertSelection')),
          h(
            'button',
            {
              type: 'button',
              className: 'dsn-btn',
              onClick: () => insert(`便签文件（Markdown）：\`${note.path}\``),
              title: t('detail.insertFile'),
            },
            t('detail.insertFile'),
          ),
          h('button', { type: 'button', className: 'dsn-btn', onClick: () => void copy(), title: t('detail.copy') }, h(IconCopy, { size: 16 }), t('detail.copy')),
          h('button', { type: 'button', className: 'dsn-btn', onClick: () => void toggleScope(), disabled: busy, title: note.scope === 'global' ? t('detail.makeSession') : t('detail.makeGlobal') }, h(IconGlobe, { size: 16 }), note.scope === 'global' ? t('detail.makeSession') : t('detail.makeGlobal')),
          h('button', { type: 'button', className: 'dsn-btn', 'data-danger': true, onClick: () => void remove(), disabled: busy }, h(IconTrash, { size: 16 }), confirmDelete ? t('detail.deleteAgain') : t('detail.delete')),
        ),
        status !== null
          ? h(
              'div',
              {
                className: 'dsn-detail-status',
                role: 'status',
                'data-success': status.error ? undefined : true,
                'data-error': status.error || undefined,
              },
              status.text,
            )
          : null,
        h(
          'div',
          { className: 'dsn-detail-body', ref: bodyRef },
          h(
            'div',
            { className: 'dsn-detail-meta' },
            `${note.scope === 'global' ? t('row.global') : t('row.session')} · ${formatTime(note.updatedAt)} · `,
            h('span', { title: note.path }, note.path),
          ),
          h('div', { className: 'dsn-md', dangerouslySetInnerHTML: { __html: renderMarkdown(note.body) } }),
        ),
      )
    }

    /** Create or edit one note with a Markdown textarea and a live preview. */
    function NoteEditor({ initial, mode, t, onSave, onCancel, busy }) {
      const [title, setTitle] = useState(initial.title ?? '')
      const [body, setBody] = useState(initial.body ?? '')
      const [scope, setScope] = useState(initial.scope ?? 'session')
      const [preview, setPreview] = useState(false)
      const [error, setError] = useState(null)

      const save = async () => {
        setError(null)
        if (body.trim().length === 0) {
          setError(t('editor.body'))
          return
        }
        const failure = await onSave({ title: title.trim(), body, scope })
        if (typeof failure === 'string') setError(failure)
      }

      return h(
        'div',
        { className: 'dsn-pane', 'data-dsn-ignore-capture': true },
        h(
          'div',
          { className: 'dsn-detail-head' },
          h('button', { type: 'button', className: 'dsn-iconbtn', onClick: onCancel, title: t('editor.cancel'), 'aria-label': t('editor.cancel') }, h(IconBack, { size: 18 })),
          h('span', { className: 'dsn-detail-title' }, mode === 'new' ? t('editor.newTitle') : t('editor.editTitle')),
        ),
        h(
          'div',
          { className: 'dsn-editor' },
          h('input', {
            value: title,
            placeholder: t('editor.title'),
            'aria-label': t('editor.title'),
            onChange: (event) => setTitle(event.target.value),
          }),
          h(
            'div',
            { className: 'dsn-editor-row' },
            h('button', { type: 'button', className: 'dsn-btn', 'data-active': !preview || undefined, onClick: () => setPreview(false) }, t('editor.write')),
            h('button', { type: 'button', className: 'dsn-btn', 'data-active': preview || undefined, onClick: () => setPreview(true) }, t('editor.preview')),
            h('span', { className: 'dsn-spacer' }),
            h('button', { type: 'button', className: 'dsn-btn', 'data-active': scope === 'session' || undefined, onClick: () => setScope('session') }, t('row.session')),
            h('button', { type: 'button', className: 'dsn-btn', 'data-active': scope === 'global' || undefined, onClick: () => setScope('global') }, t('row.global')),
          ),
          preview
            ? h('div', { className: 'dsn-preview' }, h('div', { className: 'dsn-md', dangerouslySetInnerHTML: { __html: renderMarkdown(body) } }))
            : h('textarea', {
                value: body,
                placeholder: t('editor.body'),
                'aria-label': t('editor.body'),
                onChange: (event) => setBody(event.target.value),
              }),
          error !== null ? h('div', { className: 'dsn-error', role: 'alert' }, error) : null,
          h(
            'div',
            { className: 'dsn-editor-row' },
            h('button', { type: 'button', className: 'dsn-btn', 'data-primary': true, onClick: () => void save(), disabled: busy }, busy ? t('status.saving') : t('editor.save')),
            h('button', { type: 'button', className: 'dsn-btn', onClick: onCancel }, t('editor.cancel')),
          ),
        ),
      )
    }

    // ── capture affordances ────────────────────────────────────────────────

    /** The per-reply action in the assistant message action strip. */
    function CaptureReplyAction({ sessionId, messageId, t, store }) {
      const [state, setState] = useState('idle')
      useEffect(() => {
        if (state !== 'done') return undefined
        const timer = setTimeout(() => setState('idle'), 1600)
        return () => clearTimeout(timer)
      }, [state])
      const label = t('capture.message')
      return h(
        'button',
        {
          type: 'button',
          className: 'dsn-action',
          title: label,
          'aria-label': label,
          'data-done': state === 'done' || undefined,
          disabled: state === 'busy',
          onClick: async () => {
            setState('busy')
            const result = await store.captureMessage(sessionId, messageId)
            setState(result.ok ? 'done' : 'idle')
          },
        },
        h(IconNote, { size: 16 }),
      )
    }

    /** Header shortcut that opens the notes tab. */
    function OpenNotesButton({ t, ctx }) {
      return h(
        'button',
        {
          type: 'button',
          className: 'dsn-open',
          title: t('tab.title'),
          onClick: () => {
            try {
              ctx.get('sidebarRight')?.openTab(TAB_KIND)
            } catch (error) {
              console.error('[sticky-notes] open tab failed:', error)
            }
          },
        },
        h(IconNote, { size: 15 }),
        h('span', null, t('tab.title')),
      )
    }

    /**
     * Floating capture button shown next to a text selection in the page.
     * The selected text is captured on selectionchange and reused on click, so
     * pressing the button cannot lose it to a focus change.
     */
    function SelectionCapture({ ctx, store, t }) {
      const [anchor, setAnchor] = useState(null)
      const [text, setText] = useState('')
      const [toast, setToast] = useState(null)
      const rootRef = useRef(null)

      useEffect(() => {
        let timer = null
        const evaluate = () => {
          const selection = window.getSelection()
          const raw = selection?.rangeCount ? selection.toString() : ''
          if (selection === null || selection.rangeCount === 0 || raw.trim().length < 4) {
            setAnchor(null)
            return
          }
          const node = selection.anchorNode
          const element = node === null ? null : node.nodeType === 1 ? node : node.parentElement
          if (element === null || rootRef.current?.contains(element)) return
          if (element.closest('input, textarea, [contenteditable="true"], [data-dsn-ignore-capture]')) {
            setAnchor(null)
            return
          }
          let rect
          try {
            rect = selection.getRangeAt(0).getBoundingClientRect()
          } catch {
            setAnchor(null)
            return
          }
          if (rect.width === 0 && rect.height === 0) {
            setAnchor(null)
            return
          }
          setText(raw)
          setAnchor({
            top: Math.max(8, rect.top - 40),
            left: Math.max(8, Math.min(window.innerWidth - 150, rect.left + rect.width / 2 - 60)),
          })
        }
        const schedule = () => {
          if (timer !== null) clearTimeout(timer)
          timer = setTimeout(evaluate, 140)
        }
        document.addEventListener('selectionchange', schedule)
        window.addEventListener('scroll', schedule, true)
        window.addEventListener('resize', schedule)
        return () => {
          if (timer !== null) clearTimeout(timer)
          document.removeEventListener('selectionchange', schedule)
          window.removeEventListener('scroll', schedule, true)
          window.removeEventListener('resize', schedule)
        }
      }, [])

      useEffect(() => {
        if (toast === null) return undefined
        const timer = setTimeout(() => setToast(null), 1800)
        return () => clearTimeout(timer)
      }, [toast])

      if (anchor === null) return null
      return h(
        'div',
        {
          ref: rootRef,
          className: 'dsn-floating',
          style: { left: `${String(anchor.left)}px`, top: `${String(anchor.top)}px` },
          'data-dsn-ignore-capture': true,
          onMouseDown: (event) => event.preventDefault(),
        },
        toast !== null
          ? h('span', { className: 'dsn-floating-note', role: 'status' }, toast)
          : h(
              'button',
              {
                type: 'button',
                onClick: async () => {
                  const sessionId = currentSessionId(ctx)
                  if (sessionId === null) {
                    setToast(t('capture.needSession'))
                    return
                  }
                  const result = await store.create({
                    title: titleOfText(text),
                    body: text,
                    scope: 'session',
                    sessionId,
                  })
                  if (result.ok) {
                    setToast(t('status.captured'))
                    setAnchor(null)
                    const selection = window.getSelection()
                    selection?.removeAllRanges()
                  } else {
                    setToast(failureText(result, t))
                  }
                },
              },
              h(IconNote, { size: 14 }),
              t('capture.selection'),
            ),
      )
    }

    // ── plugin body ────────────────────────────────────────────────────────

    const inject = ['slots', 'remote', 'locale', 'sessions', 'sidebarRightTabs', 'sidebarRight', 'uiSession']

    /** A translate function for this namespace; identity copy before registration. */
    function translate(ctx) {
      try {
        return ctx.locale.bind(NS)
      } catch {
        return (key) => key
      }
    }

    /**
     * Client entry: mount the Remote contribution and register the seats.
     *
     * Every step is isolated on purpose. The Client boot waits for this apply,
     * so a rejected promise or an unexpected registration conflict would take
     * the whole page down; a failed seat must only cost that seat, never boot.
     */
    async function apply(ctx) {
      let seat = null
      try {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'sticky-notes: dictionaries')
        const t = translate(ctx)
        ctx.effect(() => installStyles(), 'sticky-notes: styles')

        // Reserve the `seat` helper only after the first effect proved the
        // context is usable; until then a throw is caught by the outer guard.
        seat = (label, register) => {
          try {
            ctx.effect(register, label)
          } catch (error) {
            console.error(`[sticky-notes] ${label} failed:`, error)
          }
        }

        let remote
        try {
          await ctx.remote.$mount(TYPERT_REMOTE)
          remote = ctx.get('remote.stickyNotes')
        } catch (error) {
          console.error('[sticky-notes] Remote mount failed:', error)
        }
        if (remote === undefined || remote === null) {
          console.error('[sticky-notes] the stickyNotes Remote namespace did not mount; seats stay unmounted')
          return
        }

        const store = createStore(remote)
        ctx.effect(() => () => store.dispose(), 'sticky-notes: store')

        seat('sticky-notes: tab type', () =>
          ctx.sidebarRightTabs.register({
            id: TAB_ID,
            kind: TAB_KIND,
            title: () => t('tab.title'),
            guide: [
              {
                id: TAB_ID,
                order: 55,
                title: () => t('tab.title'),
                description: () => t('tab.description'),
              },
            ],
          }),
        )

        seat('sticky-notes: pane', () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register(
              { name: 'sidebar.right.pane.tab', key: TAB_ID, locale: NS, inject: () => ({}) },
              (props) => h(NotesPane, { ...props, store, ctx, t: props.t ?? t }),
            ),
          ),
        )

        seat('sticky-notes: reply action', () =>
          ctx.slots.inject('conversation.chat.assistant-actions', () =>
            ctx.slots.register(
              { name: 'conversation.chat.assistant-actions', id: 'sticky-notes-capture', order: 25, locale: NS },
              (props) => h(CaptureReplyAction, { ...props, store }),
            ),
          ),
        )

        seat('sticky-notes: header shortcut', () =>
          ctx.slots.inject('conversation.session.header.utilities', () =>
            ctx.slots.register(
              { name: 'conversation.session.header.utilities', id: 'sticky-notes-open', order: 30, locale: NS },
              (props) => h(OpenNotesButton, { ...props, ctx }),
            ),
          ),
        )

        seat('sticky-notes: selection capture', () =>
          ctx.slots.inject('shell.overlay', () =>
            ctx.slots.register(
              { name: 'shell.overlay', id: 'sticky-notes-selection', order: 45, locale: NS },
              (props) => h(SelectionCapture, { ...props, ctx, store }),
            ),
          ),
        )
      } catch (error) {
        // Boot must survive a broken plugin: log and leave the app usable.
        console.error('[sticky-notes] client plugin failed to start:', error)
      }
    }

    return {
      inject,
      apply,
      /** Debug handle for the Host-side smoke test; not part of the plugin surface. */
      __internals: { renderMarkdown, titleOfText, insertIntoComposer },
    }
  },
})
