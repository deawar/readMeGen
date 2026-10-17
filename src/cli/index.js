import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import inquirer from 'inquirer'
import chalk from 'chalk'
import figlet from 'figlet'
import dotenv from 'dotenv'
import { fetchGitHubUser } from '../github/fetchGitHubUser.js'
import { generateReadme } from '../core/generateReadme.js'

const LICENSES = ['MIT', 'Apache 2.0', 'GNU AGPLv3', 'GNU GPLv3', 'GPLv3', 'Mozilla Public License 2.0', 'The Unlicense']

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

async function main () {
  dotenv.config()
  const token = process.env.TOKEN
  console.log(chalk.cyan(figlet.textSync('ReadMeGen')))

  const { username, author } = await resolveAuthor(token)

  const raw = await inquirer.prompt([
    { type: 'input', name: 'projectTitle', message: "Project's title:" },
    { type: 'input', name: 'projectUrl', message: 'Project GitHub URL:', default: `https://github.com/${username}` },
    { type: 'input', name: 'tagline', message: 'One-line tagline:' },
    { type: 'input', name: 'description', message: 'Description:', default: 'To be written...' },
    { type: 'input', name: 'logoPath', message: 'Logo image path (optional):' },
    { type: 'input', name: 'screenshotPath', message: 'Screenshot path (optional):' },
    { type: 'input', name: 'docsUrl', message: 'Docs URL (optional):' },
    { type: 'input', name: 'demoUrl', message: 'Demo URL (optional):' },
    { type: 'input', name: 'builtWith', message: 'Built with (comma-separated frameworks/libraries):' },
    { type: 'input', name: 'prerequisites', message: 'Prerequisites (optional):' },
    { type: 'input', name: 'install', message: 'Install command:', default: 'npm install' },
    { type: 'input', name: 'usage', message: 'Usage command:', default: 'node index.js' },
    { type: 'input', name: 'tests', message: 'Test command:', default: 'npm test' },
    { type: 'input', name: 'modules', message: 'Runtime dependencies (comma-separated npm names):' },
    { type: 'input', name: 'devModules', message: 'Dev dependencies (comma-separated npm names):' },
    { type: 'confirm', name: 'tableOfContents', message: 'Include a table of contents?', default: true },
    { type: 'input', name: 'roadmap', message: 'Roadmap items (optional):' },
    { type: 'input', name: 'acknowledgments', message: 'Acknowledgments (optional):' },
    { type: 'confirm', name: 'conCov', message: 'Adopt the Contributor Covenant?', default: false },
    { type: 'list', name: 'license', message: 'License:', choices: LICENSES, default: 'MIT' },
    { type: 'input', name: 'contributors', message: 'Contributors (comma-separated GitHub usernames, optional):' },
    { type: 'input', name: 'twitter', message: 'Twitter handle (optional):' },
    { type: 'input', name: 'linkedin', message: 'LinkedIn URL (optional):' }
  ])

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
    author
  }

  const outPath = `${raw.projectTitle || 'README'}.md`
  writeFileSync(outPath, generateReadme(answers))
  console.log(chalk.green(figlet.textSync('ReadMe Complete!')))
  console.log(chalk.white(`Wrote ${outPath}`))
}

// Run only when invoked directly, not when imported for tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
