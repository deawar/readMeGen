import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchGitHubUser } from '../src/github/fetchGitHubUser.js'

test('returns ok + user on success', async () => {
  const client = async () => ({
    data: { login: 'deawar', name: 'Dean', email: 'd@e.com', html_url: 'u', avatar_url: 'a', bio: 'b' }
  })
  const r = await fetchGitHubUser('deawar', { client })
  assert.equal(r.ok, true)
  assert.equal(r.user.login, 'deawar')
})

test('404 -> not_found (spec §4.6)', async () => {
  const client = async () => {
    const err = new Error('Not Found')
    err.response = { status: 404 }
    throw err
  }
  assert.deepEqual(await fetchGitHubUser('nope', { client }), { ok: false, reason: 'not_found' })
})

test('no response -> unreachable (fixes bug #5)', async () => {
  const client = async () => { throw new Error('ENOTFOUND') } // err.response undefined
  assert.deepEqual(await fetchGitHubUser('x', { client }), { ok: false, reason: 'unreachable' })
})

test('sends Bearer header only when token present (fixes bug #6)', async () => {
  let sent
  const client = async (cfg) => { sent = cfg.headers; return { data: {} } }
  await fetchGitHubUser('x', { client })
  assert.equal(sent.Authorization, undefined)
  await fetchGitHubUser('x', { token: 'T', client })
  assert.equal(sent.Authorization, 'Bearer T')
})
