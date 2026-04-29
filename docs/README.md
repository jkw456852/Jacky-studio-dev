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
- `docs/changelog/`
  - project change logs and historical update notes.
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

### Product

- `docs/product/PRODUCT_SWAP_SPEC.md`
  - product-swap feature specification and implementation reference.
- `docs/product/MULTI_AGENT_INTEGRATION_PRD.md`
  - multi-agent integration PRD.
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

### Changelog

- `docs/changelog/PROJECT_CHANGELOG.md`
  - historical project update notes.

## Suggested Reading Order

For a new AI agent entering this repo, the recommended reading order is:

1. `docs/standards/AI_DEVELOPMENT_STANDARD.md`
2. `docs/architecture/ROOT_DIRECTORY_POLICY.md`
3. `docs/architecture/PROJECT_MODULE_MAP.md`
4. `docs/architecture/WORKSPACE_REFACTOR_MAP.md` if touching `Workspace.tsx`
5. `docs/roo-code-workflow.md` if using Roo Code / multi-role collaboration
6. product or reference documents relevant to the current task

## Non-doc support folders

- `scripts/`
  - ad hoc local utility scripts that are not part of the runtime app.
- `tmp/`
  - temporary analysis files, logs, scratch files, and one-off investigation output.
