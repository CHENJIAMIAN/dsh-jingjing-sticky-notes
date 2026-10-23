// dsh-jingjing-sticky-notes — the local Markdown note store.
//
// One note is one `.md` file with a small YAML-ish frontmatter block, so the
// store stays readable and editable outside DSH (and friendly to Git). The
// files are the only source of truth: every read re-scans the directory, so a
// hand edit shows up on the next refresh.
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'

/** Accepted shape of a note id, which also keeps wire input away from paths. */
const NOTE_ID = /^[0-9a-f]{12}$/

/** Project directory used when the bundle row leaves `projectDirectory` empty. */
const DEFAULT_PROJECT_DIRECTORY = '.dsh-notes'

/** Recycle bin directory inside one note store root. */
const TRASH_DIRECTORY = '.trash'

/** File prefix of a half-written trash move; never scanned as a note. */
const TEMP_PREFIX = '.'

/** Frontmatter block at the very start of a note file. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/**
 * The store used when the bundle row leaves `directory` empty.
 *
 * `sticky-notes` is the pre-1.7.0 package name and stays on purpose: renaming
 * the package must not orphan notes that are already on disk.
 */
export function defaultRoot() {
  const home = process.env.DSH_HOME?.trim()
  return join(home && home.length > 0 ? home : join(homedir(), '.dsh'), 'sticky-notes', 'notes')
}

/**
 * Validate one configured project directory. It must stay a relative path below
 * the workspace, so a bad value can never move notes outside the project.
 */
export function sanitizeProjectDirectory(value) {
  const raw = typeof value === 'string' ? value.trim().replaceAll('\\', '/') : ''
  if (raw.length === 0) return DEFAULT_PROJECT_DIRECTORY
  if (raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) return DEFAULT_PROJECT_DIRECTORY
  const segments = raw.split('/').filter((segment) => segment.length > 0 && segment !== '.')
  if (segments.length === 0 || segments.some((segment) => segment === '..')) return DEFAULT_PROJECT_DIRECTORY
  return segments.join('/')
}

/** Note store root of one workspace: `<workspace>/<projectDirectory>`, or null. */
export function projectRootFor(workspace, projectDirectory) {
  if (typeof workspace !== 'string' || !isAbsolute(workspace)) return null
  return join(workspace, sanitizeProjectDirectory(projectDirectory))
}

/** Whether a wire id names a note file this store could own. */
export function isNoteId(value) {
  return typeof value === 'string' && NOTE_ID.test(value)
}

/** Create the notes directory on first use. */
export async function ensureNotesDir(root) {
  await mkdir(root, { recursive: true })
}

/** Current id for a new note. */
export function newNoteId() {
  return randomUUID().replaceAll('-', '').slice(0, 12)
}

/**
 * Filename for one note: a readable date/title prefix that sorts roughly by
 * creation date, plus the opaque id that the wire contract uses.
 */
export function noteFileName(note) {
  const date = new Date(note.createdAt)
  const stamp = Number.isNaN(date.getTime())
    ? '0000-00-00'
    : `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return `${stamp}-${slugify(note.title)}-${note.id}.md`
}

/** Keep letters, digits, and CJK; fold everything else into single dashes. */
export function slugify(title) {
  const folded = String(title ?? '')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return folded.length > 0 ? folded : 'note'
}

/** Body text reduced to one readable line for the collapsed list row. */
export function snippetOf(body, max = 180) {
  const text = String(body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`
}

/** A title derived from the body: first heading, else first non-empty line. */
export function titleFromBody(body) {
  const lines = String(body ?? '').split(/\r?\n/)
  for (const line of lines) {
    const heading = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)
    if (heading !== null && heading[1].trim().length > 0) return clampTitle(heading[1])
  }
  for (const line of lines) {
    const text = line
      .replace(/^\s{0,3}[-*+]\s+/, '')
      .replace(/^\s{0,3}\d+\.\s+/, '')
      .replace(/[*_~`]/g, '')
      .trim()
    if (text.length > 0) return clampTitle(text)
  }
  return '便签'
}

/** Trim a title to the stored bound. */
export function clampTitle(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length === 0) return '便签'
  return text.length <= 200 ? text : `${text.slice(0, 199)}…`
}

/** Serialize one note into its file text. */
export function serializeNote(note) {
  const lines = ['---']
  lines.push(`id: ${JSON.stringify(note.id)}`)
  lines.push(`title: ${JSON.stringify(note.title)}`)
  lines.push(`scope: ${note.scope === 'global' ? 'global' : 'session'}`)
  lines.push(`favorite: ${note.favorite === true ? 'true' : 'false'}`)
  lines.push(`sessionId: ${note.sessionId === null ? 'null' : JSON.stringify(note.sessionId)}`)
  lines.push(`sessionTitle: ${note.sessionTitle === null ? 'null' : JSON.stringify(note.sessionTitle)}`)
  lines.push(`createdAt: ${Math.trunc(note.createdAt)}`)
  lines.push(`updatedAt: ${Math.trunc(note.updatedAt)}`)
  if (Number.isFinite(note.trashedAt)) lines.push(`trashedAt: ${Math.trunc(note.trashedAt)}`)
  lines.push('---', '')
  return `${lines.join('\n')}${String(note.body ?? '').replace(/\r\n/g, '\n')}`
}

/** Read one frontmatter scalar: JSON strings, booleans, `null`, integers, or raw text. */
function readScalar(raw) {
  const value = raw.trim()
  if (value === 'null' || value === '~' || value === '') return null
  if (value === 'true') return true
  if (value === 'false') return false
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  if (/^-?\d+$/.test(value)) return Number(value)
  return value
}

/** Parse one note file; malformed files are skipped by the caller. */
export function parseNote(text, path) {
  const match = FRONTMATTER.exec(text)
  if (match === null) throw new Error('missing frontmatter')
  const meta = {}
  for (const line of match[1].split(/\r?\n/)) {
    if (line.trim().length === 0) continue
    const index = line.indexOf(':')
    if (index <= 0) continue
    meta[line.slice(0, index).trim()] = readScalar(line.slice(index + 1))
  }
  if (!isNoteId(meta.id)) throw new Error('bad note id')
  const createdAt = Number.isFinite(meta.createdAt) ? meta.createdAt : 0
  const updatedAt = Number.isFinite(meta.updatedAt) ? meta.updatedAt : createdAt
  return {
    path,
    note: {
      id: meta.id,
      title: typeof meta.title === 'string' && meta.title.length > 0 ? meta.title : '便签',
      scope: meta.scope === 'global' ? 'global' : 'session',
      favorite: meta.favorite === true,
      sessionId: typeof meta.sessionId === 'string' ? meta.sessionId : null,
      sessionTitle: typeof meta.sessionTitle === 'string' ? meta.sessionTitle : null,
      createdAt,
      updatedAt,
      trashedAt: Number.isFinite(meta.trashedAt) ? meta.trashedAt : null,
      body: text.slice(match[0].length),
    },
  }
}

/** List order: favorite notes first, then most recently changed. */
export function compareNotes(left, right) {
  if (left.favorite !== right.favorite) return left.favorite ? -1 : 1
  return right.updatedAt - left.updatedAt || right.createdAt - left.createdAt
}

/** Every readable note in one store, favorites first; a missing store is empty. */
export async function readAllNotes(root) {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    // Reading must not create directories in a project the user only looks at.
    if (error?.code === 'ENOENT') return []
    throw error
  }
  const notes = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const path = join(root, entry.name)
    try {
      const parsed = parseNote(await readFile(path, 'utf8'), path)
      // The path lives on the parse result, not inside the note record.
      notes.push({ ...parsed.note, path })
    } catch {
      // A hand-edited or partially written file must not hide every other note.
    }
  }
  notes.sort(compareNotes)
  return notes
}

/** Every note visible across several stores, favorites first, one per id. */
export async function readNotesFrom(roots) {
  const seen = new Set()
  const notes = []
  for (const root of roots) {
    for (const note of await readAllNotes(root)) {
      if (seen.has(note.id)) continue
      seen.add(note.id)
      notes.push(note)
    }
  }
  notes.sort(compareNotes)
  return notes
}

/** Find one note by id; `undefined` when the store no longer holds it. */
export async function findNote(root, id) {
  if (!isNoteId(id)) return undefined
  const notes = await readAllNotes(root)
  return notes.find((note) => note.id === id)
}

/** Find one note in the first store that holds it, in root order. */
export async function findNoteIn(roots, id) {
  if (!isNoteId(id)) return undefined
  for (const root of roots) {
    const note = await findNote(root, id)
    if (note !== undefined) return note
  }
  return undefined
}

/** Write one note atomically, returning its final path. */
export async function writeNote(root, note) {
  await ensureNotesDir(root)
  const path = join(root, noteFileName(note))
  const temporary = join(root, `.${note.id}.tmp`)
  await writeFile(temporary, serializeNote(note), 'utf8')
  await rename(temporary, path)
  return path
}

/** Remove one note file; a file that already vanished is success. */
export async function removeNote(path) {
  try {
    await unlink(path)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

/** Recycle bin directory of one store root. */
export function trashRootFor(root) {
  return join(root, TRASH_DIRECTORY)
}

/**
 * Move one note file into its store's recycle bin, stamping `trashedAt` in the
 * frontmatter so the trashed note keeps its own deletion time. The original
 * file is removed only after the trashed copy is durable.
 */
export async function moveNoteToTrash(note, trashedAt = Date.now()) {
  const trashRoot = trashRootFor(dirname(note.path))
  await ensureNotesDir(trashRoot)
  const path = join(trashRoot, noteFileName(note))
  const temporary = join(trashRoot, `${TEMP_PREFIX}${note.id}.tmp`)
  await writeFile(temporary, serializeNote({ ...note, trashedAt }), 'utf8')
  await rename(temporary, path)
  await removeNote(note.path)
  return path
}

/** Every readable note in one store's recycle bin; a missing bin is empty. */
export async function readTrashedNotes(root) {
  return readAllNotes(trashRootFor(root))
}

/** Restore one trashed note file into its store root, dropping `trashedAt`. */
export async function restoreTrashedNote(root, note) {
  const path = await writeNote(root, { ...note, trashedAt: null })
  await removeNote(note.path)
  return path
}

/**
 * Permanently delete every note file in one store's recycle bin. A locked or
 * vanished file is counted instead of aborting the rest of the purge.
 */
export async function emptyTrash(root) {
  const trashRoot = trashRootFor(root)
  let entries
  try {
    entries = await readdir(trashRoot, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return { removed: 0, failed: 0 }
    throw error
  }
  let removed = 0
  let failed = 0
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    try {
      await removeNote(join(trashRoot, entry.name))
      removed += 1
    } catch {
      failed += 1
    }
  }
  return { removed, failed }
}

/** Shape one stored note for the wire list. */
export function toSummary(note) {
  return {
    id: note.id,
    title: note.title,
    scope: note.scope,
    favorite: note.favorite === true,
    sessionId: note.sessionId,
    sessionTitle: note.sessionTitle,
    snippet: snippetOf(note.body),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    trashedAt: note.trashedAt ?? null,
    path: note.path,
  }
}

/** Shape one stored note with its body for the wire. */
export function toDetail(note) {
  return { ...toSummary(note), body: note.body }
}
