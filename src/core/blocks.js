import { KNOWN_SECTIONS, BACK_TO_TOP, slug, emitShields, emitRefs, emitToc } from './managed.js'
import { parseRepo } from './generateReadme.js'

// Lookup map: normalised heading text → { type, level }
// Normalise: lowercase and collapse whitespace
const SECTION_MAP = new Map(
  KNOWN_SECTIONS
    .filter(s => s.heading !== '')
    .map(s => [s.heading.toLowerCase().replace(/\s+/g, ' '), { type: s.type, level: s.level }])
)

// ── Managed key set (derived from managed.js, never hardcoded) ──
// Emit dummy calls with every optional enabled so we capture the full set.
const _dummyRefs = emitRefs({ owner: 'o', repo: 'r', linkedin: 'l', conCov: true })
const _dummyShields = emitShields({ owner: 'o', repo: 'r', linkedin: 'l', conCov: true })
const MANAGED_KEYS = new Set()
for (const line of [..._dummyRefs.split('\n'), ..._dummyShields.split('\n')]) {
  // Ref-def labels: [key]: value
  const rm = line.match(/^\[([^\]]+)\]:/)
  if (rm) MANAGED_KEYS.add(rm[1])
  // Shield badge image-ref and link-ref labels: [![alt][img-ref]][link-ref]
  const sm = line.match(/\[!\[[^\]]*\]\[([^\]]+)\]\]\[([^\]]+)\]/)
  if (sm) { MANAGED_KEYS.add(sm[1]); MANAGED_KEYS.add(sm[2]) }
}

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

  // Shield-badge lines: [![alt][img-ref]][link-ref] — captures img-ref label in group 1.
  // Inline image links like [![screenshot](url)](url) use `](` instead, so they are kept.
  const shieldLabelRe = /^\[!\[[^\]]*\]\[([^\]]+)\]\]\[/

  // Ref-link definition lines — captures label in group 1.
  const refLabelRe = /^\[([^\]]+)\]:/

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

      // Only strip ref-def lines whose label is a managed key (Finding 1)
      const refM = refLabelRe.exec(line)
      if (refM) {
        if (MANAGED_KEYS.has(refM[1])) continue
        // Non-managed ref-def: keep as body content
      }

      // Only strip shield badge lines whose image-ref label is a managed key (Finding 1)
      const shieldM = shieldLabelRe.exec(line)
      if (shieldM) {
        if (MANAGED_KEYS.has(shieldM[1])) continue
        // Non-managed badge: keep as body content
      }

      // MARKDOWN LINKS & IMAGES comment banner
      if (line.trim() === '<!-- MARKDOWN LINKS & IMAGES -->') continue
      // https://... comment lines that appear right after that banner
      if (/^<!-- https?:\/\//.test(line)) continue

      // Section banner comments: <!-- SECTION NAME --> (Finding 2)
      if (/^<!-- [A-Z0-9 &/-]+ -->$/.test(line.trim())) continue
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

/**
 * Render a single block to a markdown string (heading + body).
 * @param {{ heading: string, level: number, body: string }} block
 * @returns {string}
 */
function renderBlock (block) {
  const prefix = '#'.repeat(block.level) + ' ' + block.heading
  return block.body ? prefix + '\n\n' + block.body : prefix
}

/**
 * Serialize a Document back to a README markdown string.
 * The output is byte-for-byte identical to the generateReadme output when the
 * document was produced by parseDocument(generateReadme(fixture)).
 * @param {{ meta: { projectUrl: string, linkedin: string, conCov: boolean, tableOfContents: boolean }, blocks: Array }} doc
 * @returns {string}
 */
export function serializeDocument (doc) {
  const { meta, blocks } = doc
  const { owner, repo } = parseRepo(meta.projectUrl)
  const { linkedin, conCov, tableOfContents } = meta

  // Derive TOC flags from which section types are actually present.
  const hasType = (type) => blocks.some(b => b.type === type)
  const hasModules = hasType('dependencies')
  const hasDevModules = hasType('devDependencies')
  const includePrerequisites = hasType('prerequisites')
  const includeRoadmap = hasType('roadmap')
  const includeAcknowledgments = hasType('acknowledgments')

  const headerBlock = blocks.find(b => b.type === 'header')
  const sectionBlocks = blocks.filter(b => b.type !== 'header')

  const pieces = []
  pieces.push('<a id="readme-top"></a>')
  pieces.push(emitShields({ owner, repo, linkedin, conCov }))
  if (headerBlock) pieces.push(headerBlock.body)
  if (tableOfContents) {
    pieces.push(emitToc({ hasModules, hasDevModules, includePrerequisites, includeRoadmap, includeAcknowledgments }))
  }

  // Emit section blocks; insert BACK_TO_TOP before each level-2 block except the first.
  let firstLevel2Seen = false
  for (const block of sectionBlocks) {
    if (block.level === 2) {
      if (firstLevel2Seen) {
        pieces.push(BACK_TO_TOP)
      } else {
        firstLevel2Seen = true
      }
    }
    pieces.push(renderBlock(block))
  }

  // Final BACK_TO_TOP before refs.
  pieces.push(BACK_TO_TOP)
  pieces.push(emitRefs({ owner, repo, linkedin, conCov }))

  return pieces.join('\n\n') + '\n'
}
