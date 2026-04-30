# Studio User Asset Layer Spec

## Purpose

This spec defines the durable user-asset layer used for account-syncable studio state.

## Core Rules

- All new durable user state must enter through `StudioUserAssetApi` or dedicated runtime-asset orchestration helpers.
- New features must not write long-term state directly to scattered `localStorage` keys.
- If a legacy key path still exists for compatibility, it must be treated as a mirror or migration source, not as the new source of truth.
- When iterating a module, check whether the change accidentally falls back to an old module chain. If the old chain can be removed, remove it. If it cannot be removed yet, document the reason, risk, and replacement plan.

## Asset Layers

- Built-in system assets: bundled roles, style libraries, plugins, shared prompts.
- Durable user asset layer: account-syncable preferences, addons, drafts, libraries, profile, evolution records, plugin/skill/workspace settings.
- Runtime temporary overlay: task-scoped drafts and temporary composition state.

## Sync Rules

- Conflict handling must go through the sync policy and merge executor, not ad-hoc field overwrites.
- Supported conflict policies:
  - `prefer_local`
  - `prefer_remote`
  - `manual_merge`
- Sync orchestration must produce a merged snapshot first, then write back to local and/or remote targets.

## Audit And Rollback

- Durable asset mutations must create audit checkpoints when the change is meaningful.
- Rollback must restore a full snapshot rather than patching individual fields opportunistically.
- Remote sync flows should preserve audit history so account restore is possible after cross-device changes.

## Testing Rules

- Runtime-asset changes must ship with automated tests when they affect merge, migration, rollback, or remote sync behavior.
- At minimum, verify:
  - merge policy behavior
  - legacy-key migration into unified snapshot
  - audit creation
  - rollback restoration
  - remote envelope push/restore
  - build passes after registry sync

## Current Reference Files

- `services/runtime-assets/api.ts`
- `services/runtime-assets/local-user-assets.ts`
- `services/runtime-assets/remote-user-assets.ts`
- `services/runtime-assets/sync-merge.ts`
- `services/runtime-assets/sync-service.ts`
- `services/runtime-assets/audit-helpers.ts`
