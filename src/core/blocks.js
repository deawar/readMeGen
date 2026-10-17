import { KNOWN_SECTIONS, BACK_TO_TOP, slug } from './managed.js'

// Lookup map: normalised heading text → { type, level }
// Normalise: lowercase and collapse whitespace
const SECTION_MAP = new Map(
  KNOWN_SECTIONS
    .filter(s => s.heading !== '')
    .map(s => [s.heading.toLowerCase().replace(/\s+/g, ' '), { type: s.type, level: s.level }])
)

function normHeading (h) {
  return h.toLowerCase().replace(/\s+/g, ' ').trim()
}

function resolveType (heading) {
  return SECTION_MAP.get(normHeading(heading)) || { type: 'custom', level: null }
}

// A counter used to generate deterministic unique IDs per parseDocument call.
// Using a closure keeps the module stateless across calls.
function makeId (heading, index) {
  const base = heading ? slug(heading) : 'header'
  return base + '-' + index
}

/**
 * Parse a README markdown string into a Document model.
 * @param {string} markdown
 * @returns {{ meta: { projectUrl: string, linkedin: string, conCov: boolean, tableOfContents: boolean }, blocks: import('./blocks.js').Block[] }}
 */
export function parseDocument (markdown) {
  const lines = markdown.split('\n')

  // ── Pass 1: collect managed metadata from top shields and bottom ref-links ──

  let projectUrl = ''
  let linkedin = ''
  let conCov = false
  let tableOfContents = false

  // Collect bottom reference-link definitions (lines like `[key]: value`)
  const refDefs = {}
  for (const line of lines) {
    const m = line.match(/^\[([^\]]+)\]:\s*(.+)$/)
    if (m) refDefs[m[1].trim()] = m[2].trim()
  }

  // Recover projectUrl from contributors-url ref (strip /graphs/contributors)
  if (refDefs['contributors-url']) {
    projectUrl = refDefs['contributors-url'].replace(/\/graphs\/contributors\/?$/, '')
  }

  // Recover linkedin
  if (refDefs['linkedin-url']) {
    linkedin = refDefs['linkedin-url']
  }

  // Detect conCov: covenant ref definitions present
  if (refDefs['covenant-shield'] || refDefs['covenant-url']) {
    conCov = true
  }

  // ── Pass 2: line-by-line split into raw sections ──
  // Track fenced-code state; never break on headings inside a fence.
  // Drop: <a id="readme-top">, BACK_TO_TOP lines, shield badge lines (top block),
  //       <details>…</details> TOC block, reference-link definition lines.

  // Heading regex: lines starting with ## or ### (only these two levels per spec)
  const headingRe = /^(#{2,3}) (.+)$/

  // Fence toggle: line whose trimmed content starts with ``` or ~~~
  const fenceRe = /^(`{3,}|~{3,})/

  // Shield-badge lines: [![…]][…-url] style
  const shieldRe = /^\[!\[/

  // Ref-link definition lines
  const refRe = /^\[[^\]]+\]:/

  // <details> block detection
  let inDetails = false

  // Sections accumulator: each entry { heading, body[] }
  // heading === null means the pre-heading header region
  const sections = [{ heading: null, bodyLines: [] }]
  let inFence = false

  for (const line of lines) {
    // Toggle fence state (only outside a <details> block)
    if (!inDetails && fenceRe.test(line.trim())) {
      inFence = !inFence
    }

    // Handle <details> TOC block
    if (!inFence && line.trim() === '<details>') {
      inDetails = true
      tableOfContents = true
      continue
    }
    if (inDetails) {
      if (line.trim() === '</details>') inDetails = false
      continue
    }

    // Skip managed scaffold lines (outside fences)
    if (!inFence) {
      if (line.trim() === '<a id="readme-top"></a>') continue
      if (line === BACK_TO_TOP) continue
      if (shieldRe.test(line)) continue
      if (refRe.test(line)) continue
      // MARKDOWN LINKS & IMAGES comment banner
      if (line.trim() === '<!-- MARKDOWN LINKS & IMAGES -->') continue
    }

    // Heading boundary (only outside a fence)
    if (!inFence) {
      const hm = headingRe.exec(line)
      if (hm) {
        sections.push({ heading: hm[2].trim(), level: hm[1].length, bodyLines: [] })
        continue
      }
    }

    // Accumulate line into current section
    sections[sections.length - 1].bodyLines.push(line)
  }

  // ── Pass 3: convert raw sections to Block objects ──
  // Trim leading/trailing blank lines from body; skip entirely-blank sections
  // except for the header block which is always present.

  const blocks = []
  let idIndex = 0

  for (const sec of sections) {
    const isHeader = sec.heading === null

    // Trim leading + trailing blank lines from body
    const bodyLines = sec.bodyLines.slice()
    while (bodyLines.length && bodyLines[0].trim() === '') bodyLines.shift()
    while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop()

    const body = bodyLines.join('\n')

    if (isHeader) {
      // Only include the header block when it has actual content
      if (body) {
        blocks.push({
          id: makeId('', idIndex++),
          type: 'header',
          heading: '',
          level: 0,
          body
        })
      }
      idIndex++
      continue
    }

    const heading = sec.heading
    const info = resolveType(heading)
    const level = sec.level !== undefined ? sec.level : (info.level || 2)

    blocks.push({
      id: makeId(heading, idIndex++),
      type: info.type,
      heading,
      level,
      body
    })
  }

  return {
    meta: { projectUrl, linkedin, conCov, tableOfContents },
    blocks
  }
}
