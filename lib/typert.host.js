// dsh-jingjing-sticky-notes — hand-written Typert host manifest, the equivalent of a
// generated `./typert` artifact. The loader validates its shape and registers
// the invocations with the runtime registry; client.js mounts the same
// endpoints through the browser Remote contribution.
import {
  captureMessageRequestSchema,
  captureSessionRequestSchema,
  createRequestSchema,
  emptyTrashRequestSchema,
  listRequestSchema,
  listResultSchema,
  listTrashRequestSchema,
  noteResultSchema,
  purgeResultSchema,
  readRequestSchema,
  removeRequestSchema,
  removeResultSchema,
  restoreRequestSchema,
  setFavoriteRequestSchema,
  setScopeRequestSchema,
  trashArchivedRequestSchema,
  trashListResultSchema,
  updateRequestSchema,
} from './schemas.js'

const PACKAGE = 'dsh-jingjing-sticky-notes'
const SERVICE = 'stickyNotes'

/** One memoized `create()` factory per strict codec, as generated artifacts emit. */
function factoryFor(schema) {
  let value
  return () => (value ??= schema)
}

const codecs = {
  listRequest: { typeSymbol: `${PACKAGE}#StickyNotesListRequest`, create: factoryFor(listRequestSchema) },
  readRequest: { typeSymbol: `${PACKAGE}#StickyNotesReadRequest`, create: factoryFor(readRequestSchema) },
  createRequest: { typeSymbol: `${PACKAGE}#StickyNotesCreateRequest`, create: factoryFor(createRequestSchema) },
  updateRequest: { typeSymbol: `${PACKAGE}#StickyNotesUpdateRequest`, create: factoryFor(updateRequestSchema) },
  removeRequest: { typeSymbol: `${PACKAGE}#StickyNotesRemoveRequest`, create: factoryFor(removeRequestSchema) },
  listTrashRequest: {
    typeSymbol: `${PACKAGE}#StickyNotesListTrashRequest`,
    create: factoryFor(listTrashRequestSchema),
  },
  restoreRequest: {
    typeSymbol: `${PACKAGE}#StickyNotesRestoreRequest`,
    create: factoryFor(restoreRequestSchema),
  },
  emptyTrashRequest: {
    typeSymbol: `${PACKAGE}#StickyNotesEmptyTrashRequest`,
    create: factoryFor(emptyTrashRequestSchema),
  },
  trashArchivedRequest: {
    typeSymbol: `${PACKAGE}#StickyNotesTrashArchivedRequest`,
    create: factoryFor(trashArchivedRequestSchema),
  },
  setFavoriteRequest: {
    typeSymbol: `${PACKAGE}#StickyNotesSetFavoriteRequest`,
    create: factoryFor(setFavoriteRequestSchema),
  },
  setScopeRequest: {
    typeSymbol: `${PACKAGE}#StickyNotesSetScopeRequest`,
    create: factoryFor(setScopeRequestSchema),
  },
  captureMessageRequest: {
    typeSymbol: `${PACKAGE}#StickyNotesCaptureMessageRequest`,
    create: factoryFor(captureMessageRequestSchema),
  },
  captureSessionRequest: {
    typeSymbol: `${PACKAGE}#StickyNotesCaptureSessionRequest`,
    create: factoryFor(captureSessionRequestSchema),
  },
  listResult: { typeSymbol: `${PACKAGE}#StickyNotesListResult`, create: factoryFor(listResultSchema) },
  trashListResult: {
    typeSymbol: `${PACKAGE}#StickyNotesTrashListResult`,
    create: factoryFor(trashListResultSchema),
  },
  noteResult: { typeSymbol: `${PACKAGE}#StickyNotesNoteResult`, create: factoryFor(noteResultSchema) },
  removeResult: { typeSymbol: `${PACKAGE}#StickyNotesRemoveResult`, create: factoryFor(removeResultSchema) },
  purgeResult: { typeSymbol: `${PACKAGE}#StickyNotesPurgeResult`, create: factoryFor(purgeResultSchema) },
}

/** Every endpoint this service publishes, in declaration order. */
const METHODS = [
  { method: 'list', request: 'listRequest', result: 'listResult', summary: 'list workspace and global notes visible from a session' },
  { method: 'read', request: 'readRequest', result: 'noteResult', summary: 'read one note with its body' },
  { method: 'create', request: 'createRequest', result: 'noteResult', summary: 'create a note from supplied text' },
  { method: 'update', request: 'updateRequest', result: 'noteResult', summary: 'replace one note' },
  { method: 'removeNote', request: 'removeRequest', result: 'removeResult', summary: 'move one note into the recycle bin' },
  {
    method: 'listTrash',
    request: 'listTrashRequest',
    result: 'trashListResult',
    summary: 'list the workspace and global recycle bins',
  },
  {
    method: 'restoreNote',
    request: 'restoreRequest',
    result: 'noteResult',
    summary: 'restore one note from the recycle bin',
  },
  {
    method: 'emptyTrash',
    request: 'emptyTrashRequest',
    result: 'purgeResult',
    summary: 'permanently empty one recycle bin or both',
  },
  {
    method: 'trashArchived',
    request: 'trashArchivedRequest',
    result: 'purgeResult',
    summary: 'move the notes of archived sessions into the recycle bin',
  },
  {
    method: 'setFavorite',
    request: 'setFavoriteRequest',
    result: 'noteResult',
    summary: 'pin or unpin one note',
  },
  {
    method: 'setScope',
    request: 'setScopeRequest',
    result: 'noteResult',
    summary: 'move one note between project and global visibility',
  },
  {
    method: 'captureMessage',
    request: 'captureMessageRequest',
    result: 'noteResult',
    summary: 'capture one finalized assistant message',
  },
  {
    method: 'captureSession',
    request: 'captureSessionRequest',
    result: 'noteResult',
    summary: 'capture the user/assistant transcript of a session',
  },
]

/** The strict codec record one descriptor field needs. */
function strictCodec(key) {
  const codec = codecs[key]
  return { mode: 'strict', typeSymbol: codec.typeSymbol, create: codec.create }
}

export const TYPERT = {
  package: PACKAGE,
  face: 'host',
  schemas: [],
  invocations: METHODS.map(({ method, request, result, summary }) => ({
    id: `${PACKAGE}#${SERVICE}/${method}`,
    service: SERVICE,
    namespace: SERVICE,
    method,
    invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: strictCodec(request) }],
    result: strictCodec(result),
    description: summary,
    sourceLocation: { file: 'lib/typert.host.js', line: 1, column: 1 },
  })),
  model: {
    services: [
      {
        key: SERVICE,
        exportName: 'StickyNotesService',
        tags: [],
        description:
          'Local Markdown note store for the Sticky Notes browser panel. It owns files under the configured directory and can capture text from persisted Session logs.',
        summary: 'Local Markdown note store.',
        jsDoc: '/**\n * Local Markdown note store for the Sticky Notes browser panel.\n */',
        members: METHODS.map(({ method }) => ({
          kind: 'method',
          name: method,
          signature: `@Remote('${method}') ${method}(request)`,
        })),
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
}
