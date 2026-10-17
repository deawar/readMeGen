import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseList, resolveContributors, authorFallbackNeeded } from '../src/cli/index.js'

test('parseList trims, drops empties and trailing commas (spec §4.2)', () => {
  assert.deepEqual(parseList('react, lodash,  , express,'), ['react', 'lodash', 'express'])
  assert.deepEqual(parseList(''), [])
})

test('resolveContributors awaits every lookup and skips unreachable (bug #4)', async () => {
  const lookup = async (n) => n === 'bad'
    ? { ok: false, reason: 'unreachable' }
    : { ok: true, user: { login: n } }
  const r = await resolveContributors(['a', 'bad', 'b'], lookup)
  assert.deepEqual(r.map((u) => u.login), ['a', 'b'])
})

test('authorFallbackNeeded only on unreachable (spec §4.6)', () => {
  assert.equal(authorFallbackNeeded({ ok: false, reason: 'unreachable' }), true)
  assert.equal(authorFallbackNeeded({ ok: false, reason: 'not_found' }), false)
})
