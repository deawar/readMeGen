import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyManifest } from '../src/core/applyManifest.js'

// Minimal document factory — only the fields applyManifest cares about.
function makeDoc (blocks) {
  return { meta: {}, blocks }
}

function makeBlock (type, heading, level, body) {
  return { id: type + '-0', type, heading, level, body }
}

test('merges without duplicating or dropping', () => {
  // axios already in body (linked form), lodash hand-added (linked form)
  const existing = [
    '* [axios](https://www.npmjs.com/package/axios)',
    '* [lodash](https://www.npmjs.com/package/lodash)'
  ].join('\n')
  const doc = makeDoc([makeBlock('dependencies', 'Dependencies', 2, existing)])
  const parsed = { modules: ['axios', 'chalk'], devModules: [], builtWith: [] }

  const result = applyManifest(doc, parsed)

  const depBlock = result.blocks.find(b => b.type === 'dependencies')
  assert.ok(depBlock, 'dependencies block must exist')

  const lines = depBlock.body.split('\n')
  assert.equal(lines.length, 3, 'exactly three entries: axios, lodash, chalk')
  assert.ok(lines[0].includes('axios'), 'axios first (existing-first)')
  assert.ok(lines[1].includes('lodash'), 'lodash second (hand-added survives)')
  assert.ok(lines[2].includes('chalk'), 'chalk appended')

  // No duplicates
  const names = lines.map(l => l.match(/\[([^\]]+)\]/)?.[1]).filter(Boolean)
  assert.equal(new Set(names).size, names.length, 'no duplicate names')
})

test('creates a missing Dependencies block in canonical position', () => {
  // Document has testing and contributing blocks but no dependencies block.
  const doc = makeDoc([
    makeBlock('testing', 'Testing', 2, 'run tests'),
    makeBlock('contributing', 'Contributing', 2, 'contributions welcome')
  ])
  const parsed = { modules: ['axios'], devModules: [], builtWith: [] }

  const result = applyManifest(doc, parsed)

  const types = result.blocks.map(b => b.type)
  const depIdx = types.indexOf('dependencies')
  assert.ok(depIdx !== -1, 'dependencies block created')

  const testIdx = types.indexOf('testing')
  const contribIdx = types.indexOf('contributing')
  assert.ok(depIdx > testIdx, 'dependencies sits after testing')
  assert.ok(depIdx < contribIdx, 'dependencies sits before contributing')
})

test('merges builtWith into the Built With block', () => {
  const existing = '* React\n* Vue'
  const doc = makeDoc([makeBlock('builtWith', 'Built With', 3, existing)])
  const parsed = { modules: [], devModules: [], builtWith: ['React', 'Express'] }

  const result = applyManifest(doc, parsed)

  const bwBlock = result.blocks.find(b => b.type === 'builtWith')
  assert.ok(bwBlock, 'builtWith block must exist')

  const lines = bwBlock.body.split('\n')
  assert.equal(lines.length, 3, 'React, Vue, Express — no duplicate React')
  assert.ok(lines[0] === '* React', 'React first (existing-first)')
  assert.ok(lines[1] === '* Vue', 'Vue second (hand-added survives)')
  assert.ok(lines[2] === '* Express', 'Express appended')
})

test('empty parsed lists leave the document unchanged', () => {
  const existing = '* [axios](https://www.npmjs.com/package/axios)'
  const doc = makeDoc([makeBlock('dependencies', 'Dependencies', 2, existing)])
  const parsed = { modules: [], devModules: [], builtWith: [] }

  const result = applyManifest(doc, parsed)

  // Structural equality (different object but same content)
  assert.deepEqual(result.blocks, doc.blocks)
  assert.equal(result.blocks[0].body, existing)
})
