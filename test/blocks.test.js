import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateReadme } from '../src/core/generateReadme.js'
import { parseDocument } from '../src/core/blocks.js'
import { fullAnswers } from './fixtures/full-answers.js'

test('parseDocument splits our own template into typed blocks', () => {
  const md = generateReadme(fullAnswers)
  const { meta, blocks } = parseDocument(md)

  // Block type sequence starts as expected
  const types = blocks.map(b => b.type)
  assert.deepEqual(
    types.slice(0, 8),
    ['header', 'about', 'builtWith', 'gettingStarted', 'prerequisites', 'installation', 'usage', 'testing']
  )

  // meta.projectUrl matches the fixture
  assert.equal(meta.projectUrl, fullAnswers.projectUrl)

  // No block body contains back-to-top or shield references
  for (const b of blocks) {
    assert.ok(!b.body.includes('back to top'), `block ${b.type} contains "back to top"`)
    assert.ok(!b.body.includes('[contributors-shield]'), `block ${b.type} contains shield ref`)
  }

  // tableOfContents flag is set because the fixture enables it
  assert.equal(meta.tableOfContents, true)
})

test('parseDocument ignores ## inside a code fence', () => {
  const md = [
    '## My Section',
    '',
    '```sh',
    '## not a heading',
    '```',
    ''
  ].join('\n')

  const { blocks } = parseDocument(md)
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].heading, 'My Section')
})

test('parseDocument keeps unknown sections as custom with body preserved', () => {
  const md = [
    '## Frequently Asked Questions',
    '',
    'Q: Does it work?',
    'A: Yes.',
    ''
  ].join('\n')

  const { blocks } = parseDocument(md)
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].type, 'custom')
  assert.ok(blocks[0].body.includes('Q: Does it work?'))
})

test('parseDocument gives every block a unique id', () => {
  const md = generateReadme(fullAnswers)
  const { blocks } = parseDocument(md)
  const ids = blocks.map(b => b.id)
  const unique = new Set(ids)
  assert.equal(unique.size, ids.length)
})
