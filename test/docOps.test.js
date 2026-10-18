import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  newDocument,
  applyManifestToDoc,
  renderContactBody,
  applyAuthorToDoc,
  renderLicenseBody,
  applyLicenseToDoc,
  parseHeaderFields,
  renderHeaderBody,
  applyHeaderToDoc
} from '../src/gui/docOps.js'

// ── newDocument ──────────────────────────────────────────────────────────────

test('newDocument returns a parseable default document', async () => {
  const doc = await newDocument()
  assert.ok(doc && typeof doc === 'object', 'returns an object')
  assert.ok(Array.isArray(doc.blocks), 'has blocks array')
  assert.ok(doc.meta && typeof doc.meta === 'object', 'has meta object')

  const types = doc.blocks.map(b => b.type)
  assert.ok(types.includes('about'), 'has about block')
  assert.ok(types.includes('license'), 'has license block')

  for (const block of doc.blocks) {
    assert.ok(block.body !== undefined, `block ${block.type} body is not undefined`)
    assert.ok(!String(block.body).includes('undefined'), `block ${block.type} body has no "undefined" text`)
  }
})

// ── applyManifestToDoc ───────────────────────────────────────────────────────

test('applyManifestToDoc merges a package.json', async () => {
  const doc = await newDocument()
  const result = applyManifestToDoc(doc, 'package.json', '{"dependencies":{"axios":"1"}}')
  const depBlock = result.blocks.find(b => b.type === 'dependencies')
  assert.ok(depBlock, 'dependencies block exists')
  assert.ok(depBlock.body.includes('axios'), 'axios listed in body')
})

test('applyManifestToDoc throws on invalid package.json', async () => {
  const doc = await newDocument()
  assert.throws(
    () => applyManifestToDoc(doc, 'package.json', 'not-json'),
    /invalid package\.json/i
  )
})

test('applyManifestToDoc throws on an unsupported filename', async () => {
  const doc = await newDocument()
  assert.throws(
    () => applyManifestToDoc(doc, 'Makefile', ''),
    /unsupported manifest/i
  )
})

// ── renderContactBody ────────────────────────────────────────────────────────

test('renderContactBody includes name, email, and mailto', () => {
  const user = { name: 'Jane Doe', login: 'janedoe', email: 'jane@example.com', html_url: 'https://github.com/janedoe', avatar_url: 'https://avatars.githubusercontent.com/u/1' }
  const body = renderContactBody(user, { twitter: '', projectUrl: 'https://github.com/janedoe/myproject' })

  assert.ok(body.includes('Jane Doe'), 'includes name')
  assert.ok(body.includes('jane@example.com'), 'includes email')
  assert.ok(body.includes('mailto:jane@example.com'), 'includes mailto link')
  assert.ok(!body.includes('twitter.com'), 'no twitter when falsy')
})

test('renderContactBody includes twitter when provided', () => {
  const user = { name: 'Jane Doe', login: 'janedoe', email: 'jane@example.com', html_url: 'https://github.com/janedoe', avatar_url: 'https://avatars.githubusercontent.com/u/1' }
  const body = renderContactBody(user, { twitter: 'janedoe_tw', projectUrl: 'https://github.com/janedoe/myproject' })

  assert.ok(body.includes('twitter.com/janedoe_tw'), 'includes twitter link')
  assert.ok(body.includes('@janedoe_tw'), 'includes twitter handle')
})

// ── renderLicenseBody ────────────────────────────────────────────────────────

test('renderLicenseBody uses the licenseInfo name and description for MIT', () => {
  const body = renderLicenseBody('MIT', { projectUrl: 'https://github.com/owner/repo' })

  assert.ok(body.includes('MIT License'), 'uses license name')
  assert.ok(body.includes('https://github.com/owner/repo/blob/HEAD/LICENSE'), 'correct LICENSE link')
  assert.ok(body.includes('permissive'), 'includes description text')
})

// ── parseHeaderFields / renderHeaderBody round-trip ──────────────────────────

test('parseHeaderFields ∘ renderHeaderBody round-trips the fields', () => {
  const fields = {
    projectTitle: 'My Awesome Project',
    tagline: 'The best tool ever built',
    logoPath: 'images/logo.png',
    docsUrl: 'https://docs.example.com',
    demoUrl: 'https://demo.example.com',
    projectUrl: 'https://github.com/owner/repo'
  }
  const body = renderHeaderBody(fields)
  const parsed = parseHeaderFields(body)
  assert.deepEqual(parsed, fields)
})

// ── applyAuthorToDoc ─────────────────────────────────────────────────────────

test('applyAuthorToDoc replaces contact block body and leaves other blocks untouched', async () => {
  const doc = await newDocument()
  const user = { name: 'Test User', login: 'testuser', email: 'test@example.com', html_url: 'https://github.com/testuser', avatar_url: 'https://avatars.githubusercontent.com/u/99' }
  const result = applyAuthorToDoc(doc, user)

  const contactBlock = result.blocks.find(b => b.type === 'contact')
  assert.ok(contactBlock, 'contact block exists')
  assert.ok(contactBlock.body.includes('Test User'), 'body updated with user name')
  assert.ok(contactBlock.body.includes('test@example.com'), 'body updated with email')

  // Other blocks unchanged
  const otherBlocksBefore = doc.blocks.filter(b => b.type !== 'contact')
  const otherBlocksAfter = result.blocks.filter(b => b.type !== 'contact')
  assert.deepEqual(otherBlocksAfter, otherBlocksBefore, 'other blocks untouched')
})

// ── applyLicenseToDoc ────────────────────────────────────────────────────────

test('applyLicenseToDoc replaces license block body and leaves other blocks untouched', async () => {
  const doc = await newDocument()
  const result = applyLicenseToDoc(doc, 'Apache 2.0')

  const licBlock = result.blocks.find(b => b.type === 'license')
  assert.ok(licBlock, 'license block exists')
  assert.ok(licBlock.body.includes('Apache License 2.0'), 'body updated with Apache license name')

  const otherBlocksBefore = doc.blocks.filter(b => b.type !== 'license')
  const otherBlocksAfter = result.blocks.filter(b => b.type !== 'license')
  assert.deepEqual(otherBlocksAfter, otherBlocksBefore, 'other blocks untouched')
})

// ── applyHeaderToDoc ──────────────────────────────────────────────────────────

test('applyHeaderToDoc replaces header block body and leaves other blocks untouched', async () => {
  const doc = await newDocument()
  const fields = {
    projectTitle: 'New Title',
    tagline: 'New tagline here',
    logoPath: '',
    docsUrl: '',
    demoUrl: '',
    projectUrl: 'https://github.com/owner/newrepo'
  }
  const result = applyHeaderToDoc(doc, fields)

  const headerBlock = result.blocks.find(b => b.type === 'header')
  assert.ok(headerBlock, 'header block exists')
  assert.ok(headerBlock.body.includes('New Title'), 'header body updated with new title')

  const otherBlocksBefore = doc.blocks.filter(b => b.type !== 'header')
  const otherBlocksAfter = result.blocks.filter(b => b.type !== 'header')
  assert.deepEqual(otherBlocksAfter, otherBlocksBefore, 'other blocks untouched')
})
