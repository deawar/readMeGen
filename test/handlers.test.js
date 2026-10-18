import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  openReadme,
  saveReadme,
  newReadme,
  applyManifest,
  resolveAuthor,
  applyAuthor,
  applyLicense,
  setHeader,
  serializeDoc,
  lookupUser,
  renderMarkdown
} from '../src/gui/handlers.js'
import { serializeDocument } from '../src/core/blocks.js'

// ── fake deps factory ─────────────────────────────────────────────────────────

function makeDeps (overrides) {
  const store = {}
  return {
    dialog: {
      showOpen: () => ({ canceled: false, filePaths: ['/fake/README.md'] }),
      showSave: () => ({ canceled: false, filePath: '/fake/out.md' })
    },
    readFile: async (p) => store[p] || '',
    writeFile: async (p, text) => { store[p] = text },
    exec: () => '',
    md: { render: (s) => '<p>' + s + '</p>' },
    sanitize: (html) => html,
    token: undefined,
    client: undefined,
    pathState: { current: null },
    _store: store,
    ...overrides
  }
}

// ── openReadme ────────────────────────────────────────────────────────────────

test('openReadme returns parsed document for a chosen file', async () => {
  const sampleMd = '## About\n\nHello world\n'
  const deps = makeDeps({
    dialog: {
      showOpen: () => ({ canceled: false, filePaths: ['/fake/README.md'] }),
      showSave: () => ({ canceled: false, filePath: '/fake/out.md' })
    },
    readFile: async () => sampleMd
  })
  const result = await openReadme(deps)
  assert.ok(!result.canceled, 'not canceled')
  assert.equal(result.path, '/fake/README.md')
  assert.ok(result.document && typeof result.document === 'object', 'has document')
  assert.ok(Array.isArray(result.document.blocks), 'document has blocks')
})

test('openReadme sets pathState.current to the opened path', async () => {
  const sampleMd = '## About\n\nHello world\n'
  const deps = makeDeps({
    dialog: {
      showOpen: () => ({ canceled: false, filePaths: ['/fake/README.md'] }),
      showSave: () => ({ canceled: false, filePath: '/fake/out.md' })
    },
    readFile: async () => sampleMd
  })
  assert.equal(deps.pathState.current, null, 'pathState.current starts null')
  await openReadme(deps)
  assert.equal(deps.pathState.current, '/fake/README.md', 'pathState.current set to opened path')
})

test('openReadme does not set pathState.current when canceled', async () => {
  const deps = makeDeps({
    dialog: {
      showOpen: () => ({ canceled: true, filePaths: [] }),
      showSave: () => ({ canceled: false, filePath: '/fake/out.md' })
    },
    readFile: async () => ''
  })
  await openReadme(deps)
  assert.equal(deps.pathState.current, null, 'pathState.current remains null on cancel')
})

test('openReadme handles cancel', async () => {
  let readCalled = false
  const deps = makeDeps({
    dialog: {
      showOpen: () => ({ canceled: true, filePaths: [] }),
      showSave: () => ({ canceled: false, filePath: '/fake/out.md' })
    },
    readFile: async () => { readCalled = true; return '' }
  })
  const result = await openReadme(deps)
  assert.deepEqual(result, { canceled: true })
  assert.equal(readCalled, false, 'readFile never called when canceled')
})

// ── saveReadme ────────────────────────────────────────────────────────────────

test('saveReadme serializes and writes when pathState.current is set', async () => {
  const { document } = await newReadme()
  const written = {}
  const deps = makeDeps({
    pathState: { current: '/fake/out.md' },
    writeFile: async (p, text) => { written[p] = text }
  })
  const result = await saveReadme(deps, { document })
  assert.ok(!result.canceled, 'not canceled')
  assert.equal(result.path, '/fake/out.md')
  const expectedText = serializeDocument(document)
  assert.equal(written['/fake/out.md'], expectedText, 'wrote serialized text')
})

test('saveReadme prompts for path when pathState.current is null', async () => {
  const { document } = await newReadme()
  const written = {}
  const deps = makeDeps({
    writeFile: async (p, text) => { written[p] = text }
  })
  const result = await saveReadme(deps, { document })
  assert.ok(!result.canceled, 'not canceled')
  assert.equal(result.path, '/fake/out.md', 'uses dialog-chosen path')
  assert.ok(written['/fake/out.md'], 'wrote to dialog path')
})

test('saveReadme sets pathState.current when falling back to dialog', async () => {
  const { document } = await newReadme()
  const deps = makeDeps({
    writeFile: async () => {}
  })
  assert.equal(deps.pathState.current, null, 'pathState.current starts null')
  await saveReadme(deps, { document })
  assert.equal(deps.pathState.current, '/fake/out.md', 'pathState.current updated to dialog path')
})

test('saveReadme handles cancel from save dialog', async () => {
  const { document } = await newReadme()
  let writeCalled = false
  const deps = makeDeps({
    dialog: {
      showOpen: () => ({ canceled: false, filePaths: ['/fake/README.md'] }),
      showSave: () => ({ canceled: true, filePath: undefined })
    },
    writeFile: async () => { writeCalled = true }
  })
  const result = await saveReadme(deps, { document })
  assert.deepEqual(result, { canceled: true })
  assert.equal(writeCalled, false, 'writeFile never called when canceled')
})

// ── SECURITY: renderer-supplied path must be ignored ──────────────────────────

test('saveReadme SECURITY: ignores renderer-supplied path, uses pathState.current', async () => {
  const { document } = await newReadme()
  const writtenPaths = []
  const deps = makeDeps({
    pathState: { current: '/safe/path.md' },
    writeFile: async (p, text) => { writtenPaths.push(p) }
  })
  // Renderer (possibly compromised) supplies an evil path in the payload
  const result = await saveReadme(deps, { document, path: '/evil/path' })
  assert.ok(!result.canceled, 'not canceled')
  assert.equal(result.path, '/safe/path.md', 'returned path is the safe one')
  assert.ok(writtenPaths.includes('/safe/path.md'), 'wrote to safe path')
  assert.ok(!writtenPaths.includes('/evil/path'), 'did NOT write to evil path')
})

// ── newReadme ─────────────────────────────────────────────────────────────────

test('newReadme returns a document', async () => {
  const result = await newReadme()
  assert.ok(result && typeof result === 'object', 'returns object')
  assert.ok(result.document, 'has document')
  assert.ok(Array.isArray(result.document.blocks), 'document has blocks')
})

test('newReadme resets pathState.current to null (prevents overwriting opened file)', async () => {
  const deps = makeDeps({ pathState: { current: '/some/opened.md' } })
  assert.equal(deps.pathState.current, '/some/opened.md', 'pathState.current pre-seeded')
  const result = await newReadme(deps)
  assert.equal(deps.pathState.current, null, 'pathState.current must be null after newReadme')
  assert.ok(result.document && Array.isArray(result.document.blocks), 'returned fresh document with blocks')
})

test('newReadme → saveReadme exploit sequence: save must prompt dialog, not overwrite opened file', async () => {
  // Simulate: Open a file (pathState set) → New (should clear pathState) → Save (must use dialog)
  const written = {}
  let dialogCalled = false
  const deps = makeDeps({
    pathState: { current: '/some/opened.md' },
    dialog: {
      showOpen: () => ({ canceled: false, filePaths: ['/some/opened.md'] }),
      showSave: () => { dialogCalled = true; return { canceled: false, filePath: '/new/save.md' } }
    },
    writeFile: async (p, text) => { written[p] = text }
  })
  // Step 1: New resets pathState
  const { document } = await newReadme(deps)
  assert.equal(deps.pathState.current, null, 'pathState.current cleared by newReadme')
  // Step 2: Save must invoke the dialog (because pathState.current is now null)
  const result = await saveReadme(deps, { document })
  assert.ok(dialogCalled, 'save dialog must have been invoked')
  assert.ok(!written['/some/opened.md'], 'must NOT have written to the previously opened file')
  assert.equal(result.path, '/new/save.md', 'must save to the dialog-chosen path')
})

// ── applyManifest ─────────────────────────────────────────────────────────────

test('applyManifest returns updated document on valid package.json', async () => {
  const { document } = await newReadme()
  const deps = makeDeps()
  const result = await applyManifest(deps, {
    document,
    filename: 'package.json',
    contents: '{"dependencies":{"axios":"1"}}'
  })
  assert.ok(result.document, 'has document')
  assert.ok(!result.error, 'no error')
  const depBlock = result.document.blocks.find(b => b.type === 'dependencies')
  assert.ok(depBlock, 'dependencies block added')
})

test('applyManifest returns {error} on invalid manifest, document unchanged', async () => {
  const { document } = await newReadme()
  const deps = makeDeps()
  const result = await applyManifest(deps, {
    document,
    filename: 'package.json',
    contents: 'not-json'
  })
  assert.ok(result.error, 'has error message')
  assert.ok(typeof result.error === 'string', 'error is a string')
  assert.deepEqual(result.document, document, 'document unchanged')
})

// ── resolveAuthor ─────────────────────────────────────────────────────────────

test('resolveAuthor falls back to null when no token and git config empty', async () => {
  const deps = makeDeps({ exec: () => '' })
  const result = await resolveAuthor(deps)
  assert.deepEqual(result, { user: null })
})

test('resolveAuthor passes bare keys to exec dep (contract-pinning)', async () => {
  // This test pins the contract between handlers.js and main.cjs's exec dep.
  // main.cjs builds exec as: exec(key) => execFileSync('git', ['config', key], ...)
  // So handlers.js MUST call exec('user.name') and exec('user.email') — bare keys only.
  // If the handler ever reverts to 'git config user.name', this test turns RED.
  const execArgs = []
  const deps = makeDeps({
    exec: (arg) => {
      execArgs.push(arg)
      if (arg === 'user.name') return 'Test User'
      if (arg === 'user.email') return 'test@example.com'
      return ''
    }
  })
  const result = await resolveAuthor(deps)
  assert.ok(result.user, 'has user')
  assert.equal(result.user.name, 'Test User')
  assert.equal(result.user.email, 'test@example.com')
  assert.equal(result.user.login, '')
  // Contract: bare keys must be passed, never the full 'git config ...' string
  assert.ok(execArgs.includes('user.name'), 'exec called with bare key "user.name"')
  assert.ok(execArgs.includes('user.email'), 'exec called with bare key "user.email"')
  assert.ok(!execArgs.some(a => a.startsWith('git config')), 'exec never called with "git config ..." prefix')
})

test('resolveAuthor uses token when provided', async () => {
  const fakeUser = { login: 'deawar', name: 'Dean', email: 'd@e.com', html_url: 'u', avatar_url: 'a', bio: 'b' }
  const deps = makeDeps({
    token: 'mytoken',
    client: async () => ({ data: fakeUser })
  })
  const result = await resolveAuthor(deps)
  assert.ok(result.user, 'has user')
  assert.equal(result.user.login, 'deawar')
})

test('resolveAuthor never throws even if exec throws', async () => {
  const deps = makeDeps({ exec: () => { throw new Error('no git') } })
  const result = await resolveAuthor(deps)
  assert.deepEqual(result, { user: null })
})

// ── applyAuthor ───────────────────────────────────────────────────────────────

test('applyAuthor returns document and user', async () => {
  const { document } = await newReadme()
  const fakeUser = { login: 'deawar', name: 'Dean', email: 'd@e.com', html_url: 'u', avatar_url: 'a', bio: 'b' }
  const deps = makeDeps({
    token: 'tok',
    client: async () => ({ data: fakeUser })
  })
  const result = await applyAuthor(deps, { document })
  assert.ok(result.document, 'has document')
  assert.ok(result.user, 'has user')
  assert.equal(result.user.login, 'deawar')
})

// ── applyLicense ──────────────────────────────────────────────────────────────

test('applyLicense returns updated document', async () => {
  const { document } = await newReadme()
  const result = await applyLicense({}, { document, key: 'MIT' })
  assert.ok(result.document, 'has document')
  const licBlock = result.document.blocks.find(b => b.type === 'license')
  assert.ok(licBlock, 'has license block')
  assert.ok(licBlock.body.includes('MIT'), 'license block mentions MIT')
})

// ── setHeader ─────────────────────────────────────────────────────────────────

test('setHeader returns updated document', async () => {
  const { document } = await newReadme()
  const fields = {
    projectTitle: 'Updated Title',
    tagline: 'My tagline',
    logoPath: '',
    docsUrl: '',
    demoUrl: '',
    projectUrl: 'https://github.com/owner/repo'
  }
  const result = await setHeader({}, { document, fields })
  assert.ok(result.document, 'has document')
  const headerBlock = result.document.blocks.find(b => b.type === 'header')
  assert.ok(headerBlock, 'has header block')
  assert.ok(headerBlock.body.includes('Updated Title'), 'header updated')
})

// ── serializeDoc ──────────────────────────────────────────────────────────────

test('serializeDoc returns text without writing', async () => {
  const { document } = await newReadme()
  let writeCalled = false
  const deps = makeDeps({ writeFile: async () => { writeCalled = true } })
  const result = await serializeDoc(deps, { document })
  assert.ok(typeof result.text === 'string', 'has text string')
  assert.ok(result.text.length > 0, 'non-empty text')
  assert.equal(writeCalled, false, 'writeFile never called')
})

// ── lookupUser ────────────────────────────────────────────────────────────────

test('lookupUser returns result from fetchGitHubUser', async () => {
  const fakeUser = { login: 'octocat', name: 'Octo', email: 'o@c.com', html_url: 'u', avatar_url: 'a', bio: 'b' }
  const deps = makeDeps({
    client: async () => ({ data: fakeUser })
  })
  const result = await lookupUser(deps, { username: 'octocat' })
  assert.equal(result.ok, true)
  assert.equal(result.user.login, 'octocat')
})

test('lookupUser returns not_found when user missing', async () => {
  const deps = makeDeps({
    client: async () => { const err = new Error('404'); err.response = { status: 404 }; throw err }
  })
  const result = await lookupUser(deps, { username: 'nouser' })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'not_found')
})

// ── renderMarkdown ────────────────────────────────────────────────────────────

test('renderMarkdown returns html from the injected renderer', async () => {
  const deps = makeDeps()
  const result = await renderMarkdown(deps, { markdown: 'hello' })
  assert.deepEqual(result, { html: '<p>hello</p>' })
})

test('renderMarkdown passes rendered html through the injected sanitizer', async () => {
  const deps = makeDeps({
    md: { render: (s) => '<p>' + s + '</p><script>alert(1)</script>' },
    sanitize: (html) => html.replace(/<script>.*?<\/script>/g, '')
  })
  const result = await renderMarkdown(deps, { markdown: 'hi' })
  assert.deepEqual(result, { html: '<p>hi</p>' })
})

test('renderMarkdown fails closed when the sanitizer is unwired (no raw passthrough)', async () => {
  const deps = makeDeps({ sanitize: undefined })
  await assert.rejects(() => renderMarkdown(deps, { markdown: 'hi' }))
})
