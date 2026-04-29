# Encoding Archive Governance 2026-04-01

## Purpose

This document records the current classification of encoding-corrupted historical archives in the workspace.

Goal:

1. Prevent mojibake-contaminated backups from being reused as restore sources.
2. Separate live runnable files from historical broken archives.
3. Provide a safe recovery order without rewriting archive contents directly.

## Scope

Scanned scope:

1. `services/skills`
2. `pages/Workspace*`
3. `pages/Workspace/controllers/*`
4. `pages/Workspace/components/workflow/*`

Detection method:

1. Scan for common mojibake markers such as mixed broken CJK text, replacement-char output, and sequences like `Ã`, `Â`, `â`
2. Compare each polluted archive with:
   - current live file
   - nearby sibling backups
3. Only classify. Do not rewrite archive content in this pass.

## Current Live Status

Live `services/skills/*.ts` status:

1. `17 / 17` live skill files scanned clean.
2. No active skill file currently matched the mojibake marker scan.

Important note:

1. Current live files are not the main encoding risk.
2. The main risk is accidental reuse of contaminated historical backups.

## Recoverable Archives

Definition:

1. A polluted archive is considered recoverable when the repo already contains a clean current file or a clean sibling backup representing the same base file.

Recoverable list:

1. `services/skills/ecom-oneclick-workflow.skill.ts.bak-20260329-encoding-corrupt`
   - Marker count: `497`
   - Clean base exists: `services/skills/ecom-oneclick-workflow.skill.ts`
   - Many clean sibling backups also exist

2. `pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts.bak-20260330-corrupt-overlay-pass`
   - Marker count: `126`
   - Clean base exists: `pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts`

3. `pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts.bak-20260330-pre-clean-restore`
   - Marker count: `120`
   - Clean base exists: `pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts`

4. `pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx.bak-20260326-corrupted-before-restore`
   - Marker count: `51`
   - Clean base exists: `pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx`

5. `pages/Workspace/components/workflow/EcommerceOneClickCards.tsx.codex-backup-20260324-ui-decode.bak`
   - Marker count: `33`
   - Clean base exists: `pages/Workspace/components/workflow/EcommerceOneClickCards.tsx`

6. `pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts.codex-backup-20260324-183702.pre-restore.bak`
   - Marker count: `33`
   - Clean base exists: `pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts`

7. `pages/Workspace.tsx.codex-backup-20260324-103137.pre-mojibake-fix.bak`
   - Marker count: `7`
   - Clean base exists: `pages/Workspace.tsx`

## Not Precisely Recoverable

Definition:

1. The archive is polluted.
2. A clean functional equivalent exists.
3. But the archive identity is too vague to restore as an exact historical point-in-time version with confidence.

List:

1. `pages/Workspace.tsx.broken-backup`
   - Marker count: `35`
   - A clean current base exists: `pages/Workspace.tsx`
   - Multiple clean sibling backups exist
   - But the file name is generic and does not provide a trustworthy exact restore checkpoint

Recommended handling:

1. Treat as reference-only
2. Do not use as an automatic rollback source
3. If needed, rebuild intent from clean siblings instead of restoring this file directly

## Forensic Only

Definition:

1. Archive intentionally preserved to record a pre-fix state
2. Should never be used as a restore source

List:

1. `pages/Workspace/controllers/useWorkspaceDesignConsistency.ts.bak-20260401-165026-encoding-fix`
   - Marker count: `3`
   - This is the pre-fix snapshot made immediately before the live file was cleaned
   - Keep only for audit / forensic comparison

## Suggested Handling Order

Phase 1:

1. Mark all recoverable polluted archives as `do-not-restore`
2. Prefer current clean base files for any future restore operation

Phase 2:

1. Build a small restore-source allowlist for encoding-sensitive files
2. Exclude `broken`, `encoding-corrupt`, `pre-restore`, `ui-decode`, `pre-mojibake-fix` style names

Phase 3:

1. If archive cleanup is approved later, move polluted archives into a dedicated quarantine folder
2. Keep forensic-only snapshots separate from normal backups

## Safe Rules Going Forward

1. Never restore from a file whose name contains `encoding-corrupt`
2. Never restore from a file whose name contains `broken`
3. Never restore from a file whose name contains `pre-mojibake-fix`
4. Never restore from a file whose name contains `ui-decode`
5. Never restore from a file whose name contains `pre-restore`
6. For encoding-sensitive files, prefer:
   - current live file
   - latest clean sibling backup with zero marker hits

## Next Optional Step

If approved later, the next safe automation step is:

1. generate a machine-readable allowlist / denylist manifest for restore tooling
2. without modifying any historical archive content
