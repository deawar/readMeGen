# ReadMeGen — Shared-Core Design

**Date:** 2026-10-17
**Status:** Approved design / pre-plan
**Author:** Dean Warren (with Claude)

---

## 1. Intent & why

ReadMeGen is a developer tool that removes the tedium of hand-writing a
`README.md` for each project. It interviews the user about a project (title,
description, install/usage/test commands, license, contributors, dependencies)
and generates a complete, well-formatted `README.md` including a title, badges,
an optional table of contents, and a "Questions" contact section built from the
user's GitHub profile.

The north-star vision: **the same tool runs either as a CLI or as a desktop
(Electron) GUI, chosen by the end user's preference.** Both front-ends must
produce byte-for-byte identical output because they share the same generation
logic. "Identical" here means **identical to each other** (same `answers` → same
string), NOT identical to today's buggy output — the bug fixes in §7 deliberately
change what the tool emits. **The canonical output format is the othneildrew
"Best-README-Template"**, provided by Dean as [`Example_README.md`](../../../Example_README.md).
The core's unit tests assert against that structure. This is a substantially
richer layout than the old tool's output (see §4.2/§5).

**Why now:** The existing code (in `Develop/`) half-works but the generation
logic is tangled directly inside the interactive `inquirer` prompt flow, it is
untested, and it carries several correctness bugs (see §7). In its current shape
it cannot be driven by anything other than the CLI prompts, which blocks the GUI
vision entirely. Establishing a clean generation "core" now — once — is the
cheapest path to both a correct CLI today and a GUI later, because the alternative
(fixing bugs in place, then untangling the same logic again for the GUI) pays to
understand and verify the generation logic twice.

---

## 2. Goals / non-goals / anti-goals

### Goals (this project)
- A **pure, side-effect-free core function** `generateReadme(answers) → string`
  that contains ALL markdown-building logic and does no prompting, no file I/O,
  no network calls, and no console output.
- A **hardened GitHub API module** that tolerates network failures and missing
  tokens and returns a predictable value.
- A **CLI front-end** that collects answers via `inquirer`, calls the core, and
  writes the file — and nothing more.
- The core is **unit-tested** (it is now testable because it is pure).
- All correctness bugs in §7 are fixed as the logic moves into the core.

### Non-goals (explicitly out of scope for now)
- Building the Electron GUI. Phase 2 (§6). The design only reserves the seam.
- Auto-detecting dependencies/scripts by parsing the target repo's
  `package.json`. Tempting future feature; not now.
- Supporting hosts other than GitHub (GitLab, Bitbucket).
- A configuration/preset system, templating engine, or plugin API.
- Publishing to npm as an installable binary.

### Anti-goals (would make this a failure even if it "works")
- A GUI and a CLI that can drift out of sync because they each contain their own
  copy of the generation logic. The whole point is one core.
- A core that quietly reaches out to the network or the filesystem, making it
  non-deterministic and hard to test.
- Output with broken links/badges (e.g. `undefined` URLs, unescaped spaces) — the
  tool's entire value is a *correct* README.

---

## 3. Constraints

- **Platform:** Windows 11 dev environment, PowerShell. Must also run on
  macOS/Linux (no OS-specific path assumptions — use `path`).
- **Runtime:** Node.js 22. ESM modules (the existing `Develop/` package is
  `"type": "module"`).
- **GitHub API:** Must work **without** a token (unauthenticated, 60 req/hr) and
  **optionally** use `process.env.TOKEN` when present. Must not crash offline.
- **Existing deps to keep:** `inquirer` (CLI prompts), `axios` (HTTP),
  `chalk` + `figlet` (CLI cosmetics only), `dotenv` (optional token),
  `standard` (lint). Note: `figlet` is declared in `Develop/package.json`
  (`^1.5.2`) — it was merely un-installed, which caused the earlier crash — so it
  is kept, not reintroduced. After consolidation (§4.4) the single root
  `package.json` dependency set is the authoritative one: runtime =
  `axios`, `chalk`, `dotenv`, `figlet`, `inquirer`, `open`; dev = `electron`,
  `standard`. The root currently lacks `figlet`; the consolidation step adds it.
- **Electron** is already upgraded to `^44` and `axios` root dep to `^1.x`
  (done in the cleanup pass). The GUI shell (`main.js`, `preload.js`) is already
  bug-fixed and waits for phase 2.

---

## 4. Architecture — decided

### 4.1 The seam
```
                 ┌─────────────────────────┐
  CLI front-end  │                         │
  (inquirer) ───▶│  answers (plain object) │───▶ generateReadme(answers)
                 │                         │              │
  GUI front-end  │                         │              ▼
  (Electron)  ──▶│                         │        README string
                 └─────────────────────────┘              │
                                                           ▼
                                        front-end writes file / shows preview
```
- **`generateReadme(answers) → string`** is the single source of truth for output.
  Pure. No I/O. Deterministic. Same input → same string.
- Each front-end's only jobs: (1) collect `answers`, (2) call the core,
  (3) decide what to do with the returned string (CLI writes a file; GUI will
  show a preview and/or write a file in phase 2).
- GitHub lookups happen in the **front-end layer** (during answer collection /
  validation), NOT inside the core — the core receives already-resolved author
  and contributor data in `answers`. This keeps the core offline and pure.

### 4.2 The `answers` object (the contract between front-ends and core)
Shaped to the Best-README-Template. Fields marked *(optional)* omit their section
or element gracefully when empty. Prose-heavy fields default to the template's
**editable placeholder text** (Dean's call) unless the user supplies content.
```js
{
  // --- project identity ---
  projectTitle:  string,          // raw; core URL-escapes where needed
  projectUrl:    string,          // https://github.com/<owner>/<repo>; core derives owner/repo
  tagline:       string,          // one-line pitch under the title
  description:   string,          // "About The Project" prose
  logoPath:      string,          // (optional) centered logo image
  screenshotPath:string,          // (optional) "About" screenshot
  docsUrl:       string,          // (optional) "Explore the docs" link
  demoUrl:       string,          // (optional) "View Demo" link

  // --- tech & setup ---
  builtWith:     [ string, ... ], // frameworks/libraries → "Built With" badges
  prerequisites: string,          // (optional; placeholder default)
  install:       string,          // "Installation" steps/command
  usage:         string,          // "Usage"
  tests:         string,          // "Testing"  [KEPT from old tool]

  // --- dependency lists  [KEPT from old tool] ---
  modules:       [ string, ... ], // runtime npm deps → linked list (may be empty)
  devModules:    [ string, ... ], // dev npm deps → linked list (may be empty)

  // --- sections ---
  tableOfContents: boolean,       // render collapsible <details> TOC
  roadmap:         string,        // (optional; placeholder checklist default)
  acknowledgments: string,        // (optional; placeholder list default)
  conCov:          boolean,       // Contributor Covenant badge + note  [KEPT]
  license:         string,        // one of the known license keys

  // --- people (resolved from GitHub BEFORE calling core; manual fallback per §4.6) ---
  author: {                       // README owner → Contact section + Questions content
    login, name, email, html_url, avatar_url
  },
  contributors: [ { login, name, html_url, avatar_url }, ... ],  // may be empty  [KEPT]
  twitter:  string,               // (optional) Contact Twitter handle
  linkedin: string                // (optional) LinkedIn URL → top LinkedIn shield
}
```
Notes:
- Front-ends normalize empty inputs to `''`→`[]` / absent so the core only ever
  sees the shapes above. The core defends against missing optional fields but
  does not do network or prompt work to fill them.
- The license key set stays as today: `MIT`, `Apache 2.0`, `GNU AGPLv3`,
  `GNU GPLv3`, `GPLv3`, `Mozilla Public License 2.0`, `The Unlicense`.
- **String→array parsing is the CLI's job, not the core's** (my call): the CLI
  splits comma-separated input, trims each entry, drops empties; empty input →
  `[]`. The core receives clean arrays and never splits strings.
- **`owner/repo` derivation + default branch** (my call): the core derives the
  `owner/repo` path for badges by parsing `projectUrl` (it already receives it),
  so `username`+title string-building is retired. LICENSE and badge links use the
  `HEAD` ref (`.../blob/HEAD/LICENSE`) instead of a hardcoded `master`, so links
  work regardless of whether the repo's default branch is `main` or `master`
  (fixes the dead-link risk flagged against bug #2/#10). Parsing a string URL is
  pure, so this stays inside the core.

### 4.3 GitHub API module — hardened
`fetchGitHubUser(username, { token }) → userInfo | null`
- Uses `Authorization: Bearer <token>` **only when a token is present**;
  omits the header entirely otherwise (correct unauthenticated behavior).
- Returns `null` on 404 **and** on any network/no-response error (never throws
  `TypeError` on `err.response`).
- No `console.log` side effects.
- **The module distinguishes the two failure modes** so the CLI can react
  correctly (see §4.6): a 404 means "no such user" (re-prompt), whereas a
  network/rate-limit error means "couldn't reach GitHub" (offer manual fallback).
  Return shape may be `null` + a thrown/typed error, or a tagged result like
  `{ ok, user, reason }` — builder's choice, as long as the caller can tell a
  404 from an unreachable API.

### 4.6 Author lookup — degraded/offline behavior (decided)
When collecting the author's own profile, if `fetchGitHubUser` fails because
GitHub is **unreachable or rate-limited** (not a 404), the CLI falls back to
**manual entry**: it prompts the user to type their name, email, and avatar URL
so a README still generates fully offline. A genuine 404 (typo'd username) still
re-prompts for a valid username as today. Contributor lookups that fail the same
way are simply skipped with a warning rather than blocking generation.

### 4.4 Repository structure — decided (my call, see §9)
Consolidate the two-package split into **one package at the repo root**. The
current `Develop/` sub-package with its own `package.json`/`node_modules` is a
long-term maintenance tax (duplicate dep trees, the reason the CLI's deps were
uninstalled). Target layout:
```
/package.json           (single package; "type": "module")
/main.js  /preload.js    Electron shell (phase 2 front-end)
/index.html
/src/
  core/
    generateReadme.js    pure generator (the core)
    licenses.js          license key → description map
  github/
    fetchGitHubUser.js   hardened API module
  cli/
    index.js             inquirer front-end → core → writeFile
/test/
  generateReadme.test.js unit tests for the core (node:test, no new dep)
/output/                 default write target (git-ignored) — optional
```
`Develop/` is retired; its working logic migrates into `src/`. (If migration risk
feels too high at plan time, the fallback is to keep `Develop/` as the home of
`src/` — but one root package either way.)

### 4.5 Module system & tooling
- ESM throughout the core, github, and CLI layers.
- `node:test` + `node:assert` for unit tests — **no new dependency**.
- `chalk`/`figlet` are imported **only** in `src/cli/`, never in the core.
- Remove the bogus `"path": "^0.12.7"` dependency — `path` is a Node built-in;
  that npm package is a broken shim.

---

## 5. Output structure — the canonical outline
Follows `Example_README.md` (Best-README-Template) with Dean's extra sections
woven in (Testing, npm Dependency lists, Contributor Covenant) and the old
"Questions" content merged into **Contact** (my call — they are the same
author-contact info; avoids a duplicate section). Prose sections emit editable
placeholder text by default.

Top-to-bottom order the core must produce:
1. `<a id="readme-top">` anchor.
2. **Top shields** (reference-style): Contributors, Forks, Stars, Issues, License,
   plus LinkedIn *(if `linkedin`)* and the Contributor Covenant badge *(if
   `conCov`)*. Derived from `owner/repo`.
3. **Header block** (centered): logo *(if `logoPath`)*, `projectTitle`, `tagline`,
   and the "Explore the docs" *(if `docsUrl`)* / "View Demo" *(if `demoUrl`)* /
   "Report Bug" / "Request Feature" links (bug/feature auto-link to repo issues).
4. **Collapsible Table of Contents** (`<details>`), auto-generated from the
   sections actually included (fixes shadowing bug #3 — entries never phantom or
   vanish).
5. **About The Project** — screenshot *(if `screenshotPath`)*, `description`,
   placeholder "Here's why" bullets. Sub-section **Built With** from `builtWith`.
6. **Getting Started** → **Prerequisites** (placeholder) → **Installation**
   (`install`).
7. **Usage** (`usage`).
8. **Testing** (`tests`).  [KEPT]
9. **Dependencies** and **Dev-Dependencies** — bulleted npm lists linking to
   npmjs.com, rendered only when `modules`/`devModules` are non-empty.  [KEPT]
10. **Roadmap** (placeholder checklist).
11. **Contributing** — fork/PR boilerplate, the contrib.rocks contributors image
    (auto `owner/repo`), and a Contributor Covenant note *(if `conCov`)*.
12. **License** — reference-style license shield + the *correct* descriptive text
    for the chosen license (fixes bug #1); link uses the `HEAD` ref.
13. **Contact** — author name, Twitter *(if `twitter`)*, author email, and project
    link; includes the author avatar + `mailto:` (this is the old "Questions"
    content).  [KEPT, merged]
14. **Acknowledgments** (placeholder list).
15. **"back to top"** links after each major section.
16. **Reference-style link-definition block** at the very bottom, auto-generated
    (shields + section URLs), matching the template's style.

Cross-cutting rules:
- All URLs real and URL-escaped — no `undefined`, no unescaped title spaces
  (fixes bugs #2, #10).
- Contributors with avatar thumbnails; empty cleanly when none.

---

## 6. Phasing
- **Phase 1 (this project):** core + github module + CLI front-end, unit-tested,
  all §7 bugs fixed, debug logging removed. Deliverable: a CLI that reliably
  produces a correct `README.md`.
- **Phase 2 (future, build-only — design deferred intentionally):** Electron GUI
  front-end. A renderer form collects the same `answers`; `main.js` relays them
  over IPC to a handler that calls the **same** `generateReadme`. GitHub lookups
  move to the main process. IPC channel shapes, renderer framework, and form
  layout are decided then, once the core is proven through the CLI.

---

## 7. Bug inventory to fix (absorbed into the extraction)
| # | Bug | Location | Fix |
|---|-----|----------|-----|
| 1 | License description never renders (always "Unlicense") — string wrapped before `switch` | index.js:260-282 | Switch on the license *key* first, build the link after |
| 2 | Badges link to `undefined` — no prompt collects `projectUrl` | index.js:229,294-296 | Add a `projectUrl` prompt; include in `answers` |
| 3 | TOC "Dependencies"/"Dev-Dependencies" (and credit) entries never appear — `let`/`const` shadowing inside `else` blocks | index.js:181,206,222,238 | Assign to outer vars, don't re-declare |
| 4 | Contributor validation always passes — `async` in `.forEach` not awaited | index.js:92 | Use `for…of` with `await`, or `Promise.all` |
| 5 | API crashes offline — `err.response.status` when no response | api.js:50 | Guard `err.response`; return `null` |
| 6 | Malformed auth header `token:${TOKEN}` | api.js:17 | `Authorization: Bearer <token>`, only when token present |
| 7 | Dead `generateMarkdown.js` stub (CJS in ESM pkg) | utils/generateMarkdown.js | Replace with the real core |
| 8 | Output path computed then ignored; writes to cwd | index.js:20-22,321-322 | CLI decides write path explicitly |
| 9 | Debug `console.log` noise throughout | index.js, api.js | Remove / gate behind a debug flag |
| 10 | Title spaces break links/badges | index.js:175 (TODO) | URL-escape in the core |
| 11 | Bogus `"path"` npm dependency | Develop/package.json | Remove (Node built-in) |

---

## 8. What's left to the builder (plan phase)
- Exact file moves for the `Develop/` → `src/` consolidation (and whether to
  preserve git history via `git mv`).
- Test coverage breadth for the core (which license/TOC/contributor permutations
  to assert), anchored to Dean's sample README (§10) as the canonical fixture.
- Whether to keep a default `output/` dir or write the README to the current
  working directory (lean: cwd, since READMEs belong in the project root).
- Whether `dotenv`/`.env` loading stays in the CLI layer (lean: yes, CLI-only).
- Follow TDD (superpowers:test-driven-development) for the core.

---

## 9. Calls I made (not explicitly decided by Dean — check these)
- **Consolidate to a single root package** and retire `Develop/` (§4.4). Biggest
  structural decision here; flagged for veto.
- **GitHub lookups live in the front-end, not the core** (§4.1), to keep the core
  pure/offline/testable.
- **`node:test` for unit tests** rather than adding Jest/Vitest (§4.5) — zero new
  deps.
- **Write the README to the current directory by default** rather than an
  `output/` folder (§8).
- **Add a `projectUrl` prompt** as the fix for the `undefined` badge bug (§7 #2).

## 10. Open inputs — status
- ✅ **Sample README provided:** `Example_README.md` (Best-README-Template). It is
  the canonical format and the core's primary test fixture. No open blockers
  remain before the plan phase.

## 11. Resolved during brainstorming / builder check (2026-10-17)
- Output format: match `Example_README.md` (Best-README-Template) (§1, §5).
- Prose-heavy sections (About/why, Prerequisites, Roadmap, Acknowledgments):
  emit **editable placeholder text** by default (§5).
- Keep the old tool's extra sections — **Testing**, npm **Dependencies/
  Dev-Dependencies** lists, **Contributor Covenant** option — woven into the
  template; old **Questions** content merged into **Contact** (§5).
- Offline/rate-limited author lookup: manual-entry fallback (§4.6).
- String→array parsing: CLI's job; comma-split, trim, drop empties (§4.2).
- `owner/repo` from `projectUrl`; links use `HEAD`, not `master` (§4.2).
- `figlet` is kept (already declared in `Develop`); consolidated dep list fixed (§3).
