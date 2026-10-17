import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { generateReadme, parseRepo } from '../src/core/generateReadme.js'
import { fullAnswers } from './fixtures/full-answers.js'

const here = dirname(fileURLToPath(import.meta.url))

const base = {
  projectTitle: 'Test Project',
  projectUrl: 'https://github.com/deawar/test-project',
  tagline: 'A test project',
  description: 'This project does things.',
  logoPath: '',
  screenshotPath: '',
  docsUrl: '',
  demoUrl: '',
  builtWith: [],
  prerequisites: '',
  install: 'npm install',
  usage: 'node index.js',
  tests: 'npm test',
  modules: [],
  devModules: [],
  tableOfContents: true,
  roadmap: '',
  acknowledgments: '',
  conCov: false,
  license: 'MIT',
  author: {
    login: 'deawar',
    name: 'Dean Warren',
    email: 'deawar@gmail.com',
    html_url: 'https://github.com/deawar',
    avatar_url: 'https://avatars.githubusercontent.com/u/15312495?v=4'
  },
  contributors: [],
  twitter: '',
  linkedin: ''
}

test('parseRepo tolerates trailing slash, .git, and extra path', () => {
  for (const u of [
    'https://github.com/a/b',
    'https://github.com/a/b/',
    'https://github.com/a/b.git',
    'https://github.com/a/b/tree/main'
  ]) {
    assert.deepEqual(parseRepo(u), { owner: 'a', repo: 'b' })
  }
})

test('title with spaces is URL-escaped in links (bug #10)', () => {
  const md = generateReadme({ ...base, projectTitle: 'My Cool App' })
  assert.ok(!/\(https?:\/\/[^)]* [^)]*\)/.test(md)) // no raw space inside any markdown URL
})

test('empty modules/contributors omit their sections and TOC entries (bug #3)', () => {
  const md = generateReadme({ ...base, modules: [], devModules: [], contributors: [], tableOfContents: true })
  assert.ok(!md.includes('## Dependencies'))
  assert.ok(!/\[Dependencies\]\(#dependencies\)/.test(md))
})

test('license section shows the correct text for the chosen key (bug #1)', () => {
  assert.match(generateReadme({ ...base, license: 'MIT' }), /permissive license/i)
})

test('no "undefined" appears anywhere in output (bug #2)', () => {
  assert.ok(!generateReadme(base).includes('undefined'))
})

test('core tolerates missing optional fields without throwing (spec §4.2)', () => {
  const minimal = { ...base }
  delete minimal.modules
  delete minimal.devModules
  delete minimal.builtWith
  delete minimal.contributors
  const md = generateReadme(minimal) // must not throw
  assert.ok(!md.includes('## Dependencies'))
  assert.ok(!md.includes('undefined'))
})

test('resolved contributors render as avatar thumbnails (spec §5)', () => {
  const md = generateReadme({
    ...base,
    contributors: [{ login: 'octocat', name: 'The Octocat', html_url: 'https://github.com/octocat', avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4' }]
  })
  assert.match(md, /octocat/)
  assert.match(md, /avatars\.githubusercontent\.com\/u\/583231/)
})

test('optional prose sections render by default (backward compatible)', () => {
  const md = generateReadme({ ...base, tableOfContents: true })
  assert.ok(md.includes('### Prerequisites'))
  assert.ok(md.includes('## Roadmap'))
  assert.ok(md.includes('## Acknowledgments'))
  assert.ok(md.includes("Here's why"))
})

test('excluded optional prose sections drop their body and TOC entry', () => {
  const md = generateReadme({
    ...base,
    tableOfContents: true,
    includePrerequisites: false,
    includeRoadmap: false,
    includeAcknowledgments: false,
    includeWhy: false
  })
  assert.ok(!md.includes('### Prerequisites'))
  assert.ok(!md.includes('## Roadmap'))
  assert.ok(!md.includes('## Acknowledgments'))
  assert.ok(!md.includes("Here's why"))
  assert.ok(!/<a href="#prerequisites">/.test(md))
  assert.ok(!/<a href="#roadmap">/.test(md))
  assert.ok(!/<a href="#acknowledgments">/.test(md))
})

test('full fixture matches the committed golden snapshot', () => {
  const expected = readFileSync(join(here, 'fixtures/expected-full.md'), 'utf8')
  assert.equal(generateReadme(fullAnswers), expected)
})
