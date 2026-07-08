# Documentation Index

This repository keeps non-runtime documents under `docs/` to avoid cluttering the project root.

## Structure

- `docs/standards/`
  - AI-facing engineering standards and operating rules.
- `docs/architecture/`
  - module maps, refactor maps, and structure notes.
- `docs/product/`
  - PRDs, feature specs, implementation plans, and workflow notes.
- `docs/references/`
  - external references, research notes, and supporting material.
- Historical changelogs that referenced removed assistant-sidebar entry points
  have been deleted. Current assistant/sidebar guidance lives in
  `docs/architecture/PROJECT_MODULE_MAP.md` and
  `docs/architecture/WORKSPACE_REFACTOR_MAP.md`.
- `docs/templates/`
  - reusable handoff and task templates for Roo Code / AI-assisted collaboration.

## Quick Navigation

### Standards

- `docs/standards/AI_DEVELOPMENT_STANDARD.md`
  - project-specific execution standard for Codex and other AI agents.

### Architecture

- `docs/architecture/PROJECT_MODULE_MAP.md`
  - current project module relationship map.
- `docs/architecture/WORKSPACE_REFACTOR_MAP.md`
  - live refactor progress map for `pages/Workspace.tsx`.
- `docs/architecture/ROOT_DIRECTORY_POLICY.md`
  - rules for what is allowed to stay in the repository root.
- `docs/architecture/PROJECT_MODULE_MAP.md`
  - current module authority map for assistant-ui sidebar, canvas controllers, providers, storage, and removed legacy entry points.

### Product

- `docs/product/PRODUCT_SWAP_SPEC.md`
  - product-swap feature specification and implementation reference.
- `docs/product/CHIP_MARKER_EDIT_WORKFLOW_PLAN.md`
  - marker editing workflow optimization plan.
- `docs/roo-code-workflow.md`
  - project-level Roo Code modes, rules, and collaboration workflow.

### Templates

- `docs/templates/roo-task-template.md`
  - end-to-end handoff structure for PM -> architect -> coder -> debugger.
- `docs/templates/roo-pm-to-architect.md`
  - requirement handoff template.
- `docs/templates/roo-architect-to-coder.md`
  - implementation design handoff template.
- `docs/templates/roo-coder-to-debugger.md`
  - implementation-to-debug handoff template.
- `docs/templates/roo-debugger-report.md`
  - debugging report template.

### References

- `docs/references/API-CONFIGURATION-GUIDE.md`
  - API provider configuration guide.
- `docs/references/AMAZON_APPAREL_PRIMARY_IMAGE_ANGLE_LIBRARY.md`
  - clothing primary-image angle and shot reference library.
- `docs/references/Lovart-AI-Design-Platform.txt`
  - external reference notes related to Lovart.

### Removed Historical Notes

- Obsolete assistant-sidebar runtime logs, changelogs, and pre-assistant-ui
  implementation plans that referenced deleted `AssistantSidebar*.tsx`,
  `AgentMessage`, `useWorkspaceSend`, or `useWorkspaceSmartGenerate` entry
  points have been removed.
- Current sidebar work should follow
  `docs/architecture/PROJECT_MODULE_MAP.md` and
  `docs/architecture/WORKSPACE_REFACTOR_MAP.md`.

## Suggested Reading Order

For a new AI agent entering this repo, the recommended reading order is:

1. `docs/standards/AI_DEVELOPMENT_STANDARD.md`
2. `docs/architecture/ROOT_DIRECTORY_POLICY.md`
3. `docs/architecture/PROJECT_MODULE_MAP.md`
4. `docs/architecture/WORKSPACE_REFACTOR_MAP.md` if touching `Workspace.tsx`
5. `docs/architecture/PROJECT_MODULE_MAP.md` if touching sidebar intelligence, tool routing, or assistant-ui integration
6. `docs/roo-code-workflow.md` if using Roo Code / multi-role collaboration
7. product or reference documents relevant to the current task

## Non-doc support folders

- `scripts/`
  - ad hoc local utility scripts that are not part of the runtime app.
- `tmp/`
  - temporary analysis files, logs, scratch files, and one-off investigation output.
