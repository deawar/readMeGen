import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import inquirer from 'inquirer'
import chalk from 'chalk'
import figlet from 'figlet'
import dotenv from 'dotenv'
import { fetchGitHubUser } from '../github/fetchGitHubUser.js'
import { generateReadme } from '../core/generateReadme.js'
import { FIELDS } from './fields.js'
import { runInterview } from './interview.js'

/**
 * Split comma-separated prompt input into a clean array: trim each item and
 * drop empties (handles stray spaces and trailing commas). Empty → [].
 */
export function parseList (input) {
  return String(input || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Resolve contributor usernames to user objects, awaiting each lookup in turn
 * (fixes bug #4). Usernames that don't resolve (not found or unreachable) are
 * skipped rather than blocking generation.
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

/** True only when a GitHub lookup failed because the API was unreachable. */
export function authorFallbackNeeded (result) {
  return result.ok === false && result.reason === 'unreachable'
}

async function resolveAuthor (token) {
  for (;;) {
    const { username } = await inquirer.prompt([
      { type: 'input', name: 'username', message: 'Your GitHub username:' }
    ])
    const result = await fetchGitHubUser(username, { token })
    if (result.ok) return { username, author: result.user }
    if (authorFallbackNeeded(result)) {
      console.log(chalk.yellow("Couldn't reach GitHub — enter your details manually."))
      const manual = await inquirer.prompt([
        { type: 'input', name: 'name', message: 'Your name:', default: username },
        { type: 'input', name: 'email', message: 'Your email:' },
        { type: 'input', name: 'avatarUrl', message: 'Avatar URL:', default: 'https://avatars.githubusercontent.com/u/0?v=4' }
      ])
      return {
        username,
        author: {
          login: username,
          name: manual.name,
          email: manual.email,
          html_url: `https://github.com/${username}`,
          avatar_url: manual.avatarUrl
        }
      }
    }
    console.log(chalk.red('No such GitHub user — try again.'))
  }
}

// --- inquirer-backed io for the interview controller ---

async function askField (field, current, username) {
  let def = current ?? field.default
  if (field.name === 'projectUrl' && !def && username) def = `https://github.com/${username}`
  const message = field.type === 'input'
    ? `${field.message} ${chalk.dim('(type < to jump to a field)')}`
    : field.message
  const prompt = { type: field.type, name: 'value', message, default: def }
  if (field.choices) prompt.choices = field.choices
  const { value } = await inquirer.prompt([prompt])
  return value
}

async function showReview (items, { atEnd }) {
  const choices = items.map((i) => ({ name: i.label, value: i.key }))
  choices.push(new inquirer.Separator())
  if (!atEnd) choices.push({ name: 'Continue answering →', value: 'continue' })
  choices.push({ name: 'Generate the README ✓', value: 'generate' })
  const { key } = await inquirer.prompt([{
    type: 'list',
    name: 'key',
    message: atEnd ? 'Review your answers — pick one to edit, or Generate:' : 'Jump to a field to edit, or continue:',
    choices,
    pageSize: 20
  }])
  return key
}

async function main () {
  dotenv.config()
  const token = process.env.TOKEN
  console.log(chalk.cyan(figlet.textSync('ReadMeGen')))

  let currentUsername = ''
  const io = {
    resolveAuthor: async () => {
      const resolved = await resolveAuthor(token)
      currentUsername = resolved.username
      return resolved
    },
    askField: (field, current) => askField(field, current, currentUsername),
    showReview: (items, opts) => showReview(items, opts)
  }

  const raw = await runInterview({ fields: FIELDS, io })

  const contributors = await resolveContributors(
    parseList(raw.contributors),
    (name) => fetchGitHubUser(name, { token })
  )

  const answers = {
    ...raw,
    builtWith: parseList(raw.builtWith),
    modules: parseList(raw.modules),
    devModules: parseList(raw.devModules),
    contributors,
    author: raw.author
  }

  const outPath = `${raw.projectTitle || 'README'}.md`
  writeFileSync(outPath, generateReadme(answers))
  console.log(chalk.cyan(figlet.textSync(`Wrote ${outPath}!`)))
  console.log(chalk.green(figlet.textSync('ReadMe Complete!')))
}

// Run only when invoked directly, not when imported for tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
