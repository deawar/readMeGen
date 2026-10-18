import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHandlers, isTrustedSender } from '../src/gui/registerHandlers.js'
import * as handlers from '../src/gui/handlers.js'

// ── fake ipcMain ──────────────────────────────────────────────────────────────

function makeFakeIpcMain () {
  const registered = []
  return {
    handle (channel, fn) {
      registered.push({ channel, fn })
    },
    _registered: registered
  }
}

// ── expected channels ─────────────────────────────────────────────────────────

const EXPECTED_CHANNELS = [
  'open-readme',
  'save-readme',
  'new-readme',
  'apply-manifest',
  'apply-author',
  'apply-license',
  'set-header',
  'serialize-doc',
  'lookup-user',
  'render-markdown'
]

// ── tests ─────────────────────────────────────────────────────────────────────

test('registerHandlers registers exactly 10 channels', () => {
  const fakeIpcMain = makeFakeIpcMain()
  registerHandlers(fakeIpcMain, handlers, {})
  assert.equal(fakeIpcMain._registered.length, EXPECTED_CHANNELS.length,
    `expected ${EXPECTED_CHANNELS.length} channels, got ${fakeIpcMain._registered.length}`)
})

test('registerHandlers registers all expected channel names', () => {
  const fakeIpcMain = makeFakeIpcMain()
  registerHandlers(fakeIpcMain, handlers, {})
  const registeredChannels = fakeIpcMain._registered.map(r => r.channel)
  for (const ch of EXPECTED_CHANNELS) {
    assert.ok(registeredChannels.includes(ch), `channel '${ch}' not registered`)
  }
})

test('registerHandlers registers no unexpected channels', () => {
  const fakeIpcMain = makeFakeIpcMain()
  registerHandlers(fakeIpcMain, handlers, {})
  const registeredChannels = fakeIpcMain._registered.map(r => r.channel)
  for (const ch of registeredChannels) {
    assert.ok(EXPECTED_CHANNELS.includes(ch), `unexpected channel '${ch}' registered`)
  }
})

test('registerHandlers registers no duplicate channels', () => {
  const fakeIpcMain = makeFakeIpcMain()
  registerHandlers(fakeIpcMain, handlers, {})
  const registeredChannels = fakeIpcMain._registered.map(r => r.channel)
  const unique = new Set(registeredChannels)
  assert.equal(unique.size, registeredChannels.length, 'duplicate channels found')
})

test('each registered handler invokes the corresponding handler fn with deps and payload', async () => {
  const fakeIpcMain = makeFakeIpcMain()
  const fakeDeps = {}
  registerHandlers(fakeIpcMain, handlers, fakeDeps)

  // Find the render-markdown handler (a simple, dep-light channel to verify wiring)
  const entry = fakeIpcMain._registered.find(r => r.channel === 'render-markdown')
  assert.ok(entry, 'render-markdown handler registered')

  const fakeMdDeps = { md: { render: (s) => '<b>' + s + '</b>' }, sanitize: (html) => html }
  registerHandlers(fakeIpcMain, handlers, fakeMdDeps)
  const entry2 = fakeIpcMain._registered.filter(r => r.channel === 'render-markdown').pop()
  const trusted = { senderFrame: { url: 'app://local/index.html' } }
  const result = await entry2.fn(trusted, { markdown: 'hi' })
  assert.deepEqual(result, { html: '<b>hi</b>' })
})

// ── senderFrame origin guard ────────────────────────────────────────────────

test('isTrustedSender accepts only app://local frames', () => {
  assert.equal(isTrustedSender({ senderFrame: { url: 'app://local/index.html' } }), true)
  assert.equal(isTrustedSender({ senderFrame: { url: 'app://local/src/gui/renderer.js' } }), true)
  assert.equal(isTrustedSender({ senderFrame: { url: 'https://evil.example/' } }), false)
  assert.equal(isTrustedSender({ senderFrame: { url: 'file:///etc/passwd' } }), false)
  assert.equal(isTrustedSender({ senderFrame: {} }), false)
  assert.equal(isTrustedSender({}), false)
  assert.equal(isTrustedSender(undefined), false)
})

test('a registered handler rejects an invoke from an untrusted sender and does not run the handler', () => {
  const fakeIpcMain = makeFakeIpcMain()
  // deps with NO md — if the guard fails to fire, renderMarkdown would throw a
  // different error (reading md.render of undefined). We assert the guard fires
  // first (synchronous throw — Electron turns it into a rejected invoke()).
  registerHandlers(fakeIpcMain, handlers, {})
  const entry = fakeIpcMain._registered.find(r => r.channel === 'render-markdown')
  assert.throws(
    () => entry.fn({ senderFrame: { url: 'https://evil.example/' } }, { markdown: 'x' }),
    /untrusted sender/
  )
})
