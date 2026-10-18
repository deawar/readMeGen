import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { resolveAppPath } from '../src/gui/appProtocol.js'

test('resolveAppPath resolves index.html under root', () => {
  const result = resolveAppPath('/app', 'app://local/index.html')
  assert.equal(result, path.join('/app', 'index.html'))
})

test('resolveAppPath resolves nested path under root', () => {
  const result = resolveAppPath('/app', 'app://local/src/gui/renderer.js')
  assert.equal(result, path.join('/app', 'src', 'gui', 'renderer.js'))
})

test('resolveAppPath defaults to index.html for empty/root path', () => {
  const result = resolveAppPath('/app', 'app://local/')
  assert.equal(result, path.join('/app', 'index.html'))
})

test('resolveAppPath returns null for path traversal attempt', () => {
  const result = resolveAppPath('/app', 'app://local/../../etc/passwd')
  assert.equal(result, null)
})

test('resolveAppPath returns null for URL-encoded traversal attempt', () => {
  const result = resolveAppPath('/app', 'app://local/..%2f..%2fsecret')
  assert.equal(result, null)
})
