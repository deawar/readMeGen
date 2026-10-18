# ReadMeGen GUI — Electron Window (Phase 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Electron block-editor window on top of the Phase-2a document engine — open/new/edit/save a README as draggable, click-to-edit blocks.

**Architecture:** The **main process** (CommonJS `main.cjs`) dynamic-imports the pure ESM engine (`blocks`, `parseManifest`, `applyManifest`, `buildReadme`, `licenses`, `github`) plus `markdown-it`, and exposes a small set of `ipcMain.handle` channels. A thin, pure, injected-deps handler layer (`src/gui/`) holds the brains and is unit-tested. The **renderer** holds the live `Document`, does structural edits with a dependency-free `documentStore`, and calls `window.api.*` (over `ipcRenderer.invoke`) for everything that touches the engine, the filesystem, the network, or markdown rendering — so the renderer imports no engine ES modules and needs no bundler. `contextIsolation: true`, `nodeIntegration: false`.

**Tech Stack:** Electron 44 (CJS shell), Node 22 ESM core, `markdown-it` (the one new runtime dependency — main-process only), `node:test` + `node:assert/strict`, `standard`.

**Spec:** [docs/superpowers/specs/2026-10-17-readme-generator-gui-design.md](../specs/2026-10-17-readme-generator-gui-design.md)

**Builds on:** Phase 2a (merged to master): `src/core/blocks.js` (`parseDocument`/`serializeDocument`), `src/core/parseManifest.js`, `src/core/applyManifest.js`, `src/core/buildReadme.js`, `src/core/managed.js` (`KNOWN_SECTIONS`), `src/core/licenses.js` (`licenseInfo`), `src/github/fetchGitHubUser.js`, `src/github/fetchAuthenticatedUser.js`.

## Global Constraints

- Node 22; package `"type": "module"`; `src/**` are ESM `.js`; the Electron shell stays CommonJS `main.cjs`/`preload.cjs`.
- `contextIsolation: true`, `nodeIntegration: false` — unchanged. The GitHub token lives only in the main process; never exposed to the renderer.
- From `main.cjs`, import the ESM engine with **dynamic import**: `const { parseDocument } = await import('./src/core/blocks.js')`.
- The renderer imports ONLY `src/gui/documentStore.js` (dependency-free). All engine/fs/network/markdown work goes through `window.api` (IPC). The renderer imports no `src/core/**` module directly.
- `standard` lint clean; `node:test` + `node:assert/strict` for unit tests; `markdown-it` is the only new dependency and is `require`d in the main process only.
- TDD for the pure layers (Tasks 1–3). The wiring (Task 4) gets a channel-registration unit test plus a manual smoke check; the renderer (Task 5) is verified by a manual checklist — the design (§6) accepts a lighter approach for the DOM layer.
- Reuse the 2a engine as-is; do not fork or re-implement `parseDocument`/`serializeDocument`/`applyManifest`/`parseManifest`.
- `Document`/`Block`/`meta` shapes are fixed by 2a: `Document = { meta: { projectUrl, linkedin, conCov, tableOfContents }, blocks: Block[] }`, `Block = { id, type, heading, level, body }`.

**Plan-time refinement of the design's IPC list (ruling):** design §4.6 sketched `parse-manifest` returning raw fields and left exact shapes to the builder. This plan has the main process both parse AND apply in one `apply-manifest` call (returning the updated `Document`), and adds `apply-author`/`apply-license`/`set-header` channels that return an updated `Document`. Rationale: it keeps ALL engine imports in the main process (the renderer stays core-free, dodging Electron `file://` ESM issues) at the cost of sending the small README document over IPC on discrete user actions (not per keystroke). Cost if wrong: if IPC latency on these actions feels sluggish, move the pure ops (`docOps.js`, Task 2) into a renderer-side ESM import instead — they're already isolated for exactly that.

## Review Focus

- **Open → Save with no edits must preserve file content** (the fs-boundary round-trip; the 2a dangling-ref fix guards it). → Task 3 `saveReadme writes the serialized document` + Task 5 manual.
- **A canceled Open/Save dialog** must return `{ canceled: true }` with no read/write and no crash. → Task 3 `openReadme/saveReadme handle cancel`.
- **`resolve-author` with no token and no git identity** returns `{ user: null }` — the UI shows editable placeholders, never blocks. → Task 3 `resolveAuthor falls back to null`.
- **Dropping a non-manifest file** (image, arbitrary `.md`) surfaces the engine's `unsupported manifest` / `invalid package.json` error as a caught, user-visible message; the document is unchanged and the app does not crash. → Task 2 `applyManifestToDoc throws on bad input` + Task 5 manual (renderer catches).
- **Rendered markdown containing raw HTML / remote refs**: `render-markdown` returns HTML (the user's own content), and `index.html`'s CSP forbids remote **script** execution while allowing remote **images** (badges). → Task 4 CSP + Task 3 `renderMarkdown returns html`.

---

## File Structure

- `src/gui/documentStore.js` *(new, renderer-side, dependency-free)* — immutable structural ops on a `Document`.
- `src/gui/docOps.js` *(new, main-side, imports the 2a engine)* — the pure doc transforms the handlers wrap (manifest apply, author/license/header block regeneration, new-from-template).
- `src/gui/handlers.js` *(new, main-side)* — IPC handler functions with injected deps (dialog, fs, github, exec, md).
- `main.cjs` *(rewrite)* — dynamic-import handlers/engine, register `ipcMain.handle`, build real deps, remove drag demo.
- `preload.cjs` *(rewrite)* — `contextBridge` `window.api` over `ipcRenderer.invoke`; remove drag demo.
- `index.html` *(rewrite)* — app shell markup + CSP; remove drag demo.
- `src/gui/renderer.js` *(new)* — the block-editor UI.
- `package.json` *(modify)* — add `markdown-it` dependency.
- Tests: `test/documentStore.test.js`, `test/docOps.test.js`, `test/handlers.test.js`, `test/guiWiring.test.js` *(new)*.

---

### Task 1: `documentStore` — immutable structural ops (renderer-side)

**Files:**
- Create: `src/gui/documentStore.js`
- Test: `test/documentStore.test.js`

**Interfaces:**
- Consumes: the `Document`/`Block` shapes only. No imports (keeps the renderer bundler-free).
- Produces (every function returns a NEW `Document`, never mutates):
  - `blockById(doc, id) → Block | undefined`
  - `moveBlock(doc, id, toIndex) → Document`
  - `insertBlock(doc, block, atIndex) → Document`
  - `deleteBlock(doc, id) → Document`
  - `updateBlockBody(doc, id, body) → Document`
  - `setMeta(doc, patch) → Document` (shallow-merge `patch` into `meta`)

- [ ] **Step 1: Write failing tests** in `test/documentStore.test.js`:
  - `moveBlock reorders and preserves all blocks` — moving index 3→1 keeps length and set of ids.
  - `deleteBlock removes exactly one block` and leaves input unmutated (assert the original array is unchanged).
  - `updateBlockBody changes only the target block's body`.
  - `insertBlock places the block at the given index`.
  - `setMeta merges without dropping other meta keys`.
- [ ] **Step 2: Run, watch fail** — `npm test -- test/documentStore.test.js` → FAIL (not defined).
- [ ] **Step 3: Implement** the six functions with spread-based immutability.
- [ ] **Step 4: Run, watch pass.** `npm run lint`.
- [ ] **Step 5: Commit** — `feat: documentStore immutable block operations for the GUI`

---

### Task 2: `docOps` — pure engine-backed document transforms (main-side)

**Files:**
- Create: `src/gui/docOps.js`
- Test: `test/docOps.test.js`

**Interfaces:**
- Consumes: `parseDocument`, `serializeDocument` (`src/core/blocks.js`); `parseManifest` (`src/core/parseManifest.js`); `applyManifest` (`src/core/applyManifest.js`); `buildReadme` (`src/core/buildReadme.js`); `licenseInfo` (`src/core/licenses.js`); `KNOWN_SECTIONS` (`src/core/managed.js`).
- Produces (all pure — no fs/network/console):
  - `newDocument() → Document` — build default `rawAnswers` (title `'Project Title'`, `projectUrl ''`, `tableOfContents true`, `license 'MIT'`, a minimal non-crashing `author` object `{ login:'', name:'', email:'', html_url:'', avatar_url:'' }`, empty lists), call `buildReadme(defaults, { lookup: async () => ({ ok: false }) })`, then `parseDocument(result.markdown)`.
  - `applyManifestToDoc(doc, filename, contents) → Document` — `applyManifest(doc, parseManifest(filename, contents))`. Propagates the engine's `Error` on bad input.
  - `renderContactBody(user, { twitter, projectUrl }) → string` — the Contact block body from a GitHub user object (name, optional twitter, email, project link, avatar + mailto), matching the shape `generateReadme` emits for Contact (exact byte-match NOT required — it's an editable block).
  - `applyAuthorToDoc(doc, user) → Document` — replace the `contact` block's body with `renderContactBody(...)` (create it in canonical position if absent, via `KNOWN_SECTIONS`).
  - `renderLicenseBody(key, { projectUrl }) → string` — `Distributed under the {licenseInfo(key).name}. See [\`LICENSE\`](…/blob/HEAD/LICENSE) …` + description.
  - `applyLicenseToDoc(doc, key) → Document` — replace the `license` block body and `setMeta({ license: key })`-style field only if meta tracked it (it does not — license lives in the block; so just the block body).
  - `parseHeaderFields(body) → { projectTitle, tagline, logoPath, docsUrl, demoUrl, projectUrl }` and `renderHeaderBody(fields) → string` — parse the centered `<div align="center">…` header body into fields and back. `renderHeaderBody` reproduces the header shape `generateReadme` emits (exact byte-match not required).
  - `applyHeaderToDoc(doc, fields) → Document` — replace the `header` block body with `renderHeaderBody(fields)`.

- [ ] **Step 1: Write failing tests** in `test/docOps.test.js`:
  - `newDocument returns a parseable default document` — `newDocument()` returns `{ meta, blocks }` with an `about` and a `license` block and no `undefined` in any body.
  - `applyManifestToDoc merges a package.json` — a doc + `('package.json', '{"dependencies":{"axios":"1"}}')` yields a `dependencies` block listing `axios`.
  - `applyManifestToDoc throws on invalid package.json` and `on an unsupported filename`.
  - `renderContactBody includes name, email, and mailto` for a sample user; omits the twitter clause when `twitter` is falsy.
  - `renderLicenseBody uses the licenseInfo name and description` for `'MIT'`.
  - `parseHeaderFields ∘ renderHeaderBody round-trips the fields` — `parseHeaderFields(renderHeaderBody(f))` deep-equals `f` for a representative `f`.
  - `applyAuthorToDoc / applyLicenseToDoc / applyHeaderToDoc replace the right block body` and leave other blocks untouched.
- [ ] **Step 2: Run, watch fail** — FAIL (not defined).
- [ ] **Step 3: Implement `docOps.js`.**
- [ ] **Step 4: Run, watch pass.** `npm run lint`.
- [ ] **Step 5: Commit** — `feat: docOps pure document transforms backed by the engine`

---

### Task 3: `handlers` — IPC handler functions with injected deps (main-side)

**Files:**
- Create: `src/gui/handlers.js`
- Test: `test/handlers.test.js`

**Interfaces:**
- Consumes: Task-2 `docOps`; `serializeDocument`/`parseDocument` (`blocks.js`); `fetchAuthenticatedUser`/`fetchGitHubUser` (github). Injected deps object `{ dialog, readFile, writeFile, exec, md, token }` so the handlers are testable without Electron/fs/network.
- Produces (each takes `(deps, payload)`):
  - `openReadme(deps) → { canceled: true } | { path, document }` — `deps.dialog.showOpen()` → `deps.readFile(path)` → `parseDocument(text)`.
  - `saveReadme(deps, { document, path }) → { canceled: true } | { path }` — `serializeDocument(document)` → (`deps.dialog.showSave()` if no `path`) → `deps.writeFile(path, text)`.
  - `newReadme() → { document }` — `docOps.newDocument()`.
  - `applyManifest(deps, { document, filename, contents }) → { document } | { error }` — wraps `docOps.applyManifestToDoc`, catching the engine `Error` into `{ error: message }`.
  - `resolveAuthor(deps) → { user } | { user: null }` — if `deps.token`, `fetchAuthenticatedUser({ token })`; else parse `deps.exec('git config user.name')`/`user.email` into a minimal user; on nothing, `{ user: null }`. Never throws.
  - `applyAuthor(deps, { document }) → { document, user }` — `resolveAuthor` then `docOps.applyAuthorToDoc`.
  - `applyLicense(deps, { document, key }) → { document }`; `setHeader(deps, { document, fields }) → { document }` — wrap the Task-2 ops.
  - `lookupUser(deps, { username }) → result` — `fetchGitHubUser(username, { token: deps.token })`.
  - `renderMarkdown(deps, { markdown }) → { html }` — `deps.md.render(markdown)`.
  - `serializeDoc(_deps, { document }) → { text }` — `serializeDocument(document)` without writing (backs the Preview/Markdown tabs).

- [ ] **Step 1: Write failing tests** in `test/handlers.test.js` with fake deps (a fake `dialog` returning canceled or a path, an in-memory `readFile`/`writeFile`, a fake `exec`, a fake `md`, a fake github `client` via the real fetch fns):
  - `openReadme returns parsed document for a chosen file`; `openReadme handles cancel` (`{ canceled: true }`, `readFile` never called).
  - `saveReadme serializes and writes` (assert `writeFile` got the serialized text); `saveReadme handles cancel`.
  - `applyManifest returns { error } on invalid manifest` (document unchanged).
  - `resolveAuthor falls back to null when no token and git config empty`.
  - `renderMarkdown returns html from the injected renderer`.
- [ ] **Step 2: Run, watch fail** — FAIL (not defined).
- [ ] **Step 3: Implement `handlers.js`.**
- [ ] **Step 4: Run, watch pass.** `npm run lint`.
- [ ] **Step 5: Commit** — `feat: GUI IPC handler functions (injected deps, unit-tested)`

---

### Task 4: Wire `main.cjs` + `preload.cjs`; add `markdown-it`; remove the drag demo

**Files:**
- Modify: `main.cjs`, `preload.cjs`, `package.json`
- Create: a small exported wiring helper for testability (see below); `test/guiWiring.test.js`

**Interfaces:**
- Consumes: Task-3 `handlers`. Builds real deps: Electron `dialog`, `fs/promises` `readFile`/`writeFile`, `node:child_process` `execFileSync` for git config, a `markdown-it` instance (`{ html: true, linkify: true }`), `token` from `dotenv`/`process.env.TOKEN`.
- Produces: `main.cjs` registers one `ipcMain.handle(channel, (e, payload) => handler(deps, payload))` per channel: `open-readme`, `save-readme`, `new-readme`, `apply-manifest`, `apply-author`, `apply-license`, `set-header`, `serialize-doc`, `lookup-user`, `render-markdown`. (`serialize-doc (document) → { text }` returns `serializeDocument(document)` WITHOUT writing — it backs the Preview/Markdown tabs; add its handler `serializeDoc(deps, { document }) → { text }` to Task 3's `handlers.js` as a one-liner.) `preload.cjs` exposes `window.api` with one method per channel wrapping `ipcRenderer.invoke`.

To make registration testable without launching Electron, put the channel→handler map in an exported pure function `registerHandlers(ipcMain, handlers, deps)` (its own tiny module `src/gui/registerHandlers.js`, or exported from `handlers.js`) that `main.cjs` calls after `app.whenReady()`.

- [ ] **Step 1: Write failing test** `test/guiWiring.test.js`: call `registerHandlers(fakeIpcMain, handlers, fakeDeps)` and assert every expected channel name was registered exactly once (fake `ipcMain.handle` records channel names).
- [ ] **Step 2: Run, watch fail** — FAIL (not defined).
- [ ] **Step 3: Implement `registerHandlers`**, then rewrite `main.cjs` to: create the window (keep size/preload), `await` the dynamic import of handlers+engine, build real deps, call `registerHandlers`, and delete the `ondragstart` handler + `iconForDragAndDrop`. Rewrite `preload.cjs` to `contextBridge.exposeInMainWorld('api', { … })` (one `invoke` wrapper per channel) and delete the drag-demo/version code. Add `markdown-it` to `package.json` dependencies and `npm install`.
- [ ] **Step 4: Run, watch pass** — `npm test -- test/guiWiring.test.js` PASS; full `npm test` green; `npm run lint`. **Manual smoke:** `npm start` launches a window with no console errors (full UI arrives in Task 5).
- [ ] **Step 5: Commit** — `feat: wire Electron main/preload to GUI handlers; add markdown-it; drop drag demo`

---

### Task 5: Renderer — the block-editor UI

**Files:**
- Modify: `index.html`
- Create: `src/gui/renderer.js`

**Interfaces:**
- Consumes: `src/gui/documentStore.js` (Task 1, via `<script type="module">`); `window.api.*` (Task 4). Holds one module-level `currentDoc` (a `Document`) and `currentPath`.

**What to build (each is a concrete piece; exact DOM/CSS is the implementer's):**
- `index.html`: app shell with a toolbar (New, Open, Save, and an Edit/Preview/Markdown tab switch) and a `#canvas` container; `<script type="module" src="src/gui/renderer.js">`. A CSP meta tag that allows `script-src 'self'`, `img-src https: data:`, `style-src 'self' 'unsafe-inline'` — remote images (badges) load, remote scripts cannot.
- `renderBlock(block)`: show the block **rendered** — call `window.api.renderMarkdown(block.body)` and set the result as HTML inside the block element; show a drag handle and a delete control.
- Click-to-edit (Option B): clicking a non-header block swaps its rendered view for a `<textarea>` of `block.body`; on input, debounce → `documentStore.updateBlockBody` + re-render that block live; blur/Escape returns to rendered view. The `header` block instead opens a small structured form (title, tagline, logo, docs/demo links) backed by `window.api.setHeader`.
- Drag-reorder: HTML5 drag events on handles → `documentStore.moveBlock(currentDoc, id, toIndex)` → re-render canvas.
- Add/Delete: a "+ Add section" control inserts a new block (`documentStore.insertBlock`); the delete control calls `documentStore.deleteBlock`.
- Manifest drop: a `dragover`/`drop` zone on the canvas reads the dropped file via the browser `FileReader`, then `window.api.applyManifest({ document: currentDoc, filename, contents })`; on `{ error }` show a non-blocking message and leave the doc unchanged; on `{ document }` adopt it and re-render.
- Toolbar actions: **New** → `window.api.newReadme()`; **Open** → `window.api.openReadme()` (adopt `{ path, document }`, ignore `{ canceled }`); **Save** → `window.api.saveReadme({ document: currentDoc, path: currentPath })`; author auto-fill button → `window.api.applyAuthor({ document })`; license dropdown → `window.api.applyLicense({ document, key })`.
- Tabs, all off one serialization — `const { text } = await window.api.serializeDoc({ document: currentDoc })`: **Markdown** shows `text` verbatim (raw source); **Preview** shows `window.api.renderMarkdown(text).html`; **Edit** is the block canvas. (`serialize-doc` is defined in Task 4 / Task 3.)

- [ ] **Step 1:** Rewrite `index.html` (shell + CSP, drag demo removed) and implement `renderer.js` with the pieces above, wiring `documentStore` + `window.api`.
- [ ] **Step 2: Manual verification** (`npm start`), checklist — record results in the task report:
  - New → a template document renders as blocks; no console errors.
  - Click a block → its markdown appears in a textarea; editing updates the live render.
  - Drag a block to a new position → order changes and persists.
  - Open `Example_README.md` → it splits into blocks; Save to a temp path → reopen → sections intact (no dangling badges).
  - Drop a `package.json` → Dependencies fill; drop a non-manifest file → a visible error, document unchanged, no crash.
  - Preview tab renders the whole README; Markdown tab shows source.
- [ ] **Step 3:** `npm run lint` clean.
- [ ] **Step 4: Commit** — `feat: block-editor renderer (open/new/edit/reorder/save, manifest drop, tabs)`

---

## Done when

All five tasks committed; `npm test` green (2a suites + the new `documentStore`/`docOps`/`handlers`/`guiWiring` suites); `npm run lint` clean; `npm start` opens the block editor and the Task-5 manual checklist passes. The GUI can create, open, edit, reorder, and save a README, pre-fill the author, drop a manifest, and pick a license — feeding the same Phase-2a engine the CLI's core is built on.
