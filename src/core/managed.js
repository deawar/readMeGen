// Shared README scaffolding: shields, TOC, back-to-top, reference-link definitions.
// These are emitted by both generateReadme (template path) and serializeDocument
// (GUI document-engine path) so that both produce byte-identical scaffold output.

export const BACK_TO_TOP = '<p align="right">(<a href="#readme-top">back to top</a>)</p>'

/**
 * GitHub-style anchor slug: lowercase, spaces → `-`, strip non-word chars.
 * @param {string} heading
 * @returns {string}
 */
export function slug (heading) {
  return heading
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]/g, '')
}

/**
 * Sections in canonical document order.
 * level 0 = document root (no heading), 2 = ##, 3 = ###
 */
export const KNOWN_SECTIONS = [
  { heading: '', type: 'header', level: 0 },
  { heading: 'About The Project', type: 'about', level: 2 },
  { heading: 'Built With', type: 'builtWith', level: 3 },
  { heading: 'Getting Started', type: 'gettingStarted', level: 2 },
  { heading: 'Prerequisites', type: 'prerequisites', level: 3 },
  { heading: 'Installation', type: 'installation', level: 3 },
  { heading: 'Usage', type: 'usage', level: 2 },
  { heading: 'Testing', type: 'testing', level: 2 },
  { heading: 'Dependencies', type: 'dependencies', level: 2 },
  { heading: 'Dev-Dependencies', type: 'devDependencies', level: 2 },
  { heading: 'Roadmap', type: 'roadmap', level: 2 },
  { heading: 'Contributing', type: 'contributing', level: 2 },
  { heading: 'License', type: 'license', level: 2 },
  { heading: 'Contact', type: 'contact', level: 2 },
  { heading: 'Acknowledgments', type: 'acknowledgments', level: 2 }
]

/**
 * Emit the top reference-style shield badge block.
 * LinkedIn line only when `linkedin` is truthy; Covenant line only when `conCov`.
 * @param {{ owner: string, repo: string, linkedin: string, conCov: boolean }} opts
 * @returns {string}
 */
export function emitShields ({ owner, repo, linkedin, conCov }) {
  const lines = [
    '[![Contributors][contributors-shield]][contributors-url]',
    '[![Forks][forks-shield]][forks-url]',
    '[![Stargazers][stars-shield]][stars-url]',
    '[![Issues][issues-shield]][issues-url]',
    '[![License][license-shield]][license-url]'
  ]
  if (linkedin) lines.push('[![LinkedIn][linkedin-shield]][linkedin-url]')
  if (conCov) lines.push('[![Contributor Covenant][covenant-shield]][covenant-url]')
  return lines.join('\n')
}

/**
 * Emit the `<!-- MARKDOWN LINKS & IMAGES -->` banner + all reference-link definitions.
 * linkedin/covenant defs only when set; derives repoBase internally from owner/repo.
 * @param {{ owner: string, repo: string, linkedin: string, conCov: boolean }} opts
 * @returns {string}
 */
export function emitRefs ({ owner, repo, linkedin, conCov }) {
  const repoBase = `https://github.com/${owner}/${repo}`
  const refs = [
    `[contributors-shield]: https://img.shields.io/github/contributors/${owner}/${repo}.svg?style=for-the-badge`,
    `[contributors-url]: ${repoBase}/graphs/contributors`,
    `[forks-shield]: https://img.shields.io/github/forks/${owner}/${repo}.svg?style=for-the-badge`,
    `[forks-url]: ${repoBase}/network/members`,
    `[stars-shield]: https://img.shields.io/github/stars/${owner}/${repo}.svg?style=for-the-badge`,
    `[stars-url]: ${repoBase}/stargazers`,
    `[issues-shield]: https://img.shields.io/github/issues/${owner}/${repo}.svg?style=for-the-badge`,
    `[issues-url]: ${repoBase}/issues`,
    `[license-shield]: https://img.shields.io/github/license/${owner}/${repo}.svg?style=for-the-badge`,
    `[license-url]: ${repoBase}/blob/HEAD/LICENSE`
  ]
  if (linkedin) {
    refs.push('[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555')
    refs.push(`[linkedin-url]: ${linkedin}`)
  }
  if (conCov) {
    refs.push('[covenant-shield]: https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg?style=for-the-badge')
    refs.push(`[covenant-url]: ${repoBase}/blob/HEAD/CODE_OF_CONDUCT.md`)
  }
  return '<!-- MARKDOWN LINKS & IMAGES -->\n' + refs.join('\n')
}

/**
 * Emit the `<details>` table-of-contents block.
 * @param {{ hasModules: boolean, hasDevModules: boolean, includePrerequisites: boolean, includeRoadmap: boolean, includeAcknowledgments: boolean }} opts
 * @returns {string}
 */
export function emitToc ({ hasModules, hasDevModules, includePrerequisites, includeRoadmap, includeAcknowledgments }) {
  const gettingStartedSub = ['        <li><a href="#installation">Installation</a></li>']
  if (includePrerequisites) gettingStartedSub.unshift('        <li><a href="#prerequisites">Prerequisites</a></li>')
  const items = [
    '    <li>\n      <a href="#about-the-project">About The Project</a>\n      <ul>\n        <li><a href="#built-with">Built With</a></li>\n      </ul>\n    </li>',
    `    <li>\n      <a href="#getting-started">Getting Started</a>\n      <ul>\n${gettingStartedSub.join('\n')}\n      </ul>\n    </li>`,
    '    <li><a href="#usage">Usage</a></li>',
    '    <li><a href="#testing">Testing</a></li>'
  ]
  if (hasModules) items.push('    <li><a href="#dependencies">Dependencies</a></li>')
  if (hasDevModules) items.push('    <li><a href="#dev-dependencies">Dev-Dependencies</a></li>')
  if (includeRoadmap) items.push('    <li><a href="#roadmap">Roadmap</a></li>')
  items.push(
    '    <li><a href="#contributing">Contributing</a></li>',
    '    <li><a href="#license">License</a></li>',
    '    <li><a href="#contact">Contact</a></li>'
  )
  if (includeAcknowledgments) items.push('    <li><a href="#acknowledgments">Acknowledgments</a></li>')
  return ['<details>', '  <summary>Table of Contents</summary>', '  <ol>', items.join('\n'), '  </ol>', '</details>'].join('\n')
}
