import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReadme, parseList } from '../src/core/buildReadme.js'

test('parseList trims and drops empties', () => {
  assert.deepEqual(parseList('a, b,, c '), ['a', 'b', 'c'])
  assert.deepEqual(parseList(''), [])
})

test('buildReadme parses list fields, resolves contributors via lookup, and generates markdown', async () => {
  const raw = {
    projectTitle: 'Demo',
    projectUrl: 'https://github.com/deawar/demo',
    builtWith: 'Node.js',
    modules: 'axios, chalk',
    devModules: 'standard',
    contributors: 'octocat, ghost',
    license: 'MIT',
    tableOfContents: false,
    author: { login: 'deawar', name: 'Dean', email: 'd@e.com', html_url: 'https://github.com/deawar', avatar_url: 'https://a/?v=4' }
  }
  const lookup = async (name) => name === 'ghost'
    ? { ok: false, reason: 'not_found' }
    : { ok: true, user: { login: name, name, html_url: 'u', avatar_url: 'https://a/?v=4' } }

  const { markdown, answers } = await buildReadme(raw, { lookup })

  assert.deepEqual(answers.modules, ['axios', 'chalk'])
  assert.deepEqual(answers.builtWith, ['Node.js'])
  assert.deepEqual(answers.contributors.map((c) => c.login), ['octocat']) // ghost skipped
  assert.equal(answers.author.login, 'deawar')
  assert.match(markdown, /Demo/)
  assert.ok(!markdown.includes('undefined'))
})
