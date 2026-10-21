// Storage-layer tests. Run with `node --test test/`; no dependencies needed.
import assert from 'node:assert/strict'
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  clampTitle,
  defaultRoot,
  emptyTrash,
  findNoteIn,
  isNoteId,
  moveNoteToTrash,
  newNoteId,
  parseNote,
  projectRootFor,
  readAllNotes,
  readNotesFrom,
  readTrashedNotes,
  removeNote,
  restoreTrashedNote,
  sanitizeProjectDirectory,
  serializeNote,
  snippetOf,
  titleFromBody,
  toSummary,
  trashRootFor,
  writeNote,
} from '../lib/store.js'

/** One note payload with sensible defaults. */
function makeNote(overrides = {}) {
  const now = Date.now()
  return {
    id: newNoteId(),
    title: '问题列表',
    scope: 'session',
    sessionId: 'session-test',
    sessionTitle: null,
    createdAt: now,
    updatedAt: now,
    body: '# 问题列表\n\n| a | b |\n| - | - |\n| 1 | 2 |\n',
    ...overrides,
  }
}

/** One throwaway store root. */
async function tempRoot(t) {
  const base = await mkdtemp(join(tmpdir(), 'dsh-sticky-notes-'))
  t.after(() => rm(base, { recursive: true, force: true }))
  return base
}

test('defaultRoot lives under DSH_HOME/sticky-notes/notes', () => {
  const previous = process.env.DSH_HOME
  try {
    process.env.DSH_HOME = join(tmpdir(), 'dsh-home')
    assert.equal(defaultRoot(), join(tmpdir(), 'dsh-home', 'sticky-notes', 'notes'))
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  }
})

test('sanitizeProjectDirectory keeps relative names and refuses escapes', () => {
  assert.equal(sanitizeProjectDirectory(''), '.dsh-notes')
  assert.equal(sanitizeProjectDirectory('   '), '.dsh-notes')
  assert.equal(sanitizeProjectDirectory('.dsh-notes'), '.dsh-notes')
  assert.equal(sanitizeProjectDirectory('notes\\sticky'), 'notes/sticky')
  assert.equal(sanitizeProjectDirectory('./.notes'), '.notes')
  assert.equal(sanitizeProjectDirectory('../outside'), '.dsh-notes')
  assert.equal(sanitizeProjectDirectory('a/../../b'), '.dsh-notes')
  assert.equal(sanitizeProjectDirectory('/absolute'), '.dsh-notes')
  assert.equal(sanitizeProjectDirectory('C:/absolute'), '.dsh-notes')
})

test('projectRootFor joins an absolute workspace only', () => {
  const workspace = join(tmpdir(), 'project')
  assert.equal(projectRootFor(workspace, '.dsh-notes'), join(workspace, '.dsh-notes'))
  assert.equal(projectRootFor('relative/path', '.dsh-notes'), null)
  assert.equal(projectRootFor(undefined, '.dsh-notes'), null)
})

test('readAllNotes does not create a missing store', async (t) => {
  const root = join(await tempRoot(t), 'absent')
  assert.deepEqual(await readAllNotes(root), [])
  // Reading must leave no directory behind.
  await assert.rejects(access(root), { code: 'ENOENT' })
})
test('writeNote round-trips, renames by title, and parseNote reads it back', async (t) => {
  const root = await tempRoot(t)
  const note = makeNote()
  const path = await writeNote(root, note)
  assert.ok(path.startsWith(root))
  assert.ok(path.endsWith(`-${note.id}.md`))

  const notes = await readAllNotes(root)
  assert.equal(notes.length, 1)
  assert.equal(notes[0].id, note.id)
  assert.equal(notes[0].title, note.title)
  assert.equal(notes[0].body, note.body)
  assert.equal(notes[0].scope, 'session')
  assert.equal(notes[0].favorite, false)

  // A missing favorite key in an older file reads as false.
  const legacy = serializeNote({ ...note, id: 'dddddddddddd' }).replace(/^favorite:.*\n/m, '')
  const parsedLegacy = parseNote(legacy, join(root, 'legacy.md')).note
  assert.equal(parsedLegacy.favorite, false)

  // A pinned note survives the round trip.
  await writeNote(root, { ...note, id: 'eeeeeeeeeeee', favorite: true, updatedAt: note.updatedAt + 2 })
  const pinned = (await readAllNotes(root)).find((entry) => entry.id === 'eeeeeeeeeeee')
  assert.equal(pinned.favorite, true)
  await removeNote(pinned.path)

  // A title change produces a new filename; the caller removes the old file.
  const renamed = await writeNote(root, { ...note, title: '改过的标题', updatedAt: note.updatedAt + 1 })
  assert.notEqual(renamed, path)
  assert.ok(renamed.includes('改过的标题'))
  await removeNote(path)
  assert.equal((await readAllNotes(root)).length, 1)

  // Removing an already-missing file is success.
  await removeNote(path)
})

test('a hand-edited file is skipped instead of hiding the store', async (t) => {
  const root = await tempRoot(t)
  await writeNote(root, makeNote())
  await writeFile(join(root, 'broken.md'), 'no frontmatter here', 'utf8')
  const notes = await readAllNotes(root)
  assert.equal(notes.length, 1)
  assert.throws(() => parseNote('no frontmatter', join(root, 'broken.md')))
})

test('readNotesFrom merges stores, favorites first, one entry per id', async (t) => {
  const projectRoot = await tempRoot(t)
  const globalRoot = await tempRoot(t)
  const older = makeNote({ id: 'aaaaaaaaaaaa', createdAt: 1000, updatedAt: 1000 })
  const pinned = makeNote({ id: 'dddddddddddd', createdAt: 900, updatedAt: 900, favorite: true })
  const newer = makeNote({ id: 'bbbbbbbbbbbb', createdAt: 2000, updatedAt: 2000 })
  const shared = makeNote({ id: 'cccccccccccc', createdAt: 1500, updatedAt: 1500 })
  await writeNote(projectRoot, older)
  await writeNote(projectRoot, pinned)
  await writeNote(projectRoot, shared)
  await writeNote(globalRoot, newer)
  await writeNote(globalRoot, shared)

  const notes = await readNotesFrom([projectRoot, globalRoot])
  assert.deepEqual(
    notes.map((note) => note.id),
    ['dddddddddddd', 'bbbbbbbbbbbb', 'cccccccccccc', 'aaaaaaaaaaaa'],
  )
  assert.equal(notes.length, 4)
})

test('findNoteIn searches stores in order', async (t) => {
  const projectRoot = await tempRoot(t)
  const globalRoot = await tempRoot(t)
  const projectNote = makeNote()
  const globalNote = makeNote()
  await writeNote(projectRoot, projectNote)
  await writeNote(globalRoot, globalNote)

  assert.equal((await findNoteIn([projectRoot, globalRoot], projectNote.id))?.id, projectNote.id)
  assert.equal((await findNoteIn([projectRoot, globalRoot], globalNote.id))?.id, globalNote.id)
  assert.equal(await findNoteIn([projectRoot], globalNote.id), undefined)
  assert.equal(await findNoteIn([projectRoot, globalRoot], 'not-a-note-id'), undefined)
})

test('ids, titles, and snippets stay bounded', () => {
  assert.equal(isNoteId(newNoteId()), true)
  assert.equal(isNoteId('short'), false)
  assert.equal(isNoteId('../../etc/passwd'), false)
  assert.equal(titleFromBody('## 一、问题列表\n\n正文'), '一、问题列表')
  assert.equal(titleFromBody('| a | b |\n| - | - |'), '| a | b |')
  assert.equal(clampTitle('  多  空格  '), '多 空格')
  assert.equal(clampTitle(''), '便签')
  assert.equal(snippetOf('# 标题\n\n- 第一项\n- 第二项'), '标题 第一项 第二项')
  assert.equal(toSummary(makeNote({ body: 'x'.repeat(400) })).snippet.length > 0, true)
})

test('moveNoteToTrash hides the note and keeps a trashedAt stamp', async (t) => {
  const root = await tempRoot(t)
  const note = makeNote()
  const path = await writeNote(root, note)

  const trashedPath = await moveNoteToTrash({ ...note, path }, 1761000000000)
  assert.notEqual(trashedPath, path)
  await assert.rejects(access(path), /ENOENT/)
  assert.equal((await readAllNotes(root)).length, 0)
  assert.equal(toSummary({ ...note, trashedAt: 1761000000000 }).trashedAt, 1761000000000)

  const trashed = await readTrashedNotes(root)
  assert.equal(trashed.length, 1)
  assert.equal(trashed[0].id, note.id)
  assert.equal(trashed[0].trashedAt, 1761000000000)
  assert.equal(trashed[0].path, trashedPath)
  assert.equal(trashedPath.startsWith(trashRootFor(root)), true)
})

test('restoreTrashedNote returns the note and drops trashedAt', async (t) => {
  const root = await tempRoot(t)
  const note = makeNote()
  const path = await writeNote(root, note)
  await moveNoteToTrash({ ...note, path })

  const [trashed] = await readTrashedNotes(root)
  const restoredPath = await restoreTrashedNote(root, trashed)
  assert.notEqual(restoredPath, trashed.path)
  const restored = await readAllNotes(root)
  assert.equal(restored.length, 1)
  assert.equal(restored[0].id, note.id)
  assert.equal(restored[0].trashedAt, null)
  assert.equal((await readTrashedNotes(root)).length, 0)
})

test('emptyTrash unlinks every note file in the bin and reports counts', async (t) => {
  const root = await tempRoot(t)
  const note = makeNote()
  const path = await writeNote(root, note)
  await moveNoteToTrash({ ...note, path })
  // A hand-copied file the parser would skip must still be cleared.
  await writeFile(join(trashRootFor(root), 'broken.md'), 'not a note', 'utf8')
  await writeFile(join(trashRootFor(root), 'keep.tmp'), 'temporary', 'utf8')

  const result = await emptyTrash(root)
  assert.deepEqual(result, { removed: 2, failed: 0 })
  assert.equal((await readTrashedNotes(root)).length, 0)
  // The bin directory itself stays for the next deletion, and files that are
  // not note Markdown are left alone.
  await access(trashRootFor(root))
  await access(join(trashRootFor(root), 'keep.tmp'))
})
