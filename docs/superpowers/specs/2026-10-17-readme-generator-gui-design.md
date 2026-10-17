# ReadMeGen — GUI (Phase 2) Design

**Date:** 2026-10-17
**Status:** Draft design / pre-plan (awaiting approval)
**Author:** Dean Warren (with Claude)
**Builds on:** [`2026-10-17-readme-generator-shared-core-design.md`](2026-10-17-readme-generator-shared-core-design.md) (Phase 1, shipped)

---

## 1. Intent & why

Phase 1 delivered a pure generation core and a CLI front-end. Phase 2 is the
**desktop GUI** — but the GUI Dean actually wants is not a window-shaped wrapper
around the CLI's question list. It is a **WYSIWYG block editor for README
files**: the finished README laid out on a canvas as a stack of clean, rendered
sections ("blocks"), each one clickable to edit, draggable to reorder, with
sections you can add or delete.

Two capabilities give the GUI its reason to exist, neither of which the CLI has:

1. **It opens existing `README.md` files.** Drop in any repo's current readme and
   it breaks into editable blocks. This is what makes the tool *instantly
   relevant* (Dean's words) — you don't have to start from scratch to get value.
2. **It pre-fills the boring parts.** The author block auto-detects the current
   user; dropping a `package.json` or `requirements.txt` onto the canvas fills the
   dependency sections automatically.

**Why now:** The shared core is proven through the CLI, so the generation logic
the GUI needs already exists and is tested. What's left is genuinely front-end
plus two new *pure* pieces (a markdown↔blocks parser and a manifest parser) that
belong in the core where they can be unit-tested, exactly like Phase 1.

**The CLI is not retired.** It stays as the quick, windowless path for blasting
out a fresh readme. The GUI is the primary, richer tool. See §2 for what this
does (and does not) mean for "shared output".

---

## 2. Goals / non-goals / anti-goals

### Goals (this project)
- An **Electron desktop app** that presents a README as an editable canvas of
  blocks: click-to-edit, drag-to-reorder, add/delete sections.
- **Open an existing `README.md`** and split it into editable blocks; **save**
  back to clean, normalized markdown.
- **New-from-template**: opening the app with no file gives the standard
  Best-README-Template sections, pre-populated, ready to edit.
- **Author auto-fill** (editable) and **manifest drop** (`package.json` /
  `requirements.txt`) that fills the dependency sections.
- Three views of the same document: **Edit** (block canvas), **Preview** (fully
  rendered, read-only), **Markdown** (raw source).
- The genuinely reusable logic — markdown↔blocks, manifest parsing, new-doc
  seeding — lives in the **pure core** and is **unit-tested**. Electron is a thin
  shell.
- The GitHub token **never enters the renderer**; all network and filesystem
  access happens in the main process.

### Non-goals (explicitly out of scope)
- A general-purpose markdown editor or multi-document workspace. This edits one
  README at a time.
- Perfect byte-for-byte round-tripping of arbitrary input (see §4.3 — Dean chose
  clean blocks over fidelity).
- Git operations beyond *reading* `git config` for the author's name/email. No
  committing, pushing, or staging from the app.
- Keeping CLI and GUI output byte-for-byte identical. They share the
  template-seeding core and otherwise diverge; parity is explicitly relaxed (it
  was a Phase-1 goal, retired here).
- Hosts other than GitHub; a plugin/theme system; publishing to an app store.

### Anti-goals (would make this a failure even if it "works")
- **Silently losing a section's content on save.** Normalization may simplify
  *formatting* (exotic HTML, spacing); it must never drop the *text* a section
  carried. A tool that quietly eats part of someone's real readme is worse than
  no tool.
- The GitHub token reachable from renderer/page context (a security failure).
- Generation logic copy-pasted into the renderer, re-creating the Phase-1
  drift problem the shared core exists to prevent.
- A block model so rigid that an unrecognized section can't be edited — every
  block, known type or not, must be editable and movable.

---

## 3. Constraints

- **Electron `^44`** shell, already in the repo: `main.cjs` + `preload.cjs`
  (CommonJS), `index.html`. `contextIsolation: true`, `nodeIntegration: false`
  stay on.
- **ESM core from a CJS main process** via dynamic `import()`:
  `const { parseBlocks } = await import('./src/core/blocks.js')`.
- **Runtime:** Node.js 22; the package is `"type": "module"`; `src/**` is ESM.
- **Lint gate:** `standard` must stay clean (same as Phase 1).
- **TDD** (superpowers:test-driven-development) for every pure core module.
- **Offline-capable:** the app must open, edit, and save a README with no network
  and no token. Auto-fill degrades (§4.5), it never blocks.
- Reuse existing core: `generateReadme`, `buildReadme`, `licenses.js`,
  `fetchGitHubUser` — do not fork them.

---

## 4. Architecture — decided

### 4.0 Process map
```
┌─ main process (CJS, main.cjs) ──────────────────────────────┐
│  owns: TOKEN, network (axios), filesystem, native dialogs   │
│  dynamic-import()s the ESM core:                            │
│    blocks.parseBlocks / serializeBlocks                     │
│    parseManifest · buildReadme/generateReadme · licenses    │
│    github: fetchGitHubUser + authenticated-user lookup      │
│  exposes ipcMain.handle(...) channels (§4.6)                │
└───────────────▲─────────────────────────────────────────────┘
                │ contextBridge (preload.cjs) — invoke only
┌───────────────┴─────────────────────────────────────────────┐
│  renderer (index.html + renderer.js)                         │
│  owns: the block UI, drag/reorder, click-to-edit, live       │
│  markdown render, the Edit/Preview/Markdown tabs             │
│  holds the document as an in-memory block array              │
│  NEVER sees the token or touches fs/network directly         │
└──────────────────────────────────────────────────────────────┘
```

### 4.1 The document model — the keystone
A README is a **document**: a small bag of structured `meta` plus an **ordered
array of blocks**. One block ≈ one section.

```js
Document = {
  meta:   Meta,        // structured facts the generator & shields need (below)
  blocks: Block[]      // the editable sections, in order
}

Block = {
  id:       string,   // stable id for drag/reorder/keying
  type:     string,   // 'header' | 'about' | 'builtWith' | 'installation' |
                      // 'dependencies' | 'devDependencies' | 'license' |
                      // 'contact' | ... | 'custom'  (drives smart assists only)
  heading:  string,   // the section heading text, '' for the pre-heading header block
  level:    number,   // heading level (2 for '##'); 0 for the header block
  body:     string    // the block's markdown body, verbatim and editable
}

Meta = {              // the structured truth the managed elements (§4.2a) derive from
  ownerRepo: string,  // 'owner/repo' parsed from the project URL — drives every shield
  author:    object,  // { login, name, email, html_url, avatar_url } — drives Contact + shields
  license:   string,  // license key — drives the License shield + body
  builtWith: string[],// drives the Built With sub-section
  linkedin:  string,  // (optional) drives the LinkedIn shield
  twitter:   string   // (optional) drives Contact
}
```

- **`type` is a hint, not a constraint.** It decides *whether a smart assist
  shows* (a license dropdown on a `license` block, a "drop a manifest here" affordance
  on `dependencies`). An unrecognized section is `type:'custom'` and is still a
  fully editable, movable block. Nothing is un-editable.
- **Blocks hold clean prose/code, not template scaffolding.** The shields,
  reference-link definitions, back-to-top links, and `<!-- … -->` banners that
  the template weaves through the file are *managed* (§4.2a), kept out of block
  bodies, and regenerated — not hand-maintained. This is what lets a user
  reorder or delete a section without leaving a dead badge behind.
- Ordinary sections are **just the array in order.** Reordering = reordering the
  array. Adding = inserting a block. Deleting = removing one. The finished file
  is `meta` + the array, serialized top to bottom with managed elements
  regenerated around them (§4.2).

### 4.2 One parser, one serializer (new pure core: `src/core/blocks.js`)
```js
parseDocument(markdown: string) → Document        // split a README into { meta, blocks }
serializeDocument(doc: Document) → string          // render the document back to markdown
```
- **`parseDocument`** splits on `##` headings. Everything before the first `##`
  becomes the `header` block (title, logo, tagline, links); the top shields found
  there are lifted into `meta` (§4.2a), not left in the header body. Each `##`
  starts a block running to the next `##`. Heading text is matched (case/space-
  insensitive) against a known-section table to assign `type`; no match →
  `custom`. It recovers what `meta` it can (owner/repo from any GitHub URL,
  author from a recognizable Contact block, license from the shield); what it
  can't recover confidently is left as body content, never guessed.
- **`serializeDocument`** re-emits `heading` + `body` per block in array order,
  regenerating the managed elements (§4.2a) from `meta` + the current block set,
  and normalizing spacing. It preserves each block's body text; it does **not**
  preserve byte-exact input formatting (§4.3).
- Both are **pure and unit-tested** (TDD). They are the heart of Phase 2 and the
  one place a bug would corrupt a user's file, so they get the heaviest tests
  (round-trip invariant in §4.9).

### 4.2a Managed elements (resolves the shields/links/back-to-top collision)
The Best-README-Template weaves scaffolding *through* the file that doesn't
belong to any one editable section: the **top reference-style shields**, the
**trailing `<!-- MARKDOWN LINKS & IMAGES -->` link-definition block**, the
**back-to-top link** after each section, and the **`<!-- SECTION -->` comment
banners**. These are **managed**, not editable body:
- **On parse:** recognized and lifted out of block bodies — shields/link-defs
  into `meta`, back-to-top links and banners simply dropped (they're regenerated).
  Blocks come out holding only their real prose/code.
- **On serialize:** regenerated from `meta` and the live block set/order — so a
  shield's URL is always consistent with the sections that actually exist, and
  **reordering or deleting a section can never strand a badge or a dead link**
  (directly serves the §2 "no broken links" anti-goal, Phase-1 bug class #2/#10).
- **On an off-template file:** scaffolding that doesn't match the known shape is
  preserved verbatim as body content rather than reconstructed — clean blocks
  where we recognize the template, lossless passthrough where we don't.

### 4.3 Round-trip fidelity — decided
Dean chose **clean editable blocks over byte-for-byte fidelity.** On save, exotic
formatting (unusual inline HTML, collapsible `<details>`, irregular spacing,
alignment tricks) may be normalized/simplified. The hard rule from §2 anti-goals
holds: **normalization may reshape formatting, never discard a section's
content.** The Preview tab lets the user see exactly what they'll get before
saving.

### 4.4 New-from-template reuses the Phase-1 core
Opening with no file produces the standard document by **running the existing
core and parsing its output**:
```
buildReadme(defaults, { lookup }) → markdown  →  parseDocument(markdown) → Document
```
Because the generated output *is* the canonical template, `parseDocument` recovers
`meta` from it cleanly (the owner/repo, author, and license were just emitted by
the core). So "new" and "open existing" converge on the *same* `Document` the
editor knows how to render — no second code path, and the template stays defined
in one place (the core). Defaults come pre-filled by the smart assists below.

### 4.5 Smart assists (all degrade gracefully, never block)
There is no standalone "author block" — author identity lives in `meta.author`,
and the **Contact** block body plus the author-derived shields (LinkedIn) are
regenerated from it. The assists set structured `meta`/blocks; they do **not**
string-patch rendered text (which would break once a user has hand-edited).
- **Author auto-fill** (main process → `meta.author`). If `TOKEN` is present, look
  up the *authenticated* GitHub user (name, avatar, profile) — a small addition to
  the github module (`/user` endpoint) alongside the existing `fetchGitHubUser`.
  No token → read `git config user.name` / `user.email`. Neither available → leave
  `meta.author` blank (editable placeholders). Contact regenerates from whatever
  `meta.author` holds; every field stays editable afterward.
- **Manifest drop** (new pure core: `src/core/parseManifest.js`). Dropping a file
  on the canvas sends its name + contents to the main process, which calls
  `parseManifest(filename, contents) → { builtWith, modules, devModules }`:
  - `package.json`: `dependencies` → modules, `devDependencies` → dev-modules,
    recognized frameworks (electron, react, vue, …) → Built With.
  - `requirements.txt`: parsed lines → the Python equivalents.
  Built With is a managed sub-section driven by `meta.builtWith`; the
  Dependencies / Dev-Dependencies blocks are **created and inserted in their
  canonical positions if they don't yet exist**. How a drop interacts with
  dependency content that's *already there* (replace vs. merge) is the one open
  product decision — see §8. `parseManifest` is pure and unit-tested.
- **License picker.** The `license` block offers a dropdown backed by the
  existing `licenses.js`; choosing one sets `meta.license`, and the License block
  body + shield regenerate.

### 4.6 IPC contract (channels, `ipcMain.handle` / `invoke`)
Renderer never imports fs/net/core; it calls these:
- `open-readme` → native open dialog, read file, `parseDocument`, return
  `{ path, document }`.
- `save-readme` `(document, path?)` → `serializeDocument`, save dialog if no path,
  write file, return the path.
- `new-readme` → run §4.4, return `{ document }`.
- `resolve-author` → §4.5 author auto-fill, return the author object (or nulls).
- `parse-manifest` `(filename, contents)` → return the parsed dependency fields.
- `lookup-user` `(username)` → wraps `fetchGitHubUser` for optional contributor
  validation.

Exact payload shapes and error signaling are the builder's to finalize; the
boundary (all I/O and token use behind `invoke`) is fixed.

### 4.7 Renderer framework & markdown lib — my calls (flagged in §7)
- **Renderer:** a **lightweight component approach** (my lean: a small library
  such as Preact or Svelte, or disciplined vanilla modules) rather than a heavy
  SPA framework — the app is one window with a focused interaction model, and the
  project's ethos is dependency-light. Final choice is the builder's; the design
  only requires that the block array (§4.1) is the single source of UI truth.
- **Markdown:** a maintained parser (my lean: `markdown-it`) for both the live
  per-block render and the Preview tab. `parseBlocks`'s heading split is built on
  its token stream so splitting and rendering agree. This adds a runtime
  dependency — flagged for Dean, since the project has been dependency-careful.

### 4.8 Editing feel — decided (Option B)
The canvas shows every block **rendered**. Clicking a block opens **that block's
markdown** inline (the user sees `## Installation` and fenced code as text); edits
re-render live; all other blocks stay rendered. This keeps code blocks, tables,
and badges honest and never hides markdown from a developer. The **Markdown** tab
shows the whole document's source; the **Preview** tab shows it fully rendered and
read-only.

**The `header` block is the one exception** (my call, §7): its content is
generated centered HTML plus managed shields, not prose a developer would want to
hand-write as raw markdown. So it edits through a small set of structured fields
(title, tagline, logo, docs/demo links) rather than raw-markdown-reveal, with its
shields managed from `meta`. Every other block uses the click-to-reveal-markdown
model above.

### 4.9 Round-trip invariant (the test that guards the anti-goal)
The §2 anti-goal "never drop a section's content" becomes a concrete, testable
contract anchored to `Example_README.md` (the Phase-1 canonical fixture):
> `serializeDocument(parseDocument(md))` preserves every section's prose and code
> text.

Regenerated managed elements (shields, link-defs, back-to-top, banners) and
normalized whitespace are **not** content loss — they're expected to change.
Losing or truncating a section's actual prose/code **is** a failure. This
round-trip over `Example_README.md`, plus off-template fixtures, is the heaviest
test suite in Phase 2.

---

## 5. What the user sees (flow)
1. Launch → either **New** (standard template, pre-filled) or **Open** an existing
   `README.md`.
2. Canvas of rendered blocks. Click one → edit its markdown inline. Drag the
   handle → reorder. **+ Add a section** → insert (known type or custom). Delete →
   remove.
3. Drop a `package.json`/`requirements.txt` → dependency sections fill in.
4. Flip to **Preview** to see the finished render; **Markdown** to see/grab the
   source.
5. **Save** → clean normalized `README.md` at the chosen path.

---

## 6. What's left to the builder (plan phase)
- Final renderer framework and markdown library (§4.7), and the drag-and-drop
  mechanism.
- Exact IPC payload/error shapes (§4.6).
- The known-section table: which heading texts map to which `type` (anchored to
  `Example_README.md`).
- The structured-field set and editor UI for the specialized `header` block
  (the decision *that* it's structured is made in §4.8; the exact fields/UI is
  the builder's).
- Whether manifest reading happens from a dropped file's contents (renderer reads
  text, sends to main) or a path (main reads) — lean: send contents, keep
  `parseManifest` pure.
- Replacing the leftover Electron drag-demo in `index.html`/`preload.cjs`.
- Test strategy for the renderer (the pure core modules are straightforward TDD;
  the UI layer needs a lighter approach).

## 7. Calls I made (not explicitly decided by Dean — check these)
- **Renderer framework & markdown dependency** (§4.7): leaning Preact/Svelte or
  vanilla + `markdown-it`. Adds at least one runtime dep to a dependency-careful
  project — most likely to warrant a veto.
- **New-from-template is generated-then-parsed** through the existing core (§4.4)
  rather than a hand-written default block list — one template definition, one
  render path.
- **Author auto-fill source order**: authenticated GitHub user (if token) →
  `git config` → editable placeholder (§4.5).
- **Manifest parsing lives in a pure core module** callable over IPC (§4.5/§4.6),
  not inline in the main process, so it's unit-testable like Phase 1.
- **`type` is a non-binding hint** so unknown sections stay fully editable (§4.1).
- **`Document = { meta, blocks }` with managed elements** (§4.1/§4.2a): shields,
  link-defs, back-to-top, and banners are regenerated from `meta`, not edited as
  body — so reorder/delete can't strand a badge. `meta` recovery from off-template
  files is best-effort; unrecognized scaffolding is preserved as body, never
  guessed. *(Added after the builder check — resolves its findings #1, #3, #5.)*
- **The `header` block edits via structured fields, not raw markdown** (§4.8) —
  the single exception to Option B, because its content is generated HTML +
  shields. *(Added after the builder check — finding #2.)*
- **Round-trip invariant anchored to `Example_README.md`** (§4.9): prose/code
  preserved; managed elements and whitespace may change. *(Builder-check #6.)*

## 8. Manifest-drop merge behavior — decided by Dean (2026-10-17)
**Merge + dedupe.** When a manifest is dropped onto a section that already has
entries, the app adds the manifest's deps that aren't already listed and keeps
everything the user hand-added; it never clobbers existing content (honoring the
"never lose content" anti-goal). Dedupe is by package name. Known trade-off Dean
accepted: a dependency deliberately deleted can reappear on a later re-drop — the
user removes it again, and a deletion is cheap. This applies to the modules,
dev-modules, and Built With lists alike.

## 9. Resolved during brainstorming (2026-10-17)
- ✅ Editor shape (WYSIWYG block canvas), starting state (pre-filled template),
  open-existing READMEs, fidelity tradeoff (clean blocks > byte-exact), CLI's
  fate (kept as the quick path), and editing feel (Option B) — all settled with
  Dean.
- ✅ Builder-check findings #1–#3, #5, #6 folded into §4 as builder/my calls;
  #4 (merge vs replace) raised to Dean as §8.
- ⏳ The §7 calls await Dean's review; the renderer/markdown-dependency call is the
  one most worth a second look before planning.
