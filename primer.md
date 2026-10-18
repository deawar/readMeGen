# ReadMeGen — Session Primer

> Resume point for picking the project back up. Last updated 2026-10-17 (after Phase 2b — the Electron GUI window — merged to `master`; **Phase 2 complete**).

## What this is
A developer tool that turns project info into a complete, well-formatted
`README.md` (styled after the othneildrew **Best-README-Template**).
**North star (achieved):** it runs as a **CLI** *or* a **desktop (Electron) GUI**,
chosen by the user. The CLI is a quick, windowless one-shot template filler. The
GUI is a **WYSIWYG block editor** that also opens and edits *existing* READMEs.
They share the generation core for "new from template" but are not required to
produce identical output (parity was a Phase-1 goal, deliberately relaxed for the GUI).

## Status at a glance
- **Phase 1 (CLI): DONE** — merged/pushed. All 11 catalogued bugs fixed.
- **CLI back-navigation: DONE** — type `<` at a text prompt to open a jump-list.
- **Phase-2 prep (`buildReadme` extraction): DONE** — shared CLI orchestration seam.
- **Phase 2a — GUI document engine: DONE** — merged to `master` (`f3e1e56`). Pure,
  Electron-free core: parse/serialize README ↔ block model, manifest parse, dep
  merge, signed-in GitHub identity.
- **Phase 2b — the Electron window: DONE** — merged to `master` (`850f5aa`), pushed.
  The block-editor desktop app: open/new/edit/reorder/save a README as draggable,
  click-to-edit blocks; manifest drop (merge+dedupe); author auto-fill; license
  picker; Edit/Preview/Markdown tabs. **Manually verified working by Dean.**
  **116 tests pass, `standard` lint clean. One new dep: `markdown-it` (main only).**
- **➡️ PHASE 2 IS COMPLETE.** Both front-ends ship on the shared core. Remaining
  work is hardening/polish — see NEXT STEPS (security first).

## The GUI model (built in 2a, wired in 2b)
The README is a **document**: `Document = { meta, blocks }`.
- `meta = { projectUrl, linkedin, conCov, tableOfContents }` — minimal structured
  facts the regenerated scaffolding needs. **Author/license/builtWith are NOT in
  meta** — they live in block bodies (deliberate ruling, see Decisions).
- `Block = { id, type, heading, level, body }`. One block ≈ one section. `type` is a
  non-binding hint (drives smart assists); unknown sections are `type:'custom'`.
- **Managed elements** (top shields, bottom reference-link defs, back-to-top links,
  TOC, `<!-- SECTION -->` banners) are lifted out on parse and *regenerated* on
  serialize — so reordering/deleting a section can't strand a dead badge. Unknown
  scaffolding is preserved verbatim as body.
- Editing feel is **Option B**: every block renders; click one to reveal *its*
  markdown; the `header` block is edited via structured fields.

## How it's built (architecture)
One **ESM** package (`"type": "module"`). Pure core + two front-ends (CLI + Electron GUI).

```
main.cjs / preload.cjs   Electron shell (CommonJS). main.cjs registers the app:// scheme,
                         dynamic-imports the ESM handlers, builds real deps (dialog, fs, git,
                         markdown-it, token, pathState), registerHandlers(ipcMain,...).
                         preload.cjs: contextBridge window.api over ipcRenderer.invoke.
index.html               the GUI shell: strict CSP, toolbar/tabs/#canvas, loads renderer.js (module).
src/
  core/                  (PURE, Electron-free, shared by CLI + GUI)
    licenses.js          licenseInfo(key) → {key,name,spdx,description}
    managed.js           emitShields/emitRefs/emitToc, BACK_TO_TOP, KNOWN_SECTIONS, slug
    generateReadme.js    generateReadme(answers) → string; also parseRepo(url)→{owner,repo}
    buildReadme.js       buildReadme(rawAnswers,{lookup}) → {markdown,answers}  (CLI orchestration)
    blocks.js            parseDocument(md) → {meta,blocks};  serializeDocument(doc) → md
    parseManifest.js     parseManifest(filename,contents) → {builtWith,modules,devModules}
    applyManifest.js     applyManifest(document,parsed) → document  (merge + dedupe)
  github/
    fetchGitHubUser.js        fetchGitHubUser(username,{token,client}) → {ok,user}|{ok:false,reason}
    fetchAuthenticatedUser.js fetchAuthenticatedUser({token,client}) → {ok,user}|{ok:false,reason}
  gui/                   (Phase 2b)
    documentStore.js     renderer-side immutable block ops (blockById/move/insert/delete/updateBody/setMeta) — NO imports
    docOps.js            main-side pure transforms: newDocument, applyManifestToDoc, render{Contact,License}Body,
                         parseHeaderFields/renderHeaderBody, apply{Author,License,Header}ToDoc
    handlers.js          IPC handlers (injected deps): open/save/new/applyManifest/apply{Author,License}/
                         setHeader/serializeDoc/lookupUser/renderMarkdown  (resolveAuthor = token→git config→null)
    registerHandlers.js  registerHandlers(ipcMain,handlers,deps) — data-driven CHANNEL_MAP (10 channels)
    appProtocol.js       resolveAppPath(root,url) → file path | null (traversal-guarded; backs app:// handler)
    renderer.js          the block-editor UI (imports documentStore; calls window.api)
  cli/
    fields.js / interview.js / index.js   CLI front-end (inquirer → buildReadme → write)
test/                    node:test suites (116 tests)
docs/superpowers/
  specs/2026-10-17-readme-generator-shared-core-design.md   ← Phase-1 design
  specs/2026-10-17-readme-generator-gui-design.md           ← GUI design (read for Phase 2)
  plans/2026-10-17-gui-document-engine.md                   ← Phase-2a plan (done)
  plans/2026-10-17-gui-electron-shell.md                    ← Phase-2b plan (done)
Example_README.md        Best-README-Template sample = canonical format + round-trip fixture
```

**IPC boundary:** renderer holds the live `Document`, does structural edits with
`documentStore` (local, no IPC), and calls `window.api` for anything touching the
engine/fs/network/markdown. `main.cjs` dynamic-imports the engine; the GitHub token
and the save path live only in main.

## Commands
- `npm start`    — launch the **GUI block editor** (`electron .`; served over app://)
- `npm run cli`  — run the CLI (needs a real TTY)
- `npm test`     — `node --test` (116 tests)
- `npm run lint` — `standard` (the commit gate)

## Gotchas / things that bit us
- **ES modules do NOT load over `file://` in Electron** (Chromium CORS, origin
  `null`). The GUI is therefore served over a privileged **`app://`** scheme
  (`protocol.registerSchemesAsPrivileged` at module top level + `protocol.handle` in
  `onReady` + `win.loadURL('app://local/index.html')`). If the window renders blank,
  this is the first suspect. `resolveAppPath` (appProtocol.js) maps + traversal-guards.
- **Tab panes defaulted to `display:none` in CSS** — showing a pane must set an
  explicit `display` ('block'/'flex'), NOT `''` (which falls back to the CSS none).
  (Bit us: Preview/Markdown blank.)
- **Save path is main-owned** (`pathState`) — the renderer must NEVER send a path to
  `save-readme`; `newReadme` clears it so New→Save can't overwrite the opened file.
- **markdown-it runs in MAIN only** (`render-markdown` IPC) — no markdown lib / bundler
  in the renderer; rendered HTML is injected under the strict CSP.
- **The keystone invariant:** `serializeDocument(parseDocument(generateReadme(x)))`
  must equal `generateReadme(x)` byte-for-byte. Fix parse/serialize, never the golden.
- **Managed-key set derived from `managed.js`** so `parseDocument` strips only OUR
  shield/ref keys and preserves other `[label]:` defs/badges as body (don't hardcode).
- **ESM vs CJS:** `src/**` ESM; Electron shell CJS; from CJS use dynamic `import()`.
- **`standard` lint gate** — trailing whitespace, padded-blocks, single quotes,
  `new Error()` not literals. SonarLint IDE warnings are advisory, not the gate.
- **GitHub auth:** unauthenticated 60 req/hr; token in `.env` as `TOKEN=` → 5000/hr +
  email; `Authorization: Bearer <token>` only when present; token stays in main.

## Decisions worth remembering
- **GUI = block editor, not a form.** Opens existing READMEs; save normalizes exotic
  formatting — clean blocks beat byte-exact fidelity, but a section's content is never dropped.
- **`meta` minimal:** author/license/builtWith live in block bodies, not `meta`; assists
  regenerate a block body at assist-time so the serializer never clobbers hand-edits.
- **Manifest drop = merge + dedupe** (new appended, existing/hand-added preserved, by name).
- **GUI served over app:// scheme**; engine owned by main; renderer imports only `documentStore`.
- **Security posture:** path traversal closed (main-owned path); XSS mitigated by the
  strict CSP (`script-src 'self'`, no `unsafe-inline`). DOMPurify + senderFrame validation
  were deliberately DEFERRED (see NEXT STEPS).
- Phase-1 decisions still hold (Best-README-Template structure; Testing/Deps/DevDeps/
  Contributor-Covenant; Questions→Contact; per-section prose toggles; `HEAD` links).

## NEXT STEPS

### 🔴 HIGHEST PRIORITY — security hardening
Progress on the two HIGH findings' defense-in-depth:
- ✅ **DONE (`bd5ff00`, hardened `3a59045`): Navigation lockdown** — `main.cjs`
  `will-navigate` keeps the window on `app://local` and opens off-origin links via
  `shell.openExternal`, but ONLY through the tested `safeExternalUrl` scheme allowlist
  (`src/gui/navigation.js`: http/https/mailto only — `file:`/`smb:`/`javascript:`/OS
  handlers are dropped to prevent protocol-handler abuse). `setWindowOpenHandler`
  denies new windows.
- ✅ **DONE (`bd5ff00`): IPC sender validation** — `registerHandlers.isTrustedSender`
  rejects invokes whose `senderFrame` origin isn't `app://local/` before any handler
  runs (unit-tested in `test/guiWiring.test.js`).
- 🔴 **REMAINING — Sanitize rendered markdown with DOMPurify.** `markdown-it` runs with
  `{html:true}` (required — READMEs are HTML-rich) and its output is injected via
  `innerHTML` in the renderer (block render + Preview). The strict CSP blocks
  script/inline-handler execution, but DOMPurify is belt-and-suspenders against a CSP
  gap. **Needs a decision (worth a quick brainstorm):** sanitize in MAIN inside
  `render-markdown` (DOMPurify + jsdom) vs. in the renderer (DOMPurify browser build,
  vendored — no bundler). Allow legitimate README HTML (div/img/a/details/headings)
  while stripping `script`/`on*`/`meta`/`form`/`base`/`link`/`style`. New dep(s) —
  flag for Dean (dependency-careful). The push-time security review will keep
  re-flagging the `innerHTML` XSS surface until this lands.

### Functional deferred minors (next)
- Manifest drop reads `files[0]` with **no size/type guard** — cap size, restrict to
  `package.json`/`requirements*.txt`.
- `resolveAuthor` loses the name if `git config user.email` is unset (resolve each key
  independently).
- **Live rendered preview while editing** a block — currently shows markdown source
  until blur (Option B). Reconcile with design §4.8 "edits render live" if desired.
- `moveBlock` has no out-of-range `toIndex` guard (not reachable from the UI today).
- `standard` `envs:["browser"]` is applied project-wide (could scope to the renderer).

### Polish / future features
- Package/distribute the Electron app (electron-builder) — currently `npm start` only.
- "Save As" (force the dialog) vs. Save-to-current-path.
- Status-bar dirty/unsaved indicator.

## Housekeeping loose ends
- `master` is pushed and clean (116 tests, lint clean). GitHub Dependabot may still
  show stale alerts from the OLD dependency tree — verify/dismiss on the Dependabot page.
- SDD ledgers are deleted on plan completion (git history is the record).
- Untracked generated test READMEs may sit in the root (e.g. `Cathi-s-Portfolio.md`) —
  safe to delete; not source.
```
