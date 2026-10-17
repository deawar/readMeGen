// License metadata keyed by the prompt's license choices.
// `description` text is ported from the original generator, now paired with
// the correct key (the old code wrapped the key into a link before the switch,
// so no case ever matched — see design bug #1).

const LICENSES = {
  MIT: {
    name: 'MIT License',
    spdx: 'MIT',
    description: 'A short and simple permissive license with conditions only requiring preservation of copyright and license notices. Licensed works, modifications, and larger works may be distributed under different terms and without source code.'
  },
  'Apache 2.0': {
    name: 'Apache License 2.0',
    spdx: 'Apache-2.0',
    description: 'A permissive license whose main conditions require preservation of copyright and license notices. Contributors provide an express grant of patent rights. Licensed works, modifications, and larger works may be distributed under different terms and without source code.'
  },
  'GNU AGPLv3': {
    name: 'GNU Affero General Public License v3.0',
    spdx: 'AGPL-3.0',
    description: 'Permissions of this strongest copyleft license are conditioned on making available complete source code of licensed works and modifications, which include larger works using a licensed work, under the same license. Copyright and license notices must be preserved. Contributors provide an express grant of patent rights. When a modified version is used to provide a service over a network, the complete source code of the modified version must be made available.'
  },
  'GNU GPLv3': {
    name: 'GNU General Public License v3.0',
    spdx: 'GPL-3.0',
    description: 'Permissions of this strong copyleft license are conditioned on making available complete source code of licensed works and modifications, which include larger works using a licensed work, under the same license. Copyright and license notices must be preserved. Contributors provide an express grant of patent rights.'
  },
  GPLv3: {
    name: 'GNU General Public License v3.0',
    spdx: 'GPL-3.0',
    description: 'Permissions of this strong copyleft license are conditioned on making available complete source code of licensed works and modifications, which include larger works using a licensed work, under the same license. Copyright and license notices must be preserved. Contributors provide an express grant of patent rights.'
  },
  'Mozilla Public License 2.0': {
    name: 'Mozilla Public License 2.0',
    spdx: 'MPL-2.0',
    description: 'Permissions of this weak copyleft license are conditioned on making available source code of licensed files and modifications of those files under the same license (or in certain cases, one of the GNU licenses). Copyright and license notices must be preserved. Contributors provide an express grant of patent rights. However, a larger work using the licensed work may be distributed under different terms and without source code for files added in the larger work.'
  },
  'The Unlicense': {
    name: 'The Unlicense',
    spdx: 'Unlicense',
    description: 'A license with no conditions whatsoever which dedicates works to the public domain. Unlicensed works, modifications, and larger works may be distributed under different terms and without source code.'
  }
}

/**
 * Look up license metadata by its prompt key.
 * @param {string} key one of the known license choices
 * @returns {{key: string, name: string, spdx: string, description: string}|null}
 */
export function licenseInfo (key) {
  const entry = LICENSES[key]
  if (!entry) return null
  return { key, ...entry }
}
