# ReadMeGen — Session Primer

> Resume point for picking the project back up. Last updated 2026-10-17.

## What this is
A developer tool that interviews you about a project and generates a complete,
well-formatted `README.md` (styled after the othneildrew **Best-README-Template**).
**North star:** the same tool runs as a **CLI** *or* a **desktop (Electron) GUI**,
chosen by the user — both front-ends feed the same inputs into the same
generation core so their output is identical.

## Status at a glance
- **Phase 1 (CLI): DONE, merged to `master`, pushed to origin.** All 11
  catalogued bugs fixed. **20 tests pass, `standard` lint clean.**
- **Phase 2 (Electron GUI): NOT STARTED.** The shared core is ready for it.
- Working tree may have untracked generated test outputs in the root
  (e.g. `*.md` the tool produced while testing) — safe to delete; not source.

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
    index.js             inquirer prompts → fetch → generate → write <title>.md
test/                    node:test suites + fixtures (full-answers.js, expected-full.md golden)
docs/superpowers/
  specs/2026-10-17-readme-generator-shared-core-design.md   ← the design (read this)
  plans/2026-10-17-readme-generator-shared-core.md          ← the Phase-1 plan
Example_README.md        the Best-README-Template sample = canonical output format
```

**Key seam:** each front-end only (1) collects an `answers` object, (2) calls the
core, (3) decides what to do with the returned string. The `answers` schema is in
the design doc **§4.2**; the output structure is **§5**.

## Commands
- `npm run cli`  — run the CLI (needs a real terminal; inquirer requires a TTY)
- `npm test`     — `node --test` (20 tests)
- `npm run lint` — `standard` (the gate; must be clean to commit)
- `npm start`    — launch the Electron shell (currently the leftover drag-demo window)

## Gotchas / things that bit us
- **ESM vs CJS:** package is `type: module`; `src/**` are ESM `.js`. The Electron
  shell is CommonJS (`main.cjs`/`preload.cjs`). From `main.cjs`, import the ESM
  core with **dynamic import**: `const { generateReadme } = await import('./src/core/generateReadme.js')`.
- **inquirer needs a TTY** — the interactive CLI flow can't be driven by piped
  stdin, so it's verified manually, not unit-tested. The pure helpers are tested.
- **chalk auto-disables color for non-TTY** output — color only shows in a real
  terminal (not when piping to a file/subprocess).
- **`standard` is the lint gate** — watch for trailing whitespace, `padded-blocks`,
  single-quote preference (double quotes OK only to avoid escaping). SonarLint IDE
  warnings (S7778 push-merge, S6594 exec, S3776 complexity) are **advisory only**,
  not the gate.
- **GitHub auth:** works unauthenticated (60 req/hr); a token in `.env` as `TOKEN=`
  raises it to 5000/hr and enables email. Header is `Authorization: Bearer <token>`,
  sent only when a token is present. See the README "Configuration" section.

## Decisions worth remembering (in the design doc, but quick ref)
- Output = Best-README-Template structure; kept the old tool's **Testing**,
  **Dependencies/Dev-Dependencies**, **Contributor Covenant**; old **Questions**
  merged into **Contact**.
- **Per-section prompts** for optional prose: `includeWhy`, `includePrerequisites`,
  `includeRoadmap`, `includeAcknowledgments` (default true in core; CLI defaults
  Prereqs ON, the rest OFF). Excluding a section drops its body AND its TOC entry.
  Included-but-blank → editable placeholder. (Design §4.2 / §11.)
- `owner/repo` derived from `projectUrl`; links use the `HEAD` ref (works for
  `main` or `master`). URLs never embed the title (bug #10 eliminated).
- Offline/rate-limited author lookup → CLI falls back to manual entry (§4.6).

## NEXT STEPS — Phase 2: the GUI
Do this as its own brainstorm → design-doc update → plan → TDD build (same flow
that made Phase 1 go smoothly). Design doc **§6** already reserves the seam.

1. **Prep refactor (unblocks everything, DRY):** extract the orchestration glue
   currently inside `main()` in `src/cli/index.js` (resolve author → resolve
   contributors → assemble answers → `generateReadme`) into a shared, testable
   module, e.g. `src/core/buildReadme.js`:
   `buildReadme(rawAnswers, { token, lookup }) → { markdown, author, contributors }`.
   Then CLI = "prompts → buildReadme → write"; GUI = "form → buildReadme →
   preview + save." TDD it (pure given an injected `lookup`).
2. **IPC contract:** define channels — at least `generate` (answers → markdown);
   likely `lookup-user` (live username validation) and `save` (native Save dialog
   + write). GitHub lookups live in the **main process** (token stays out of the
   renderer).
3. **main.cjs:** add `ipcMain.handle(...)`; dynamic-import the ESM core; call
   `buildReadme`; handle the save dialog.
4. **preload.cjs:** replace the drag-demo with a `contextBridge` API wrapping
   `ipcRenderer.invoke`. Keep `contextIsolation: true`, `nodeIntegration: false`.
5. **Renderer (index.html + new renderer.js):** the real work — a form for every
   `answers` field (incl. the per-section toggle checkboxes + license dropdown),
   a live Markdown **preview pane**, Generate/Save buttons, and the manual-author
   fallback as form fields.
6. **Cleanup:** remove the drag-and-drop demo (`ondragstart` in main.cjs, the
   "Drag me" div, `iconForDragAndDrop`) and wire the real `renderer.js`.
7. **Open brainstorm question:** window shape — one long form vs. stepped wizard
   vs. form-with-live-preview-beside-it. Decide this first.

## Housekeeping loose ends
- `master` is pushed and clean (`npm audit` = 0 on the committed lockfile).
  GitHub Dependabot may still show a high alert count from the *old* dependency
  tree (Electron 26 / axios 0.27 / electron-html-to) — stale, should reconcile
  after it re-scans; verify/dismiss on the Dependabot page if it lingers.
- Phase-1 SDD ledger was deleted on completion (git history is the record).
