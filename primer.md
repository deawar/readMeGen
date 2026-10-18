# ReadMeGen — Session Primer

> Resume point for picking the project back up. Last updated 2026-10-18 (after
> security hardening — DOMPurify sanitization — and packaging/CI release setup
> merged to `master`; **Phase 2 complete; all security + distribution done**).

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
  **133 tests pass, `standard` lint clean. Runtime deps: `markdown-it`, `dompurify`,
  `jsdom` (all main-only). Dev: `electron-builder` (packaging).**
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
    navigation.js        safeExternalUrl(url) → href|null (http/https/mailto allowlist for shell.openExternal)
    sanitize.js          createSanitize(window) → (html)→safe html (DOMPurify+injected DOM; render-markdown choke point)
    renderer.js          the block-editor UI (imports documentStore; calls window.api)
  cli/
    fields.js / interview.js / index.js   CLI front-end (inquirer → buildReadme → write)
test/                    node:test suites (133 tests)
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
- `npm test`     — `node --test` (133 tests)
- `npm run dist` — build installers (electron-builder); `npm run pack` = unpacked smoke
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

### ✅ DONE — security hardening (all items complete)
Defense-in-depth on the two HIGH findings, all landed:
- ✅ **DONE (`bd5ff00`, hardened `3a59045`): Navigation lockdown** — `main.cjs`
  `will-navigate` keeps the window on `app://local` and opens off-origin links via
  `shell.openExternal`, but ONLY through the tested `safeExternalUrl` scheme allowlist
  (`src/gui/navigation.js`: http/https/mailto only — `file:`/`smb:`/`javascript:`/OS
  handlers are dropped to prevent protocol-handler abuse). `setWindowOpenHandler`
  denies new windows.
- ✅ **DONE (`bd5ff00`): IPC sender validation** — `registerHandlers.isTrustedSender`
  rejects invokes whose `senderFrame` origin isn't `app://local/` before any handler
  runs (unit-tested in `test/guiWiring.test.js`).
- ✅ **DONE (`824aedd`): Sanitize rendered markdown with DOMPurify (in MAIN).**
  `src/gui/sanitize.js` `createSanitize(window)` builds a DOMPurify bound to an
  injected DOM (jsdom in main) and is wired into the `render-markdown` IPC choke
  point (`handlers.renderMarkdown` → `deps.sanitize(deps.md.render(md))`), so the
  renderer never receives unsanitized HTML. Fail-closed: a missing sanitizer throws
  (unit-tested). Config forbids `script`/`style`/`meta`/`form`/`base`/`link` + style
  attrs while preserving README HTML (a/img/details/headings). New deps: `dompurify`,
  `jsdom`. Branch security-reviewed clean.

### Functional deferred minors
- ✅ **DONE (`87059bc`):** manifest drop name/size guard (parseManifest accepts only
  `package.json`/`requirements*.txt`; applyManifest rejects >1 MB; renderer pre-checks);
  `resolveAuthor` resolves `user.name`/`user.email` independently; `moveBlock` clamps
  `toIndex` to `[0, length]`; `browser` eslint env scoped to renderer.js (not project-wide).
- ✅ **RESOLVED AS DESIGNED (2026-10-18): live rendered preview while editing** — Dean
  chose to **keep Option B** (block shows raw markdown while editing, re-renders on blur).
  No change; design §4.8's "edits render live" is intentionally not pursued. **All
  functional minors are now closed.**

### ✅ DONE — packaging & distribution (CI release)
- ✅ **DONE (`389c2bc`): electron-builder + GitHub Actions release.** `package.json`
  `build` config (appId `com.deawar.readmegen`, output `dist/`, targets: win
  nsis+portable, mac dmg+zip, linux AppImage+deb; GitHub publish provider,
  `releaseType: draft`). Scripts: `npm run pack` (--dir local smoke), `npm run dist`.
  `.github/workflows/release.yml`: on `v*` tag push (or manual dispatch), a 3-OS
  matrix (windows/macos/ubuntu-latest) runs tests then `electron-builder --publish
  always` on tags / `never` on manual runs. **Unsigned** (`CSC_IDENTITY_AUTO_DISCOVERY
  =false`); `GH_TOKEN` = Actions token with `contents:write`.
  - **To cut a release:** `git tag v1.0.0 && git push origin v1.0.0` → CI builds all
    three OSes and attaches binaries to a **draft** release → review on the Releases
    page and click **Publish**. Link from README via a shields.io release badge.
  - **Known local gotcha:** `npm run pack` fails with `EPERM: rename ...win-unpacked`
    under OneDrive (file-sync lock). Build to a non-OneDrive output
    (`-c.directories.output=C:/Temp/...`) locally; CI runners are unaffected.
  - ✅ **App icons DONE (`364d139`):** branded icon (indigo→violet squircle +
    white Markdown mark). `scripts/make-icons.mjs` (pure-JS pureimage + png2icons,
    dev-only) generates `build/icon.{png,ico,icns}` — committed, auto-detected by
    electron-builder from buildResources. Regenerate with `npm run icons`. No more
    "default Electron icon" warning.
  - **Deferred:** code signing (unsigned → one-time Gatekeeper/SmartScreen prompts).

### Polish / future features
- (optional) code signing for a warning-free install.
- "Save As" (force the dialog) vs. Save-to-current-path.
- Status-bar dirty/unsaved indicator.

## Housekeeping loose ends
- `master` is pushed and clean (133 tests, lint clean). GitHub Dependabot may still
  show stale alerts from the OLD dependency tree — verify/dismiss on the Dependabot page.
- SDD ledgers are deleted on plan completion (git history is the record).
- Untracked generated test READMEs may sit in the root (e.g. `Cathi-s-Portfolio.md`) —
  safe to delete; not source.
```
