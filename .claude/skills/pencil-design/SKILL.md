---
name: pencil-design
description: >
  Create high-quality visual designs — websites, app screens, dashboards, slides, marketing
  materials, social media graphics — using Pencil (.pen design files). Use this skill whenever the
  user wants to create, generate, edit, or visualize any kind of UI design, mockup, wireframe,
  layout, webpage, app screen, presentation slide, poster, banner, or marketing asset. Also use it
  when the user says things like "design me a...", "make a visual for...", "create a mockup of...",
  "what would X look like?", "add a screen", "edit the design", or wants to turn an idea into a
  visual. Even if the user doesn't mention "Pencil" or "design tool" explicitly — if they want
  something visual created or changed, this is the skill to use.
---

# Pencil Design

Create and edit professional visual designs as `.pen` files. A `.pen` file is an **encrypted**,
infinite-canvas document (nested object hierarchy: frames, text, icons, components/instances).
This repo already has one: `desing.pen` at the project root (10 screens + 89 reusable components
for the Guia/Metas product).

> **Driving Pencil in this repo = the Pencil MCP server**, not the CLI. The MCP tools
> (`mcp__pencil__*`) are wired into the agent session and are the verified path. The standalone
> `@pencil.dev/cli` is **not installed here** (`npx pencil` fails with "could not determine
> executable"); treat it as the optional alternative documented at the bottom.

All paths below are relative to the repo root (`C:\Users\Lucas Emiliano\Documents\VSCode\guia-goals`).

---

## Run (agent path) — the MCP harness

The "driver" is off-the-shelf: the `mcp__pencil__*` tools. There is **no script file** to run — the
tool-call sequence below *is* the harness. Follow it in order.

### 1. Load the schema (required first, once per conversation)

```
mcp__pencil__get_editor_state(include_schema: true)
```

This returns: the active `.pen` file, current selection, the list of top-level screen frames and
reusable components (with their IDs), **and the full `.pen` schema + design rules**. You cannot use
any other Pencil tool correctly without the schema in context. After it's loaded once, subsequent
reads may pass `include_schema: false`.

Verified output in this repo: active editor `desing.pen`; top-level frames include
`s4yLg` Dashboard - Progress, `dUhvy` Metas Page, `MoUGA` Login Page, `W0bBr` Dashboard - Home,
`F7HfnJ` Timeline Page, `lgTKG` Uptime Page; plus 89 components (`L:VSnC2` Button/Default,
`L:pcGlv` Card, `L:hahxH` Progress, `L:PV1ln` Sidebar, …).

### 2. Load task + style guidance before designing

```
mcp__pencil__get_guidelines()                                  # list available guides + styles
mcp__pencil__get_guidelines(category: "guide", name: "<name>") # task-specific how-to
mcp__pencil__get_guidelines(category: "style", name: "<name>") # visual archetype for inspiration
```

Pick only the guide(s) relevant to the task. Don't load incompatible guides at once.

### 3. Inspect existing structure before editing

```
mcp__pencil__batch_get(...)        # read specific nodes / reusable components in detail
mcp__pencil__get_variables(...)    # read design tokens (colors, spacing, type) before adding new ones
```

Favor **copying existing screens/components and editing the copy** over generating from scratch —
the repo has a full component library; reuse it via `ref` instances.

### 4. Make the design changes

```
mcp__pencil__batch_design(script: "<small JS snippet>")
```

`batch_design` runs a tiny JS snippet against the document using only these functions: `Insert`,
`Copy`, `Update`, `Replace`, `Move`, `Delete`, `Generate` (images), `FindEmptySpace`. Key rules
(full set comes back with the schema in step 1):

- Split work into **small, section-focused** calls. On error, the whole call reverts.
- Persist values across calls with bare assignment (`myNode = Insert(...)`), **not** `const`/`let` —
  each call has its own scope. The call returns a name→id map for the nodes you created.
- Set a human-readable `name` on every node. Never set `id` (auto-generated).
- New/copied/modified root frames carry `placeholder: true` until that frame is finished, then unset.
- For new root content with no known position, start with `FindEmptySpace({width, height})` — never
  overlap root objects or pick random coordinates.
- Only screen frames + reusable components live directly under `document`. Never put loose
  text/icons/buttons at the document root.
- It's Pencil's own layout model, **not CSS/HTML** — no percentages, no `margin`, no
  `alignItems: stretch/baseline`. Use `fill_container` / `fit_content` and flexbox `layout`.

### 5. Verify the section you just changed

```
mcp__pencil__snapshot_layout(...)   # cheap: structural / sizing / overflow check
mcp__pencil__get_screenshot(filePath: "<abs path to .pen>", nodeId: "<id>")   # visual fidelity
```

Screenshots are **expensive** — take one only after a section is complete, on the **smallest
meaningful node** (a section frame, not `document`). Use `nodeId: "document"` only when you truly
need the whole canvas. Then actually look at it: layout not collapsed, content not clipped, contrast
OK, alignment/spacing clean.

Verified in this repo: `get_screenshot(filePath: ".../desing.pen", nodeId: "P3FgpJ")` rendered the
"Goal Row" component — a "Meta" label, an "Em Progresso" status, and a 75% progress bar.

### Export

```
mcp__pencil__export_nodes(...)   # export node(s) to image/asset output
```

---

## Setup / prerequisites

Nothing to install for the MCP path — the Pencil MCP server is already connected to the agent
session in this repo. If `get_editor_state` ever returns "no active editor," open `desing.pen` (or
the target `.pen`) in the Pencil editor / pass `filePath` explicitly to the read tools.

---

## Gotchas (battle scars from this environment)

- **`.pen` files are encrypted.** `Read`/`Grep`/`cat` on `desing.pen` return ~830 KB of opaque
  bytes — useless and misleading. The **only** valid access is via `mcp__pencil__*` tools.
- **The CLI is not installed here.** `which pencil` → nothing; `npx pencil version` → `npm error
  could not determine executable to run`. Don't burn time on the CLI — use the MCP tools. (The
  latest published CLI is `@pencil.dev/cli` `0.2.7` per `npm view`, if you ever do install it.)
- **Schema first, every conversation.** Calling `batch_design`/`batch_get` before
  `get_editor_state(include_schema: true)` means you're guessing at the format. Load it once up front.
- **Don't think in CSS.** Properties that look like CSS (`margin`, `%`, `stretch`) are unsupported
  and error. The schema returned in step 1 is the source of truth for every property.
- **One screen at a time.** Don't leave multiple root frames half-built (unless fanning out with
  sub-agents). Finish a `placeholder: true` frame, then unset the flag.
- **Multiplayer / stale state.** The document can change under you (the user edits live). If a node
  you remembered is missing or different, **re-read** with `batch_get`/`get_editor_state` — don't
  recreate it and don't undo the user's changes.
- **Screenshots cost tokens.** Prefer `snapshot_layout` for structure; reach for `get_screenshot`
  only for color/type/alignment fidelity, on the smallest node that shows the issue.

---

## Project fit (Guia / Metas)

This repo is a Next.js + Tailwind + shadcn/ui app (see `CLAUDE.md`, `PRD.md`, `SPEC.md`). The
`desing.pen` components mirror shadcn primitives (Button/*, Card, Tabs, Dialog, Table, Sidebar, …)
and the product screens (Login, Dashboard, Metas, Nova Meta, Timeline, Uptime, Settings). When the
user asks to design or change a screen, reuse those existing components/screens rather than
inventing new visual language, so the design stays consistent with the implemented UI.

---

## Alternative: the Pencil CLI (not installed in this repo)

If a future environment has the standalone CLI instead of the MCP server, the package is
`@pencil.dev/cli`. It generates `.pen` files and exports images, and runs its own AI agent (which
itself needs an authenticated Claude Code user).

- Install: `npm install -g @pencil.dev/cli` (or local `npm install @pencil.dev/cli` → `npx pencil`).
- Discover commands: `pencil --help`.
- Pencil auth: `pencil status`; then `pencil signup ...` / `pencil login --email you@example.com`,
  or set `PENCIL_CLI_KEY` in the session.
- Latest version: `npm view @pencil.dev/cli version` (was `0.2.7` when this skill was written).
- Stay in sync: the published package ships its own `SKILL.md` at
  `node_modules/@pencil.dev/cli/SKILL.md` (or `https://unpkg.com/@pencil.dev/cli@latest/SKILL.md`).
  Re-copy it after upgrading — placed skill files don't auto-update.

Prefer the MCP path above whenever the `mcp__pencil__*` tools are available; they are in this repo.
