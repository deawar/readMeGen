import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  blockById,
  moveBlock,
  insertBlock,
  deleteBlock,
  updateBlockBody,
  setMeta
} from '../src/gui/documentStore.js'

// Sample document for testing
const sampleDoc = {
  meta: { projectUrl: 'https://github.com/user/repo', linkedin: '', conCov: false, tableOfContents: false },
  blocks: [
    { id: 'header-0', type: 'header', heading: '', level: 0, body: 'Welcome' },
    { id: 'about-1', type: 'about', heading: 'About', level: 2, body: 'About the project' },
    { id: 'started-2', type: 'gettingStarted', heading: 'Getting Started', level: 2, body: 'Getting started' },
    { id: 'usage-3', type: 'usage', heading: 'Usage', level: 2, body: 'Usage instructions' }
  ]
}

test('moveBlock no-op returns a new Document (not the same reference)', () => {
  // Moving a block to its current index must still return a NEW object
  const result = moveBlock(sampleDoc, 'about-1', 1)

  // Must NOT be the same reference as input doc
  assert.notEqual(result, sampleDoc)

  // blocks array must also be a new reference
  assert.notEqual(result.blocks, sampleDoc.blocks)

  // Input doc must be entirely unchanged
  assert.deepEqual(result.blocks.map(b => b.id), sampleDoc.blocks.map(b => b.id))
  assert.equal(sampleDoc.blocks.length, 4)
})

test('moveBlock reorders and preserves all blocks', () => {
  // Move block at index 3 to index 1
  const result = moveBlock(sampleDoc, 'usage-3', 1)

  // Check length preserved
  assert.equal(result.blocks.length, sampleDoc.blocks.length)

  // Check all IDs are present
  const originalIds = new Set(sampleDoc.blocks.map(b => b.id))
  const resultIds = new Set(result.blocks.map(b => b.id))
  assert.deepEqual(resultIds, originalIds)

  // Check order: usage-3 should be at index 1
  assert.equal(result.blocks[1].id, 'usage-3')
  assert.equal(result.blocks[0].id, 'header-0')
  assert.equal(result.blocks[2].id, 'about-1')
  assert.equal(result.blocks[3].id, 'started-2')
})

test('deleteBlock removes exactly one block and leaves input unmutated', () => {
  const originalLength = sampleDoc.blocks.length
  const originalBlockIds = sampleDoc.blocks.map(b => b.id)

  // Delete the 'about-1' block
  const result = deleteBlock(sampleDoc, 'about-1')

  // Check result has one fewer block
  assert.equal(result.blocks.length, originalLength - 1)

  // Check the deleted block is not in result
  assert.ok(!result.blocks.find(b => b.id === 'about-1'))

  // Check remaining blocks are preserved
  assert.equal(result.blocks[0].id, 'header-0')
  assert.equal(result.blocks[1].id, 'started-2')
  assert.equal(result.blocks[2].id, 'usage-3')

  // CRITICAL: Check original document is unchanged
  assert.equal(sampleDoc.blocks.length, originalLength)
  assert.deepEqual(sampleDoc.blocks.map(b => b.id), originalBlockIds)
  assert.ok(sampleDoc.blocks.find(b => b.id === 'about-1'), 'original doc should still have about-1')
})

test('updateBlockBody changes only the target block\'s body', () => {
  const newBody = 'Updated about content'

  // Update about-1 block body
  const result = updateBlockBody(sampleDoc, 'about-1', newBody)

  // Check the updated block has the new body
  const updatedBlock = result.blocks.find(b => b.id === 'about-1')
  assert.equal(updatedBlock.body, newBody)

  // Check other blocks are unchanged
  const headerBlock = result.blocks.find(b => b.id === 'header-0')
  assert.equal(headerBlock.body, 'Welcome')

  const usageBlock = result.blocks.find(b => b.id === 'usage-3')
  assert.equal(usageBlock.body, 'Usage instructions')

  // Check other properties of updated block are unchanged
  assert.equal(updatedBlock.type, 'about')
  assert.equal(updatedBlock.heading, 'About')
  assert.equal(updatedBlock.level, 2)
})

test('insertBlock places the block at the given index', () => {
  const newBlock = {
    id: 'custom-4',
    type: 'custom',
    heading: 'Custom Section',
    level: 2,
    body: 'Custom content'
  }

  // Insert at index 2 (between started and usage)
  const result = insertBlock(sampleDoc, newBlock, 2)

  // Check length increased
  assert.equal(result.blocks.length, sampleDoc.blocks.length + 1)

  // Check block is at the correct index
  assert.equal(result.blocks[2].id, 'custom-4')

  // Check surrounding blocks
  assert.equal(result.blocks[1].id, 'about-1')
  assert.equal(result.blocks[3].id, 'started-2')

  // Check the new block is not mutated (has all properties)
  assert.deepEqual(result.blocks[2], newBlock)
})

test('setMeta merges without dropping other meta keys', () => {
  const patch = { linkedin: 'https://linkedin.com/in/user' }

  // Merge patch into meta
  const result = setMeta(sampleDoc, patch)

  // Check patched key is updated
  assert.equal(result.meta.linkedin, 'https://linkedin.com/in/user')

  // Check other keys are preserved
  assert.equal(result.meta.projectUrl, 'https://github.com/user/repo')
  assert.equal(result.meta.conCov, false)
  assert.equal(result.meta.tableOfContents, false)

  // Check blocks are the same reference (unchanged)
  assert.equal(result.blocks, sampleDoc.blocks)
})

test('blockById returns the block with matching id', () => {
  const block = blockById(sampleDoc, 'about-1')
  assert.deepEqual(block, sampleDoc.blocks[1])
})

test('blockById returns undefined if no block matches', () => {
  const block = blockById(sampleDoc, 'nonexistent-99')
  assert.equal(block, undefined)
})
