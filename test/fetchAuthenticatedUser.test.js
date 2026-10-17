import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchAuthenticatedUser } from '../src/github/fetchAuthenticatedUser.js'

test('returns no_token when no token is given', async () => {
  let called = false
  const client = async () => { called = true; return { data: {} } }
  const r = await fetchAuthenticatedUser({ client })
  assert.deepEqual(r, { ok: false, reason: 'no_token' })
  assert.equal(called, false)
})

test('returns the authenticated user on success', async () => {
  const client = async () => ({
    data: { login: 'deawar', name: 'Dean', email: 'd@e.com', html_url: 'u', avatar_url: 'a', bio: 'b' }
  })
  const r = await fetchAuthenticatedUser({ token: 'tok', client })
  assert.equal(r.ok, true)
  assert.deepEqual(r.user, { login: 'deawar', name: 'Dean', email: 'd@e.com', html_url: 'u', avatar_url: 'a', bio: 'b' })
})

test('returns unreachable when the client throws', async () => {
  const client = async () => { throw new Error('ENOTFOUND') }
  const r = await fetchAuthenticatedUser({ token: 'tok', client })
  assert.deepEqual(r, { ok: false, reason: 'unreachable' })
})
