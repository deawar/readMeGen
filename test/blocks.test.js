import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { generateReadme } from '../src/core/generateReadme.js'
import { parseDocument, serializeDocument } from '../src/core/blocks.js'
import { fullAnswers } from './fixtures/full-answers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

test('serializeDocument round-trips our own template byte-for-byte', () => {
  const md = generateReadme(fullAnswers)
  const result = serializeDocument(parseDocument(md))
  assert.equal(result, md)
})

test('round-trips an off-template readme preserving prose', () => {
  const examplePath = join(__dirname, '..', 'Example_README.md')
  const md = readFileSync(examplePath, 'utf8')
  const result = serializeDocument(parseDocument(md))
  // Managed scaffold may differ; prose sentences must survive
  assert.ok(result.includes('An awesome README template to jumpstart your projects!'))
  assert.ok(result.includes('There are many great README templates available on GitHub'))
  assert.ok(result.includes('See the [open issues]'))
  assert.ok(result.includes('Use this space to list resources you find helpful'))
})

test('reordering a block moves its heading in the output', () => {
  const md = generateReadme(fullAnswers)
  const doc = parseDocument(md)
  // Move license block before usage block
  const licenseIdx = doc.blocks.findIndex(b => b.type === 'license')
  const usageIdx = doc.blocks.findIndex(b => b.type === 'usage')
  const [licenseBlock] = doc.blocks.splice(licenseIdx, 1)
  doc.blocks.splice(usageIdx, 0, licenseBlock)
  const result = serializeDocument(doc)
  const licensePos = result.indexOf('## License')
  const usagePos = result.indexOf('## Usage')
  assert.ok(licensePos < usagePos, '## License should precede ## Usage after reorder')
  // Shield block and ref block still present
  assert.ok(result.includes('[contributors-shield]'))
  assert.ok(result.includes('[contributors-url]:'))
})
