import { parseDocument } from '../core/blocks.js'
import { parseManifest } from '../core/parseManifest.js'
import { applyManifest } from '../core/applyManifest.js'
import { buildReadme } from '../core/buildReadme.js'
import { licenseInfo } from '../core/licenses.js'
import { KNOWN_SECTIONS, slug } from '../core/managed.js'
import { parseRepo } from '../core/generateReadme.js'

// ── helpers ──────────────────────────────────────────────────────────────────

const CANONICAL_INDEX = new Map(KNOWN_SECTIONS.map((s, i) => [s.type, i]))

function canonicalInsertIndex (blocks, type) {
  const targetCanon = CANONICAL_INDEX.get(type) !== undefined ? CANONICAL_INDEX.get(type) : Infinity
  let insertAt = 0
  for (let i = 0; i < blocks.length; i++) {
    const blockCanon = CANONICAL_INDEX.get(blocks[i].type) !== undefined ? CANONICAL_INDEX.get(blocks[i].type) : Infinity
    if (blockCanon <= targetCanon) {
      insertAt = i + 1
    }
  }
  return insertAt
}

function makeBlockId (heading, blocks) {
  const base = heading ? slug(heading) : 'header'
  return base + '-' + blocks.length
}

// ── newDocument ──────────────────────────────────────────────────────────────

/**
 * Build a default Document from a template with safe placeholder values.
 * @returns {Promise<{ meta: object, blocks: Array }>}
 */
export async function newDocument () {
  const defaults = {
    projectTitle: 'Project Title',
    projectUrl: '',
    tableOfContents: true,
    license: 'MIT',
    tagline: '',
    description: '',
    install: '',
    usage: '',
    tests: '',
    builtWith: '',
    modules: '',
    devModules: '',
    contributors: '',
    twitter: '',
    linkedin: '',
    conCov: false,
    author: {
      login: '',
      name: '',
      email: '',
      html_url: '',
      avatar_url: ''
    }
  }
  const result = await buildReadme(defaults, { lookup: async () => ({ ok: false }) })
  return parseDocument(result.markdown)
}

// ── applyManifestToDoc ───────────────────────────────────────────────────────

/**
 * Parse a manifest file and merge its dependency lists into the document.
 * Propagates the engine's Error on bad input.
 * @param {{ meta: object, blocks: Array }} doc
 * @param {string} filename
 * @param {string} contents
 * @returns {{ meta: object, blocks: Array }}
 */
export function applyManifestToDoc (doc, filename, contents) {
  const parsed = parseManifest(filename, contents)
  return applyManifest(doc, parsed)
}

// ── renderContactBody ────────────────────────────────────────────────────────

/**
 * Build the Contact block body from a GitHub user object.
 * @param {{ name: string, login: string, email: string, html_url: string, avatar_url: string }} user
 * @param {{ twitter: string, projectUrl: string }} opts
 * @returns {string}
 */
export function renderContactBody (user, { twitter, projectUrl }) {
  let contactLine = user.name
  if (twitter) contactLine += ` - [@${twitter}](https://twitter.com/${twitter})`
  contactLine += ` - ${user.email}`

  return [
    contactLine,
    '',
    `Project Link: [${projectUrl}](${projectUrl})`,
    '',
    `![${user.name}](${user.avatar_url}&s=48) Reach me by email at [${user.email}](mailto:${user.email}) or on GitHub at [@${user.login}](${user.html_url}).`
  ].join('\n')
}

// ── applyAuthorToDoc ─────────────────────────────────────────────────────────

/**
 * Replace or create the contact block body with renderContactBody output.
 * Returns a NEW document.
 * @param {{ meta: object, blocks: Array }} doc
 * @param {{ name: string, login: string, email: string, html_url: string, avatar_url: string }} user
 * @returns {{ meta: object, blocks: Array }}
 */
export function applyAuthorToDoc (doc, user) {
  const twitter = ''
  const projectUrl = doc.meta.projectUrl || ''
  const body = renderContactBody(user, { twitter, projectUrl })

  return replaceOrInsertBlock(doc, 'contact', body)
}

// ── renderLicenseBody ────────────────────────────────────────────────────────

/**
 * Build the License block body string.
 * @param {string} key  license key (e.g. 'MIT')
 * @param {{ projectUrl: string }} opts
 * @returns {string}
 */
export function renderLicenseBody (key, { projectUrl }) {
  const lic = licenseInfo(key) || { name: key, description: '' }
  const { owner, repo } = parseRepo(projectUrl)
  const repoBase = `https://github.com/${owner}/${repo}`
  return `Distributed under the ${lic.name}. See [\`LICENSE\`](${repoBase}/blob/HEAD/LICENSE) for more information.\n\n${lic.description}`
}

// ── applyLicenseToDoc ────────────────────────────────────────────────────────

/**
 * Replace or create the license block body.
 * Returns a NEW document.
 * @param {{ meta: object, blocks: Array }} doc
 * @param {string} key
 * @returns {{ meta: object, blocks: Array }}
 */
export function applyLicenseToDoc (doc, key) {
  const body = renderLicenseBody(key, { projectUrl: doc.meta.projectUrl || '' })
  return replaceOrInsertBlock(doc, 'license', body)
}

// ── parseHeaderFields / renderHeaderBody ─────────────────────────────────────

/**
 * Render the header block body from named fields.
 * Mirrors the shape that generateReadme's header() function emits.
 * @param {{ projectTitle: string, tagline: string, logoPath: string, docsUrl: string, demoUrl: string, projectUrl: string }} fields
 * @returns {string}
 */
export function renderHeaderBody (fields) {
  const { projectTitle, tagline, logoPath, docsUrl, demoUrl, projectUrl } = fields
  const { owner, repo } = parseRepo(projectUrl)
  const repoBase = `https://github.com/${owner}/${repo}`
  const lines = ['<br />', '<div align="center">', `  <a href="${projectUrl}">`]
  if (logoPath) lines.push(`    <img src="${logoPath}" alt="Logo" width="80" height="80">`)
  lines.push(
    '  </a>',
    '',
    `  <h3 align="center">${projectTitle}</h3>`,
    '',
    '  <p align="center">',
    `    ${tagline}`,
    '    <br />'
  )
  if (docsUrl) lines.push(`    <a href="${docsUrl}"><strong>Explore the docs »</strong></a>`, '    <br />')
  lines.push('    <br />')
  if (demoUrl) lines.push(`    <a href="${demoUrl}">View Demo</a>`, '    &middot;')
  lines.push(
    `    <a href="${repoBase}/issues/new?labels=bug">Report Bug</a>`,
    '    &middot;',
    `    <a href="${repoBase}/issues/new?labels=enhancement">Request Feature</a>`,
    '  </p>',
    '</div>'
  )
  return lines.join('\n')
}

/**
 * Extract header fields from a rendered header block body.
 * @param {string} body
 * @returns {{ projectTitle: string, tagline: string, logoPath: string, docsUrl: string, demoUrl: string, projectUrl: string }}
 */
export function parseHeaderFields (body) {
  // projectUrl: from <a href="..."> immediately after <div align="center">
  const projectUrlMatch = /<div align="center">\s*<a href="([^"]*)"/.exec(body)
  const projectUrl = projectUrlMatch ? projectUrlMatch[1] : ''

  // logoPath: from <img src="..." alt="Logo" ...>
  const logoPathMatch = /<img src="([^"]*)" alt="Logo"/.exec(body)
  const logoPath = logoPathMatch ? logoPathMatch[1] : ''

  // projectTitle: from <h3 align="center">...</h3>
  const projectTitleMatch = /<h3 align="center">([^<]*)<\/h3>/.exec(body)
  const projectTitle = projectTitleMatch ? projectTitleMatch[1] : ''

  // tagline: first non-empty content line inside <p align="center">
  const taglineMatch = /<p align="center">\n[ \t]+([^\n<][^\n]*)/.exec(body)
  const tagline = taglineMatch ? taglineMatch[1].trim() : ''

  // docsUrl: from <a href="..."><strong>Explore the docs
  const docsUrlMatch = /<a href="([^"]*)"><strong>Explore the docs/.exec(body)
  const docsUrl = docsUrlMatch ? docsUrlMatch[1] : ''

  // demoUrl: from <a href="...">View Demo
  const demoUrlMatch = /<a href="([^"]*)">View Demo/.exec(body)
  const demoUrl = demoUrlMatch ? demoUrlMatch[1] : ''

  return { projectTitle, tagline, logoPath, docsUrl, demoUrl, projectUrl }
}

// ── applyHeaderToDoc ──────────────────────────────────────────────────────────

/**
 * Replace the header block body with renderHeaderBody output.
 * The header block always exists. Returns a NEW document.
 * @param {{ meta: object, blocks: Array }} doc
 * @param {{ projectTitle: string, tagline: string, logoPath: string, docsUrl: string, demoUrl: string, projectUrl: string }} fields
 * @returns {{ meta: object, blocks: Array }}
 */
export function applyHeaderToDoc (doc, fields) {
  const body = renderHeaderBody(fields)
  return replaceOrInsertBlock(doc, 'header', body)
}

// ── shared block-replace helper ───────────────────────────────────────────────

/**
 * Replace the body of an existing block of `type`, or create it in canonical
 * position if absent. Returns a NEW document (no mutation).
 * @param {{ meta: object, blocks: Array }} doc
 * @param {string} type
 * @param {string} body
 * @returns {{ meta: object, blocks: Array }}
 */
function replaceOrInsertBlock (doc, type, body) {
  const blockIdx = doc.blocks.findIndex(b => b.type === type)

  if (blockIdx !== -1) {
    const block = doc.blocks[blockIdx]
    const updatedBlock = { ...block, body }
    const blocks = [
      ...doc.blocks.slice(0, blockIdx),
      updatedBlock,
      ...doc.blocks.slice(blockIdx + 1)
    ]
    return { meta: doc.meta, blocks }
  }

  // Block absent — create it in canonical position
  const section = KNOWN_SECTIONS.find(s => s.type === type)
  const heading = section ? section.heading : type
  const level = section ? section.level : 2
  const newBlocks = doc.blocks.slice()
  const newBlock = {
    id: makeBlockId(heading, newBlocks),
    type,
    heading,
    level,
    body
  }
  const insertAt = canonicalInsertIndex(newBlocks, type)
  const blocks = [
    ...newBlocks.slice(0, insertAt),
    newBlock,
    ...newBlocks.slice(insertAt)
  ]
  return { meta: doc.meta, blocks }
}
