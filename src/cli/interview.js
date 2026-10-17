import { isJumpCommand, activeFields, reviewItems } from './fields.js'

// Navigation controller for the interview. Walks fields forward; a bare `<` at
// a text prompt opens the review/jump-list; the user may edit any field and
// resume (Continue) or finish (Generate). All I/O is injected via `io` so the
// control flow is testable without a terminal.
//
// io.resolveAuthor() -> { username, author }
// io.askField(field, current) -> value   (value may be '<' to request a jump)
// io.showReview(items, { atEnd }) -> field.name | '__username' | 'continue' | 'generate'

async function review (answers, fields, io, opts) {
  for (;;) {
    const items = [{ key: '__username', label: `GitHub username: ${answers.__username}` }, ...reviewItems(answers, fields)]
    const key = await io.showReview(items, opts)
    if (key === 'generate') return true
    if (key === 'continue') return false
    if (key === '__username') {
      const resolved = await io.resolveAuthor()
      answers.__username = resolved.username
      answers.author = resolved.author
      continue
    }
    const field = fields.find((f) => f.name === key)
    if (field) answers[field.name] = await io.askField(field, answers[field.name] ?? field.default)
  }
}

function finalize (answers) {
  const out = { ...answers }
  delete out.__username
  return out
}

export async function runInterview ({ fields, io }) {
  const answers = {}
  const resolved = await io.resolveAuthor()
  answers.__username = resolved.username
  answers.author = resolved.author

  for (;;) {
    const next = activeFields(answers, fields).find((f) => !(f.name in answers))
    if (!next) break
    const value = await io.askField(next, answers[next.name] ?? next.default)
    if (next.type === 'input' && isJumpCommand(value)) {
      const generate = await review(answers, fields, io, { atEnd: false })
      if (generate) return finalize(answers)
      continue
    }
    answers[next.name] = value
  }

  await review(answers, fields, io, { atEnd: true })
  return finalize(answers)
}
