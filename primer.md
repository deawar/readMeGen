# ReadMeGen — Session Primer

> Resume point for picking the project back up. Last updated 2026-10-17 (after CLI back-navigation).

## What this is
A developer tool that interviews you about a project and generates a complete,
well-formatted `README.md` (styled after the othneildrew **Best-README-Template**).
**North star:** the same tool runs as a **CLI** *or* a **desktop (Electron) GUI**,
chosen by the user — both front-ends feed the same inputs into the same
generation core so their output is identical.

## Status at a glance
- **Phase 1 (CLI): DONE** — merged to `master`, pushed to origin. All 11 catalogued
  bugs fixed.
- **CLI back-navigation: DONE** — merged/pushed. Type `<` at any text prompt to open
  a jump-list, edit any earlier answer (incl. the GitHub username), then Continue or
  Generate; an automatic review runs before anything is written.
- **27 tests pass, `standard` lint clean.**
- **Phase 2 (Electron GUI): NOT STARTED.** The shared core is ready for it.
- Untracked generated test READMEs may sit in the root (e.g. `Cathi-s-Portfolio.md`,
  `jspassword_generator.md`) — safe to delete; not source, not committed.

## How it's built (architecture)
One **ESM** package (`"type": "module"`) at the repo root. Thin front-ends on a
pure core:

```
main.cjs / preload.cjs   Electron shell (CommonJS; Phase-2 front-end, not wired yet)
index.html               Electron window (still the drag-demo placeholder)
src/
  core/
    licenses.js          licenseInfo(key) → {key,name,spdx,description}
    generateReadme.js    generateReadme(answers) → string  (PURE: no I/O/net/console)
                         also exports parseRepo(projectUrl) → {owner,repo}
  github/
    fetchGitHubUser.js   fetchGitHubUser(username,{token,client}) → {ok,user}|{ok:false,reason}
  cli/
    fields.js            FIELDS schema + pure helpers: isJumpCommand, activeFields, reviewItems, LICENSES
    interview.js         runInterview({fields, io}) → answers  (PURE control-flow; all I/O injected via `io`)
    index.js             main(): inquirer-backed `io` (askField/showReview) + resolveAuthor →
                         runInterview → resolveContributors → generateReadme → write <title>.md
test/                    node:test suites + fixtures (full-answers.js, expected-full.md golden)
docs/superpowers/
  specs/2026-10-17-readme-generator-shared-core-design.md   ← the design (read this)
  plans/2026-10-17-readme-generator-shared-core.md          ← Phase-1 plan
  plans/2026-10-17-cli-back-navigation.md                   ← back-navigation plan
Example_README.md        the Best-README-Template sample = canonical output format
```

**Key seam:** each front-end only (1) collects an `answers` object, (2) calls the
core, (3) decides what to do with the returned string. The `answers` schema is in
the design doc **§4.2**; the output structure is **§5**.

**Back-nav seam (new):** `runInterview` is pure — it takes an injected `io`
(`resolveAuthor`/`askField`/`showReview`). The CLI builds that `io` from inquirer
in `main()`. This is the pattern the GUI should follow (its own `io` or its own
collector feeding the same `generateReadme`).

## Commands
- `npm run cli`  — run the CLI (needs a real terminal; inquirer requires a TTY)
- `npm test`     — `node --test` (27 tests)
- `npm run lint` — `standard` (the gate; must be clean to commit)
- `npm start`    — launch the Electron shell (currently the leftover drag-demo window)

## Gotchas / things that bit us
- **ESM vs CJS:** package is `type: module`; `src/**` are ESM `.js`. The Electron
  shell is CommonJS (`main.cjs`/`preload.cjs`). From `main.cjs`, import the ESM
  core with **dynamic import**: `const { generateReadme } = await import('./src/core/generateReadme.js')`.
- **inquirer needs a TTY** — the interactive CLI flow can't be driven by piped
  stdin, so it's verified manually, not unit-tested. The pure helpers + the
  navigation controller (via an injected fake `io`) ARE unit-tested.
- **chalk auto-disables color for non-TTY** output — color only shows in a real
  terminal (not when piping to a file/subprocess).
- **`standard` is the lint gate** — watch for trailing whitespace, `padded-blocks`,
  single-quote preference (double quotes OK only to avoid escaping). SonarLint IDE
  warnings (S7778/S6594/S3776) are **advisory only**, not the gate.
- **GitHub auth:** works unauthenticated (60 req/hr); a token in `.env` as `TOKEN=`
  raises it to 5000/hr and enables email. Header is `Authorization: Bearer <token>`,
  sent only when a token is present. See the README "Configuration" section.

## Decisions worth remembering
- Output = Best-README-Template structure; kept the old tool's **Testing**,
  **Dependencies/Dev-Dependencies**, **Contributor Covenant**; old **Questions**
  merged into **Contact**.
- **Per-section prompts** for optional prose: `includeWhy`, `includePrerequisites`,
  `includeRoadmap`, `includeAcknowledgments` (default true in core; CLI defaults
  Prereqs ON, the rest OFF). Excluding a section drops its body AND its TOC entry.
  Included-but-blank → editable placeholder. (Design §4.2 / §11.)
- `owner/repo` derived from `projectUrl`; links use the `HEAD` ref. URLs never embed
  the title (bug #10 eliminated).
- Offline/rate-limited author lookup → CLI falls back to manual entry (§4.6).
- **Back-navigation:** jump-list reached by typing `<` at text prompts; `<` is a
  bare-input sentinel (a value containing `<` is kept literally). v1 does NOT honor
  `<` inside menu prompts (License, Yes/No toggles) — the automatic end-review covers
  those. Deferred minors noted in the back-nav plan/commits.

## NEXT STEPS — Phase 2: the GUI
Run it as its own brainstorm → design-doc update → plan → TDD build. Design doc
**§6** reserves the seam.

1. **START HERE — prep refactor (DRY, no design decisions needed):** extract the
   orchestration glue in `main()` (resolve author → resolve contributors →
   assemble answers → `generateReadme`) into a shared, testable module, e.g.
   `src/core/buildReadme.js`:
   `buildReadme(rawAnswers, { token, lookup }) → { markdown, author, contributors }`.
   Then CLI = "interview → buildReadme → write"; GUI = "form → buildReadme →
   preview + save." Behavior-preserving; TDD with an injected `lookup`. This is the
   cleanest thing to do first — it needs no UI decisions and de-duplicates the seam.
2. **Brainstorm the window shape FIRST (the one real design fork):** one long form
   vs. stepped wizard vs. form-with-live-preview-beside-it.
3. **IPC contract:** channels — at least `generate` (answers → markdown); likely
   `lookup-user` (live username validation) and `save` (native Save dialog + write).
   GitHub lookups live in the **main process** (token stays out of the renderer).
4. **main.cjs:** `ipcMain.handle(...)`; dynamic-import the ESM core; call
   `buildReadme`; save dialog.
5. **preload.cjs:** replace the drag-demo with a `contextBridge` API wrapping
   `ipcRenderer.invoke`. Keep `contextIsolation: true`, `nodeIntegration: false`.
6. **Renderer (index.html + new renderer.js):** the bulk — a form for every
   `answers` field (incl. per-section toggles + license dropdown), a live Markdown
   **preview pane**, Generate/Save buttons, manual-author fallback as fields.
7. **Cleanup:** remove the drag demo (`ondragstart`, "Drag me" div,
   `iconForDragAndDrop`) and wire the real `renderer.js`.

## Housekeeping loose ends
- `master` is pushed and clean (`npm audit` = 0 on the committed lockfile).
  GitHub Dependabot may still show a high alert count from the *old* dependency
  tree (Electron 26 / axios 0.27 / electron-html-to) — stale; verify/dismiss on the
  Dependabot page if it lingers.
- SDD ledgers are deleted on completion (git history is the record).
