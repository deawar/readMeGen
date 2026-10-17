# CLI Back-Navigation (Jump-List) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the CLI user correct any earlier answer before the README is written — via a review/jump-list reachable at any text prompt by typing `<`, and shown automatically as a final review before Generate.

**Architecture:** Replace the one-shot `inquirer.prompt([...])` in `main()` with a small navigation controller. Field definitions become data (`FIELDS`); pure helpers decide the sentinel, active (non-gated) fields, and review display; a controller (`runInterview`) walks fields forward, opens the review when `<` is typed, lets the user edit any field and return, and ends on Generate. All I/O is injected so the controller is unit-testable without a TTY. The core and GitHub modules are untouched.

**Tech Stack:** Node.js 22, ESM, inquirer (existing), `node:test`, standard. No new dependencies.

**Spec:** This plan is self-contained (brainstorming decision, 2026-10-17 — no separate design doc by the user's choice). Related: [the shared-core design](../specs/2026-10-17-readme-generator-shared-core-design.md).

## Global Constraints

- **Agreed behavior:** nothing is written until the user chooses **Generate**. At any **text** prompt, entering exactly `<` opens the jump-list (every active field + its current value); selecting one re-prompts just that field (pre-filled) and returns to the list; **Continue** resumes the forward walk where it left off; **Generate** finalizes. After the last question the jump-list appears automatically as a final review.
- **Sentinel:** the whole trimmed input equals `<` (a value containing `<` among other text is NOT the sentinel).
- **Menu prompts (v1 scope):** `<` is honored only at text (`input`) prompts. License and the Yes/No toggles are single-keypress; the automatic end-review guarantees nothing is unreachable. (Escape-from-menu-prompts is a deliberate later polish.)
- **GitHub username / author** is resolved first (reusing the existing `resolveAuthor`) and appears in the jump-list as one entry whose edit re-runs `resolveAuthor` (re-validates). Editing any validated field re-validates via that field's own prompt.
- **Gated fields** (`prerequisites`/`roadmap`/`acknowledgments` text) appear in the walk and the jump-list only when their toggle is on.
- **No new dependency; ESM; `standard` clean; `node:test`. Core (`src/core/*`) and GitHub (`src/github/*`) modules unchanged.**

## Review Focus

- **`<` typed at the very first field** (nothing answered yet) → review opens with empty/default values and does not crash. Test in Task 2.
- **Toggling a section off in the review** (e.g., Prerequisites → No) → its gated text field disappears from the active set and the list. Test in Task 1 (activeFields) + Task 2 (edit toggle).
- **A value that merely contains `<`** (e.g., `a < b`) is recorded normally, not treated as the sentinel. Test in Task 1 (isJumpCommand).
- **Jump → edit → Continue mid-flow** resumes at the same next-unanswered field, not a restart, and preserves already-entered answers. Test in Task 2.
- **Generate chosen mid-flow** (before all questions answered) → returns cleanly; unanswered optional fields are simply absent (the core already defaults them). Test in Task 2.

---

### Task 1: Field schema + pure helpers

**Files:**
- Create: `src/cli/fields.js`
- Test: `test/fields.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `FIELDS` — array of descriptors `{ name, label, message, type, default?, choices?, when? }`, one per current `main()` prompt (see Step 3).
  - `isJumpCommand(input) → boolean` — true iff `String(input).trim() === '<'`.
  - `activeFields(answers, fields = FIELDS) → descriptor[]` — fields whose `when` is absent or returns truthy for `answers`.
  - `reviewItems(answers, fields = FIELDS) → [{ key, label }]` — one entry per active field: `key = field.name`, `label = \`${field.label}: ${display(value)}\`` where `display` renders arrays as comma-joined, booleans as `Yes`/`No`, and empty/undefined as `(not set)`.

- [ ] **Step 1: Write the failing test** in `test/fields.test.js`:
```js
test('isJumpCommand matches only a bare <', () => {
  assert.equal(isJumpCommand('<'), true)
  assert.equal(isJumpCommand('  <  '), true)
  assert.equal(isJumpCommand('a < b'), false)
  assert.equal(isJumpCommand(''), false)
})
test('activeFields hides gated text when its toggle is off', () => {
  const on = activeFields({ includePrerequisites: true })
  const off = activeFields({ includePrerequisites: false })
  assert.ok(on.some((f) => f.name === 'prerequisites'))
  assert.ok(!off.some((f) => f.name === 'prerequisites'))
})
test('reviewItems renders value by type and hides gated fields', () => {
  const items = reviewItems({ projectTitle: 'My App', tableOfContents: true, modules: ['a', 'b'], includeRoadmap: false })
  const byKey = Object.fromEntries(items.map((i) => [i.key, i.label]))
  assert.match(byKey.projectTitle, /My App/)
  assert.match(byKey.tableOfContents, /Yes/)
  assert.match(byKey.modules, /a, b/)
  assert.equal(byKey.roadmap, undefined)
})
```
- [ ] **Step 2: Run** `node --test test/fields.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `src/cli/fields.js`. Port the prompt list from `main()` in [src/cli/index.js](../../../src/cli/index.js) into `FIELDS`, one descriptor per prompt, preserving each `name`, `message`, `type`, `default`, `choices`, and `when`; add a short `label` per field for the review display. Implement `isJumpCommand`, `activeFields`, `reviewItems` per the Interfaces block.
- [ ] **Step 4: Run** `node --test test/fields.test.js`. Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add src/cli/fields.js test/fields.test.js
git commit -m "feat(cli): field schema + pure helpers for back-navigation"
```

---

### Task 2: Navigation controller

**Files:**
- Create: `src/cli/interview.js`
- Test: `test/interview.test.js`

**Interfaces:**
- Consumes: `FIELDS`, `isJumpCommand`, `activeFields`, `reviewItems` (Task 1).
- Produces: `runInterview({ fields, io }) → Promise<answers>` where `answers` is the collected field values by name plus `author` (the resolved author object). `io` is the injected I/O boundary:
  - `io.resolveAuthor() → Promise<{ username, author }>`
  - `io.askField(field, current) → Promise<value>` (value may be `<` to request a jump)
  - `io.showReview(items, { atEnd }) → Promise<key>` where `key ∈ field.name | '__username' | 'continue' | 'generate'`
  Control flow: resolve author first; walk `activeFields(answers)` in order, calling `io.askField`; if the field is `input` and `isJumpCommand(value)`, open the review loop instead of recording (and resume at the same field); after the last field, open the review loop with `{ atEnd: true }`. The review loop calls `io.showReview` repeatedly: `generate` → finalize and return; `continue` → return to the walk; `__username` → re-run `io.resolveAuthor`; any field key → re-ask that field. Prepend a `__username` item (label `GitHub username: <value>`) to the review items.

- [ ] **Step 1: Write the failing test** in `test/interview.test.js` using a scripted fake `io` (queues of return values; records the field order asked):
```js
// Fake io: resolveAuthor returns deawar; askField/ showReview pull from queues.
test('mid-flow jump edits an earlier field then generates', async () => {
  // Script: answer projectTitle='typo', then at next field type '<',
  // review → edit projectTitle='Fixed', → continue, answer rest, → generate.
  const answers = await runInterview({ fields, io: scriptedIo({...}) })
  assert.equal(answers.projectTitle, 'Fixed')
  assert.equal(answers.author.login, 'deawar')
})
test('jump at the very first field does not crash and returns to the walk', async () => {
  const answers = await runInterview({ fields, io: scriptedIo({ firstInput: '<', thenContinue: true, ... }) })
  assert.ok(answers) // completed without throwing
})
test('toggling a section off removes its gated field from the remaining walk', async () => {
  // set includePrerequisites=false via review; assert prerequisites is never asked afterward
  const asked = []
  await runInterview({ fields, io: scriptedIo({ record: asked, ... }) })
  assert.ok(!asked.includes('prerequisites'))
})
test('generate chosen mid-flow returns without the unanswered fields', async () => {
  const answers = await runInterview({ fields, io: scriptedIo({ generateAfter: 'projectTitle', ... }) })
  assert.equal(answers.acknowledgments, undefined)
})
```
(Define `scriptedIo(opts)` at the top of the test file — a small object whose `askField`/`showReview`/`resolveAuthor` shift from queues and push asked field names into `opts.record`.)
- [ ] **Step 2: Run** `node --test test/interview.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `runInterview` in `src/cli/interview.js` per the Interfaces block. Recompute `activeFields(answers)` each iteration so toggle edits take effect. Strip any internal bookkeeping keys from the returned `answers`.
- [ ] **Step 4: Run** `node --test test/interview.test.js`. Expected: PASS.
- [ ] **Step 5: Run full suite** `node --test` and `npm run lint`. Expected: all pass, lint clean.
- [ ] **Step 6: Commit**
```bash
git add src/cli/interview.js test/interview.test.js
git commit -m "feat(cli): interview controller with jump-list navigation"
```

---

### Task 3: Wire the controller into `main()`

**Files:**
- Modify: `src/cli/index.js` (`main()` only; keep the exported pure helpers unchanged)

**Interfaces:**
- Consumes: `runInterview` + `FIELDS` (Tasks 1–2), existing `resolveAuthor`, `parseList`, `resolveContributors`, `authorFallbackNeeded`, `fetchGitHubUser`, `generateReadme`.
- Produces: no new exports; behavior only.

- [ ] **Step 1: Implement.** In `main()`, replace the one-shot `inquirer.prompt([...])` with a call to `runInterview({ fields: FIELDS, io })`, where `io` is built from inquirer:
  - `io.resolveAuthor` = the existing `resolveAuthor(token)`.
  - `io.askField(field, current)` = a single `inquirer.prompt([{ ...field, default: current ?? field.default }])` returning the one value; for `input`-type fields, append a dim hint to the message like `(type < to review/jump)`.
  - `io.showReview(items, { atEnd })` = an `inquirer` `list` whose choices are the items plus `Generate`, and `Continue` when not `atEnd`; return the chosen key.
  Then keep the existing tail: `parseList` the list fields, `resolveContributors`, assemble the final `answers` (with `author` from the interview), `generateReadme`, write `<title>.md`, print the banner.
- [ ] **Step 2: Run full suite** `node --test` and `npm run lint`. Expected: all pass (existing CLI helper tests still green), lint clean.
- [ ] **Step 3: Manual smoke.** `npm run cli`: (a) type `<` mid-interview, edit the title, Continue, finish, confirm the generated file has the corrected title; (b) at the end review, change the license and Generate; confirm it took. (Interactive inquirer flow is not unit-tested.)
- [ ] **Step 4: Commit**
```bash
git add src/cli/index.js
git commit -m "feat(cli): back-navigation jump-list in the interview flow"
```

---

## Notes for the executor
- Keep `parseList`, `resolveContributors`, `authorFallbackNeeded` exported from `src/cli/index.js` unchanged — `test/cli.test.js` imports them.
- The interactive inquirer wiring in `main()`/`io` is manual-smoke only (TTY); the controller logic is fully covered via the injected fake `io`.
