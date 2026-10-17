import { licenseInfo } from './licenses.js'
import { BACK_TO_TOP, emitShields, emitRefs, emitToc } from './managed.js'

// Pure README generator — no I/O, no network, no console, no env.
// Output follows the othneildrew Best-README-Template (design §5), with the
// old tool's Testing / Dependencies / Dev-Dependencies / Contributor Covenant
// sections woven in and the old "Questions" content merged into Contact.

/**
 * Derive { owner, repo } from a GitHub project URL.
 * Tolerates a trailing slash, a `.git` suffix, and extra path segments.
 * @param {string} projectUrl
 * @returns {{owner: string, repo: string}}
 */
export function parseRepo (projectUrl) {
  const m = String(projectUrl || '').match(/github\.com[/:]([^/]+)\/([^/#?]+)/i)
  if (!m) return { owner: '', repo: '' }
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') }
}

const list = (items, render) => items.map(render).join('\n')

function header ({ projectTitle, tagline, logoPath, docsUrl, demoUrl, projectUrl, repoBase }) {
  const lines = ['<br />', '<div align="center">', `  <a href="${projectUrl}">`]
  if (logoPath) lines.push(`    <img src="${logoPath}" alt="Logo" width="80" height="80">`)
  lines.push(
    '  </a>',
    '',
    `  <h3 align="center">${projectTitle}</h3>`,
    '',
    '  <p align="center">',
    `    ${tagline}`,
    '    <br />'
  )
  if (docsUrl) lines.push(`    <a href="${docsUrl}"><strong>Explore the docs »</strong></a>`, '    <br />')
  lines.push('    <br />')
  if (demoUrl) lines.push(`    <a href="${demoUrl}">View Demo</a>`, '    &middot;')
  lines.push(
    `    <a href="${repoBase}/issues/new?labels=bug">Report Bug</a>`,
    '    &middot;',
    `    <a href="${repoBase}/issues/new?labels=enhancement">Request Feature</a>`,
    '  </p>',
    '</div>'
  )
  return lines.join('\n')
}

function builtWith (items) {
  if (!items.length) return '### Built With\n\nThis section lists the major frameworks/libraries used in this project. _Add yours here._'
  return '### Built With\n\n' + list(items, (i) => `* ${i}`)
}

export function generateReadme (answers) {
  // Defend against missing optional fields (spec §4.2): normalize arrays to []
  // and directly-interpolated strings to '' so the core never emits `undefined`
  // regardless of which front-end assembled the answers.
  const a = {
    tagline: '',
    description: '',
    install: '',
    usage: '',
    tests: '',
    ...answers,
    builtWith: Array.isArray(answers.builtWith) ? answers.builtWith : [],
    modules: Array.isArray(answers.modules) ? answers.modules : [],
    devModules: Array.isArray(answers.devModules) ? answers.devModules : [],
    contributors: Array.isArray(answers.contributors) ? answers.contributors : []
  }
  const { owner, repo } = parseRepo(a.projectUrl)
  const repoBase = `https://github.com/${owner}/${repo}`
  const lic = licenseInfo(a.license) || { name: a.license, description: '' }
  const hasModules = a.modules.length > 0
  const hasDevModules = a.devModules.length > 0

  // Optional prose sections: included unless the front-end explicitly opts out
  // (per-section prompt). Excluding a section drops its body and TOC entry.
  const includePrerequisites = a.includePrerequisites !== false
  const includeRoadmap = a.includeRoadmap !== false
  const includeAcknowledgments = a.includeAcknowledgments !== false
  const includeWhy = a.includeWhy !== false

  const prerequisites = a.prerequisites ||
    'List anything users need before they begin.\n* npm\n  ```sh\n  npm install npm@latest -g\n  ```'
  const roadmap = a.roadmap ||
    `- [ ] Feature one\n- [ ] Feature two\n\nSee the [open issues](${repoBase}/issues) for a full list of proposed features (and known issues).`
  const acknowledgments = a.acknowledgments ||
    '* [Choose an Open Source License](https://choosealicense.com)\n* [Img Shields](https://shields.io)\n* [Best-README-Template](https://github.com/othneildrew/Best-README-Template)'

  const blocks = []
  blocks.push('<a id="readme-top"></a>')
  blocks.push(emitShields({ owner, repo, linkedin: a.linkedin, conCov: a.conCov }))
  blocks.push(header({ ...a, repoBase }))

  if (a.tableOfContents) blocks.push(emitToc({ hasModules, hasDevModules, includePrerequisites, includeRoadmap, includeAcknowledgments }))

  // About
  const about = ['## About The Project', '']
  if (a.screenshotPath) about.push(`[![Product Screenshot](${a.screenshotPath})](${a.demoUrl || a.projectUrl})`, '')
  about.push(a.description)
  if (includeWhy) about.push('', "Here's why this project is worth your time:", '* Saves you from writing a README by hand', '* Keeps a consistent structure across your projects')
  blocks.push(about.join('\n'))
  blocks.push(builtWith(a.builtWith))
  blocks.push(BACK_TO_TOP)

  // Getting Started
  blocks.push('## Getting Started')
  if (includePrerequisites) blocks.push(`### Prerequisites\n\n${prerequisites}`)
  blocks.push(`### Installation\n\n1. Clone the repo\n   \`\`\`sh\n   git clone ${repoBase}.git\n   \`\`\`\n2. Install dependencies\n   \`\`\`sh\n   ${a.install}\n   \`\`\``)
  blocks.push(BACK_TO_TOP)

  // Usage
  blocks.push(`## Usage\n\n\`\`\`sh\n${a.usage}\n\`\`\``)
  blocks.push(BACK_TO_TOP)

  // Testing (kept from old tool)
  blocks.push(`## Testing\n\n\`\`\`sh\n${a.tests}\n\`\`\``)
  blocks.push(BACK_TO_TOP)

  // Dependencies / Dev-Dependencies (kept) — only when non-empty
  if (hasModules) {
    blocks.push('## Dependencies\n\n' + list(a.modules, (m) => `* [${m}](https://www.npmjs.com/package/${m})`))
    blocks.push(BACK_TO_TOP)
  }
  if (hasDevModules) {
    blocks.push('## Dev-Dependencies\n\n' + list(a.devModules, (m) => `* [${m}](https://www.npmjs.com/package/${m})`))
    blocks.push(BACK_TO_TOP)
  }

  // Roadmap
  if (includeRoadmap) {
    blocks.push(`## Roadmap\n\n${roadmap}`)
    blocks.push(BACK_TO_TOP)
  }

  // Contributing
  const contributing = [
    '## Contributing',
    '',
    'Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.',
    '',
    '1. Fork the Project',
    '2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)',
    "3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)",
    '4. Push to the Branch (`git push origin feature/AmazingFeature`)',
    '5. Open a Pull Request',
    '',
    '### Top contributors:',
    ''
  ]
  if (a.contributors.length) {
    contributing.push(
      a.contributors
        .map((c) => `<a href="${c.html_url}" title="${c.name || c.login}"><img src="${c.avatar_url}&s=48" width="48" height="48" alt="${c.login}" /></a>`)
        .join(' '),
      ''
    )
  }
  contributing.push(
    `<a href="${repoBase}/graphs/contributors">`,
    `  <img src="https://contrib.rocks/image?repo=${owner}/${repo}" alt="contrib.rocks image" />`,
    '</a>'
  )
  if (a.conCov) {
    contributing.push('', 'This project adheres to the [Contributor Covenant](https://www.contributor-covenant.org/) code of conduct.')
  }
  blocks.push(contributing.join('\n'))
  blocks.push(BACK_TO_TOP)

  // License
  blocks.push(`## License\n\nDistributed under the ${lic.name}. See [\`LICENSE\`](${repoBase}/blob/HEAD/LICENSE) for more information.\n\n${lic.description}`)
  blocks.push(BACK_TO_TOP)

  // Contact (merges old Questions content)
  const author = a.author
  let contactLine = author.name
  if (a.twitter) contactLine += ` - [@${a.twitter}](https://twitter.com/${a.twitter})`
  contactLine += ` - ${author.email}`
  const contact = [
    '## Contact',
    '',
    contactLine,
    '',
    `Project Link: [${a.projectUrl}](${a.projectUrl})`,
    '',
    `![${author.name}](${author.avatar_url}&s=48) Reach me by email at [${author.email}](mailto:${author.email}) or on GitHub at [@${author.login}](${author.html_url}).`
  ]
  blocks.push(contact.join('\n'))
  blocks.push(BACK_TO_TOP)

  // Acknowledgments
  if (includeAcknowledgments) {
    blocks.push(`## Acknowledgments\n\n${acknowledgments}`)
    blocks.push(BACK_TO_TOP)
  }

  // Reference-style link definitions
  blocks.push(emitRefs({ owner, repo, linkedin: a.linkedin, conCov: a.conCov }))

  return blocks.join('\n\n') + '\n'
}
