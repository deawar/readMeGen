const JS_FRAMEWORK_HINTS = new Set([
  'electron', 'react', 'vue', 'svelte', 'next', 'express', 'nest', 'angular'
])

const PY_FRAMEWORK_HINTS = new Set([
  'django', 'flask', 'fastapi'
])

/**
 * Parse a manifest file and return categorised dependency lists.
 *
 * @param {string} filename - The manifest filename (e.g. 'package.json').
 * @param {string} contents - The raw file contents as a string.
 * @returns {{ builtWith: string[], modules: string[], devModules: string[] }}
 */
export function parseManifest (filename, contents) {
  if (filename.endsWith('package.json')) {
    return parsePackageJson(contents)
  }
  if (filename.endsWith('requirements.txt') || filename.endsWith('.txt')) {
    return parseRequirementsTxt(contents)
  }
  throw new Error('unsupported manifest: ' + filename)
}

function parsePackageJson (contents) {
  let parsed
  try {
    parsed = JSON.parse(contents)
  } catch (_) {
    throw new Error('invalid package.json')
  }
  const modules = Object.keys(parsed.dependencies || {})
  const devModules = Object.keys(parsed.devDependencies || {})
  const builtWith = modules.filter(name => JS_FRAMEWORK_HINTS.has(name))
  return { builtWith, modules, devModules }
}

function parseRequirementsTxt (contents) {
  const modules = contents
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .map(line => line.replace(/[=<>!~[;].*$/, '').trim())
    .filter(name => name.length > 0)
  const builtWith = modules.filter(name => PY_FRAMEWORK_HINTS.has(name))
  return { builtWith, modules, devModules: [] }
}
