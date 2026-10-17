import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BACK_TO_TOP, emitShields, emitRefs, emitToc, KNOWN_SECTIONS, slug } from '../src/core/managed.js'

// --- emitToc ---

test('emitToc wraps output in <details> and includes Prerequisites only when set', () => {
  const withPrereqs = emitToc({ hasModules: false, hasDevModules: false, includePrerequisites: true, includeRoadmap: false, includeAcknowledgments: false })
  assert.ok(withPrereqs.startsWith('<details>'), 'should start with <details>')
  assert.ok(withPrereqs.includes('<a href="#prerequisites">Prerequisites</a>'), 'should include prerequisites when set')

  const withoutPrereqs = emitToc({ hasModules: false, hasDevModules: false, includePrerequisites: false, includeRoadmap: false, includeAcknowledgments: false })
  assert.ok(!withoutPrereqs.includes('<a href="#prerequisites">'), 'should not include prerequisites when not set')
})

// --- BACK_TO_TOP ---

test('BACK_TO_TOP is the expected paragraph', () => {
  assert.equal(BACK_TO_TOP, '<p align="right">(<a href="#readme-top">back to top</a>)</p>')
})

// --- emitShields ---

test('emitShields includes LinkedIn line only when linkedin is set', () => {
  const withLinkedin = emitShields({ owner: 'a', repo: 'b', linkedin: 'https://linkedin.com/in/foo', conCov: false })
  assert.ok(withLinkedin.includes('[![LinkedIn][linkedin-shield]][linkedin-url]'), 'should include linkedin shield when set')

  const withoutLinkedin = emitShields({ owner: 'a', repo: 'b', linkedin: '', conCov: false })
  assert.ok(!withoutLinkedin.includes('[![LinkedIn][linkedin-shield]][linkedin-url]'), 'should not include linkedin shield when not set')
})

test('emitShields includes Covenant line only when conCov is set', () => {
  const withConCov = emitShields({ owner: 'a', repo: 'b', linkedin: '', conCov: true })
  assert.ok(withConCov.includes('[![Contributor Covenant][covenant-shield]][covenant-url]'), 'should include covenant shield when set')

  const withoutConCov = emitShields({ owner: 'a', repo: 'b', linkedin: '', conCov: false })
  assert.ok(!withoutConCov.includes('[![Contributor Covenant][covenant-shield]][covenant-url]'), 'should not include covenant shield when not set')
})

// --- emitRefs ---

test('emitRefs contains [linkedin-url]: only when linkedin is set', () => {
  const withLinkedin = emitRefs({ owner: 'a', repo: 'b', linkedin: 'https://linkedin.com/in/foo', conCov: false })
  assert.ok(withLinkedin.includes('[linkedin-url]:'), 'should include linkedin-url when set')

  const withoutLinkedin = emitRefs({ owner: 'a', repo: 'b', linkedin: '', conCov: false })
  assert.ok(!withoutLinkedin.includes('[linkedin-url]:'), 'should not include linkedin-url when not set')
})

test('emitRefs contains [covenant-url]: only when conCov is set', () => {
  const withConCov = emitRefs({ owner: 'a', repo: 'b', linkedin: '', conCov: true })
  assert.ok(withConCov.includes('[covenant-url]:'), 'should include covenant-url when set')

  const withoutConCov = emitRefs({ owner: 'a', repo: 'b', linkedin: '', conCov: false })
  assert.ok(!withoutConCov.includes('[covenant-url]:'), 'should not include covenant-url when not set')
})

test('emitRefs starts with the markdown links banner', () => {
  const result = emitRefs({ owner: 'a', repo: 'b', linkedin: '', conCov: false })
  assert.ok(result.startsWith('<!-- MARKDOWN LINKS & IMAGES -->'), 'should start with the banner comment')
})

// --- slug ---

test("slug('Dev-Dependencies') === 'dev-dependencies'", () => {
  assert.equal(slug('Dev-Dependencies'), 'dev-dependencies')
})

test('slug lowercases and replaces spaces with hyphens', () => {
  assert.equal(slug('About The Project'), 'about-the-project')
})

test('slug strips non-word characters (except hyphens)', () => {
  assert.equal(slug('Getting Started!'), 'getting-started')
})

// --- KNOWN_SECTIONS ---

test('KNOWN_SECTIONS has builtWith at level 3', () => {
  const builtWith = KNOWN_SECTIONS.find(s => s.type === 'builtWith')
  assert.ok(builtWith, 'builtWith section should exist')
  assert.equal(builtWith.level, 3)
})

test('KNOWN_SECTIONS has all required sections in canonical order', () => {
  const types = KNOWN_SECTIONS.map(s => s.type)
  assert.deepEqual(types, [
    'header',
    'about',
    'builtWith',
    'gettingStarted',
    'prerequisites',
    'installation',
    'usage',
    'testing',
    'dependencies',
    'devDependencies',
    'roadmap',
    'contributing',
    'license',
    'contact',
    'acknowledgments'
  ])
})

test('KNOWN_SECTIONS header has level 0', () => {
  const header = KNOWN_SECTIONS.find(s => s.type === 'header')
  assert.ok(header)
  assert.equal(header.level, 0)
})
