import { generateReadme } from './generateReadme.js'

// Front-end-agnostic orchestration: turn raw collected answers (from the CLI
// interview or the GUI form) into a finished README. Both front-ends resolve
// the author their own way and pass it in via `rawAnswers.author`; `lookup`
// resolves contributor usernames (injected, so this stays testable offline).

/**
 * Split comma-separated input into a clean array: trim each item and drop
 * empties (handles stray spaces and trailing commas). Empty → [].
 */
export function parseList (input) {
  return String(input || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Resolve contributor usernames to user objects, awaiting each lookup in turn.
 * Usernames that don't resolve (not found or unreachable) are skipped.
 * @param {string[]} names
 * @param {(name: string) => Promise<{ok: boolean, user?: object}>} lookup
 */
export async function resolveContributors (names, lookup) {
  const resolved = []
  for (const name of names) {
    const result = await lookup(name)
    if (result.ok) resolved.push(result.user)
  }
  return resolved
}

/**
 * Assemble final answers from raw input and generate the README markdown.
 * @param {object} rawAnswers collected answers (must include a resolved `author`)
 * @param {{lookup: Function}} deps contributor-username resolver
 * @returns {Promise<{markdown: string, answers: object}>}
 */
export async function buildReadme (rawAnswers, { lookup }) {
  const contributors = await resolveContributors(parseList(rawAnswers.contributors), lookup)
  const answers = {
    ...rawAnswers,
    builtWith: parseList(rawAnswers.builtWith),
    modules: parseList(rawAnswers.modules),
    devModules: parseList(rawAnswers.devModules),
    contributors
  }
  return { markdown: generateReadme(answers), answers }
}
