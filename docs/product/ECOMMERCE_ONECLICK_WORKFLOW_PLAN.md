# Ecommerce One-Click Workflow Plan

Last updated: 2026-03-24  
Owner: Codex implementation flow  
Scope: Workspace assistant-side staged ecommerce image workflow

## 1) Goal

Build a new staged workflow based on `新功能规划/使用说明.txt` and `01.png ~ 27.png`, then integrate it into existing Workspace architecture without coupling it into `ClothingStudio` internals.

Core user flow:

1. Upload product images + brief
2. AI product analysis
3. Supplement Q&A
4. Per-image analysis
5. Plan groups per output type
6. Model lock
7. Batch generation + retry + prompt rewrite + final download

## 2) Where It Should Be Added

### Type layer

- `types/workflow.types.ts`
- Add `EcommerceWorkflowStep` and `ecomOneClick.*` message variants into `WorkflowUiMessage`.

### Store layer

- `stores/ecommerceOneClick.store.ts` (parallel to clothing store)
- Session-based state keyed by topic/session id.

### Controller layer

- `pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts`
- Parallel to `useWorkspaceClothingWorkflow.ts`.

### UI rendering layer

- `pages/Workspace/components/workflow/EcommerceOneClickCards.tsx`
- Render by `message.workflowUi.type`.

### Workspace integration points

- `pages/Workspace.tsx`
- `handleSpecialSkillData` branch for `skillData.id === 'ecom-oneclick-workflow'`.
- Session wiring in `useWorkspaceConversationSession` via `setActiveEcommerceSession`.

### Quick skill entry

- `pages/Workspace/controllers/useAssistantSidebarQuickSkills.ts`
- `pages/Workspace/components/AssistantSidebarQuickSkills.tsx`
- New trigger for `ecom-oneclick-workflow`.

## 3) Data Model (Planned)

- `step: EcommerceWorkflowStep`
- `productImages`
- `description`
- `recommendedTypes`
- `supplementFields`
- `imageAnalyses`
- `planGroups`
- `modelOptions` + `selectedModelId`
- `batchJobs`
- `results`
- `progress`

## 4) Delivery Stages

### Stage A (MVP pipeline)

- Wire basic path:
  - quick-skill entry
  - special send route
  - workflow message rendering
  - basic session store
- Provide placeholder stages for product intake + type recommendation + draft plans.

### Stage B (analysis/planning completion)

- Replace placeholders with real skill calls:
  - `ecomAnalyzeProduct`
  - `ecomSupplementQuestions`
  - `ecomAnalyzeImages`
  - `ecomGeneratePlans`
- Add editable supplemental data and plan editing actions.

### Stage C (generation completion)

- Add model lock step and batch generation board:
  - `ecomBatchGenerate`
  - `ecomRewritePrompt`
- Add retry failed, per-item regenerate, and final download pack.

### Stage D (stability)

- Topic-memory snapshot restore and backtracking semantics.
- Type guards and strict validation.
- Full `tsc --noEmit` pass and regression check.

## 5) Current Progress Snapshot (as of 2026-03-24)

Completed:

- Extended workflow type skeleton in `types/workflow.types.ts` for `ecomOneClick.*`.
- Added new store file skeleton: `stores/ecommerceOneClick.store.ts`.
- Added new controller file skeleton: `pages/Workspace/controllers/useWorkspaceEcommerceWorkflow.ts`.
- Added new workflow cards file skeleton: `pages/Workspace/components/workflow/EcommerceOneClickCards.tsx`.
- Updated `AgentMessage` to split rendering by workflow prefix:
  - `clothingStudio.*` -> existing cards
  - `ecomOneClick.*` -> new cards
- Wired quick skill trigger for ecommerce one-click in:
  - `pages/Workspace/controllers/useAssistantSidebarQuickSkills.ts`
  - `pages/Workspace/components/AssistantSidebarQuickSkills.tsx`
- Wired Workspace routing and session activation:
  - `pages/Workspace.tsx` `handleSpecialSkillData` branch for `ecom-oneclick-workflow`
  - `pages/Workspace/controllers/useWorkspaceConversationSession.ts` adds `ensureEcommerceSession`
- Restored broken syntax in `pages/Workspace.tsx` (legacy encoding artifacts) and recovered compile stability.
- Replaced ecommerce placeholder pipeline with real skill-chain execution in `useWorkspaceEcommerceWorkflow.ts`:
  - `ecomAnalyzeProduct`
  - `ecomSupplementQuestions`
  - `ecomAnalyzeImages`
  - `ecomGeneratePlans`
- Added ecommerce upload + staged progress + model-lock/batch queue bootstrap in controller.
- Extended `EcommerceOneClickCards.tsx` to render:
  - `ecomOneClick.supplements`
  - `ecomOneClick.imageAnalyses`
- Added interactive ecommerce workflow actions:
  - model lock selection from workflow card
  - batch generation trigger from workflow card
  - retry failed batch jobs from workflow card
- Added initial `BATCH_GENERATE -> results` execution path using existing `generateImage` skill.
- Verified with:
  - `cmd /c node_modules\\.bin\\tsc --noEmit --pretty false` -> pass

In progress / not fully wired yet:

- Add editable supplement confirmation/actions from workflow card.
- Add topic-memory snapshot persistence/recovery for ecommerce workflow state.
- Expand generation controls (per-job rerun, prompt rewrite, result-to-canvas/download semantics).

Additional progress after the snapshot above:

- `ecomOneClick.supplements` save action is now fully wired from workflow card -> sidebar -> workspace -> controller.
- Saved supplement fields are written back into session state and injected into later batch-generation prompts.
- Assistant sidebar now exposes a persistent `电商一键工作流` entry even after a conversation already has messages, instead of hiding the entry only in empty sessions.
- `EcommerceOneClickCards.tsx` was rewritten to clean UTF-8 UI copy and now renders:
  - supplement editing in a stable form
  - per-job result thumbnails in batch queue
  - result gallery cards with download entry points
- Recommended output types are now editable and savable from the workflow card.
- Saving type selection now synchronizes:
  - `recommendedTypes`
  - filtered `planGroups`
  - rebuilt `batchJobs`
- Per-image analysis cards are now editable and savable from the workflow card.
- Saving image analyses now synchronizes:
  - `imageAnalyses`
  - usable reference-image selection for existing `planGroups`
- Per-image analysis cards now expose single-image retry, and rerun results are merged back into current session state.
- Plan groups are now editable and savable from the workflow card.
- Saving plan groups now synchronizes:
  - `planGroups`
  - rebuilt `batchJobs`
  - preserved valid existing `results` for unchanged plan items
- Each plan item now exposes:
  - AI prompt rewrite
  - single-item image generation
- AI rewrite is now implemented as a dedicated workflow skill:
  - `ecomRewritePrompt`
- Single-item generation now synchronizes:
  - current draft `planGroups`
  - matching `batchJobs` status/results
  - aggregated workflow `results`
- Ecommerce workflow snapshot is now persisted into topic memory and restored on conversation resume.
- Persisted snapshot now includes:
  - workflow step/progress
  - product images and generated results
  - recommended types / supplement fields / image analyses
  - plan groups / model selection / batch jobs
- Ecommerce result management is now interactive.
- Result cards and batch thumbnails now support:
  - promote/set as preferred result
  - delete result
  - bulk download from result gallery
- Result management now synchronizes:
  - `results`
  - matching `batchJobs.results`
  - follow-up workflow UI messages after deletion/promote
- Assistant sidebar now exposes a stateful ecommerce resume card with:
  - current workflow stage
  - next-step hint
  - quick counters for images / plans / results
- Repeated single-item reruns now carry clearer result labels via versioning (for example `v2`, `v3`).
- Result gallery now supports lightweight batch operations:
  - select multiple results
  - insert selected results to canvas
  - delete selected results
- Ecommerce result cards now expose `插入画布` and `下载` actions.

Additional progress in the current phase slice:

- Result gallery now also supports:
  - download selected results
  - promote selected results to the front of the preferred sequence
- `EcommerceOneClickCards.tsx` has been rebuilt and cleaned to restore stable UTF-8 Chinese UI copy.
- Result presentation is now clearer across batch cards and result gallery:
  - version badge parsing from labels such as `v2`
  - preferred-result badge
  - source cue / lightweight history count
- Plan cards now expose per-plan generated-result counts using current `batchJobs` state.
- Batch job cards now expose per-job result counts for easier review before reopening the result gallery.
- Assistant sidebar ecommerce resume card copy has been restored to stable UTF-8 Chinese text.
- Ecommerce workflow controller user-facing progress / status copy has been switched back to Chinese across:
  - workflow start
  - staged analysis/planning status
  - batch generation / retry status
  - failure feedback
- Result gallery now supports quick multi-select helpers:
  - select all results
  - clear selection
- Verified again with:
  - `cmd /c node_modules\\.bin\\tsc --noEmit --pretty false` -> pass

## 6) Resume Checklist (Do Next Without Re-planning)

1. Consider adding “resume from current stage” direct CTA variants instead of a single generic continue button.
2. Add stronger result grouping/history if the same plan item accumulates many reruns over time.
3. Consider batch operations for “set selected as preferred sequence” or “export selected pack”.
4. Keep `tsc` green after each stage slice.

Updated do-next list:

1. Replace remaining legacy mojibake / mixed-language UI copy in ecommerce cards with clean UTF-8 strings.
2. Add true node backtracking semantics so users can return to previous workflow stages from the in-card UI.
3. Consider adding true grouped sections in the result gallery when one plan item accumulates many reruns.
4. Keep `tsc` green after each stage slice.

## 6.1) UX Restructure Direction (Confirmed)

The current “chat card flood” implementation is no longer the target UX.

New direction:

- The chat area should keep only one persistent ecommerce workflow summary card for each conversation.
- Clicking that summary card opens a large slide-out workflow panel on top of the canvas area.
- The slide-out panel becomes the only place where the staged workflow is edited and advanced:
  - product upload
  - product analysis review
  - supplement confirmation
  - image analysis review
  - plan editing
  - model lock
  - batch generation
  - result review
- Closing the panel should be lightweight:
  - click close button
  - or click outside the panel / mask
- Re-clicking the summary card should reopen the same workflow session at the current step.
- The outer chat card should stay compact and clean:
  - current stage
  - overall status
  - short next-step hint
  - counters such as images / plans / results
  - open / resume CTA

Problems in the current UX that must be removed:

- Clicking the quick-skill currently feels like “immediate execution” with no onboarding or instruction.
- The first trigger lacks explicit guidance on what the user should do next.
- The chat timeline currently accumulates many workflow cards, which is too dense for a narrow sidebar.
- The workflow is visually fragmented across many messages instead of acting like one resumable task surface.

Replacement architecture:

- Keep session state in the existing ecommerce store.
- Reduce workflow chat messages to a single durable summary message or a dedicated sidebar summary card.
- Introduce a dedicated component such as:
  - `pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx`
- Introduce a compact trigger card component such as:
  - `pages/Workspace/components/workflow/EcommerceWorkflowSummaryCard.tsx`
- Introduce drawer UI state near `AssistantSidebar` / `Workspace` level:
  - `isEcommerceWorkflowOpen`
  - `openEcommerceWorkflow`
  - `closeEcommerceWorkflow`
- Rework quick-skill trigger behavior:
  - first click should open onboarding / empty workflow state
  - not silently fall through into normal single-image generation
  - not flood the message list with every stage card

Suggested implementation order:

1. Lock trigger semantics:
   - ecommerce quick skill opens / focuses workflow mode
   - if no product images exist, show empty-state guidance instead of sending normal generation
2. Build the slide-out workflow drawer shell with mask + close behaviors.
3. Move existing stage UIs from `EcommerceOneClickCards.tsx` into drawer sections.
4. Collapse chat rendering to one summary card / resume card.
5. Add backtracking and stronger step navigation inside the drawer.
6. Only after the drawer is stable, continue refining result grouping and batch operations.

Current implementation progress for this restructure:

- Added reusable ecommerce workflow UI helpers for:
  - summary text
  - next-step hints
  - workflow-message filtering in chat
- Added a reusable summary card component:
  - `pages/Workspace/components/workflow/EcommerceWorkflowSummaryCard.tsx`
- Added a canvas-side quick entry card:
  - `pages/Workspace/components/workflow/EcommerceCanvasQuickCard.tsx`
- Added a large slide-out workflow drawer shell:
  - `pages/Workspace/components/workflow/EcommerceWorkflowDrawer.tsx`
- Updated quick-skill trigger semantics:
  - clicking `电商一键工作流` now opens / resumes workflow mode instead of immediately flooding chat
- Updated assistant sidebar:
  - always shows one workflow summary card
  - no longer relies on stacked workflow chat cards as the main UX
- Updated message rendering:
  - ecommerce workflow messages are now filtered from the normal chat stream
  - the workflow is intended to be operated from the drawer instead
- Drawer empty state is now actionable instead of informational only:
  - users can upload product images directly inside the drawer
  - users can write the initial product brief directly inside the drawer
  - clicking `开始分析` now enters the real ecommerce workflow pipeline from the drawer
- Drawer step navigation is now semantically resumable:
  - users can backtrack to an earlier workflow stage from the step bar
  - backtracking now clears downstream state by stage instead of only changing `step`
  - backtracking while the workflow is actively executing is now blocked in the drawer UI
- Stage progression is now reconnected after backtracking:
  - saving output-type selection from `ANALYZE_PRODUCT` regenerates supplement questions
  - saving supplement fields from `SUPPLEMENT_INFO` reruns image analysis and plan generation
  - saving image analyses from `ANALYZE_IMAGES` reruns plan generation
  - saving plan groups from `PLAN_SCHEMES` returns the workflow to model lock
  - selecting a model from `LOCK_MODEL` advances the workflow into batch generation
- Result review in the drawer is now grouped more clearly:
  - generated results are grouped by matched plan item / batch-job source when possible
  - each group now surfaces version/history count, selected-count state, and whether it contains the preferred result
  - users can select an entire result group before running bulk actions such as download / insert / delete / promote
- Result review is now promoted into a dedicated drawer-native workbench:
  - added reusable component `pages/Workspace/components/workflow/EcommerceWorkflowResultReview.tsx`
  - `DONE` no longer relies only on a generic result card inside the drawer
  - `BATCH_GENERATE` can now show already-produced results in the same grouped review surface while jobs are still running
- The staged workflow bug has been fixed in the controller:
  - uploading product images and clicking `开始分析` now stops at `ANALYZE_PRODUCT`
  - steps 2 / 3 / 4 / 5 no longer auto-skip to `LOCK_MODEL`
  - supplements / image analyses / plans now generate only after the user confirms each previous stage
- Ecommerce workflow visible copy has been cleaned again:
  - `EcommerceOneClickCards.tsx` visible Chinese UI copy has been restored from mojibake
  - summary / quick-entry CTA labels now change by current stage instead of always showing a generic continue action
  - controller user-facing status / error text has been aligned back to Chinese for the staged flow
- Workflow resume and recovery affordances are now clearer:
  - summary card and canvas quick card now expose stage-specific CTA text instead of a generic `继续`
  - batch-stage summary now surfaces failed-job count directly in the compact entry cards
  - result review now also exposes `重试失败任务` from both normal state and empty-state recovery paths
- Result review bulk operations are now stronger:
  - result groups now expose direct actions for `下载本组` / `插入本组` / `本组设优选` / `导出本组清单`
  - result review bulk bar now supports `导出全部清单` and `导出已选清单`
  - summary entry cards now show progress text and progress ratio without opening the drawer
- Verified with:
  - `cmd /c node_modules\\.bin\\tsc --noEmit --pretty false` -> pass

## 7) Guardrails

- Keep ecommerce workflow isolated from clothing workflow.
- Keep changes incremental and compilable at each phase.
- Backup before each large phase.
- Do not touch unrelated unstable/encoding-fragile blocks unless required.
