# ReadMeGen Shared-Core (Phase 1: CLI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a pure `generateReadme(answers)` core and a hardened GitHub module, then wire the CLI on top, producing correct Best-README-Template output — with all catalogued bugs fixed and the project consolidated into one package.

**Architecture:** One ESM package at the repo root. A pure, side-effect-free core (`src/core/`) builds the README string; a hardened GitHub module (`src/github/`) resolves user data; a thin CLI front-end (`src/cli/`) collects answers, calls both, and writes the file. The Electron shell stays untouched (Phase 2). Tests use the built-in `node:test` runner — no new dependencies.

**Tech Stack:** Node.js 22, ESM, axios, inquirer, chalk, figlet, dotenv, `node:test` + `node:assert`, standard (lint).

**Spec:** [docs/superpowers/specs/2026-10-17-readme-generator-shared-core-design.md](../specs/2026-10-17-readme-generator-shared-core-design.md)

## Global Constraints

- **Module system:** Root `package.json` is `"type": "module"`; all `src/` and `test/` files are ESM `.js`. The Electron shell files are renamed `main.cjs`/`preload.cjs` (CommonJS) and are otherwise unchanged. (Reconciles spec §4.4/§4.5: ESM for core/cli, CJS allowed for the Electron main.)
- **No new dependencies.** Runtime: `axios`, `chalk`, `dotenv`, `figlet`, `inquirer`, `open`. Dev: `electron`, `standard`. Tests use `node:test` (built-in). Remove the bogus `path` dependency (Node built-in).
- **Core purity:** `src/core/*` performs no file I/O, no network, no `console`, no `process.env` reads. Deterministic: same `answers` → same string.
- **GitHub auth:** Send `Authorization: Bearer <token>` only when a token is present; otherwise no auth header (works unauthenticated at 60 req/hr).
- **Links:** URL-escape all interpolated values; derive `owner/repo` from `projectUrl`; use the `HEAD` ref (`/blob/HEAD/...`) — never a hardcoded `master`.
- **Output format:** Match [Example_README.md](../../../Example_README.md) (Best-README-Template) structure per spec §5, including reference-style link block and "back to top" links.
- **Lint:** `npm run lint` (standard) passes with zero errors at every commit.

## Review Focus

- **Project title with spaces/special characters** → all generated URLs and badge links are percent-escaped, no raw spaces (spec bug #10). Test in Task 4.
- **Empty `modules`/`contributors`/optional sections** → those sections and their TOC entries are omitted cleanly, never rendered empty or phantom (spec bug #3). Test in Task 4.
- **`projectUrl` in varied forms** (trailing slash, `.git` suffix, extra path) → `parseRepo` yields the correct `{owner, repo}` (spec §4.2). Test in Task 4.
- **GitHub unreachable/rate-limited vs. a genuine 404** → distinguished so the CLI offers manual fallback vs. re-prompt (spec §4.3/§4.6). Test in Tasks 3 and 5.
- **Malformed comma-separated input** (extra spaces, empty items, trailing commas) → `parseList` returns a clean, trimmed, empty-free array (spec §4.2). Test in Task 5.

---

### Task 1: Consolidate to a single ESM package

**Files:**
- Modify: `package.json` (merge deps, set `"type": "module"`, scripts, remove `path`)
- Rename: `main.js` → `main.cjs`; `preload.js` → `preload.cjs`
- Modify: `main.cjs` (update preload path reference to `preload.cjs`)
- Modify: `index.html` (if it references a preload path — update to `preload.cjs`)
- Create dirs: `src/core/`, `src/github/`, `src/cli/`, `test/`, `test/fixtures/`
- Delete: `Develop/package.json`, `Develop/package-lock.json`, `Develop/node_modules/` (retire the sub-package; `Develop/` source files remain only as reference until Task 5)

**Interfaces:**
- Consumes: nothing.
- Produces: a single installable package; `npm start` launches Electron; `node --test` is the test runner; `npm run cli` (added, points to `src/cli/index.js`, which arrives in Task 5).

- [ ] **Step 1:** `git mv main.js main.cjs` and `git mv preload.js preload.cjs`.
- [ ] **Step 2:** In `main.cjs`, update the preload reference from `preload.js` to `preload.cjs`. In `index.html`, if a preload/script path points at `preload.js`, update it to `preload.cjs`.
- [ ] **Step 3:** Edit root `package.json`: add `"type": "module"`; set `"main": "main.cjs"`; dependencies = `axios ^1.20.0`, `chalk ^5.0.1`, `dotenv ^16.0.1`, `figlet ^1.5.2`, `inquirer ^9.0.0`, `open ^8.4.0`; devDependencies = `electron ^44.0.0`, `standard ^17.0.0`; scripts = `{ "start": "electron .", "cli": "node src/cli/index.js", "test": "node --test", "lint": "standard" }`. Remove any `path` dependency.
- [ ] **Step 4:** Create the empty directories (add a `.gitkeep` where needed so they commit).
- [ ] **Step 5:** Delete `Develop/package.json`, `Develop/package-lock.json`, and `Develop/node_modules/`.
- [ ] **Step 6:** Run `npm install`. Expected: completes, `npm ls` reports no missing deps.
- [ ] **Step 7:** Run `npm run lint`. Expected: passes (0 errors) on the renamed shell files.
- [ ] **Step 8:** Run `node --check main.cjs` and `node --check preload.cjs`. Expected: no syntax errors. (Electron GUI launch is a manual smoke, not automated.)
- [ ] **Step 9: Commit**
```bash
git add -A
git commit -m "refactor: consolidate into a single ESM package"
```

---

### Task 2: License info module

**Files:**
- Create: `src/core/licenses.js`
- Test: `test/licenses.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function licenseInfo(key)` → `{ key, name, spdx, description }` for a known key, or `null` for an unknown key. Keys (spec §4.2): `MIT`, `Apache 2.0`, `GNU AGPLv3`, `GNU GPLv3`, `GPLv3`, `Mozilla Public License 2.0`, `The Unlicense`. `description` is the full descriptive sentence(s) for that license (ported from the old tool's switch, now correctly keyed).

- [ ] **Step 1: Write the failing test** in `test/licenses.test.js`:
```js
test('licenseInfo returns the correct description per key (fixes bug #1)', () => {
  assert.match(licenseInfo('MIT').description, /permissive license/i)
  assert.match(licenseInfo('Apache 2.0').description, /patent rights/i)
  assert.equal(licenseInfo('The Unlicense').spdx, 'Unlicense')
})
test('licenseInfo returns null for an unknown key', () => {
  assert.equal(licenseInfo('Bogus'), null)
})
```
- [ ] **Step 2: Run** `node --test test/licenses.test.js`. Expected: FAIL (module/function not found).
- [ ] **Step 3: Implement** `licenseInfo(key)` in `src/core/licenses.js` as a lookup over a map of the seven keys. Port each `description` verbatim from the old `index.js` license switch, pairing each with its *correct* key (this is the fix for bug #1 — the old code never matched any case). Include a short `name` and `spdx` id per entry.
- [ ] **Step 4: Run** `node --test test/licenses.test.js`. Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add src/core/licenses.js test/licenses.test.js
git commit -m "feat: add license info module with correct per-license text"
```

---

### Task 3: Hardened GitHub user module

**Files:**
- Create: `src/github/fetchGitHubUser.js`
- Test: `test/fetchGitHubUser.test.js`

**Interfaces:**
- Consumes: `axios` (default), injectable for tests.
- Produces: `export async function fetchGitHubUser(username, { token, client = axios } = {})` →
  - `{ ok: true, user: { login, name, email, html_url, avatar_url, bio } }` on success,
  - `{ ok: false, reason: 'not_found' }` on HTTP 404,
  - `{ ok: false, reason: 'unreachable' }` on any network error / no response / other status.
  Never throws for these cases; never calls `console`.

- [ ] **Step 1: Write the failing test** in `test/fetchGitHubUser.test.js` using a fake `client` (no real network):
```js
test('returns ok + user on success', async () => {
  const client = async () => ({ data: { login: 'deawar', name: 'Dean', email: 'd@e.com', html_url: 'u', avatar_url: 'a', bio: 'b' } })
  const r = await fetchGitHubUser('deawar', { client })
  assert.equal(r.ok, true); assert.equal(r.user.login, 'deawar')
})
test('404 → not_found (spec §4.6)', async () => {
  const client = async () => { throw { response: { status: 404 } } }
  assert.deepEqual(await fetchGitHubUser('nope', { client }), { ok: false, reason: 'not_found' })
})
test('no response → unreachable (fixes bug #5)', async () => {
  const client = async () => { throw new Error('ENOTFOUND') }   // err.response undefined
  assert.deepEqual(await fetchGitHubUser('x', { client }), { ok: false, reason: 'unreachable' })
})
test('sends Bearer header only when token present (fixes bug #6)', async () => {
  let sent
  const client = async (cfg) => { sent = cfg.headers; return { data: {} } }
  await fetchGitHubUser('x', { client })
  assert.equal(sent.Authorization, undefined)
  await fetchGitHubUser('x', { token: 'T', client })
  assert.equal(sent.Authorization, 'Bearer T')
})
```
- [ ] **Step 2: Run** `node --test test/fetchGitHubUser.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `fetchGitHubUser` in `src/github/fetchGitHubUser.js`: call `client({ method: 'get', url: \`https://api.github.com/users/${username}\`, headers })` where `headers` includes `Authorization: \`Bearer ${token}\`` only when `token` is truthy. In `catch`, return `{ ok:false, reason:'not_found' }` when `err?.response?.status === 404`, else `{ ok:false, reason:'unreachable' }`. Map the response data to the `user` shape.
- [ ] **Step 4: Run** `node --test test/fetchGitHubUser.test.js`. Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add src/github/fetchGitHubUser.js test/fetchGitHubUser.test.js
git commit -m "feat: hardened GitHub user module (offline-safe, proper auth)"
```

---

### Task 4: Core generator `generateReadme(answers)`

**Files:**
- Create: `src/core/generateReadme.js`
- Test: `test/generateReadme.test.js`
- Create: `test/fixtures/full-answers.js` (a complete `answers` object)
- Create: `test/fixtures/expected-full.md` (golden snapshot; generated once, then verified by eye against `Example_README.md` and committed)

**Interfaces:**
- Consumes: `licenseInfo` (Task 2).
- Produces:
  - `export function generateReadme(answers)` → markdown string (pure; the `answers` shape is spec §4.2).
  - `export function parseRepo(projectUrl)` → `{ owner, repo }` (exported for testing; tolerates trailing `/`, a `.git` suffix, and extra path segments).

- [ ] **Step 1: Write the failing tests** in `test/generateReadme.test.js`. Cover the Review Focus items plus structure:
```js
test('parseRepo tolerates trailing slash, .git, extra path', () => {
  for (const u of ['https://github.com/a/b', 'https://github.com/a/b/', 'https://github.com/a/b.git', 'https://github.com/a/b/tree/main'])
    assert.deepEqual(parseRepo(u), { owner: 'a', repo: 'b' })
})
test('title with spaces is URL-escaped in links (bug #10)', () => {
  const md = generateReadme({ ...base, projectTitle: 'My Cool App' })
  assert.ok(!/\(https?:\/\/[^)]* [^)]*\)/.test(md))       // no raw space inside any URL
})
test('empty modules/contributors omit their sections and TOC entries (bug #3)', () => {
  const md = generateReadme({ ...base, modules: [], devModules: [], contributors: [], tableOfContents: true })
  assert.ok(!md.includes('## Dependencies'))
  assert.ok(!/\[Dependencies\]\(#dependencies\)/.test(md))
})
test('license section shows the correct text for the chosen key (bug #1)', () => {
  assert.match(generateReadme({ ...base, license: 'MIT' }), /permissive license/i)
})
test('no undefined appears anywhere in output (bug #2)', () => {
  assert.ok(!generateReadme(base).includes('undefined'))
})
test('full fixture matches the committed golden snapshot', () => {
  assert.equal(generateReadme(fullAnswers), readFileSync('test/fixtures/expected-full.md', 'utf8'))
})
```
(`base` is a minimal valid `answers`; define it at the top of the test file.)
- [ ] **Step 2: Run** `node --test test/generateReadme.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `generateReadme` and `parseRepo` in `src/core/generateReadme.js`. Build the output in the section order of spec §5 using small internal section-builder functions (shields, header, TOC, about+built-with, getting-started, usage, testing, dependency lists, roadmap, contributing, license via `licenseInfo`, contact, acknowledgments, back-to-top links, reference-style link block). Omit any section/element whose source field is empty; emit the spec's placeholder text for prose fields that are empty. Derive all repo URLs from `parseRepo(answers.projectUrl)`; percent-escape interpolated values; use the `HEAD` ref for blob links.
- [ ] **Step 4: Create the golden fixture.** Write `test/fixtures/full-answers.js` (every field populated, including optional logo/screenshot/twitter/linkedin). Run the generator once, write the result to `test/fixtures/expected-full.md`, and read it against `Example_README.md` to confirm the structure matches the template. Commit the reviewed snapshot.
- [ ] **Step 5: Run** `node --test test/generateReadme.test.js`. Expected: PASS.
- [ ] **Step 6: Run** `npm run lint`. Expected: passes.
- [ ] **Step 7: Commit**
```bash
git add src/core/generateReadme.js test/generateReadme.test.js test/fixtures/
git commit -m "feat: pure generateReadme core matching Best-README-Template"
```

---

### Task 5: CLI front-end

**Files:**
- Create: `src/cli/index.js`
- Test: `test/cli.test.js`
- Delete: `Develop/` (remaining source: `index.js`, `utils/api.js`, `utils/generateMarkdown.js`, and its stale `.md` artifacts) once logic has moved

**Interfaces:**
- Consumes: `fetchGitHubUser` (Task 3), `generateReadme` (Task 4), `inquirer`, `chalk`, `figlet`, `dotenv`, `node:fs`.
- Produces (exported for testing, kept pure):
  - `export function parseList(input)` → `string[]` (comma-split, trim each, drop empties).
  - `export async function resolveContributors(names, lookup)` → array of resolved user objects, awaiting each lookup (fixes bug #4); unreachable lookups are skipped with a collected warning.
  - `export function authorFallbackNeeded(result)` → `true` when `result.reason === 'unreachable'` (drives manual entry per §4.6), `false` for `not_found` (re-prompt) or `ok`.
  The interactive prompt flow and file write live in a `main()` that runs when the module is the entry point.

- [ ] **Step 1: Write the failing tests** in `test/cli.test.js`:
```js
test('parseList trims, drops empties and trailing commas (spec §4.2)', () => {
  assert.deepEqual(parseList('react, lodash,  , express,'), ['react', 'lodash', 'express'])
  assert.deepEqual(parseList(''), [])
})
test('resolveContributors awaits every lookup and skips unreachable (bug #4)', async () => {
  const lookup = async (n) => n === 'bad' ? { ok: false, reason: 'unreachable' } : { ok: true, user: { login: n } }
  const r = await resolveContributors(['a', 'bad', 'b'], lookup)
  assert.deepEqual(r.map(u => u.login), ['a', 'b'])
})
test('authorFallbackNeeded only on unreachable (spec §4.6)', () => {
  assert.equal(authorFallbackNeeded({ ok: false, reason: 'unreachable' }), true)
  assert.equal(authorFallbackNeeded({ ok: false, reason: 'not_found' }), false)
})
```
- [ ] **Step 2: Run** `node --test test/cli.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement the pure helpers** (`parseList`, `resolveContributors`, `authorFallbackNeeded`) in `src/cli/index.js`.
- [ ] **Step 4: Run** `node --test test/cli.test.js`. Expected: PASS.
- [ ] **Step 5: Implement `main()`** in the same file: load `.env` via `dotenv`; prompt with `inquirer` for every `answers` field in spec §4.2 — **including the new `projectUrl` prompt** (fixes bug #2) and optional tagline/logo/screenshot/docs/demo/twitter/linkedin; split list inputs with `parseList`; look up the author via `fetchGitHubUser` and, when `authorFallbackNeeded`, prompt for name/email/avatar manually; resolve contributors via `resolveContributors`; call `generateReadme(answers)`; write the result to `<projectTitle>.md` in the current directory; print a `chalk`/`figlet` success banner. Remove all stray debug `console.log` statements (fixes bug #9). Gate the `main()` call behind an `import.meta.url === ...` entry-point check so importing the module for tests does not run it.
- [ ] **Step 6: Manual smoke test.** Run `npm run cli`, answer the prompts for a real repo, and confirm a correct `<title>.md` is produced and opens cleanly in a markdown viewer. (Interactive `inquirer` flow is not unit-tested.)
- [ ] **Step 7: Delete `Develop/`** now that all logic has moved. Run `npm run lint` and `node --test`. Expected: both pass.
- [ ] **Step 8: Commit**
```bash
git add -A
git commit -m "feat: CLI front-end on shared core; retire Develop/"
```

---

## Notes for the executor
- The CLI is not runnable between Task 1 and Task 5 (its source moves/rewrites); that is expected. Each task is still independently verifiable via its own tests.
- The Electron GUI (Phase 2) is out of scope here; do not modify `main.cjs`/`preload.cjs` beyond the Task 1 rename.
- If the golden snapshot (Task 4) and `Example_README.md` disagree on a structural detail the spec didn't pin, follow `Example_README.md` and note the choice in the commit message.
