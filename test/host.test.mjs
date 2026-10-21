// Host-manifest tests: keep the Typert descriptor table and the browser half's
// endpoint list on the same wire contract, and pin the recycle-bin validators.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { TYPERT } from '../lib/typert.host.js'
import {
  emptyTrashRequestSchema,
  noteSummarySchema,
  restoreRequestSchema,
  trashArchivedRequestSchema,
} from '../lib/schemas.js'

const here = dirname(fileURLToPath(import.meta.url))

test('host manifest and browser endpoint table agree on every method', async () => {
  const source = await readFile(join(here, '..', 'client.js'), 'utf8')
  const start = source.indexOf('const ENDPOINTS = [')
  assert.ok(start >= 0, 'client ENDPOINTS table not found')
  const end = source.indexOf('\n    ]', start)
  const methods = [...source.slice(start, end).matchAll(/\['([^']+)'/g)].map((match) => match[1])
  assert.deepEqual(
    [...methods].sort(),
    TYPERT.invocations.map((invocation) => invocation.method).sort(),
  )
  for (const invocation of TYPERT.invocations) {
    assert.equal(invocation.parameters.length, 1)
    assert.equal(invocation.parameters[0].codec.mode, 'strict')
    assert.equal(invocation.result.mode, 'strict')
  }

  // Every descriptor also needs its Remote marker on the service class.
  const host = await readFile(join(here, '..', 'index.js'), 'utf8')
  const markerStart = host.indexOf('for (const method of [')
  assert.ok(markerStart >= 0, 'Remote marker list not found')
  const markerEnd = host.indexOf(']) {', markerStart)
  const marked = [...host.slice(markerStart, markerEnd).matchAll(/'([^']+)'/g)].map((match) => match[1])
  assert.deepEqual(
    [...marked].sort(),
    TYPERT.invocations.map((invocation) => invocation.method).sort(),
  )
})

test('recycle bin requests validate the empty-trash origin', () => {
  assert.deepEqual(emptyTrashRequestSchema.parse({ origin: 'workspace' }), { origin: 'workspace' })
  assert.deepEqual(emptyTrashRequestSchema.parse({ origin: 'global', sessionId: null }), { origin: 'global', sessionId: null })
  assert.throws(() => emptyTrashRequestSchema.parse({ origin: 'everything' }), TypeError)
  assert.throws(() => emptyTrashRequestSchema.parse({}), TypeError)
  // Unknown keys are dropped, matching every other request validator.
  assert.deepEqual(emptyTrashRequestSchema.parse({ origin: 'all', extra: 1 }), { origin: 'all' })
  assert.deepEqual(restoreRequestSchema.parse({ id: 'abcdef123456' }), { id: 'abcdef123456' })
  assert.deepEqual(trashArchivedRequestSchema.parse({ sessionId: 'session-1' }), { sessionId: 'session-1' })
})

test('the note summary schema documents the trashedAt field', () => {
  const summary = {
    id: 'abcdef123456',
    title: '便签',
    scope: 'session',
    favorite: false,
    sessionId: null,
    sessionTitle: null,
    snippet: '',
    createdAt: 1,
    updatedAt: 2,
    trashedAt: null,
    path: '/tmp/x.md',
  }
  assert.deepEqual(noteSummarySchema.parse(summary), summary)
  assert.throws(() => noteSummarySchema.parse({ ...summary, trashedAt: 'yesterday' }), TypeError)
})
