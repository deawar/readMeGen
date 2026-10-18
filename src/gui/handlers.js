import { parseDocument, serializeDocument } from '../core/blocks.js'
import { fetchAuthenticatedUser } from '../github/fetchAuthenticatedUser.js'
import { fetchGitHubUser } from '../github/fetchGitHubUser.js'
import * as docOps from './docOps.js'

// A real package.json / requirements.txt is small; cap the accepted size so a
// dropped file can't be read wholesale into memory. 1 MB is generous.
const MAX_MANIFEST_BYTES = 1_000_000

// ── openReadme ────────────────────────────────────────────────────────────────

/**
 * Show an open-file dialog and parse the chosen README.
 * Sets deps.pathState.current to the chosen path on success.
 * @param {object} deps
 * @returns {Promise<{canceled:true}|{path:string, document:object}>}
 */
export async function openReadme (deps) {
  const { canceled, filePaths } = await deps.dialog.showOpen()
  if (canceled) return { canceled: true }
  const path = filePaths[0]
  deps.pathState.current = path
  const text = await deps.readFile(path)
  const document = parseDocument(text)
  return { path, document }
}

// ── saveReadme ────────────────────────────────────────────────────────────────

/**
 * Serialize a document and write it to the main-held path.
 * The renderer-supplied path (if any) is intentionally ignored — the main
 * process owns the write destination to prevent path-traversal attacks.
 * If deps.pathState.current is null, a save dialog is shown.
 * @param {object} deps
 * @param {{document:object}} payload  (any path key in payload is ignored)
 * @returns {Promise<{canceled:true}|{path:string}>}
 */
export async function saveReadme (deps, { document } = {}) {
  let savePath = deps.pathState.current
  if (!savePath) {
    const result = await deps.dialog.showSave()
    if (result.canceled) return { canceled: true }
    savePath = result.filePath
    deps.pathState.current = savePath
  }
  const text = serializeDocument(document)
  await deps.writeFile(savePath, text)
  return { path: savePath }
}

// ── newReadme ─────────────────────────────────────────────────────────────────

/**
 * Build a default document and reset the main-held save path.
 * Clearing pathState.current ensures a subsequent Save will prompt for a new
 * path instead of silently overwriting whatever file was previously opened.
 * @param {object} deps
 * @returns {Promise<{document:object}>}
 */
export async function newReadme (deps) {
  if (deps && deps.pathState) {
    deps.pathState.current = null
  }
  const document = await docOps.newDocument()
  return { document }
}

// ── applyManifest ─────────────────────────────────────────────────────────────

/**
 * Parse and apply a manifest file to the document.
 * Returns {error} on a thrown Error; does not propagate.
 * @param {object} deps
 * @param {{document:object, filename:string, contents:string}} payload
 * @returns {Promise<{document:object}|{document:object, error:string}>}
 */
export async function applyManifest (deps, { document, filename, contents }) {
  if (typeof contents === 'string' && contents.length > MAX_MANIFEST_BYTES) {
    return { document, error: 'manifest too large' }
  }
  try {
    const updated = docOps.applyManifestToDoc(document, filename, contents)
    return { document: updated }
  } catch (err) {
    return { document, error: err.message }
  }
}

// ── resolveAuthor ─────────────────────────────────────────────────────────────

/**
 * Resolve the current author: GitHub token → git config → null.
 * Never throws.
 * @param {object} deps
 * @returns {Promise<{user:object}|{user:null}>}
 */
export async function resolveAuthor (deps) {
  if (deps.token) {
    const result = await fetchAuthenticatedUser({ token: deps.token, client: deps.client })
    if (result.ok) return { user: result.user }
  }

  // Resolve each key independently: `git config user.email` exits non-zero
  // (exec throws) when unset, which must not discard a present user.name.
  const name = gitConfig(deps, 'user.name')
  const email = gitConfig(deps, 'user.email')
  if (name) {
    return {
      user: {
        login: '',
        name,
        email,
        html_url: '',
        avatar_url: ''
      }
    }
  }

  return { user: null }
}

/**
 * Read a single git config key via the injected exec dep; '' if unavailable.
 * @param {object} deps
 * @param {string} key
 * @returns {string}
 */
function gitConfig (deps, key) {
  try {
    return deps.exec(key).trim()
  } catch {
    return ''
  }
}

// ── applyAuthor ───────────────────────────────────────────────────────────────

/**
 * Resolve the author and apply to the document.
 * @param {object} deps
 * @param {{document:object}} payload
 * @returns {Promise<{document:object, user:object|null}>}
 */
export async function applyAuthor (deps, { document }) {
  const { user } = await resolveAuthor(deps)
  const fallback = { login: '', name: '', email: '', html_url: '', avatar_url: '' }
  const updated = docOps.applyAuthorToDoc(document, user || fallback)
  return { document: updated, user }
}

// ── applyLicense ──────────────────────────────────────────────────────────────

/**
 * Apply a license key to the document.
 * @param {object} _deps
 * @param {{document:object, key:string}} payload
 * @returns {Promise<{document:object}>}
 */
export async function applyLicense (_deps, { document, key }) {
  const updated = docOps.applyLicenseToDoc(document, key)
  return { document: updated }
}

// ── setHeader ─────────────────────────────────────────────────────────────────

/**
 * Apply header fields to the document.
 * @param {object} _deps
 * @param {{document:object, fields:object}} payload
 * @returns {Promise<{document:object}>}
 */
export async function setHeader (_deps, { document, fields }) {
  const updated = docOps.applyHeaderToDoc(document, fields)
  return { document: updated }
}

// ── serializeDoc ──────────────────────────────────────────────────────────────

/**
 * Serialize a document to markdown text without writing to disk.
 * Backs Preview/Markdown tabs.
 * @param {object} _deps
 * @param {{document:object}} payload
 * @returns {Promise<{text:string}>}
 */
export async function serializeDoc (_deps, { document }) {
  const text = serializeDocument(document)
  return { text }
}

// ── lookupUser ────────────────────────────────────────────────────────────────

/**
 * Fetch a GitHub user by username.
 * @param {object} deps
 * @param {{username:string}} payload
 * @returns {Promise<object>}
 */
export async function lookupUser (deps, { username }) {
  return fetchGitHubUser(username, { token: deps.token, client: deps.client })
}

// ── renderMarkdown ────────────────────────────────────────────────────────────

/**
 * Render markdown to HTML and sanitize it before it reaches the renderer.
 * Sanitization is mandatory: deps.sanitize is the main-side DOMPurify choke
 * point, so a missing sanitizer must fail loudly rather than pass raw HTML.
 * @param {object} deps
 * @param {{markdown:string}} payload
 * @returns {Promise<{html:string}>}
 */
export async function renderMarkdown (deps, { markdown }) {
  const html = deps.sanitize(deps.md.render(markdown))
  return { html }
}
