# Jacky-Studio AI Development Standard

Last updated: 2026-03-24
Scope: this repository only
Audience: Codex and other AI coding agents working directly in this project

## 1. Purpose

This file is the execution standard for AI agents contributing to `Jacky-Studio` (`JK`).
It is not a generic frontend guideline. It is a project-specific operating manual based on the actual stack, actual directory structure, and actual refactor history of this repo.

Primary goals:
- Keep the project stable while AI performs continuous development.
- Reduce regressions caused by broad rewrites and pattern drift.
- Make future AI handoff easier by keeping structure predictable.
- Prefer safe incremental refactor over impressive but risky large-scale edits.
- Keep new features from collapsing into nested patch chains before they are even complete.

## 2. Project Reality

AI must align with the current codebase instead of forcing a textbook architecture.

Current verified stack:
- React 19
- TypeScript 5
- Vite 6
- Tailwind CSS v4
- Zustand
- Zod
- framer-motion

Current root structure includes:
- `docs/`
- `pages/`
- `components/`
- `hooks/`
- `services/`
- `scripts/`
- `stores/`
- `tmp/`
- `types/`
- `utils/`
- `api/`
- `constants/`
- `knowledge/`
- `skills/`

Important local realities:
- This is a React-only project. Do not write Vue-oriented standards into active guidance.
- Tailwind utilities are the dominant styling approach. Do not impose SCSS/CSS Modules as a default.
- Naming in the repo is mixed, but current active direction favors:
  - PascalCase for React component files
  - camelCase for hooks, controllers, utilities, and store helpers
  - page-private components under page-local `components/`
  - page-private orchestration hooks under page-local `controllers/`
- There is no confirmed repo-wide ESLint, Prettier, CommitLint, or CI pipeline enforced yet. Do not assume they exist.
- `tsc --noEmit` is currently the main reliable verification baseline.

## 3. Highest-Level Rules

When editing this repo, AI must follow these rules in order:

1. Preserve working behavior.
2. Match existing project patterns before introducing new ones.
3. Prefer small safe extractions over broad rewrites.
4. Verify with available tooling after meaningful changes.
5. Leave the code easier for the next AI than you found it.
6. For new features, prefer a clean primary flow over layered fallback patches.
7. If the implementation starts turning into patch-on-patch nesting, stop and redesign the main flow before adding more guards.
8. For agent-owned or model-owned decision layers, do not replace missing intelligence with rule fallback.
9. If orchestration, planning, routing, or reference-role reasoning fails, fail explicitly instead of silently degrading to a fake-smart rule path.

If a generic best practice conflicts with the actual repo structure, prefer the repo structure unless there is a clear maintenance or correctness problem.

## 4. Required Working Method For AI

Before editing:
- Inspect the relevant file and nearby dependencies first.
- Identify whether the target is global, page-scoped, or feature-scoped.
- Reuse existing patterns from the same feature area before inventing a new abstraction.
- Re-open the governing plan or implementation spec for the feature before every new development step.
- Explicitly identify:
  - which planned stage the current task belongs to
  - what has already been implemented
  - whether the next change is still inside that stage boundary
  - whether the implementation direction has drifted from the intended product concept
- For agent, orchestrator, runtime, or tool-system work, always re-check that the solution is still converging on a general execution agent rather than drifting into a planner-only UI, workflow hardcode, or hidden rule fallback.
- If drift is detected, stop and realign to the plan before adding more code.

During editing:
- Keep changes local to the requested task.
- Do not mix refactor, behavior change, visual redesign, and cleanup in one undifferentiated edit unless necessary.
- Avoid broad file rewrites in encoding-sensitive files.
- Never use PowerShell direct file-content editing for Chinese text files or mixed Chinese/English UI copy files.
- If Chinese content is involved, use an editing path that preserves UTF-8 reliably; if `bash`/WSL is unavailable, stop and switch to a verified non-garbling method before touching the file.
- Prefer extraction-first migration:
  - extract a component or hook
  - wire it in
  - delete dead inline code after the new path works
- Do not hide unfinished feature logic behind fake completeness:
  - prefer explicit failure or empty state over synthetic fallback content
  - do not stack repair layers when the real issue is the primary flow design
- For intelligence layers such as agent routing, planning, prompt orchestration, reference-role assignment, and strategy selection:
  - do not use hidden rule fallback as a permanent substitute
  - do not merge model output onto a silent rule authority and call that "smart"
  - if model output is required for the feature, failure must be visible and traceable
- Temporary stabilization logic is allowed only as short-term containment:
  - document why it exists
  - remove or collapse it once the correct flow is implemented

After editing:
- Run verification appropriate to the change.
- Summarize what changed, what was verified, and any residual risk.
- Re-check the result against the governing plan and state whether the implementation still matches the intended stage and product direction.

## 5. File And Directory Standards

### 5.1 Directory placement

Use the existing placement rules:
- `pages/`: page-level screens and page-owned submodules
- `pages/<Feature>/components/`: components only used by that page or feature
- `pages/<Feature>/controllers/`: feature/page orchestration hooks and prop builders
- `components/`: shared reusable UI across multiple pages
- `hooks/`: cross-page reusable hooks
- `stores/`: Zustand stores and store-related logic
- `services/`: provider integrations, AI/model logic, business services
- `utils/`: small reusable helpers with low feature coupling
- `types/`: shared type definitions
- `constants/`: shared constants

Do not place page-private code into global folders just because it is extracted.

### 5.2 Naming

Use these naming defaults unless a local area already uses a different stable pattern:
- React component file: `PascalCase.tsx`
- Hook or controller: `camelCase.ts` and hook names starting with `use`
- Utility file: `camelCase.ts`
- Store file: existing repo pattern, usually `*.store.ts`
- Markdown spec or mapping document: `UPPER_SNAKE_CASE.md` or current repo naming style

Examples from this repo:
- `pages/Workspace/components/WorkspaceCanvasStage.tsx`
- `pages/Workspace/controllers/useWorkspaceCanvasLayerProps.ts`
- `stores/canvas.store.ts`
- `hooks/useAgentOrchestrator.ts`

## 6. React Component Standards

### 6.1 General component rules

AI should keep components focused:
- One component should own one clear UI responsibility.
- If JSX branches become large and self-contained, extract them.
- If a page file mainly passes grouped props into subtrees, that is acceptable and often desirable.

Prefer this split:
- Page file: orchestration, high-level state composition, feature wiring
- Page-local component: render block or UI shell
- Page-local controller hook: derived state, grouped handlers, prop assembly
- Global component: reused across unrelated pages/features

### 6.2 Props

Prop rules:
- Prefer typed props interfaces or type aliases.
- Group related props when a component surface becomes too wide.
- Do not flatten dozens of unrelated props if they naturally belong to groups.
- Reuse existing shared prop-group types when possible instead of duplicating shape definitions.

Good local pattern already used in this repo:
- `inputUi`
- `modelPreferences`
- grouped layer props
- grouped page-shell props

### 6.3 Extraction threshold

Extract when any of the following is true:
- A JSX block is long, conditional-heavy, and internally coherent.
- The same mental unit keeps distracting from the page's main orchestration flow.
- A branch requires dedicated prop typing or isolated tests later.
- A render helper has become large enough that a component is easier to reason about.

Do not extract tiny wrappers that only add indirection and no clarity.

## 7. Hook And Controller Standards

This project already uses page-local controllers heavily, especially in `pages/Workspace/controllers/`.
That is an approved pattern for this repo.

Use a controller hook when:
- derived selectors are cluttering the page file
- large prop objects are being assembled for child layers
- a coherent state/handler cluster can be isolated without moving ownership incorrectly
- effects and UI state belong to one subdomain

Controller hooks should:
- have a narrow purpose
- return well-named grouped outputs
- avoid hiding core business ownership when the page should still own the final action
- prefer typed return values

Do not move logic into hooks only to make the page shorter if the ownership boundary becomes less clear.

## 8. TypeScript Standards

### 8.1 Required defaults

AI should prefer:
- explicit domain types for non-trivial data
- inference for obvious local primitives
- discriminated unions or literal unions over loose string handling where practical
- small reusable helper types when prop groups repeat

### 8.2 `any` policy

`any` is not banned absolutely, but it is restricted.

Rules:
- Do not introduce new `any` if a realistic type can be written quickly.
- If temporary `any` is used to unblock a safe refactor, keep it local and leave an obvious path to removal.
- Never spread unbounded `any` through public component or hook surfaces unless forced by external data.
- Prefer `unknown`, narrowed objects, or local adapter types over wide `any`.

### 8.3 Type hygiene

AI should:
- keep types close to usage unless they are clearly shared
- move repeated types into shared files only after repetition is real
- avoid duplicate shape declarations across parent/child components when one shared type can be reused

## 9. State Management Standards

This repo uses Zustand. Follow these rules:
- Global cross-page or cross-feature state belongs in `stores/`.
- Local page interaction state should stay local unless multiple distant parts truly need it.
- Do not migrate local state into Zustand just to reduce prop passing.
- Read existing store patterns before extending them.

When extending a store:
- keep actions explicit
- avoid mixing unrelated domains into one store
- do not silently change persisted or shared shape without reviewing all call sites

## 10. Service And API Standards

Service-layer and provider code should stay out of UI components when possible.

Use these boundaries:
- `services/`: provider integrations, AI orchestration helpers, domain workflows
- `api/`: request wrappers or API-facing helpers if applicable
- `utils/`: pure generic helpers, not feature-specific business orchestration

When touching model/provider code:
- handle failure states explicitly
- use project error helpers where they already exist
- do not hide provider-specific assumptions in generic utility files

## 11. Styling Standards

This repo is Tailwind-first.

Required styling rules:
- Prefer Tailwind utility classes for page and component styling.
- Match nearby class composition patterns before introducing helpers.
- Use `clsx` and `tailwind-merge` when conditional class composition becomes dense.
- Avoid inline style objects unless dynamic positioning, transforms, or canvas-like rendering genuinely require them.
- Do not introduce a new styling system for one feature.

Allowed exceptions:
- inline styles for geometry, transforms, canvas overlay positioning, dynamic dimensions
- component-local style logic when required by rendering math or external library integration

## 12. Workspace-Specific Refactor Standard

`pages/Workspace.tsx` is a special high-risk file.
Any AI editing it must follow a stricter workflow.

### 12.1 Mandatory pre-phase backup

Before each major refactor phase of `Workspace.tsx`, create a fresh backup with a non-compiling suffix.

Backup naming pattern:
- `pages/Workspace.tsx.codex-backup-YYYYMMDD-HHMMSS.tsx.bak`

Reason:
- this file has a history of encoding-sensitive damage
- rollback speed matters more than backup minimalism
- the user explicitly wants phase-by-phase safety

### 12.2 Approved refactor strategy

For `Workspace.tsx`, prefer this sequence:
1. Backup the file.
2. Extract one coherent UI/render/state cluster.
3. Wire the extracted module into the live page.
4. Remove dead inline code only after the new path is live.
5. Run `tsc --noEmit`.
6. Update `docs/architecture/WORKSPACE_REFACTOR_MAP.md`.

### 12.3 Approved extraction targets

Preferred landing zones:
- render/UI shells -> `pages/Workspace/components/`
- orchestration/derived state/prop assembly -> `pages/Workspace/controllers/`

Good examples already present:
- `WorkspaceCanvasStage.tsx`
- `WorkspacePageOverlays.tsx`
- `WorkspaceSidebarLayer.tsx`
- `useWorkspacePageShellProps.ts`
- `useWorkspaceCanvasLayerProps.ts`
- `useWorkspaceDerivedCanvasState.ts`

### 12.4 What not to do

When editing `Workspace.tsx`, do not:
- perform a full-file rewrite just to reorganize formatting
- combine unrelated refactor phases into one giant edit
- delete old logic before the replacement is wired and type-checked
- normalize text encoding by rewriting the whole file unless rollback is ready

## 13. Verification Standard

### 13.1 Minimum required verification

For TypeScript-impacting changes, run:

```powershell
cmd /c node_modules\.bin\tsc --noEmit --pretty false
```

This is the current baseline verification command for the repo.

### 13.2 Additional verification guidance

Also use when relevant:
- feature-specific scripts already defined in `package.json`
- local build commands when changing build-sensitive areas
- targeted manual sanity checks for UI-heavy work

Current known scripts:
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run test:optimizer`

Do not claim lint, unit tests, or CI passed if those checks were not actually run.

### 13.3 Text integrity verification (required for high-risk files)

For encoding-sensitive files (especially `pages/Workspace.tsx` and long-lived controller files), AI must run a quick text-integrity check after edits:

- Scan for known mojibake markers (examples: `鍙`, `锛`, `鈹`, `銆`).
- Re-check template strings near edited text to ensure `${...}` interpolation is still intact.
- If user-facing Chinese text is intended, distinguish valid Chinese from mojibake before replacing.

If mojibake is detected:
- Fix immediately in the same phase.
- Re-run `tsc --noEmit` after the text fix.

## 14. Refactor Versus Feature Work

AI must distinguish between these modes:

Feature work:
- prioritize behavior correctness and project consistency
- refactor only what is needed to make the change safe

Refactor work:
- prefer no behavior change
- preserve UI and interaction behavior
- verify after each meaningful phase

Mixed work is allowed only when the feature cannot be implemented safely without structural cleanup.

## 15. Safe Editing Rules

### 15.1 Avoid unsafe operations

Unless explicitly requested, AI must not:
- revert unrelated user changes
- delete large files as a shortcut
- use destructive git operations
- rewrite huge files wholesale when a targeted edit is possible

### 15.2 Encoding-sensitive files

If a file has prior corruption history or mixed text artifacts:
- prefer small targeted patches
- avoid mass replacement edits
- create a rollback copy first if the file is high value

### 15.3 Mojibake prevention protocol (mandatory)

When editing high-risk files, AI must follow this protocol:

1. Create a timestamped backup before the phase.
2. Do not copy text from already-corrupted backups into active files.
3. Prefer targeted line-level edits over whole-file rewrites.
4. Treat user-visible strings and template strings as high risk; verify both text readability and interpolation syntax.
5. After edits, run text-integrity scan + `tsc --noEmit` before declaring completion.

Known root causes in this repo:
- UTF-8 content read/written through a mismatched encoding path.
- Reusing mojibake-contaminated historical backups.
- Large replacement edits accidentally damaging string literals (especially template strings).

### 15.4 Comment policy

Comments should be:
- brief
- useful
- explaining intent or non-obvious constraints

Do not add decorative or redundant comments.

## 16. Documentation Standards For AI

When AI changes structure significantly, update the relevant local spec or map.

In this repo, examples include:
- `docs/architecture/WORKSPACE_REFACTOR_MAP.md`
- feature specs under `docs/product/`
- module maps when architecture meaningfully changes

Documentation should record:
- what changed
- what is already extracted or standardized
- what remains risky
- what order future AI should continue in

## 17. Definition Of Done For AI Tasks

A task is not complete just because code was written.

Default done criteria:
- requested change is implemented
- structure matches repo patterns
- type errors introduced by the change are resolved
- verification was run when applicable
- follow-up risk is called out honestly

For `Workspace.tsx` refactor phases, done also includes:
- backup created before the phase
- `docs/architecture/WORKSPACE_REFACTOR_MAP.md` updated after the phase

## 18. Recommended Decision Heuristics

When uncertain, AI should usually choose the safer option below:

- existing local pattern over new architecture
- page-local extraction over premature global abstraction
- typed adapter over `any`
- incremental migration over rewrite
- real repo tooling over imagined ideal tooling
- truthful limitation reporting over pretending a check passed

## 19. Short Operating Checklist

Before work:
- inspect nearby files
- confirm local pattern
- identify verification path

During work:
- keep scope tight
- extract by coherent unit
- protect high-risk files with backups when needed

After work:
- run verification
- update relevant docs/maps
- report changes, checks, and residual risk clearly

## 20. Final Instruction

This standard exists to keep AI development stable, cumulative, and handoff-friendly.
The best contribution is not the most dramatic edit.
The best contribution is the one that leaves the repo more understandable, still working, and easier for the next iteration.
