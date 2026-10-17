import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isJumpCommand, activeFields, reviewItems } from '../src/cli/fields.js'

test('isJumpCommand matches only a bare <', () => {
  assert.equal(isJumpCommand('<'), true)
  assert.equal(isJumpCommand('  <  '), true)
  assert.equal(isJumpCommand('a < b'), false)
  assert.equal(isJumpCommand(''), false)
})

test('activeFields hides gated text when its toggle is off', () => {
  const on = activeFields({ includePrerequisites: true })
  const off = activeFields({ includePrerequisites: false })
  assert.ok(on.some((f) => f.name === 'prerequisites'))
  assert.ok(!off.some((f) => f.name === 'prerequisites'))
})

test('reviewItems renders value by type and hides gated fields', () => {
  const items = reviewItems({ projectTitle: 'My App', tableOfContents: true, modules: ['a', 'b'], includeRoadmap: false })
  const byKey = Object.fromEntries(items.map((i) => [i.key, i.label]))
  assert.match(byKey.projectTitle, /My App/)
  assert.match(byKey.tableOfContents, /Yes/)
  assert.match(byKey.modules, /a, b/)
  assert.equal(byKey.roadmap, undefined)
})
