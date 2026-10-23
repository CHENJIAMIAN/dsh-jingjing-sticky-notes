// dsh-jingjing-sticky-notes — Host half.
//
// A storage sidecar for the browser panel: it owns Markdown notes in two kinds
// of stores — a global directory and one `.dsh-notes` directory per Session
// project — exposes list/read/create/update/remove over Typert Remote, and can
// capture text straight from the durable Session log so the client never has
// to scrape the DOM. It never creates or resumes an Agent.
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { deriveEventMessage, isAppendSurfaceEvent } from '@deepseek-ai/dsh-session/surface'
import {
  clampTitle,
  compareNotes,
  defaultRoot,
  emptyTrash as emptyStoredTrash,
  findNote,
  findNoteIn,
  isNoteId,
  moveNoteToTrash,
  newNoteId,
  projectRootFor,
  readAllNotes,
  readNotesFrom,
  readTrashedNotes,
  removeNote,
  restoreTrashedNote,
  sanitizeProjectDirectory,
  titleFromBody,
  toDetail,
  toSummary,
  writeNote,
} from './lib/store.js'

/** Maximum characters stored in one note body. */
const MAX_BODY = 600000
/** Maximum characters captured from one Session transcript. */
const MAX_TRANSCRIPT = 400000
/** Maximum messages folded into one transcript note. */
const MAX_TRANSCRIPT_MESSAGES = 200

/** Freeze one success branch. */
function ok(value) {
  return { ok: true, value }
}

/** Build one business-failure branch. */
function fail(code, message) {
  return { ok: false, error: { code, message } }
}

/** Coerce unknown input to a bounded string. */
function textOf(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

/** Visible text blocks of one derived message, joined as Markdown paragraphs. */
function messageText(message) {
  const parts = []
  for (const block of message?.content ?? []) {
    if (block.type === 'text' && typeof block.text === 'string' && block.text.trim().length > 0) parts.push(block.text)
  }
  return parts.join('\n\n')
}

let StickyNotesService = class StickyNotesService extends TypertRemoteService {
  static inject = ['sessionPersistence']

  constructor(ctx, config) {
    super(ctx, 'stickyNotes')
    this.root = textOf(config?.directory, 1024).trim() || defaultRoot()
    this.projectDirectory = sanitizeProjectDirectory(textOf(config?.projectDirectory, 256))
    const configuredMax = Number(config?.maxNotes)
    this.maxNotes = Number.isSafeInteger(configuredMax) && configuredMax > 0 ? configuredMax : 2000
    this.operationTail = Promise.resolve()
    /** Session id → project store root; only successful resolutions are cached. */
    this.projectRoots = new Map()
  }

  /** Note store root of the project that owns one Session, or null when unknown. */
  async projectRootOf(sessionId) {
    const id = textOf(sessionId, 160)
    if (id.length === 0) return null
    const cached = this.projectRoots.get(id)
    if (cached !== undefined) return cached
    let root = null
    try {
      // `stat` returns the immutable Session header without reading the log.
      const snapshot = await this.ctx.sessionPersistence.stat(id)
      root = projectRootFor(snapshot?.header?.cwd, this.projectDirectory)
    } catch {
      root = null
    }
    if (root !== null) this.projectRoots.set(id, root)
    return root
  }

  /** Stores one Session can see: its project first, then the global store. */
  async rootsFor(sessionId) {
    const project = await this.projectRootOf(sessionId)
    return project === null ? [this.root] : [project, this.root]
  }

  /**
   * Sessions the Workspace registry reports as archived, or null when this Host
   * has no Workspace service (the notes panel then hides archive affordances).
   */
  archivedSessionIds() {
    try {
      const registry = this.ctx.get('workspaceRegistry')
      const ids = registry?.archivedSessionIds
      return Array.isArray(ids) ? new Set(ids.map((id) => String(id))) : null
    } catch {
      return null
    }
  }

  /**
   * Every note the workspace surface shows for one Session: all notes of its
   * project store (any Session), plus global notes, plus legacy session notes
   * that live in the global store but belong to this workspace. Legacy files
   * are included so a pre-1.5 or write-fallback capture never disappears.
   */
  async workspaceNotes(sessionId) {
    const project = await this.projectRootOf(sessionId)
    const notes = []
    const seen = new Set()
    if (project !== null) {
      for (const note of await readAllNotes(project)) {
        seen.add(note.id)
        notes.push(note)
      }
    }
    for (const note of await readAllNotes(this.root)) {
      if (seen.has(note.id)) continue
      if (note.scope === 'global') {
        notes.push(note)
        continue
      }
      if (note.sessionId === null) continue
      // A session note still stored globally stays visible in the Session that
      // owns it, and joins the workspace once its project can be resolved.
      if (note.sessionId === sessionId) {
        notes.push(note)
        continue
      }
      if (project !== null && (await this.projectRootOf(note.sessionId)) === project) notes.push(note)
    }
    notes.sort(compareNotes)
    return { project, notes }
  }

  /**
   * Every note in one workspace store and the global store. The client splits
   * the result by `scope`: session notes are the workspace surface, global
   * notes are the cross-workspace surface.
   */
  async list(request) {
    try {
      const sessionId = textOf(request?.sessionId, 160) || null
      const { notes } = await this.workspaceNotes(sessionId)
      return ok({ notes: notes.map((note) => toSummary(note)) })
    } catch (error) {
      return fail('list-failed', errorMessage(error))
    }
  }

  /** Store one note belongs in, from its visibility and owning Session. */
  async targetRootFor(note, sessionId) {
    if (note.scope === 'global') return this.root
    const owner = note.sessionId ?? (textOf(sessionId, 160) || null)
    const project = owner === null ? null : await this.projectRootOf(owner)
    return project ?? this.root
  }

  /** Write one note to its target store and drop any file it no longer lives in. */
  async commitNote(existing, note, targetRoot) {
    const path = await writeNote(targetRoot, note)
    if (typeof existing.path === 'string' && existing.path !== path) {
      await removeNote(existing.path)
    }
    return path
  }

  /** One note with its full Markdown body. */
  async read(request) {
    const id = textOf(request?.id, 64)
    if (!isNoteId(id)) return fail('bad-id', '便签 ID 无效')
    try {
      const sessionId = textOf(request?.sessionId, 160) || null
      const note = await findNoteIn(await this.rootsFor(sessionId), id)
      if (note === undefined) return fail('not-found', '便签已不存在，可能已被删除')
      return ok({ note: toDetail(note) })
    } catch (error) {
      return fail('read-failed', errorMessage(error))
    }
  }

  /** Create one note from text the caller already holds (a selection, an editor draft). */
  create(request) {
    return this.enqueue(async () => {
      const body = textOf(request?.body, MAX_BODY)
      if (body.trim().length === 0) return fail('empty', '便签内容不能为空')
      const scope = request?.scope === 'global' ? 'global' : 'session'
      const sessionId = textOf(request?.sessionId, 160) || null
      if (scope === 'session' && sessionId === null) return fail('bad-session', '会话便签需要一个会话 ID')
      // Session notes follow their project; an unknown workspace falls back to
      // the global store so a capture is never lost.
      const project = scope === 'session' ? await this.projectRootOf(sessionId) : null
      const targetRoot = project ?? this.root
      const existing = await readNotesFrom(targetRoot === this.root ? [this.root] : [targetRoot, this.root])
      if (existing.length >= this.maxNotes) {
        return fail('limit', `便签数量已达到上限（${String(this.maxNotes)}），请先删除一些便签`)
      }
      const now = Date.now()
      const title = clampTitle(textOf(request?.title, 200).trim() || titleFromBody(body))
      const note = {
        id: newNoteId(),
        title,
        scope,
        favorite: request?.favorite === true,
        sessionId,
        sessionTitle: textOf(request?.sessionTitle, 200) || null,
        createdAt: now,
        updatedAt: now,
        body,
      }
      try {
        const path = await writeNote(targetRoot, note)
        return ok({ note: toSummary({ ...note, path }) })
      } catch (error) {
        return fail('write-failed', errorMessage(error))
      }
    })
  }

  /** Replace one note's title, body, and visibility. */
  update(request) {
    return this.enqueue(async () => {
      const id = textOf(request?.id, 64)
      if (!isNoteId(id)) return fail('bad-id', '便签 ID 无效')
      const body = textOf(request?.body, MAX_BODY)
      if (body.trim().length === 0) return fail('empty', '便签内容不能为空')
      try {
        const sessionId = textOf(request?.sessionId, 160) || null
        const existing = await findNoteIn(await this.rootsFor(sessionId), id)
        if (existing === undefined) return fail('not-found', '便签已不存在，可能已被删除')
        const note = {
          ...existing,
          title: clampTitle(textOf(request?.title, 200).trim() || titleFromBody(body)),
          body,
          scope: request?.scope === 'global' ? 'global' : 'session',
          favorite: typeof request?.favorite === 'boolean' ? request.favorite : existing.favorite === true,
          updatedAt: Math.max(Date.now(), existing.updatedAt),
        }
        const targetRoot = await this.targetRootFor(note, sessionId)
        const path = await this.commitNote(existing, note, targetRoot)
        return ok({ note: toSummary({ ...note, path }) })
      } catch (error) {
        return fail('write-failed', errorMessage(error))
      }
    })
  }

  /**
   * Move one note into its store's recycle bin. Named `removeNote` rather than
   * `remove`: the client Remote namespace service already owns a `remove`
   * method, and a descriptor named `remove` is refused when the contribution
   * mounts. The note can be restored from the recap page until the bin is
   * emptied, which is the only operation that unlinks files.
   */
  removeNote(request) {
    return this.enqueue(async () => {
      const id = textOf(request?.id, 64)
      if (!isNoteId(id)) return fail('bad-id', '便签 ID 无效')
      try {
        const sessionId = textOf(request?.sessionId, 160) || null
        const existing = await findNoteIn(await this.rootsFor(sessionId), id)
        if (existing !== undefined) await moveNoteToTrash(existing)
        return ok({ removed: true })
      } catch (error) {
        return fail('trash-failed', errorMessage(error))
      }
    })
  }

  /** Every note currently in the workspace and global recycle bins. */
  async listTrash(request) {
    try {
      const sessionId = textOf(request?.sessionId, 160) || null
      const project = await this.projectRootOf(sessionId)
      const notes = []
      const seen = new Set()
      for (const note of project === null ? [] : await readTrashedNotes(project)) {
        seen.add(note.id)
        notes.push({ ...toSummary(note), origin: 'workspace' })
      }
      for (const note of await readTrashedNotes(this.root)) {
        if (seen.has(note.id)) continue
        notes.push({ ...toSummary(note), origin: 'global' })
      }
      notes.sort((left, right) => (right.trashedAt ?? 0) - (left.trashedAt ?? 0) || right.updatedAt - left.updatedAt)
      return ok({ notes })
    } catch (error) {
      return fail('list-trash-failed', errorMessage(error))
    }
  }

  /** Restore one trashed note into the store it was deleted from. */
  restoreNote(request) {
    return this.enqueue(async () => {
      const id = textOf(request?.id, 64)
      if (!isNoteId(id)) return fail('bad-id', '便签 ID 无效')
      try {
        const sessionId = textOf(request?.sessionId, 160) || null
        const project = await this.projectRootOf(sessionId)
        const roots = project === null ? [this.root] : [project, this.root]
        for (const root of roots) {
          const trashed = (await readTrashedNotes(root)).find((note) => note.id === id)
          if (trashed === undefined) continue
          if ((await findNote(root, id)) !== undefined) {
            return fail('exists', '同一位置已有一条相同 ID 的便签，无法恢复')
          }
          const path = await restoreTrashedNote(root, trashed)
          return ok({ note: toSummary({ ...trashed, trashedAt: null, path }) })
        }
        return fail('not-found', '回收站中没有这条便签')
      } catch (error) {
        return fail('restore-failed', errorMessage(error))
      }
    })
  }

  /**
   * Permanently unlink every note in one recycle bin: the workspace bin, the
   * global bin, or both. This is the only irreversible notes operation.
   */
  emptyTrash(request) {
    return this.enqueue(async () => {
      const origin = request?.origin === 'workspace' || request?.origin === 'global' ? request.origin : 'all'
      try {
        const sessionId = textOf(request?.sessionId, 160) || null
        const project = await this.projectRootOf(sessionId)
        if (origin === 'workspace' && project === null) {
          return fail('no-workspace', '当前会话没有可识别的工作区，无法清空工作区回收站')
        }
        const roots = []
        if (origin !== 'global' && project !== null) roots.push(project)
        if (origin !== 'workspace') roots.push(this.root)
        let removed = 0
        let failed = 0
        for (const root of roots) {
          const result = await emptyStoredTrash(root)
          removed += result.removed
          failed += result.failed
        }
        return ok({ removed, failed })
      } catch (error) {
        return fail('purge-failed', errorMessage(error))
      }
    })
  }

  /**
   * Move every note of an archived Session in this workspace into the recycle
   * bin. The archive set is read from this Host's Workspace registry, never
   * from the client, so a stale panel cannot delete the wrong notes.
   */
  trashArchived(request) {
    return this.enqueue(async () => {
      try {
        const sessionId = textOf(request?.sessionId, 160) || null
        const archived = this.archivedSessionIds()
        if (archived === null) {
          return fail('archive-unavailable', '这个环境没有工作区归档信息，无法按归档批量清理')
        }
        const { project, notes } = await this.workspaceNotes(sessionId)
        if (project === null) {
          return fail('no-workspace', '当前会话没有可识别的工作区，无法清理归档便签')
        }
        let trashed = 0
        let failed = 0
        for (const note of notes) {
          if (note.scope !== 'session' || note.sessionId === null || !archived.has(note.sessionId)) continue
          try {
            await moveNoteToTrash(note)
            trashed += 1
          } catch {
            failed += 1
          }
        }
        return ok({ trashed, failed })
      } catch (error) {
        return fail('trash-archive-failed', errorMessage(error))
      }
    })
  }

  /** Pin or unpin one note without rewriting its body. */
  setFavorite(request) {
    return this.enqueue(async () => {
      const id = textOf(request?.id, 64)
      if (!isNoteId(id)) return fail('bad-id', '便签 ID 无效')
      try {
        const sessionId = textOf(request?.sessionId, 160) || null
        const existing = await findNoteIn(await this.rootsFor(sessionId), id)
        if (existing === undefined) return fail('not-found', '便签已不存在，可能已被删除')
        // Pinning is metadata only: it must not look like a content edit.
        const note = { ...existing, favorite: request?.favorite === true }
        const path = await this.commitNote(existing, note, await this.targetRootFor(note, sessionId))
        return ok({ note: toSummary({ ...note, path }) })
      } catch (error) {
        return fail('favorite-failed', errorMessage(error))
      }
    })
  }

  /** Move one note between project and global visibility without rewriting its body. */
  setScope(request) {
    return this.enqueue(async () => {
      const id = textOf(request?.id, 64)
      if (!isNoteId(id)) return fail('bad-id', '便签 ID 无效')
      try {
        const sessionId = textOf(request?.sessionId, 160) || null
        const existing = await findNoteIn(await this.rootsFor(sessionId), id)
        if (existing === undefined) return fail('not-found', '便签已不存在，可能已被删除')
        const note = { ...existing, scope: request?.scope === 'global' ? 'global' : 'session' }
        const path = await this.commitNote(existing, note, await this.targetRootFor(note, sessionId))
        return ok({ note: toSummary({ ...note, path }) })
      } catch (error) {
        return fail('scope-failed', errorMessage(error))
      }
    })
  }

  /** Capture one finalized assistant message from the durable Session log. */
  async captureMessage(request) {
    const sessionId = textOf(request?.sessionId, 160)
    const messageId = textOf(request?.messageId, 160)
    if (sessionId.length === 0 || messageId.length === 0) return fail('bad-request', '缺少会话或消息 ID')
    const read = await this.readSessionEvents(sessionId)
    if (!read.ok) return read
    let body = ''
    for (const event of read.value) {
      if (event.type !== 'assistant/message' || !isAppendSurfaceEvent(event)) continue
      const message = deriveEventMessage(event)
      if (message?.role === 'assistant' && message.id === messageId) {
        body = messageText(message)
        break
      }
    }
    if (body.trim().length === 0) return fail('not-found', '这条回复尚未落盘，或没有可保存的文字内容')
    return this.create({ title: titleFromBody(body), body, scope: 'session', sessionId })
  }

  /** Capture the visible user/assistant transcript of one Session as a single note. */
  async captureSession(request) {
    const sessionId = textOf(request?.sessionId, 160)
    if (sessionId.length === 0) return fail('bad-request', '缺少会话 ID')
    // The client passes its UI locale so the generated note reads in that
    // language; an old client without the field keeps the Chinese default.
    const copy = transcriptCopy(request?.locale)
    const read = await this.readSessionEvents(sessionId)
    if (!read.ok) return read
    const sections = []
    let length = 0
    let captured = 0
    for (const event of read.value) {
      if (captured >= MAX_TRANSCRIPT_MESSAGES) break
      if (event.type !== 'user/message' && event.type !== 'assistant/message') continue
      if (!isAppendSurfaceEvent(event)) continue
      const message = deriveEventMessage(event)
      if (message === null) continue
      const role = message.role
      if (role !== 'user' && role !== 'assistant') continue
      const text = messageText(message).trim()
      if (text.length === 0) continue
      const heading = role === 'user' ? copy.userHeading : copy.assistantHeading
      const block = `${heading}\n\n${text}`
      if (length + block.length > MAX_TRANSCRIPT) break
      sections.push(block)
      length += block.length
      captured += 1
    }
    if (sections.length === 0) return fail('not-found', copy.emptyMessage)
    const body = `> ${copy.excerpt} · ${formatTime(Date.now())}\n\n${sections.join('\n\n')}`
    return this.create({ title: `${copy.title} ${formatTime(Date.now())}`, body, scope: 'session', sessionId })
  }

  /** Read a Session's complete event log through a short-lived read handle. */
  async readSessionEvents(sessionId) {
    try {
      const handle = await this.ctx.sessionPersistence.open(sessionId, 'read')
      try {
        const result = await handle.read()
        return ok(result.events)
      } finally {
        await handle.close()
      }
    } catch (error) {
      const name = error?.constructor?.name
      if (name === 'SessionPersistenceNotFoundError' || error?.code === 'ENOENT') {
        return fail('session-not-found', '找不到这个会话的持久化日志')
      }
      return fail('session-read-failed', errorMessage(error))
    }
  }

  /** Queue one complete read/compare/write mutation behind the previous one. */
  enqueue(operation) {
    const result = this.operationTail.then(operation, operation)
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
}

/** Human-readable message for any thrown value. */
function errorMessage(error) {
  if (error instanceof Error && error.message.length > 0) return error.message
  return String(error)
}

/** Copy used for transcript notes, keyed by the caller's UI language. */
const TRANSCRIPT_COPY = {
  zh: {
    userHeading: '### 你',
    assistantHeading: '### 助手',
    excerpt: '会话摘录',
    title: '对话摘录',
    emptyMessage: '这个会话还没有可保存的对话内容',
  },
  en: {
    userHeading: '### You',
    assistantHeading: '### Assistant',
    excerpt: 'Conversation excerpt',
    title: 'Conversation excerpt',
    emptyMessage: 'This conversation has no saved messages yet',
  },
}

/** Pick transcript copy for a UI locale id; unknown or absent keeps Chinese. */
function transcriptCopy(locale) {
  const raw = textOf(locale, 32).trim().toLowerCase()
  if (raw.length === 0) return TRANSCRIPT_COPY.zh
  return raw.startsWith('zh') ? TRANSCRIPT_COPY.zh : TRANSCRIPT_COPY.en
}

/** `YYYY-MM-DD HH:mm` in the Host's local time, for captured-note titles. */
function formatTime(time) {
  const date = new Date(time)
  const pad = (value) => String(value).padStart(2, '0')
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ── Remote markers ──────────────────────────────────────────────────────────
//
// The equivalent of @Remote('list') without decorator syntax: Remote(name)
// returns a standard method decorator, and running its initializer against a
// dummy object whose prototype is the service prototype writes exactly the
// marker table the real decorators produce.

// Method names are part of the wire contract. `remove` is reserved by the
// client Remote namespace service, so the delete endpoint is `removeNote`.
for (const method of [
  'list',
  'read',
  'create',
  'update',
  'removeNote',
  'listTrash',
  'restoreNote',
  'emptyTrash',
  'trashArchived',
  'setFavorite',
  'setScope',
  'captureMessage',
  'captureSession',
]) {
  Remote(method)(undefined, {
    private: false,
    static: false,
    name: method,
    addInitializer(init) {
      init.call(Object.create(StickyNotesService.prototype))
    },
  })
}

export { StickyNotesService, StickyNotesService as default }
