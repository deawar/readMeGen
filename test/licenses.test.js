import { test } from 'node:test'
import assert from 'node:assert/strict'
import { licenseInfo } from '../src/core/licenses.js'

test('licenseInfo returns the correct description per key (fixes bug #1)', () => {
  assert.match(licenseInfo('MIT').description, /permissive license/i)
  assert.match(licenseInfo('Apache 2.0').description, /patent rights/i)
  assert.equal(licenseInfo('The Unlicense').spdx, 'Unlicense')
})

test('licenseInfo returns null for an unknown key', () => {
  assert.equal(licenseInfo('Bogus'), null)
})
