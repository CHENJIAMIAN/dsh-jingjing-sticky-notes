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
.dsn-row{position:relative;display:flex;align-items:stretch;min-height:96px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;margin:0 0 8px;box-shadow:0 1px 2px rgba(0,0,0,.05);transition:border-color 150ms ease,box-shadow 150ms ease,opacity 150ms ease}
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
.dsn-row-meta{display:flex;align-items:center;gap:6px;margin-top:auto;padding:2px 12px 10px;font-size:11px;color:var(--dsw-alias-label-secondary);min-width:0;overflow:hidden}
.dsn-chip{font-size:10.5px;line-height:16px;padding:0 6px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap;flex:none}
.dsn-chip[data-global]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.dsn-time{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Right action rail: a 2x2 grid inset by the card padding on every side, so the
   dashed rule has equal breathing room on both sides. */
.dsn-row-rail{display:grid;grid-template-columns:repeat(2,34px);grid-template-rows:repeat(2,1fr);flex:none;align-self:stretch;padding:10px 12px;border-left:1px dashed var(--dsw-alias-border-l2);border-radius:0 11px 11px 0;overflow:hidden}
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
      'error.code.bad-id': '便签 ID 无效',
      'error.code.not-found': '便签已不存在，可能已被删除',
      'error.code.empty': '便签内容不能为空',
      'error.code.bad-session': '会话便签需要一个会话 ID',
      'error.code.limit': '便签数量已达上限，请先删除一些',
      'error.code.write-failed': '写入便签失败',
      'error.code.read-failed': '读取便签失败',
      'error.code.list-failed': '加载便签失败',
      'error.code.remove-failed': '删除便签失败',
      'error.code.favorite-failed': '更新收藏状态失败',
      'error.code.scope-failed': '切换可见性失败',
      'error.code.session-not-found': '找不到这个会话的日志',
      'error.code.session-read-failed': '读取会话日志失败',
      'error.code.bad-request': '请求参数不完整',
      'error.code.transport': '与 Host 的通信失败，请重试',
      'default.title': '便签',
      'detail.insertFileText': '便签文件（Markdown）：`{path}`',
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
      'error.code.bad-id': 'Invalid note id',
      'error.code.not-found': 'This note no longer exists',
      'error.code.empty': 'A note cannot be empty',
      'error.code.bad-session': 'A chat note needs a chat id',
      'error.code.limit': 'The note limit is reached; delete some notes first',
      'error.code.write-failed': 'Could not write the note',
      'error.code.read-failed': 'Could not read the note',
      'error.code.list-failed': 'Could not load notes',
      'error.code.remove-failed': 'Could not delete the note',
      'error.code.favorite-failed': 'Could not update the favorite state',
      'error.code.scope-failed': 'Could not change the visibility',
      'error.code.session-not-found': 'This chat log could not be found',
      'error.code.session-read-failed': 'Could not read the chat log',
      'error.code.bad-request': 'The request is missing fields',
      'error.code.transport': 'Lost the connection to the Host; please retry',
      'default.title': 'Note',
      'detail.insertFileText': 'Note file (Markdown): `{path}`',
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

    // ── selection markdown (rendered DOM → Markdown) ───────────────────────
    //
    // A browser selection is a DOM range, not a slice of the Markdown source.
    // DSH renders every reply from Markdown into semantic HTML, so a selected
    // fragment can be rebuilt from the elements it covers: headings, lists,
    // code blocks, tables and inline emphasis survive. This is a reconstruction,
    // not the original source; capturing a whole reply stays exact.

    const BLOCK_HANDLERS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'HR', 'BLOCKQUOTE', 'UL', 'OL', 'TABLE', 'LI'])
    const CONTAINER_TAGS = new Set([
      'ADDRESS', 'ARTICLE', 'ASIDE', 'DETAILS', 'DIV', 'DL', 'DT', 'DD', 'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER',
      'FORM', 'HEADER', 'HGROUP', 'MAIN', 'NAV', 'SECTION', 'SUMMARY', 'TBODY', 'THEAD', 'TFOOT', 'TR', 'TD', 'TH',
    ])
    const SKIP_ATTRIBUTES = ['data-turn-tail', 'data-clock', 'data-dsn-ignore-capture', 'data-turn-usage-details']

    const isElement = (node) => typeof node === 'object' && node !== null && node.nodeType === 1
    const isText = (node) => typeof node === 'object' && node !== null && node.nodeType === 3
    const tagOf = (node) => (typeof node.nodeName === 'string' ? node.nodeName.toUpperCase() : '')
    const classOf = (node) => String(attrOf(node, 'class') ?? '')
    const hasClass = (node, name) => classOf(node).split(/\s+/).includes(name)
    const classIncludes = (node, piece) => classOf(node).includes(piece)
    const childNodesOf = (node) => (node !== null && node !== undefined && node.childNodes !== undefined && node.childNodes !== null ? Array.from(node.childNodes) : [])
    const parentOf = (node) => (node !== null && node !== undefined && node.parentElement !== undefined ? node.parentElement ?? null : null)

    /** Attribute read that never throws on exotic nodes. */
    function attrOf(node, name) {
      try {
        return typeof node.getAttribute === 'function' ? node.getAttribute(name) : null
      } catch {
        return null
      }
    }

    /** UI chrome inside a message must never leak into a note. */
    function isSkipped(node) {
      const tag = tagOf(node)
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE' || tag === 'NOSCRIPT' || tag === 'SVG') return true
      if (tag === 'BUTTON' && !classIncludes(node, 'fileMention')) return true
      if (hasClass(node, 'sr-only') || attrOf(node, 'hidden') !== null) return true
      for (const name of SKIP_ATTRIBUTES) if (attrOf(node, name) !== null) return true
      return false
    }

    /** First descendant element that matches one predicate. */
    function findDescendant(node, predicate) {
      for (const child of childNodesOf(node)) {
        if (!isElement(child)) continue
        if (isSkipped(child)) continue
        if (predicate(child)) return child
        const found = findDescendant(child, predicate)
        if (found !== null) return found
      }
      return null
    }

    /** Concatenated text nodes, ignoring the selection clip. */
    function plainText(node) {
      if (isText(node)) return String(node.nodeValue ?? '')
      let out = ''
      for (const child of childNodesOf(node)) out += plainText(child)
      return out
    }

    /** Concatenated text nodes, clipped to the selection. */
    function rawText(node, clipper) {
      if (isText(node)) return clipper.contains(node) ? clipper.textOf(node) : ''
      if (!isElement(node)) return ''
      let out = ''
      for (const child of childNodesOf(node)) out += rawText(child, clipper)
      return out
    }

    /** Selection-aware view over one DOM range. */
    function clipperFromRange(range) {
      const start = range.startContainer
      const end = range.endContainer
      const contains = (node) => {
        try {
          return range.intersectsNode(node)
        } catch {
          return true
        }
      }
      const textOf = (node) => {
        const value = isText(node) ? String(node.nodeValue ?? '') : ''
        if (node === start && node === end) return value.slice(range.startOffset, range.endOffset)
        if (node === start) return value.slice(range.startOffset)
        if (node === end) return value.slice(0, range.endOffset)
        return value
      }
      return { contains, textOf }
    }

    /** Inline code span with a delimiter that cannot collide with its text. */
    function codeSpan(value) {
      const text = String(value).replace(/\r?\n/g, ' ')
      if (text.length === 0) return ''
      const runs = text.match(/`+/g)
      const longest = runs === null ? 0 : Math.max(...runs.map((run) => run.length))
      const fence = '`'.repeat(longest + 1)
      const padded = text.startsWith('`') || text.endsWith('`') || text.startsWith(' ') || text.endsWith(' ') ? ' ' : ''
      return `${fence}${padded}${text}${padded}${fence}`
    }

    /** Protect a rendered fragment (code, math) from whitespace normalization. */
    function placeholder(state, value) {
      state.tokens.push(value)
      return `\u0000${String(state.tokens.length - 1)}\u0000`
    }

    /** Put protected fragments back once block structure is final. */
    function restoreTokens(markdown, state) {
      return String(markdown).replace(/\u0000(\d+)\u0000/g, (match, index) => state.tokens[Number(index)] ?? '')
    }

    /** Collapse DOM whitespace but keep explicit hard breaks. */
    function normalizeInline(value) {
      let text = String(value ?? '')
      text = text.replace(/[ \t\u00a0]+/g, ' ')
      text = text.replace(/[ \t]*\n[ \t]*/g, '\n')
      text = text.replace(/\n{3,}/g, '\n\n')
      text = text.replace(/\u0001/g, '  \n')
      return text.replace(/^[ \t\n]+|[ \t\n]+$/g, '')
    }

    /** The Tex source behind one KaTeX element. */
    function mathTex(node) {
      const annotation = findDescendant(node, (child) => tagOf(child) === 'ANNOTATION' && String(attrOf(child, 'encoding') ?? '').includes('tex'))
      return annotation === null ? null : plainText(annotation).trim()
    }

    /** Language tag of a rendered code block, when one is exposed. */
    function codeLanguage(node) {
      let scope = node
      let walker = node
      while (walker !== null && !classIncludes(walker, 'md-code-block')) walker = parentOf(walker)
      if (walker !== null) scope = walker
      const banner = findDescendant(scope, (child) => attrOf(child, 'data-code-block-banner') !== null)
      if (banner !== null) {
        const label = findDescendant(banner, (child) => classIncludes(child, 'infostring') || classIncludes(child, 'language'))
        if (label !== null) {
          const text = plainText(label).trim()
          if (text.length > 0) return text.split(/\s+/)[0]
        }
      }
      const code = findDescendant(scope, (child) => tagOf(child) === 'CODE')
      const match = code === null ? null : /language-([\w#+.-]+)/.exec(classOf(code))
      return match === null ? '' : match[1]
    }

    /** Fenced code block, clipped to the selected lines. */
    function codeBlockMarkdown(node, clipper) {
      const pre = tagOf(node) === 'PRE' ? node : findDescendant(node, (child) => tagOf(child) === 'PRE')
      if (pre === null) return ''
      const language = codeLanguage(node)
      let code = rawText(pre, clipper).replace(/\r\n/g, '\n')
      code = code.replace(/\n$/, '')
      if (code.replace(/\s/g, '').length === 0) return ''
      const runs = code.match(/`+/g)
      const longest = runs === null ? 0 : Math.max(...runs.map((run) => run.length))
      const fence = '`'.repeat(Math.max(3, longest + 1))
      return `${fence}${language}\n${code}\n${fence}`
    }

    /** Inline children of one element as Markdown. */
    function inlineMarkdown(nodes, clipper, state) {
      let out = ''
      for (const node of nodes) out += inlineNode(node, clipper, state)
      return out
    }

    /** One inline node as Markdown. */
    function inlineNode(node, clipper, state) {
      if (isText(node)) return clipper.contains(node) ? String(clipper.textOf(node) ?? '') : ''
      if (!isElement(node) || isSkipped(node) || !clipper.contains(node)) return ''
      const tag = tagOf(node)
      if (hasClass(node, 'katex-display')) {
        const tex = mathTex(node)
        return tex === null ? '' : placeholder(state, `$$${tex}$$`)
      }
      if (hasClass(node, 'katex')) {
        const tex = mathTex(node)
        return tex === null ? '' : placeholder(state, `$${tex}$`)
      }
      if (tag === 'BR') return '\u0001'
      if (tag === 'STRONG' || tag === 'B') return `**${inlineMarkdown(childNodesOf(node), clipper, state)}**`
      if (tag === 'EM' || tag === 'I') return `*${inlineMarkdown(childNodesOf(node), clipper, state)}*`
      if (tag === 'DEL' || tag === 'S' || tag === 'STRIKE') return `~~${inlineMarkdown(childNodesOf(node), clipper, state)}~~`
      if (tag === 'CODE') {
        const value = rawText(node, clipper)
        return value.length === 0 ? '' : placeholder(state, codeSpan(value))
      }
      if (tag === 'A') {
        const href = attrOf(node, 'href')
        const label = inlineMarkdown(childNodesOf(node), clipper, state)
        if (href === null || !safeUrl(href)) return label
        return `[${label.length > 0 ? label : href}](${href.replace(/ /g, '%20')})`
      }
      if (tag === 'IMG') {
        const alt = attrOf(node, 'alt') ?? ''
        const src = attrOf(node, 'src')
        if (src === null || /^(blob:|data:)/i.test(src)) return alt
        return `![${alt}](${src})`
      }
      if (tag === 'INPUT') return ''
      if (tag === 'BUTTON' && classIncludes(node, 'fileMention')) {
        const path = plainText(node).trim()
        return path.length === 0 ? '' : placeholder(state, codeSpan(path))
      }
      return inlineMarkdown(childNodesOf(node), clipper, state)
    }

    /** Whether a node is a block this converter serializes on its own. */
    function isBlockHandler(node) {
      return isElement(node) && (BLOCK_HANDLERS.has(tagOf(node)) || classIncludes(node, 'md-code-block'))
    }

    /** Whether a node lays out blocks as children (plain wrapper). */
    function isContainer(node) {
      return isElement(node) && CONTAINER_TAGS.has(tagOf(node))
    }

    /** Marker of one list item, resolved from its parent list when possible. */
    function markerOf(item) {
      const parent = parentOf(item)
      if (parent !== null && tagOf(parent) === 'OL') {
        const start = Math.max(1, Number(attrOf(parent, 'start')) || 1)
        const index = Array.from(parent.children ?? []).indexOf(item)
        return `${String(start + Math.max(0, index))}. `
      }
      return '- '
    }

    /** Body of one list item, without its marker. */
    function listItemBody(item, clipper, state) {
      const checkbox = findDescendant(item, (child) => tagOf(child) === 'INPUT' && String(attrOf(child, 'type') ?? '').toLowerCase() === 'checkbox')
      const checked = checkbox !== null && (checkbox.checked === true || attrOf(checkbox, 'checked') !== null)
      const body = blocksMarkdown(childNodesOf(item), clipper, state)
      if (body.length === 0) return ''
      return checkbox === null ? body : `${checked ? '[x]' : '[ ]'} ${body}`
    }

    /** Attach a list marker and indent the continuation lines. */
    function indentListItem(body, marker) {
      const pad = ' '.repeat(marker.length)
      return body
        .split('\n')
        .map((line, index) => (index === 0 ? marker + line : line.length > 0 ? pad + line : ''))
        .join('\n')
    }

    /** One list as Markdown, keeping numbering across partial selections. */
    function listMarkdown(list, clipper, state) {
      const ordered = tagOf(list) === 'OL'
      const start = Math.max(1, Number(attrOf(list, 'start')) || 1)
      const lines = []
      let index = 0
      for (const child of childNodesOf(list)) {
        if (!isElement(child) || tagOf(child) !== 'LI') continue
        const marker = ordered ? `${String(start + index)}. ` : '- '
        index += 1
        if (!clipper.contains(child)) continue
        const body = listItemBody(child, clipper, state)
        if (body.length > 0) lines.push(indentListItem(body, marker))
      }
      return lines.join('\n')
    }

    /** Cells of one table row, in order. */
    function rowCells(row) {
      return childNodesOf(row).filter((cell) => isElement(cell) && (tagOf(cell) === 'TD' || tagOf(cell) === 'TH'))
    }

    /** Every row below a table or a section wrapper, in document order. */
    function tableRows(node, rows) {
      for (const child of childNodesOf(node)) {
        if (!isElement(child)) continue
        if (tagOf(child) === 'TR') rows.push(child)
        else tableRows(child, rows)
      }
      return rows
    }

    /** One table cell as Markdown cell text. */
    function tableCellText(cell, clipper, state) {
      return normalizeInline(inlineMarkdown(childNodesOf(cell), clipper, state))
        .replace(/\n+/g, ' ')
        .replace(/\|/g, '\\|')
    }

    /** Alignment marker of one header cell. */
    function tableAlign(cell) {
      const style = String(attrOf(cell, 'style') ?? '')
      const match = /text-align\s*:\s*(left|center|right)/i.exec(style)
      if (match === null) return '---'
      const align = match[1].toLowerCase()
      if (align === 'center') return ':---:'
      return align === 'right' ? '---:' : ':---'
    }

    /** One table as GFM Markdown; partial selections re-use the first row as header. */
    function tableMarkdown(table, clipper, state) {
      const selected = tableRows(table, []).filter((row) => clipper.contains(row))
      if (selected.length === 0) return ''
      const header = rowCells(selected[0])
      const body = selected.slice(1).map((row) => rowCells(row))
      const width = Math.max(header.length, ...body.map((cells) => cells.length), 1)
      const renderRow = (cells) => {
        const parts = []
        for (let column = 0; column < width; column += 1) {
          const cell = cells[column]
          parts.push(cell === undefined ? '' : tableCellText(cell, clipper, state))
        }
        return `| ${parts.join(' | ')} |`
      }
      const separators = []
      for (let column = 0; column < width; column += 1) {
        const cell = header[column]
        separators.push(cell === undefined ? '---' : tableAlign(cell))
      }
      const lines = [renderRow(header), `| ${separators.join(' | ')} |`]
      for (const cells of body) lines.push(renderRow(cells))
      return lines.join('\n')
    }

    /** Prefix every line of a block quote body. */
    function prefixQuote(markdown) {
      if (markdown.length === 0) return markdown
      return markdown
        .split('\n')
        .map((line) => (line.length > 0 ? `> ${line}` : '>'))
        .join('\n')
    }

    /** One block element as Markdown. */
    function blockMarkdown(node, clipper, state) {
      const tag = tagOf(node)
      if (tag === 'PRE' || classIncludes(node, 'md-code-block')) return codeBlockMarkdown(node, clipper)
      if (tag === 'HR') return '---'
      if (tag === 'BLOCKQUOTE') return prefixQuote(blocksMarkdown(childNodesOf(node), clipper, state))
      if (tag === 'UL' || tag === 'OL') return listMarkdown(node, clipper, state)
      if (tag === 'TABLE') return tableMarkdown(node, clipper, state)
      if (tag === 'LI') {
        const body = listItemBody(node, clipper, state)
        return body.length === 0 ? '' : indentListItem(body, markerOf(node))
      }
      const inline = normalizeInline(inlineMarkdown(childNodesOf(node), clipper, state))
      if (inline.length === 0) return ''
      if (/^H[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag.slice(1)))} ${inline.replace(/\n+/g, ' ')}`
      return inline
    }

    /** A run of block children as Markdown blocks separated by blank lines. */
    function blocksMarkdown(nodes, clipper, state) {
      const blocks = []
      let inlineRun = []
      const flush = () => {
        if (inlineRun.length === 0) return
        const text = normalizeInline(inlineMarkdown(inlineRun, clipper, state))
        if (text.length > 0) blocks.push(text)
        inlineRun = []
      }
      for (const node of nodes) {
        if (isText(node)) {
          if (clipper.contains(node)) inlineRun.push(node)
          continue
        }
        if (!isElement(node) || isSkipped(node) || !clipper.contains(node)) continue
        if (isBlockHandler(node)) {
          flush()
          const block = blockMarkdown(node, clipper, state)
          if (block.length > 0) blocks.push(block)
          continue
        }
        if (isContainer(node)) {
          flush()
          const block = blocksMarkdown(childNodesOf(node), clipper, state)
          if (block.length > 0) blocks.push(block)
          continue
        }
        if (hasClass(node, 'katex-display')) {
          flush()
          const math = inlineNode(node, clipper, state)
          if (math.length > 0) blocks.push(math)
          continue
        }
        inlineRun.push(node)
      }
      flush()
      return blocks.join('\n\n')
    }

    /** Nearest block the converter can serialize on its own. */
    function closestBlockHandler(element) {
      let node = element
      while (isElement(node)) {
        const tag = tagOf(node)
        if (tag === 'TD' || tag === 'TH') return null
        if (isBlockHandler(node)) return node
        node = parentOf(node)
      }
      return null
    }

    /** Block wrappers around a selected block, innermost first. */
    function ancestorWraps(element) {
      const wraps = []
      let node = parentOf(element)
      while (isElement(node)) {
        const tag = tagOf(node)
        if (tag === 'BLOCKQUOTE') wraps.push({ kind: 'quote' })
        else if (tag === 'LI') wraps.push({ kind: 'item', marker: markerOf(node) })
        node = parentOf(node)
      }
      return wraps
    }

    /** Apply one ancestor wrapper to a finished block. */
    function applyWrap(markdown, wrap) {
      if (wrap.kind === 'quote') return prefixQuote(markdown)
      const pad = ' '.repeat(wrap.marker.length)
      return markdown
        .split('\n')
        .map((line, index) => (index === 0 ? wrap.marker + line : line.length > 0 ? pad + line : ''))
        .join('\n')
    }

    /** Rebuild Markdown from a root node and a selection-aware clipper. */
    function domToMarkdown(root, clipper) {
      if (root === null || root === undefined) return ''
      const state = { tokens: [] }
      const element = isElement(root) ? root : isText(root) ? parentOf(root) : null
      if (!isElement(element)) return isText(root) ? normalizeInline(clipper.textOf(root)) : ''
      const block = closestBlockHandler(element)
      let markdown = block === null ? blocksMarkdown(childNodesOf(element), clipper, state) : blockMarkdown(block, clipper, state)
      if (markdown.length === 0) return ''
      for (const wrap of ancestorWraps(block === null ? element : block)) markdown = applyWrap(markdown, wrap)
      return restoreTokens(markdown, state).trim()
    }

    /**
     * Rebuild the Markdown of one browser selection. Returns '' when the range
     * cannot be interpreted; callers fall back to the plain selected text.
     */
    function selectionToMarkdown(range) {
      if (range === null || range === undefined) return ''
      const root = range.commonAncestorContainer
      const element = isElement(root) ? root : isText(root) ? parentOf(root) : null
      if (!isElement(element)) return ''
      try {
        // Only the chat transcript carries rendered Markdown; anything else
        // (sidebar, dialogs, our own panes) keeps the plain-text capture.
        if (typeof element.closest === 'function' && element.closest('[data-conversation-scroll]') === null) return ''
        return domToMarkdown(root, clipperFromRange(range))
      } catch (error) {
        console.error('[sticky-notes] selection markdown failed:', error)
        return ''
      }
    }

    /** First meaningful line of a selection, for the note title. */
    function titleOfText(text, fallback = '便签') {
      const line = String(text ?? '')
        .split(/\r?\n/)
        .map((value) => value.replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/, '').trim())
        .find((value) => value.length > 0)
      if (line === undefined) return fallback
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

    /**
     * Turn a failed Result into one localized message. The Host reports a
     * stable `code`, so the browser owns the wording; its own message is only
     * the fallback for codes this client does not know yet.
     */
    function failureText(result, t) {
      const code = result?.error?.code
      if (typeof code === 'string' && code.length > 0) {
        const key = `error.code.${code}`
        const translated = t(key)
        if (typeof translated === 'string' && translated.length > 0 && translated !== key) return translated
      }
      return result?.error?.message || t('error.generic')
    }

    /** Active UI locale id ('zh' | 'en'), used for Host-generated note content. */
    function currentLocale(ctx) {
      try {
        const active = ctx.get('locale')?.getLocale?.()?.active
        return typeof active === 'string' && active.length > 0 ? active : 'en'
      } catch {
        return 'en'
      }
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
        async captureSession(sessionId, locale) {
          try {
            const carried = await remote.captureSession({ sessionId, locale })
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
        const result = await store.captureSession(sessionId, currentLocale(ctx))
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
              onClick: () => insert(t('detail.insertFileText', { path: note.path })),
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
     * pressing the button cannot lose it to a focus change. Selections inside
     * the chat transcript are rebuilt as Markdown from the rendered DOM.
     */
    function SelectionCapture({ ctx, store, t }) {
      const [anchor, setAnchor] = useState(null)
      const [payload, setPayload] = useState(null)
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
          let range
          let rect
          try {
            range = selection.getRangeAt(0)
            rect = range.getBoundingClientRect()
          } catch {
            setAnchor(null)
            return
          }
          if (rect.width === 0 && rect.height === 0) {
            setAnchor(null)
            return
          }
          let markdown = ''
          try {
            markdown = selectionToMarkdown(range)
          } catch (error) {
            console.error('[sticky-notes] selection markdown failed:', error)
          }
          const trimmed = markdown.trim()
          setPayload({ text: raw, markdown: trimmed.length > 0 ? trimmed : raw })
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
                  if (payload === null) {
                    setToast(t('capture.needSelection'))
                    return
                  }
                  const sessionId = currentSessionId(ctx)
                  if (sessionId === null) {
                    setToast(t('capture.needSession'))
                    return
                  }
                  const body = payload.markdown.length > 0 ? payload.markdown : payload.text
                  const result = await store.create({
                    title: titleOfText(payload.text, t('default.title')),
                    body,
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
      __internals: { renderMarkdown, selectionToMarkdown, domToMarkdown, titleOfText, insertIntoComposer, failureText },
    }
  },
})
