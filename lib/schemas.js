// dsh-jingjing-sticky-notes — hand-written wire validators.
//
// Deliberately dependency-free: the typert-loader imports this module straight
// from the package directory while the Host boots, and a linked plugin
// directory has no node_modules of its own. A bare `zod` import there fails
// module loading, fails typert activation, and takes the whole Remote API down
// with it (the desktop then reports "Web RPC failed" during its welcome RPC).
// The Host gateway only calls `create().parse(value)` on strict input codecs,
// so a plain `parse` method is the entire contract we need.

/** Throw the one error shape the gateway reports as boundary validation. */
function fail(message) {
  throw new TypeError(`sticky-notes: ${message}`)
}

/** Whether a value is a plain object (not an array, not null). */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A string field. */
const string = {
  parse(value) {
    if (typeof value !== 'string') fail('expected a string')
    return value
  },
}

/** A non-negative integer field within the JSON-safe range. */
const integer = {
  parse(value) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
      fail('expected a non-negative safe integer')
    }
    return value
  },
}

/** A boolean field. */
const boolean = {
  parse(value) {
    if (typeof value !== 'boolean') fail('expected a boolean')
    return value
  },
}

/** A field that may be `null`. */
function nullable(schema) {
  return {
    parse(value) {
      return value === null ? null : schema.parse(value)
    },
  }
}

/** A field that may be omitted entirely. */
function optional(schema) {
  return {
    optional: true,
    parse(value) {
      return value === undefined ? undefined : schema.parse(value)
    },
  }
}

/** One of a fixed set of string values. */
function oneOf(...allowed) {
  return {
    parse(value) {
      if (!allowed.includes(value)) fail(`expected one of ${allowed.join(', ')}`)
      return value
    },
  }
}

/** An array of one element shape. */
function arrayOf(schema) {
  return {
    parse(value) {
      if (!Array.isArray(value)) fail('expected an array')
      return value.map((item) => schema.parse(item))
    },
  }
}

/**
 * One object with a fixed field table. Unknown fields are dropped and every
 * declared field is validated; an `optional()` field may be absent.
 */
function objectOf(fields) {
  return {
    parse(value) {
      if (!isRecord(value)) fail('expected an object')
      const result = {}
      for (const [key, schema] of Object.entries(fields)) {
        const raw = value[key]
        if (raw === undefined) {
          if (schema.optional === true) continue
          fail(`missing field ${JSON.stringify(key)}`)
        }
        result[key] = schema.parse(raw)
      }
      return result
    },
  }
}

/** Result codecs are never parsed by the gateway; pass through unchanged. */
const anyValue = { parse: (value) => value }

/** Visibility of one note: private to its Session, or shown everywhere. */
export const noteScopeSchema = oneOf('session', 'global')

/** One note without its body, as the list endpoint returns it. */
export const noteSummarySchema = objectOf({
  id: string,
  title: string,
  scope: noteScopeSchema,
  favorite: boolean,
  sessionId: nullable(string),
  sessionTitle: nullable(string),
  snippet: string,
  createdAt: integer,
  updatedAt: integer,
  /** Set while the note sits in a recycle bin; active notes carry `null`. */
  trashedAt: nullable(integer),
  path: string,
})

/** One trashed note, tagged with the store its recycle bin belongs to. */
export const trashNoteSummarySchema = objectOf({
  id: string,
  title: string,
  scope: noteScopeSchema,
  favorite: boolean,
  sessionId: nullable(string),
  sessionTitle: nullable(string),
  snippet: string,
  createdAt: integer,
  updatedAt: integer,
  trashedAt: nullable(integer),
  path: string,
  /** `workspace` for the current project bin, `global` for the shared bin. */
  origin: oneOf('workspace', 'global'),
})

/** One note with its full Markdown body. */
export const noteSchema = objectOf({
  id: string,
  title: string,
  scope: noteScopeSchema,
  favorite: boolean,
  sessionId: nullable(string),
  sessionTitle: nullable(string),
  snippet: string,
  createdAt: integer,
  updatedAt: integer,
  trashedAt: nullable(integer),
  path: string,
  body: string,
})

export const listRequestSchema = objectOf({
  sessionId: nullable(string),
})

/**
 * The Session an operation belongs to. It locates the note's project store;
 * clients that predate project stores omit it and fall back to the global one.
 */
const owningSession = { sessionId: optional(nullable(string)) }

export const readRequestSchema = objectOf({ id: string, ...owningSession })

export const createRequestSchema = objectOf({
  title: nullable(string),
  body: string,
  scope: noteScopeSchema,
  sessionId: nullable(string),
  /** Optional provenance; clients may omit it entirely. */
  sessionTitle: optional(nullable(string)),
  /** Pin to the top of the list; omitted means not favorite. */
  favorite: optional(boolean),
})

export const updateRequestSchema = objectOf({
  id: string,
  title: string,
  body: string,
  scope: noteScopeSchema,
  ...owningSession,
  /** Omitted keeps the stored value. */
  favorite: optional(boolean),
})

export const removeRequestSchema = objectOf({ id: string, ...owningSession })

/** List the current workspace and global recycle bins. */
export const listTrashRequestSchema = objectOf({ sessionId: nullable(string) })

/** Restore one trashed note; `sessionId` locates the workspace bin. */
export const restoreRequestSchema = objectOf({ id: string, ...owningSession })

/** Permanently empty one recycle bin, or both. */
export const emptyTrashRequestSchema = objectOf({
  ...owningSession,
  origin: oneOf('workspace', 'global', 'all'),
})

/** Move every note of an archived Session in this workspace into the bin. */
export const trashArchivedRequestSchema = objectOf({ sessionId: nullable(string) })

/** Pin or unpin one note without rewriting its body. */
export const setFavoriteRequestSchema = objectOf({
  id: string,
  favorite: boolean,
  ...owningSession,
})

/** Move one note between project and global visibility without rewriting its body. */
export const setScopeRequestSchema = objectOf({
  id: string,
  scope: noteScopeSchema,
  ...owningSession,
})

export const captureMessageRequestSchema = objectOf({
  sessionId: string,
  messageId: string,
})

export const captureSessionRequestSchema = objectOf({
  sessionId: string,
  /** UI locale of the caller, so generated headings and titles follow it. */
  locale: optional(string),
})

/** Success payload of `list`. */
export const listValueSchema = objectOf({ notes: arrayOf(noteSummarySchema) })

/** Success payload of `listTrash`. */
export const trashListValueSchema = objectOf({ notes: arrayOf(trashNoteSummarySchema) })

/** Success payload of `read`, `restoreNote`, `create`, `update`, and both capture endpoints. */
export const noteValueSchema = objectOf({ note: noteSummarySchema })

/** Success payload of `removeNote`. */
export const removeValueSchema = objectOf({ removed: { parse: (value) => value } })

/** Success payload of `emptyTrash` and `trashArchived`. */
export const purgeValueSchema = objectOf({
  removed: optional(integer),
  trashed: optional(integer),
  failed: integer,
})

/**
 * Result codecs. The Host gateway encodes results but never parses them, so
 * these carry type identity only; the shapes above document what they hold.
 */
export const listResultSchema = anyValue
export const trashListResultSchema = anyValue
export const noteResultSchema = anyValue
export const removeResultSchema = anyValue
export const purgeResultSchema = anyValue
