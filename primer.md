# ReadMeGen — Session Primer

> Resume point for picking the project back up. Last updated 2026-10-17 (after Phase 2a — the GUI document engine — merged to `master`).

## What this is
A developer tool that turns project info into a complete, well-formatted
`README.md` (styled after the othneildrew **Best-README-Template**).
**North star:** it runs as a **CLI** *or* a **desktop (Electron) GUI**, chosen by
the user. The CLI is a quick, windowless one-shot template filler. The GUI is a
**WYSIWYG block editor** that also opens and edits *existing* READMEs. They share
the generation core for "new from template" but are no longer required to produce
identical output (parity was a Phase-1 goal, deliberately relaxed for the GUI).

## Status at a glance
- **Phase 1 (CLI): DONE** — merged/pushed. All 11 catalogued bugs fixed.
- **CLI back-navigation: DONE** — merged/pushed. Type `<` at any text prompt to
  open a jump-list, edit earlier answers, then Continue/Generate.
- **Phase-2 prep (`buildReadme` extraction): DONE** — shared CLI orchestration seam.
- **Phase 2a — GUI document engine: DONE** — merged to `master` (`f3e1e56`), pushed.
  The pure, Electron-free core the GUI needs: parse/serialize a README to an
  editable block model and back, manifest parsing, dependency merging, and the
  signed-in GitHub identity. **60 tests pass, `standard` lint clean. Zero new deps.**
- **Phase 2b — the Electron window: NOT STARTED.** This is the next plan (Plan B):
  `documentStore`, IPC handlers, `main.cjs`/`preload.cjs` wiring, and the
  block-editor renderer. Its interfaces are now concrete because 2a exists.
- Untracked generated test READMEs may sit in the root (e.g. `Cathi-s-Portfolio.md`)
  — safe to delete; not source, not committed.

## The GUI model (decided in brainstorming, built in 2a)
The README is a **document**: `Document = { meta, blocks }`.
- `meta = { projectUrl, linkedin, conCov, tableOfContents }` — the minimal
  structured facts the regenerated scaffolding needs. **Author/license/builtWith are
  NOT in meta** — they live in block bodies (a deliberate ruling, see below).
- `Block = { id, type, heading, level, body }`. One block ≈ one section. `type` is a
  non-binding hint (drives smart assists); unknown sections are `type:'custom'` and
  stay fully editable.
- **Managed elements** (top shields, bottom reference-link defs, back-to-top links,
  the TOC, `<!-- SECTION -->` banners) are lifted out on parse and *regenerated* on
  serialize from `meta` + the live block set — so reordering/deleting a section can
  never strand a dead badge. Scaffolding that doesn't match the known shape is
  preserved verbatim as body (never guessed).
- Editing feel is **Option B**: every block renders; click one to reveal *its*
  markdown (edits render live); the `header` block is the one exception (structured
  fields, not raw markdown, because it's generated HTML + shields).

## How it's built (architecture)
One **ESM** package (`"type": "module"`) at the repo root. Thin front-ends on a
pure core:

```
main.cjs / preload.cjs   Electron shell (CommonJS; still the drag-demo placeholder — Phase 2b)
index.html               Electron window (still the drag-demo placeholder)
src/
  core/
    licenses.js          licenseInfo(key) → {key,name,spdx,description}
    managed.js           shared template scaffolding: emitShields/emitRefs/emitToc,
                         BACK_TO_TOP, KNOWN_SECTIONS, slug  (used by generateReadme AND blocks)
    generateReadme.js    generateReadme(answers) → string  (PURE); also parseRepo(url)→{owner,repo}
    buildReadme.js       buildReadme(rawAnswers,{lookup}) → {markdown,answers}  (CLI orchestration)
    blocks.js            parseDocument(md) → {meta,blocks};  serializeDocument(doc) → md
                         (THE engine; byte-for-byte round-trip of our own template)
    parseManifest.js     parseManifest(filename,contents) → {builtWith,modules,devModules}
    applyManifest.js     applyManifest(document,parsed) → document  (merge + dedupe, create-if-missing)
  github/
    fetchGitHubUser.js        fetchGitHubUser(username,{token,client}) → {ok,user}|{ok:false,reason}
    fetchAuthenticatedUser.js fetchAuthenticatedUser({token,client}) → {ok,user}|{ok:false,reason:'no_token'|'unreachable'}
  cli/
    fields.js / interview.js / index.js   the CLI front-end (inquirer-backed io → buildReadme → write)
test/                    node:test suites + fixtures (full-answers.js, expected-full.md golden)
docs/superpowers/
  specs/2026-10-17-readme-generator-shared-core-design.md   ← Phase-1 design
  specs/2026-10-17-readme-generator-gui-design.md           ← GUI design (READ THIS for Phase 2)
  plans/2026-10-17-gui-document-engine.md                   ← Phase-2a plan (done)
Example_README.md        the Best-README-Template sample = canonical format + round-trip fixture
```

## Commands
- `npm run cli`  — run the CLI (needs a real terminal; inquirer requires a TTY)
- `npm test`     — `node --test` (60 tests)
- `npm run lint` — `standard` (the gate; must be clean to commit)
- `npm start`    — launch the Electron shell (still the leftover drag-demo window)

## Gotchas / things that bit us
- **The keystone invariant:** `serializeDocument(parseDocument(generateReadme(x)))`
  must equal `generateReadme(x)` **byte-for-byte**. If a blocks.js change breaks it,
  fix parse/serialize — never the golden fixture.
- **Managed-key set is derived from `managed.js`** (`emitRefs`/`emitShields`) at load
  time, so `parseDocument` strips only OUR shield/ref keys and preserves all other
  `[label]:` defs + badges as body. Don't hardcode that key list — it would drift.
- **ESM vs CJS:** package is `type: module`; `src/**` are ESM. The Electron shell is
  CommonJS. From `main.cjs`, import the ESM core with **dynamic import**:
  `const { parseDocument } = await import('./src/core/blocks.js')`.
- **GitHub token stays in the main process** — never the renderer (Phase 2b rule).
- **`standard` is the lint gate** — trailing whitespace, `padded-blocks`, single
  quotes (double only to avoid escaping), `new Error()` not thrown literals.
  SonarLint IDE warnings (S7778/S6594/S3776) are advisory only, not the gate.
- **GitHub auth:** works unauthenticated (60 req/hr); a token in `.env` as `TOKEN=`
  raises it to 5000/hr and enables email. Header `Authorization: Bearer <token>`,
  sent only when a token is present.

## Decisions worth remembering
- **GUI = block editor, not a form.** Opens existing READMEs (its killer feature);
  save re-renders to clean markdown, normalizing exotic formatting — **clean blocks
  beat byte-exact fidelity**, but a section's *content* is never dropped.
- **`meta` minimal ruling (Phase 2a):** author/license/builtWith live in block
  bodies, not `meta`; smart assists regenerate a block body at assist-time so the
  serializer never clobbers hand-edits. (Refines design §4.1.)
- **Manifest drop = merge + dedupe** (Dean's call, design §8): new deps appended,
  existing/hand-added ones preserved, dedupe by package name.
- **Smart assists:** author auto-fill → authenticated GitHub user (token) → `git
  config` fallback → editable placeholder; license picker → `meta.license`; manifest
  drop → dependency/Built-With blocks (created in canonical position if missing).
- Phase-1 decisions still hold: Best-README-Template structure; kept Testing /
  Dependencies / Dev-Dependencies / Contributor Covenant; Questions merged into
  Contact; per-section prose toggles; `owner/repo` from `projectUrl`, links use
  `HEAD`; offline author lookup → manual fallback.

## NEXT STEPS — Phase 2b: the Electron window (Plan B)
The engine is done and proven. Plan B is pure front-end on top of it. **The GUI's
job: open/new a `Document` → edit blocks (click-to-reveal-markdown, drag-reorder,
add/delete) → save via `serializeDocument`.** Likely task shape:

1. **`documentStore` (pure, TDD):** block-array operations on `Document` —
   moveBlock, insertBlock, deleteBlock, updateBlockBody, setMeta. Testable without a DOM.
2. **IPC handlers (`src/gui/handlers.js`, TDD with injected deps):** `open-readme`
   (dialog → read → `parseDocument` → `{path, document}`), `save-readme`
   (`serializeDocument` → dialog/write), `new-readme` (`buildReadme` defaults →
   `parseDocument`), `resolve-author`, `parse-manifest`, `lookup-user`. All I/O +
   token behind `invoke`.
3. **`main.cjs`:** `ipcMain.handle(...)` wiring; dynamic-import the ESM core; native
   dialogs; `git config` author fallback. Remove the drag demo.
4. **`preload.cjs`:** `contextBridge` API over `ipcRenderer.invoke`; keep
   `contextIsolation: true`, `nodeIntegration: false`. Remove the drag demo.
5. **Renderer (`index.html` + `renderer.js`):** the block canvas — render blocks,
   Option-B click-to-edit, drag-reorder, add/delete, Edit/Preview/Markdown tabs,
   manifest drop, structured `header` editor. The markdown-render dependency
   (lean: `markdown-it`) and drag-and-drop land here (design §4.7 — the one dep
   addition flagged for Dean).

Open design calls still to settle in Plan B: renderer framework/markdown lib
(design §4.7 — leaning vanilla + `markdown-it`), exact IPC payload/error shapes,
the known-section heading→type table contents, and the structured `header` editor UI.

## Housekeeping loose ends
- `master` is pushed and clean. GitHub Dependabot may still show stale alerts from
  the *old* dependency tree — verify/dismiss on the Dependabot page if it lingers.
- SDD ledgers are deleted on plan completion (git history is the record).
- Deferred minors from 2a (non-blocking, for 2b/hardening): latent `!inDetails`
  fence-ordering edge; non-contiguous (still-unique) block ids; best-effort
  `projectUrl` recovery; untested `;` env-markers in requirements parsing; a couple
  of narrow-assertion tests; banner-drop regex matches only all-caps HTML comments.
```
