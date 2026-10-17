// Interview field schema (data) + pure helpers for the CLI jump-list.
// Ported from the original one-shot inquirer prompt list; each descriptor adds
// a short `label` for the review display. No I/O here.

export const LICENSES = ['MIT', 'Apache 2.0', 'GNU AGPLv3', 'GNU GPLv3', 'GPLv3', 'Mozilla Public License 2.0', 'The Unlicense']

export const FIELDS = [
  { name: 'projectTitle', label: 'Title', message: "Project's title:", type: 'input' },
  // projectUrl's username-based default is applied by the CLI wiring (needs the resolved username).
  { name: 'projectUrl', label: 'Project URL', message: 'Project GitHub URL:', type: 'input' },
  { name: 'tagline', label: 'Tagline', message: 'One-line tagline:', type: 'input' },
  { name: 'description', label: 'Description', message: 'Description:', type: 'input', default: 'To be written...' },
  { name: 'includeWhy', label: 'Include "why" bullets', message: "Include the About section's \"Here's why\" bullets?", type: 'confirm', default: false },
  { name: 'logoPath', label: 'Logo path', message: 'Logo image path (optional):', type: 'input' },
  { name: 'screenshotPath', label: 'Screenshot path', message: 'Screenshot path (optional):', type: 'input' },
  { name: 'docsUrl', label: 'Docs URL', message: 'Docs URL (optional):', type: 'input' },
  { name: 'demoUrl', label: 'Demo URL', message: 'Demo URL (optional):', type: 'input' },
  { name: 'builtWith', label: 'Built with', message: 'Built with (comma-separated frameworks/libraries):', type: 'input' },
  { name: 'includePrerequisites', label: 'Include Prerequisites', message: 'Include a Prerequisites section?', type: 'confirm', default: true },
  { name: 'prerequisites', label: 'Prerequisites', message: 'Prerequisites (blank = template placeholder):', type: 'input', when: (ans) => ans.includePrerequisites },
  { name: 'install', label: 'Install command', message: 'Install command:', type: 'input', default: 'npm install' },
  { name: 'usage', label: 'Usage command', message: 'Usage command:', type: 'input', default: 'node index.js' },
  { name: 'tests', label: 'Test command', message: 'Test command:', type: 'input', default: 'npm test' },
  { name: 'modules', label: 'Dependencies', message: 'Runtime dependencies (comma-separated npm names):', type: 'input' },
  { name: 'devModules', label: 'Dev dependencies', message: 'Dev dependencies (comma-separated npm names):', type: 'input' },
  { name: 'tableOfContents', label: 'Table of contents', message: 'Include a table of contents?', type: 'confirm', default: true },
  { name: 'includeRoadmap', label: 'Include Roadmap', message: 'Include a Roadmap section?', type: 'confirm', default: false },
  { name: 'roadmap', label: 'Roadmap', message: 'Roadmap items (blank = template placeholder):', type: 'input', when: (ans) => ans.includeRoadmap },
  { name: 'includeAcknowledgments', label: 'Include Acknowledgments', message: 'Include an Acknowledgments section?', type: 'confirm', default: false },
  { name: 'acknowledgments', label: 'Acknowledgments', message: 'Acknowledgments (blank = template placeholder):', type: 'input', when: (ans) => ans.includeAcknowledgments },
  { name: 'conCov', label: 'Contributor Covenant', message: 'Adopt the Contributor Covenant?', type: 'confirm', default: false },
  { name: 'license', label: 'License', message: 'License:', type: 'list', choices: LICENSES, default: 'MIT' },
  { name: 'contributors', label: 'Contributors', message: 'Contributors (comma-separated GitHub usernames, optional):', type: 'input' },
  { name: 'twitter', label: 'Twitter', message: 'Twitter handle (optional):', type: 'input' },
  { name: 'linkedin', label: 'LinkedIn', message: 'LinkedIn URL (optional):', type: 'input' }
]

/** True iff the whole trimmed input is the jump sentinel `<`. */
export function isJumpCommand (input) {
  return String(input).trim() === '<'
}

/** Fields whose `when` is absent or returns truthy for the given answers. */
export function activeFields (answers, fields = FIELDS) {
  return fields.filter((f) => !f.when || f.when(answers))
}

function display (value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(not set)'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === undefined || value === null || value === '') return '(not set)'
  return String(value)
}

/** One `{ key, label }` per active field for the review/jump-list menu. */
export function reviewItems (answers, fields = FIELDS) {
  return activeFields(answers, fields).map((f) => ({
    key: f.name,
    label: `${f.label}: ${display(answers[f.name])}`
  }))
}
