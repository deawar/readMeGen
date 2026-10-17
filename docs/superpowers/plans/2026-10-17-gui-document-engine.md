# ReadMeGen GUI — Document Engine (Phase 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, Electron-free core that turns a README into an editable `{ meta, blocks }` document and back, plus the manifest and authenticated-user helpers the GUI's smart assists need.

**Architecture:** All new logic is pure ES modules under `src/core/` and `src/github/`, unit-tested with `node:test` — exactly the Phase-1 pattern. A shared `managed.js` holds the template's "managed" scaffolding (shields, reference links, back-to-top, TOC) so that `generateReadme` (Phase 1) and the new `serializeDocument` emit byte-identical scaffolding, which is what makes round-tripping our own template exact. No Electron, no DOM, no new runtime dependency in this plan.

**Tech Stack:** Node.js 22, ESM, `node:test` + `node:assert/strict`, `standard` lint. Reuses existing `parseRepo`, `licenses.js`, `axios`.

**Spec:** [docs/superpowers/specs/2026-10-17-readme-generator-gui-design.md](../specs/2026-10-17-readme-generator-gui-design.md)

**Scope note:** This is Phase **2a of 2**. Phase 2b (the Electron main/preload/renderer window — `documentStore`, IPC handlers, the block-editor UI) is a separate plan written after this engine lands, when these interfaces are concrete.

## Global Constraints

- Node.js 22; package is `"type": "module"`; every new file under `src/**` is ESM `.js`.
- `standard` must stay clean (`npm run lint`) — single quotes (double only to avoid escaping), no trailing whitespace, no `padded-blocks`, `new Error()` not thrown literals.
- Tests use `node:test` + `node:assert/strict` only — **no new dependency** (the core stays dependency-free; the markdown-split is hand-rolled, not a library).
- TDD throughout (superpowers:test-driven-development): every function gets a test watched to fail first.
- Reuse, do not fork: `generateReadme`, `buildReadme`, `licenses.js`, `fetchGitHubUser` stay as they are except for the Task-1 import rewrite.
- `fetchAuthenticatedUser` must never throw — tagged result only (mirrors `fetchGitHubUser`).

**Plan-time refinement of the design (ruling):** the design §4.1 listed `author`, `license`, and `builtWith` inside `meta`. This plan keeps those in their **block bodies**, not `meta`, so that smart assists regenerate a block's body at assist-time and `serializeDocument` never clobbers a user's hand-edits. `meta` is therefore the minimal set the scaffolding needs: `{ projectUrl, linkedin, conCov, tableOfContents }`. Cost if wrong: an assist that wanted a persistent structured author object would re-read it from the Contact block instead — cheap.

## Review Focus

- **Headings inside fenced code blocks** (```` ``` ````/`~~~`) must NOT start a new block — the splitter is fence-aware. → Task 2 test `parseDocument ignores ## inside a code fence`.
- **Off-template / minimal READMEs** (no shields, no TOC, unknown headings) must parse and round-trip without crashing and without losing prose. → Task 3 test `round-trips an off-template readme preserving prose`.
- **Malformed `package.json` and messy `requirements.txt`** (invalid JSON; lines with `==`/`>=`, comments, blanks, `extras`) → predictable output or a typed error. → Task 4 tests.
- **Manifest merge must not duplicate an existing dep nor drop a hand-added one** absent from the manifest. → Task 5 test `merges without duplicating or dropping`.
- **`fetchAuthenticatedUser` with no token / network error** returns a tagged result, never throws. → Task 6 tests.

---

## File Structure

- `src/core/managed.js` *(new)* — shared scaffolding emitters + section table.
- `src/core/generateReadme.js` *(modify)* — import scaffolding from `managed.js`.
- `src/core/blocks.js` *(new)* — `parseDocument` + `serializeDocument`.
- `src/core/parseManifest.js` *(new)* — manifest → dependency lists.
- `src/core/applyManifest.js` *(new)* — merge parsed deps into a document.
- `src/github/fetchAuthenticatedUser.js` *(new)* — the `/user` endpoint.
- `test/managed.test.js`, `test/blocks.test.js`, `test/parseManifest.test.js`, `test/applyManifest.test.js`, `test/fetchAuthenticatedUser.test.js` *(new)*.

---

### Task 1: Extract shared scaffolding into `managed.js`

**Files:**
- Create: `src/core/managed.js`
- Modify: `src/core/generateReadme.js` (replace its local `shields`/`toc`/`BACK_TO_TOP`/refs with imports)
- Test: `test/managed.test.js` (and the existing `test/generateReadme.test.js` golden is the guard)

**Interfaces:**
- Consumes: `parseRepo` from `generateReadme.js` (stays exported there).
- Produces:
  - `BACK_TO_TOP: string` — the exact back-to-top paragraph.
  - `emitShields({ owner, repo, linkedin, conCov }) → string` — the top reference-style shield block (LinkedIn line only if `linkedin`; Covenant line only if `conCov`).
  - `emitRefs({ owner, repo, linkedin, conCov }) → string` — the `<!-- MARKDOWN LINKS & IMAGES -->` banner + all reference-link definitions (linkedin/covenant defs only when set); derives `repoBase` internally.
  - `emitToc({ hasModules, hasDevModules, includePrerequisites, includeRoadmap, includeAcknowledgments }) → string` — the `<details>` TOC.
  - `KNOWN_SECTIONS: Array<{ heading, type, level }>` — in canonical document order: header(0), `About The Project`/about(2), `Built With`/builtWith(3), `Getting Started`/gettingStarted(2), `Prerequisites`/prerequisites(3), `Installation`/installation(3), `Usage`/usage(2), `Testing`/testing(2), `Dependencies`/dependencies(2), `Dev-Dependencies`/devDependencies(2), `Roadmap`/roadmap(2), `Contributing`/contributing(2), `License`/license(2), `Contact`/contact(2), `Acknowledgments`/acknowledgments(2).
  - `slug(heading: string) → string` — GitHub-style anchor slug (lowercase, spaces→`-`, strip non-word).

- [ ] **Step 1: Write `test/managed.test.js`** — assert `emitShields` contains the LinkedIn line only when `linkedin` is set and the Covenant line only when `conCov`; `emitRefs` contains `[linkedin-url]:`/`[covenant-url]:` under the same conditions; `slug('Dev-Dependencies') === 'dev-dependencies'`; `KNOWN_SECTIONS` has `builtWith` at level 3.
- [ ] **Step 2: Run it, watch it fail** — `npm test -- test/managed.test.js` → FAIL (module not found).
- [ ] **Step 3: Create `managed.js`** by lifting the current `BACK_TO_TOP`, `shields`, `toc`, and the refs-array builder out of `generateReadme.js` verbatim into the signatures above; add `KNOWN_SECTIONS` and `slug`.
- [ ] **Step 4: Rewrite `generateReadme.js`** to import `BACK_TO_TOP`, `emitShields`, `emitRefs`, `emitToc` from `managed.js` and delete its local copies. Keep its output byte-identical.
- [ ] **Step 5: Run the full suite** — `npm test` → the existing `generateReadme` golden test passes unchanged (this is the guard) and `managed.test.js` passes. Run `npm run lint`.
- [ ] **Step 6: Commit** — `refactor: extract managed README scaffolding into managed.js`

---

### Task 2: `parseDocument` — README → `{ meta, blocks }`

**Files:**
- Create: `src/core/blocks.js`
- Test: `test/blocks.test.js`

**Interfaces:**
- Consumes: `KNOWN_SECTIONS`, `slug` from `managed.js`; `parseRepo` from `generateReadme.js`.
- Produces:
  - `Block = { id: string, type: string, heading: string, level: number, body: string }`
  - `Document = { meta: { projectUrl: string, linkedin: string, conCov: boolean, tableOfContents: boolean }, blocks: Block[] }`
  - `parseDocument(markdown: string) → Document`

**Approach (the parts the signature/tests leave open):** scan line-by-line tracking fenced-code state (toggle on a line whose trimmed start is ```` ``` ```` or `~~~`); never treat a heading line as a boundary while inside a fence. Lift managed lines out: drop the `<a id="readme-top">` anchor and any `BACK_TO_TOP` line; collect the top shield lines (`[![…]][…-url]`) and the bottom reference definitions (`^\[[^\]]+\]:`), using them to recover `meta` (`projectUrl` from the header `<a href>` or `contributors-url`; `linkedin` from `[linkedin-url]:`; `conCov` from a covenant ref/shield); detect the `<details>…Table of Contents…</details>` block, set `meta.tableOfContents = true`, and drop it. Everything before the first heading that is left is the `header` block (`type:'header'`, `level:0`, `heading:''`). Then split at each `##`/`###` heading into blocks; assign `type` by matching the heading against `KNOWN_SECTIONS` (case/space-insensitive) else `'custom'`; `level` = count of leading `#`. Give each block a stable unique `id`.

- [ ] **Step 1: Write failing tests** in `test/blocks.test.js`:
  - `test('parseDocument splits our own template into typed blocks')` — `const md = generateReadme(FIXTURE)` (reuse `test/fixtures/full-answers.js`); assert `blocks.map(b => b.type)` begins `['header','about','builtWith','gettingStarted','prerequisites','installation','usage','testing']`; assert `meta.projectUrl` matches the fixture repo; assert no `block.body` contains `'back to top'` or `'[contributors-shield]'`; assert `meta.tableOfContents === true` when the fixture sets it.
  - `test('parseDocument ignores ## inside a code fence')` — a block whose body has a fenced `## not a heading` yields ONE block, not two.
  - `test('parseDocument keeps unknown sections as custom with body preserved')` — a `## Frequently Asked Questions` section → `type:'custom'`, body text intact.
  - `test('parseDocument gives every block a unique id')`.
- [ ] **Step 2: Run, watch fail** — `npm test -- test/blocks.test.js` → FAIL (`parseDocument` not defined).
- [ ] **Step 3: Implement `parseDocument`** per the approach above.
- [ ] **Step 4: Run, watch pass** — `npm test -- test/blocks.test.js` → PASS. `npm run lint`.
- [ ] **Step 5: Commit** — `feat: parseDocument splits a README into editable blocks`

---

### Task 3: `serializeDocument` + round-trip

**Files:**
- Modify: `src/core/blocks.js`
- Test: `test/blocks.test.js`

**Interfaces:**
- Consumes: `emitShields`, `emitRefs`, `emitToc`, `BACK_TO_TOP` from `managed.js`; `parseRepo`; the `Document`/`Block` shapes from Task 2.
- Produces: `serializeDocument(doc: Document) → string`

**Approach:** derive `{ owner, repo }` via `parseRepo(meta.projectUrl)`. Emit, joined by blank lines: the `<a id="readme-top">` anchor; `emitShields(...)`; the `header` block body; `emitToc(...)` when `meta.tableOfContents` (recomputing `hasModules`/`hasDevModules`/`include*` from which section blocks are present); then each remaining block as `'#'.repeat(level) + ' ' + heading + '\n\n' + body`; insert `BACK_TO_TOP` immediately **before each level-2 block except the first** and once at the very end; finish with `emitRefs(...)`. (This placement reproduces Phase-1 back-to-top positions exactly — see the golden round-trip test.)

- [ ] **Step 1: Write failing tests**:
  - `test('serializeDocument round-trips our own template byte-for-byte')` — `const md = generateReadme(FIXTURE); assert.equal(serializeDocument(parseDocument(md)), md)`.
  - `test('round-trips an off-template readme preserving prose')` — read `Example_README.md`, round-trip it, assert several distinctive prose sentences from its sections still appear (managed scaffolding may differ; prose must not be lost).
  - `test('reordering a block moves its heading in the output')` — move the `license` block before the `usage` block; assert the `## License` heading now precedes `## Usage`, and the shield block + ref block are still present.
- [ ] **Step 2: Run, watch fail** — FAIL (`serializeDocument` not defined).
- [ ] **Step 3: Implement `serializeDocument`** per the approach.
- [ ] **Step 4: Run, watch pass** — `npm test -- test/blocks.test.js` → PASS (round-trip is the keystone; if it's off, fix `serializeDocument`/`parseDocument`, never the golden). `npm run lint`.
- [ ] **Step 5: Commit** — `feat: serializeDocument renders blocks back to markdown (round-trip exact)`

---

### Task 4: `parseManifest` — package.json / requirements.txt → lists

**Files:**
- Create: `src/core/parseManifest.js`
- Test: `test/parseManifest.test.js`

**Interfaces:**
- Produces: `parseManifest(filename: string, contents: string) → { builtWith: string[], modules: string[], devModules: string[] }`

**Approach:** if `filename` ends `package.json`: `JSON.parse` (on failure throw `new Error('invalid package.json')`); `modules = Object.keys(dependencies||{})`, `devModules = Object.keys(devDependencies||{})`, `builtWith` = those dependency names present in a `FRAMEWORK_HINTS` set (`electron`, `react`, `vue`, `svelte`, `next`, `express`, `nest`, `angular`). If `filename` ends `requirements.txt` (or `.txt`): split lines, drop blanks and `#` comments, strip everything from the first of `=<>!~[ ;` to get the bare package name → `modules`; `devModules = []`; `builtWith` = names in a Python hints set (`django`, `flask`, `fastapi`). Otherwise throw `new Error('unsupported manifest: ' + filename)`.

- [ ] **Step 1: Write failing tests**:
  - `test('parseManifest reads package.json deps, devDeps, and detects frameworks')` — deps `{axios, react}`, devDeps `{standard}` → `modules:['axios','react']`, `devModules:['standard']`, `builtWith:['react']`.
  - `test('parseManifest reads requirements.txt stripping versions and comments')` — `"django==4.2\n# a comment\n\nrequests>=2\nuvicorn[standard]"` → `modules:['django','requests','uvicorn']`, `builtWith:['django']`.
  - `test('parseManifest throws on invalid package.json')` and `test('parseManifest throws on an unsupported filename')`.
- [ ] **Step 2: Run, watch fail** — FAIL (not defined).
- [ ] **Step 3: Implement `parseManifest`.**
- [ ] **Step 4: Run, watch pass.** `npm run lint`.
- [ ] **Step 5: Commit** — `feat: parseManifest extracts dependency lists from manifests`

---

### Task 5: `applyManifest` — merge parsed deps into a document

**Files:**
- Create: `src/core/applyManifest.js`
- Test: `test/applyManifest.test.js`

**Interfaces:**
- Consumes: `Document`/`Block` (Task 2); `KNOWN_SECTIONS` (for canonical insert position); the `parseManifest` result shape (Task 4).
- Produces: `applyManifest(document: Document, parsed: { builtWith, modules, devModules }) → Document` (returns a new document; does not mutate the input).

**Approach:** for each of the three targets — `modules`→type `dependencies` (level 2, rendered `* [name](https://www.npmjs.com/package/name)`), `devModules`→type `devDependencies` (level 2, same render), `builtWith`→type `builtWith` (level 3, rendered `* name`): find the block by `type`; read existing names from its body (match `* [name]` or `* name`); produce the union **existing-first, appending only names not already present** (dedupe by exact name); re-render the body. If the block is absent and the parsed list is non-empty, create `{ id, type, heading, level, body }` (heading from `KNOWN_SECTIONS`) and insert it at the position that keeps `blocks` in `KNOWN_SECTIONS` order. Empty parsed lists make no change.

- [ ] **Step 1: Write failing tests**:
  - `test('merges without duplicating or dropping')` — a `dependencies` block body listing `axios`; `parsed.modules = ['axios','chalk']` → body lists `axios` once then `chalk`; a hand-added `lodash` already in the body survives.
  - `test('creates a missing Dependencies block in canonical position')` — document with no dependencies block; `parsed.modules=['axios']` → new `dependencies` block exists and sits after `testing`, before `contributing`.
  - `test('merges builtWith into the Built With block')`.
  - `test('empty parsed lists leave the document unchanged')`.
- [ ] **Step 2: Run, watch fail** — FAIL (not defined).
- [ ] **Step 3: Implement `applyManifest`.**
- [ ] **Step 4: Run, watch pass.** `npm run lint`.
- [ ] **Step 5: Commit** — `feat: applyManifest merges manifest deps into a document (merge + dedupe)`

---

### Task 6: `fetchAuthenticatedUser` — the GitHub `/user` endpoint

**Files:**
- Create: `src/github/fetchAuthenticatedUser.js`
- Test: `test/fetchAuthenticatedUser.test.js`

**Interfaces:**
- Consumes: `axios` (default), injectable `client` (mirrors `fetchGitHubUser`).
- Produces: `fetchAuthenticatedUser({ token, client }) → Promise<{ ok: true, user: { login, name, email, html_url, avatar_url, bio } } | { ok: false, reason: 'no_token' | 'unreachable' }>`

**Approach:** no `token` → return `{ ok: false, reason: 'no_token' }` without a request. Otherwise `GET https://api.github.com/user` with `Accept: application/vnd.github+json` and `Authorization: Bearer <token>`; map the same six fields `fetchGitHubUser` maps; any thrown error or non-2xx → `{ ok: false, reason: 'unreachable' }`. Never throws.

- [ ] **Step 1: Write failing tests** (inject a fake `client`):
  - `test('returns no_token when no token is given')` — no request made.
  - `test('returns the authenticated user on success')` — fake 200 with user data → `ok:true`, fields mapped.
  - `test('returns unreachable when the client throws')`.
- [ ] **Step 2: Run, watch fail** — FAIL (not defined).
- [ ] **Step 3: Implement `fetchAuthenticatedUser`.**
- [ ] **Step 4: Run, watch pass.** `npm run lint`.
- [ ] **Step 5: Commit** — `feat: fetchAuthenticatedUser resolves the token's GitHub identity`

---

## Done when

All six tasks committed; `npm test` green (Phase-1 suite unchanged plus the new suites); `npm run lint` clean. The engine can parse any README into `{ meta, blocks }`, round-trip our own template byte-for-byte, merge manifest dependencies, and resolve the signed-in GitHub user — with zero Electron and zero new dependencies. Phase 2b (the window) consumes exactly these functions.
