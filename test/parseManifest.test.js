import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseManifest } from '../src/core/parseManifest.js'

test('parseManifest reads package.json deps, devDeps, and detects frameworks', () => {
  const pkg = JSON.stringify({
    dependencies: { axios: '^1.0.0', react: '^18.0.0' },
    devDependencies: { standard: '^17.0.0' }
  })
  const result = parseManifest('package.json', pkg)
  assert.deepEqual(result.modules, ['axios', 'react'])
  assert.deepEqual(result.devModules, ['standard'])
  assert.deepEqual(result.builtWith, ['react'])
})

test('parseManifest reads requirements.txt stripping versions and comments', () => {
  const contents = 'django==4.2\n# a comment\n\nrequests>=2\nuvicorn[standard]'
  const result = parseManifest('requirements.txt', contents)
  assert.deepEqual(result.modules, ['django', 'requests', 'uvicorn'])
  assert.deepEqual(result.devModules, [])
  assert.deepEqual(result.builtWith, ['django'])
})

test('parseManifest throws on invalid package.json', () => {
  assert.throws(
    () => parseManifest('package.json', 'not json'),
    new Error('invalid package.json')
  )
})

test('parseManifest throws on an unsupported filename', () => {
  assert.throws(
    () => parseManifest('Gemfile', 'source "https://rubygems.org"'),
    new Error('unsupported manifest: Gemfile')
  )
})

test('parseManifest rejects a generic .txt that is not a requirements file', () => {
  assert.throws(
    () => parseManifest('notes.txt', 'just some notes'),
    /unsupported manifest/
  )
})

test('parseManifest accepts requirements*.txt variants (e.g. requirements-dev.txt)', () => {
  const result = parseManifest('requirements-dev.txt', 'pytest==7.0\n')
  assert.deepEqual(result.modules, ['pytest'])
})
