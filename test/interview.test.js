import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FIELDS } from '../src/cli/fields.js'
import { runInterview } from '../src/cli/interview.js'

// A scripted I/O boundary: each field's answers come from a queue; `reviews`
// is the queue of showReview() results; `record` collects asked field names.
function scriptedIo ({ username = 'deawar', author = { login: 'deawar' }, answers = {}, reviews = [], record = [] }) {
  const aQ = {}
  for (const k of Object.keys(answers)) aQ[k] = [...answers[k]]
  const rQ = [...reviews]
  return {
    async resolveAuthor () { return { username, author } },
    async askField (field) {
      record.push(field.name)
      const q = aQ[field.name]
      if (q && q.length) return q.shift()
      if (field.type === 'confirm') return field.default ?? false
      if (field.type === 'list') return field.default ?? field.choices[0]
      return ''
    },
    async showReview () { return rQ.shift() }
  }
}

test('mid-flow jump edits an earlier field then generates', async () => {
  const answers = await runInterview({
    fields: FIELDS,
    io: scriptedIo({
      answers: { projectTitle: ['typo', 'Fixed'], projectUrl: ['<', ''] },
      reviews: ['projectTitle', 'continue', 'generate']
    })
  })
  assert.equal(answers.projectTitle, 'Fixed')
  assert.equal(answers.author.login, 'deawar')
})

test('jump at the very first field does not crash and returns to the walk', async () => {
  const answers = await runInterview({
    fields: FIELDS,
    io: scriptedIo({ answers: { projectTitle: ['<', 'OK'] }, reviews: ['continue', 'generate'] })
  })
  assert.ok(answers)
  assert.equal(answers.projectTitle, 'OK')
})

test('toggling a section off in review removes its gated field from the remaining walk', async () => {
  const record = []
  await runInterview({
    fields: FIELDS,
    io: scriptedIo({
      answers: { builtWith: ['<', ''], includePrerequisites: [false] },
      reviews: ['includePrerequisites', 'continue', 'generate'],
      record
    })
  })
  assert.ok(!record.includes('prerequisites'))
})

test('generate chosen mid-flow returns without the unanswered fields', async () => {
  const answers = await runInterview({
    fields: FIELDS,
    io: scriptedIo({ answers: { projectTitle: ['<'] }, reviews: ['generate'] })
  })
  assert.equal(answers.acknowledgments, undefined)
})
