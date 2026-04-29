# Root Directory Policy

Last updated: 2026-03-24
Scope: repository root only

This file defines what is allowed to stay in the project root and what should be moved elsewhere.

## Keep In Root

Only files that are part of runtime, build, deployment, package management, or top-level project entry should stay in the root.

Examples in this repo:
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `vercel.json`
- `index.html`
- `index.tsx`
- `App.tsx`
- `index.css`
- `vite-env.d.ts`
- `README.md`
- `cspell.json`
- `metadata.json`

## Move Out Of Root

These should not accumulate in the root:
- feature specs
- architecture maps
- PRDs
- reference notes
- changelogs
- temporary debug output
- ad hoc scripts
- scratch files
- local logs

Approved destinations:
- `docs/standards/`
- `docs/architecture/`
- `docs/product/`
- `docs/references/`
- `docs/changelog/`
- `scripts/`
- `tmp/`

## Folder Responsibilities

- `docs/standards/`
  - AI-facing engineering standards and execution rules.
- `docs/architecture/`
  - project maps, structural notes, refactor maps, and directory policy.
- `docs/product/`
  - product specs, implementation plans, workflow notes, and PRDs.
- `docs/references/`
  - external references, research notes, sample libraries, and inspiration material.
- `docs/changelog/`
  - historical update notes.
- `scripts/`
  - local helper scripts that are useful but not part of the app runtime.
- `tmp/`
  - disposable outputs, logs, debug captures, scratch files, and one-off analysis artifacts.

## Safety Rules

Before moving a root file:
1. Check whether it is referenced by runtime code, build config, deployment config, or package scripts.
2. If it has uncertain external-tool meaning, keep it in root until verified.
3. If you move it, update any repo references that use the old path.
4. Run `tsc --noEmit` after the reorganization if TypeScript-facing files were touched.

## Current Exceptions

- `metadata.json` remains in root intentionally because external tooling may read it even though the app code does not import it directly.
- Existing local backup files for `Workspace.tsx` may remain near the source file for rollback speed, but they should stay ignored by git.
