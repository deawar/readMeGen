import { KNOWN_SECTIONS, slug } from './managed.js'

// Canonical order: index in KNOWN_SECTIONS for each type.
const CANONICAL_INDEX = new Map(KNOWN_SECTIONS.map((s, i) => [s.type, i]))

/**
 * Extract package names from a block body.
 * Handles both linked form  `* [name](url)` and plain form `* name`.
 * @param {string} body
 * @returns {string[]}
 */
function extractNames (body) {
  if (!body) return []
  return body.split('\n').flatMap(line => {
    // Linked: * [name](url)
    const linked = line.match(/^\* \[([^\]]+)\]/)
    if (linked) return [linked[1]]
    // Plain: * name
    const plain = line.match(/^\* (.+)$/)
    if (plain) return [plain[1].trim()]
    return []
  })
}

/**
 * Render a list of names as npm-linked list items.
 * @param {string[]} names
 * @returns {string}
 */
function renderNpmList (names) {
  return names.map(n => `* [${n}](https://www.npmjs.com/package/${n})`).join('\n')
}

/**
 * Render a list of names as plain list items.
 * @param {string[]} names
 * @returns {string}
 */
function renderPlainList (names) {
  return names.map(n => `* ${n}`).join('\n')
}

/**
 * Compute the insertion index in `blocks` that keeps the array in KNOWN_SECTIONS
 * canonical order for a new block of the given `type`.
 * @param {Array<{type: string}>} blocks
 * @param {string} type
 * @returns {number}
 */
function canonicalInsertIndex (blocks, type) {
  const targetCanon = CANONICAL_INDEX.get(type) ?? Infinity
  // Find the last block whose canonical index is less than ours.
  let insertAt = 0
  for (let i = 0; i < blocks.length; i++) {
    const blockCanon = CANONICAL_INDEX.get(blocks[i].type) ?? Infinity
    if (blockCanon <= targetCanon) {
      insertAt = i + 1
    }
  }
  return insertAt
}

/**
 * Generate a unique block id for a newly created block.
 * Matches the convention in blocks.js: slug(heading) + '-' + index.
 * The index is derived from current blocks length to avoid collisions.
 * @param {string} heading
 * @param {Array} blocks
 * @returns {string}
 */
function makeBlockId (heading, blocks) {
  const base = heading ? slug(heading) : 'header'
  return base + '-' + blocks.length
}

/**
 * Merge parsed manifest dependency lists into an existing Document.
 * Returns a NEW document; does not mutate the input.
 *
 * @param {{ meta: object, blocks: Array }} document
 * @param {{ builtWith: string[], modules: string[], devModules: string[] }} parsed
 * @returns {{ meta: object, blocks: Array }}
 */
export function applyManifest (document, parsed) {
  // Clone blocks array (shallow-clone each block on update)
  let blocks = document.blocks.slice()

  const targets = [
    { list: parsed.modules, type: 'dependencies', render: renderNpmList },
    { list: parsed.devModules, type: 'devDependencies', render: renderNpmList },
    { list: parsed.builtWith, type: 'builtWith', render: renderPlainList }
  ]

  for (const { list, type, render } of targets) {
    // Empty parsed list → no change for this target.
    if (!list || list.length === 0) continue

    const blockIdx = blocks.findIndex(b => b.type === type)

    if (blockIdx !== -1) {
      // Block exists — merge existing-first, then append new names.
      const block = blocks[blockIdx]
      const existingNames = extractNames(block.body)
      const existingSet = new Set(existingNames)
      const toAdd = list.filter(n => !existingSet.has(n))
      const merged = [...existingNames, ...toAdd]
      // Replace block with updated body (shallow clone).
      blocks = [
        ...blocks.slice(0, blockIdx),
        { ...block, body: render(merged) },
        ...blocks.slice(blockIdx + 1)
      ]
    } else {
      // Block absent — create it and insert in canonical position.
      const section = KNOWN_SECTIONS.find(s => s.type === type)
      const heading = section ? section.heading : type
      const level = section ? section.level : 2
      const newBlock = {
        id: makeBlockId(heading, blocks),
        type,
        heading,
        level,
        body: render(list)
      }
      const insertAt = canonicalInsertIndex(blocks, type)
      blocks = [
        ...blocks.slice(0, insertAt),
        newBlock,
        ...blocks.slice(insertAt)
      ]
    }
  }

  return { meta: document.meta, blocks }
}
