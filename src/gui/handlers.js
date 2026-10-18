import { parseDocument, serializeDocument } from '../core/blocks.js'
import { fetchAuthenticatedUser } from '../github/fetchAuthenticatedUser.js'
import { fetchGitHubUser } from '../github/fetchGitHubUser.js'
import * as docOps from './docOps.js'

// ── openReadme ────────────────────────────────────────────────────────────────

/**
 * Show an open-file dialog and parse the chosen README.
 * @param {object} deps
 * @returns {Promise<{canceled:true}|{path:string, document:object}>}
 */
export async function openReadme (deps) {
  const { canceled, filePaths } = await deps.dialog.showOpen()
  if (canceled) return { canceled: true }
  const path = filePaths[0]
  const text = await deps.readFile(path)
  const document = parseDocument(text)
  return { path, document }
}

// ── saveReadme ────────────────────────────────────────────────────────────────

/**
 * Serialize a document and write it; prompt for a path if none supplied.
 * @param {object} deps
 * @param {{document:object, path?:string}} payload
 * @returns {Promise<{canceled:true}|{path:string}>}
 */
export async function saveReadme (deps, { document, path } = {}) {
  const text = serializeDocument(document)
  let savePath = path
  if (!savePath) {
    const result = await deps.dialog.showSave()
    if (result.canceled) return { canceled: true }
    savePath = result.filePath
  }
  await deps.writeFile(savePath, text)
  return { path: savePath }
}

// ── newReadme ─────────────────────────────────────────────────────────────────

/**
 * Build a default document.
 * @returns {Promise<{document:object}>}
 */
export async function newReadme () {
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

  try {
    const name = deps.exec('user.name').trim()
    const email = deps.exec('user.email').trim()
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
  } catch {
    // git config unavailable — fall through
  }

  return { user: null }
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
 * Render markdown to HTML using the injected md renderer.
 * @param {object} deps
 * @param {{markdown:string}} payload
 * @returns {Promise<{html:string}>}
 */
export async function renderMarkdown (deps, { markdown }) {
  const html = deps.md.render(markdown)
  return { html }
}
