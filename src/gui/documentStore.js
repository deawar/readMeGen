/**
 * Immutable Document store for the GUI.
 * Every function returns a NEW Document (or value) and never mutates its inputs.
 * No imports — renderer-safe (no bundler needed).
 */

/**
 * Find a block by id.
 * @param {{ meta: object, blocks: Array }} doc
 * @param {string} id
 * @returns {object|undefined}
 */
export function blockById (doc, id) {
  return doc.blocks.find(b => b.id === id)
}

/**
 * Move a block from its current position to a new index.
 * Returns a new Document; does not mutate the input.
 * @param {{ meta: object, blocks: Array }} doc
 * @param {string} id
 * @param {number} toIndex
 * @returns {{ meta: object, blocks: Array }}
 */
export function moveBlock (doc, id, toIndex) {
  const blocks = doc.blocks.slice()
  const fromIndex = blocks.findIndex(b => b.id === id)

  if (fromIndex === -1 || fromIndex === toIndex) {
    return doc
  }

  // Remove block from current position
  const [block] = blocks.splice(fromIndex, 1)

  // Insert at new position
  blocks.splice(toIndex, 0, block)

  return { ...doc, blocks }
}

/**
 * Insert a block at the given index.
 * Returns a new Document; does not mutate the input.
 * @param {{ meta: object, blocks: Array }} doc
 * @param {object} block
 * @param {number} atIndex
 * @returns {{ meta: object, blocks: Array }}
 */
export function insertBlock (doc, block, atIndex) {
  const blocks = [
    ...doc.blocks.slice(0, atIndex),
    block,
    ...doc.blocks.slice(atIndex)
  ]

  return { ...doc, blocks }
}

/**
 * Delete a block by id.
 * Returns a new Document; does not mutate the input.
 * @param {{ meta: object, blocks: Array }} doc
 * @param {string} id
 * @returns {{ meta: object, blocks: Array }}
 */
export function deleteBlock (doc, id) {
  const blocks = doc.blocks.filter(b => b.id !== id)

  return { ...doc, blocks }
}

/**
 * Update the body of a block.
 * Returns a new Document; does not mutate the input.
 * @param {{ meta: object, blocks: Array }} doc
 * @param {string} id
 * @param {string} body
 * @returns {{ meta: object, blocks: Array }}
 */
export function updateBlockBody (doc, id, body) {
  const blocks = doc.blocks.map(b => {
    if (b.id === id) {
      return { ...b, body }
    }
    return b
  })

  return { ...doc, blocks }
}

/**
 * Shallow-merge a patch into the document's meta.
 * Returns a new Document; does not mutate the input.
 * @param {{ meta: object, blocks: Array }} doc
 * @param {object} patch
 * @returns {{ meta: object, blocks: Array }}
 */
export function setMeta (doc, patch) {
  return {
    ...doc,
    meta: { ...doc.meta, ...patch }
  }
}
