import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeExternalUrl } from '../src/gui/navigation.js'

test('safeExternalUrl returns the href for allowed schemes (http, https, mailto)', () => {
  assert.equal(safeExternalUrl('https://github.com/deawar/readMeGen'), 'https://github.com/deawar/readMeGen')
  assert.equal(safeExternalUrl('http://example.com/path?q=1'), 'http://example.com/path?q=1')
  assert.equal(safeExternalUrl('mailto:deawar@gmail.com'), 'mailto:deawar@gmail.com')
})

test('safeExternalUrl rejects non-http(s) protocols (no OS handler abuse)', () => {
  assert.equal(safeExternalUrl('file:///etc/passwd'), null)
  assert.equal(safeExternalUrl('smb://server/share'), null)
  // eslint-disable-next-line no-script-url
  assert.equal(safeExternalUrl('javascript:alert(1)'), null)
  assert.equal(safeExternalUrl('ms-msdt:/id'), null)
  assert.equal(safeExternalUrl('app://local/index.html'), null)
})

test('safeExternalUrl returns null for a malformed url', () => {
  assert.equal(safeExternalUrl('not a url'), null)
  assert.equal(safeExternalUrl(''), null)
  assert.equal(safeExternalUrl(undefined), null)
})
