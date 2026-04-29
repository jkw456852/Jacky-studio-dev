# Workspace.tsx Refactor Map

Target file: `pages/Workspace.tsx`
Last updated: 2026-03-24

## Current status

`Workspace.tsx` has already moved past the ?all business logic in one page? phase.
The real remaining pressure is now concentrated in a few large render helpers and page-level orchestration glue.

Current reality:
- Controller logic has been extracted into dedicated hooks.
- `Workspace.tsx` is back to a healthy compilable state.
- `tsc --noEmit` currently passes.
- Context menu, multi-select toolbar, and several image-toolbar UI shells have already been moved into components.
- Video toolbar UI has now been extracted into its own component as well.
- `AssistantSidebar -> InputArea` props have been regrouped by concern, and the shared prop-group types now come from `InputArea.tsx`.
- `AssistantSidebar` empty-state quick-skill panel now renders through `AssistantSidebarQuickSkills`.
- `AssistantSidebar` task-status banner rendering has been deduplicated into a single status branch.
- `AssistantSidebar` header/session toolbar now renders through `AssistantSidebarHeader`.
- `AssistantSidebar` bottom status banner now renders through `AssistantSidebarStatusBanner`.
- The extracted top toolbar, context menu, and floating toolbar components are now back in live use inside `Workspace.tsx`.
- The left-panel `layers` branch now renders `WorkspaceLayersPanel` in live JSX.
- The left-panel generated-files branch now renders `WorkspaceGeneratedFilesPanel` in live JSX.
- The left-panel shell now renders through `WorkspaceLeftPanel`.
- The focused-group breadcrumb/banner now renders through `WorkspaceFocusedGroupBanner`.
- The preview image modal now renders through `WorkspacePreviewModal`.
- The mode-switch confirmation dialog now renders through `WorkspaceModeSwitchDialog`.
- The feature-notice toast now renders through `WorkspaceFeatureNotice`.
- The touch-edit mode indicator now renders through `WorkspaceTouchEditIndicator`.
- The touch-edit popup now renders through `WorkspaceTouchEditPopup`.
- The page header bar now renders through `WorkspaceHeaderBar`.
- The custom Ctrl cursor now renders through `WorkspaceCtrlCursor`.
- The temporary `false && ...` legacy render guards have now been removed from `Workspace.tsx`.
- Stage backups now use a non-compiling `.tsx.bak` suffix so they no longer interfere with `tsc`.
- `Workspace.tsx` has started another dead-code cleanup pass at the top level, removing stale template data and unused inline helper components that no longer participate in the live page.
- The legacy inline `renderToolbar` / `renderContextMenu` / `renderTextToolbar` / `renderShapeToolbar` / `renderImageToolbar` / `renderGenVideoToolbar` / `renderMultiSelectToolbar` blocks have now been removed from `Workspace.tsx`.
- The old floating-menu state chain that only served those legacy render helpers has now been deleted from `Workspace.tsx`.
- The canvas `visibleElements.map(...)` entry path in `Workspace.tsx` has started to be decompressed: group-node rendering now flows through `WorkspaceCanvasGroupElement`, and visible canvas filtering is memoized instead of staying inline.
- The live canvas element map now also routes text-node rendering through `WorkspaceCanvasTextElement` and shape-node rendering through `WorkspaceCanvasShapeElement`.
- The live canvas element map now also routes image / generated-image rendering through `WorkspaceCanvasImageElement` and video / generated-video rendering through `WorkspaceCanvasVideoElement`.
- The marker/popup overlay inside the transformed canvas layer now renders through `WorkspaceCanvasMarkersLayer`.
- The common non-group canvas element wrapper now renders through `WorkspaceCanvasElementShell`.
- The remaining per-type canvas content dispatch now renders through `WorkspaceCanvasElementContent`.
- The transformed-canvas alignment guides now render through `WorkspaceAlignmentGuidesLayer`.
- The full visible-canvas element map now renders through `WorkspaceCanvasElementsLayer`.
- The transformed-canvas overlays and floating toolbar cluster now render through `WorkspaceCanvasOverlayLayer`.
- The page-level canvas stage shell now renders through `WorkspaceCanvasStage`.
- Long page-shell prop bundles for left panel, assistant sidebar, and canvas layers are now pre-grouped before JSX rendering.
- The page-level overlays/dialogs now render through `WorkspacePageOverlays`.
- The left-panel plus assistant-sidebar shell now renders through `WorkspaceSidebarLayer`.
- Page-shell composition props now assemble through `useWorkspacePageShellProps`.
- Canvas layer prop assembly now flows through `useWorkspaceCanvasLayerProps`.
- Canvas view-fit / manual-paste / download / context-menu actions now flow through `useWorkspaceCanvasViewActions`.
- Canvas state sync / history save / undo / redo orchestration now flows through `useWorkspaceCanvasStateHistory`.
- Canvas file-upload / drag-drop asset import now flows through `useWorkspaceCanvasAssetImport`.
- Canvas element creation for generic/image/video/text/shape insertion now flows through `useWorkspaceCanvasElementCreation`.
- Canvas pointer pan / marquee / drag / resize orchestration now flows through `useWorkspaceCanvasPointer`.
- Canvas pointer helper comparisons / drag-cache access now flow through `useWorkspaceCanvasPointerHelpers`.
- Canvas element interaction / marker placement / canvas-pick flows now flow through `useWorkspaceCanvasElementInteraction`.
- Element upscale / background-remove / text-edit / fast-edit actions now flow through `useWorkspaceElementEditActions`.
- Element update / delete / text-commit state mutations now flow through `useWorkspaceElementStateActions`.
- Image-tool upscale / eraser / vector-redraw actions now flow through `useWorkspaceImageToolActions`.
- Image/video reference upload actions now flow through `useWorkspaceElementReferenceUploads`.
- Marker-label save and input-block removal coordination now flow through `useWorkspaceMarkerInputActions`.
- Touch-edit analysis / execution actions now flow through `useWorkspaceTouchEditActions`.
- Shared element image-mutation helpers now flow through `useWorkspaceElementMutationHelpers`.
- Project/workspace bootstrap loading now flows through `useWorkspaceProjectLoader`.
- Conversation message persistence now flows through `useWorkspaceConversationPersistence`.
- Canvas-derived selectors/state now flow through `useWorkspaceDerivedCanvasState`.
- Conversation id / topic id / clothing-session orchestration now flows through `useWorkspaceConversationSession`.
- Model-preference state, mode-switch confirmation flow, and active image-model derivation now flow through `useWorkspaceModelPreferences`.
- Sidebar/left-panel prop assembly now flows through `useWorkspaceSidebarProps`.
- Assistant-sidebar conversation/history handlers and title derivation now flow through `useAssistantSidebarConversationUi`.
- Assistant-sidebar panel UI state, modal toggles, and task-status label derivation now flow through `useAssistantSidebarPanelUi`.
- Assistant-sidebar quick-skill preset state and send coordination now flow through `useAssistantSidebarQuickSkills`.
- `InputArea` object-URL lifecycle, file picking, image-paste handling, and pending-attachment commit flow now move through `useInputAreaFileHandling`.
- `InputArea` image/video media upload panel now renders through `InputAreaMediaUploadPanel`.
- `InputArea` file chips, pending-attachment chips, quick-skill badge, and marker-edit popover now render through dedicated subcomponents.
- `InputArea` bottom toolbar and hidden file-input entry now render through `InputAreaBottomToolbar`.
- `InputArea` mixed text/chip editor surface now renders through `InputAreaEditor`.
- Shared `Workspace.tsx` top-level constants, ratio helpers, image proxy helpers, and element URL helpers now start moving through `pages/Workspace/workspaceShared.tsx`.
- Workspace upscale sizing helpers and aspect-ratio derivation now also move through `pages/Workspace/workspaceShared.tsx`.
- The generic `getClosestAspectRatio` helper now also moves through `pages/Workspace/workspaceShared.tsx`.
- Repeated visible-canvas center-point math now starts moving through shared viewport/center helpers in `pages/Workspace/workspaceShared.tsx`.
- Workspace edit-session persistence and design-consistency helpers now start moving through `pages/Workspace/controllers/useWorkspaceDesignConsistency.ts`.
- Existing workspace controller hooks are now being reconnected into the live page for product-swap and image-regeneration flows, reducing duplicated inline implementations inside `Workspace.tsx`.
- Existing workspace controller hooks are now also being reconnected into the live page for video-generation flows, reducing another large inline handler inside `Workspace.tsx`.
- The existing `useWorkspaceClothingWorkflow` controller is now reconnected into the live page for workflow UI messaging, model selection/generation, result insertion, retry handling, and the clothing-studio `handleSend` branch.
- Text-toolbar popover UI state now flows through `useWorkspaceTextToolbarUi`.
- Multi-select menu state and selection transforms now flow through `useWorkspaceMultiSelectTools`.

## Completed extractions

### Controller hooks

These controller hooks are already extracted and wired into `Workspace.tsx`:
- `pages/Workspace/controllers/useWorkspaceSend.ts`
- `pages/Workspace/controllers/useWorkspaceClothingWorkflow.ts`
- `pages/Workspace/controllers/useWorkspaceSmartGenerate.ts`
- `pages/Workspace/controllers/useWorkspaceTouchEditActions.ts`
- `pages/Workspace/controllers/useWorkspaceElementImageGeneration.ts`
- `pages/Workspace/controllers/useWorkspaceElementEditing.ts`
- `pages/Workspace/controllers/useWorkspaceElementVideoGeneration.ts`
- `pages/Workspace/controllers/useWorkspaceProductSwap.ts`
- `pages/Workspace/controllers/useWorkspaceTextEditing.ts`
- `pages/Workspace/controllers/useAssistantSidebarConversationUi.ts`
- `pages/Workspace/controllers/useAssistantSidebarPanelUi.ts`
- `pages/Workspace/controllers/useAssistantSidebarQuickSkills.ts`
- `pages/Workspace/controllers/useInputAreaFileHandling.ts`
- `pages/Workspace/controllers/useWorkspaceCanvasPointer.ts`
- `pages/Workspace/controllers/useWorkspaceCanvasPointerHelpers.ts`
- `pages/Workspace/controllers/useWorkspaceCanvasStateHistory.ts`
- `pages/Workspace/controllers/useWorkspaceCanvasElementInteraction.ts`
- `pages/Workspace/controllers/useWorkspaceCanvasViewActions.ts`
- `pages/Workspace/controllers/useWorkspaceCanvasLayerProps.ts`
- `pages/Workspace/controllers/useWorkspaceCanvasAssetImport.ts`
- `pages/Workspace/controllers/useWorkspaceCanvasElementCreation.ts`
- `pages/Workspace/controllers/useWorkspaceElementEditActions.ts`
- `pages/Workspace/controllers/useWorkspaceElementStateActions.ts`
- `pages/Workspace/controllers/useWorkspaceImageToolActions.ts`
- `pages/Workspace/controllers/useWorkspaceElementReferenceUploads.ts`
- `pages/Workspace/controllers/useWorkspaceMarkerInputActions.ts`
- `pages/Workspace/controllers/useWorkspaceElementMutationHelpers.ts`
- `pages/Workspace/controllers/useWorkspaceConversationPersistence.ts`
- `pages/Workspace/controllers/useWorkspaceConversationSession.ts`
- `pages/Workspace/controllers/useWorkspaceDesignConsistency.ts`
- `pages/Workspace/controllers/useWorkspaceDerivedCanvasState.ts`
- `pages/Workspace/controllers/useWorkspaceModelPreferences.ts`
- `pages/Workspace/controllers/useWorkspaceMultiSelectTools.ts`
- `pages/Workspace/controllers/useWorkspacePageShellProps.ts`
- `pages/Workspace/controllers/useWorkspaceProjectLoader.ts`
- `pages/Workspace/controllers/useWorkspaceSidebarProps.ts`
- `pages/Workspace/controllers/useWorkspaceTextToolbarUi.ts`

### UI/render components

These UI blocks are already extracted from `Workspace.tsx`:
- `pages/Workspace/components/WorkspaceContextMenu.tsx`
- `pages/Workspace/components/WorkspaceCanvasGroupElement.tsx`
- `pages/Workspace/components/WorkspaceCanvasElementContent.tsx`
- `pages/Workspace/components/WorkspaceCanvasElementsLayer.tsx`
- `pages/Workspace/components/WorkspaceCanvasElementShell.tsx`
- `pages/Workspace/components/WorkspaceCanvasImageElement.tsx`
- `pages/Workspace/components/WorkspaceCanvasMarkersLayer.tsx`
- `pages/Workspace/components/WorkspaceCanvasOverlayLayer.tsx`
- `pages/Workspace/components/WorkspaceCanvasStage.tsx`
- `pages/Workspace/components/WorkspacePageOverlays.tsx`
- `pages/Workspace/components/WorkspaceSidebarLayer.tsx`
- `pages/Workspace/components/WorkspaceCanvasShapeElement.tsx`
- `pages/Workspace/components/WorkspaceCanvasTextElement.tsx`
- `pages/Workspace/components/WorkspaceCanvasVideoElement.tsx`
- `pages/Workspace/components/WorkspaceAlignmentGuidesLayer.tsx`
- `pages/Workspace/components/WorkspaceCtrlCursor.tsx`
- `pages/Workspace/components/WorkspaceFeatureNotice.tsx`
- `pages/Workspace/components/WorkspaceFocusedGroupBanner.tsx`
- `pages/Workspace/components/WorkspaceGeneratedFilesPanel.tsx`
- `pages/Workspace/components/WorkspaceHeaderBar.tsx`
- `pages/Workspace/components/WorkspaceLayersPanel.tsx`
- `pages/Workspace/components/WorkspaceLeftPanel.tsx`
- `pages/Workspace/components/WorkspaceModeSwitchDialog.tsx`
- `pages/Workspace/components/WorkspaceMultiSelectToolbar.tsx`
- `pages/Workspace/components/WorkspacePreviewModal.tsx`
- `pages/Workspace/components/WorkspaceImageConfigPanel.tsx`
- `pages/Workspace/components/WorkspaceImageTextEditModal.tsx`
- `pages/Workspace/components/WorkspaceImageFastEditPanel.tsx`
- `pages/Workspace/components/WorkspaceImageSideToolbar.tsx`
- `pages/Workspace/components/WorkspaceImageEraserOverlay.tsx`
- `pages/Workspace/components/WorkspaceShapeToolbar.tsx`
- `pages/Workspace/components/WorkspaceTextToolbar.tsx`
- `pages/Workspace/components/WorkspaceTouchEditIndicator.tsx`
- `pages/Workspace/components/WorkspaceTouchEditPopup.tsx`
- `pages/Workspace/components/WorkspaceTopToolbar.tsx`
- `pages/Workspace/components/WorkspaceVideoToolbar.tsx`
- `pages/Workspace/components/WorkspaceImageToolbar.tsx`
- `pages/Workspace/components/AssistantSidebarFilesPopover.tsx`
- `pages/Workspace/components/AssistantSidebarHeader.tsx`
- `pages/Workspace/components/AssistantSidebarHistoryPopover.tsx`
- `pages/Workspace/components/AssistantSidebarQuickSkills.tsx`
- `pages/Workspace/components/AssistantSidebarStatusBanner.tsx`
- `pages/Workspace/components/InputAreaFileBlock.tsx`
- `pages/Workspace/components/InputAreaBottomToolbar.tsx`
- `pages/Workspace/components/InputAreaEditor.tsx`
- `pages/Workspace/components/InputAreaMarkerEditPopover.tsx`
- `pages/Workspace/components/InputAreaMediaUploadPanel.tsx`
- `pages/Workspace/components/InputAreaPendingAttachments.tsx`
- `pages/Workspace/components/InputAreaQuickSkillBadge.tsx`

## What changed most recently

Latest completed step:
- Extracted `saveToHistory`, synced element/marker setters, append-history helpers, and undo/redo into `useWorkspaceCanvasStateHistory`, removing another shared page-level state/history cluster from `Workspace.tsx`.
- Extracted the canvas-pointer support helpers (`setSelectedElementIdsIfChanged`, `setMarqueeEndIfChanged`, `setAlignGuidesIfChanged`, `getCachedDragOthers`) into `useWorkspaceCanvasPointerHelpers`.
- Extracted marker-label save and input-block removal coordination into `useWorkspaceMarkerInputActions`, so `Workspace.tsx` no longer owns that marker/input synchronization logic inline.
- Continued shrinking `Workspace.tsx` to roughly 2339 lines while keeping `tsc --noEmit` green.
- Extracted the remaining image-tool action cluster into `useWorkspaceImageToolActions`, moving upscale selection, eraser session init/reset/execute, and vector redraw orchestration out of `Workspace.tsx`.
- Rewired `WorkspaceImageToolbar` so eraser close/reset now comes from the shared controller path instead of a component-local inline reset branch.
- Extracted image/video reference-upload handlers into `useWorkspaceElementReferenceUploads`, so `Workspace.tsx` no longer owns those async file-to-element update flows inline.
- Extracted selected-element update/delete and text-edit commit mutations into `useWorkspaceElementStateActions`, consolidating another page-local state/history mutation cluster behind a dedicated controller.
- Folded the page-level context-menu opener into `useWorkspaceCanvasViewActions`, so another small page-local shell handler is gone.
- Reconnected the existing `useWorkspaceSmartGenerate` controller into the live page so proposal execution and smart image-generation orchestration are no longer page-local inline blocks.
- Reconnected the existing `useWorkspaceSend` controller into the live page so general agent-send orchestration, research enrichment, and request metadata assembly are no longer page-local inline blocks.
- Extracted touch-edit analysis / execute orchestration into `useWorkspaceTouchEditActions` and removed the old inline touch-edit handlers from `Workspace.tsx`.
- Continued shrinking `Workspace.tsx` to roughly 3045 lines while keeping `tsc --noEmit` green.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Reconnected the existing `useWorkspaceCanvasPointer` controller into the live page for pan / marquee / drag / resize pointer orchestration.
- Reconnected the existing `useWorkspaceCanvasElementInteraction` controller into the live page for canvas picking, marker placement, element selection/drag start, and resize-start orchestration.
- Reconnected `useWorkspaceCanvasViewActions` and `useWorkspaceElementEditActions` into the live page so view actions and image-edit actions are no longer page-local implementation islands.
- Removed the now-dead inline pointer and element-interaction handler blocks from `Workspace.tsx`, dropping the file to roughly 3600 lines while keeping `tsc --noEmit` green.
- Moved marker-crop image utility into `useWorkspaceCanvasElementInteraction` so `Workspace.tsx` no longer owns that local image-cropping helper.
- Removed an unused page-local marker deletion helper after confirming it no longer participates in the live page.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted shared element image-mutation helpers into `useWorkspaceElementMutationHelpers`.
- Rewired `Workspace.tsx` to consume the new helper hook for `urlToBase64`, generated-image application, and element generating-state mutation instead of keeping those cross-feature helpers inline.
- Continued shrinking `Workspace.tsx` by removing another page-local helper cluster after the extracted mutation hook compiled cleanly.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted page-local canvas element creation into `useWorkspaceCanvasElementCreation`.
- Rewired `Workspace.tsx` to consume the new controller hook for adding base image/video elements, shapes, text nodes, text-at-point insertion, generated-image placeholders, and generated-video placeholders.
- Continued shrinking `Workspace.tsx` by removing another large page-local creation cluster after the controller path compiled cleanly.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted canvas file-upload and drag/drop asset import orchestration into `useWorkspaceCanvasAssetImport`.
- Rewired `Workspace.tsx` to consume the new controller hook for local file placement instead of owning the async image/video import flows inline.
- Removed another batch of fully dead commented legacy blocks from `Workspace.tsx`, including old layer-item, clothing-workflow, product-swap, image-generation, and video-generation implementations.
- Reused shared viewport/center helpers to collapse repeated visible-canvas center-point math across the page.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Reconnected the existing `useWorkspaceClothingWorkflow` controller into the live page for clothing workflow orchestration.
- Routed the clothing-studio `handleSend` branch through the controller hook instead of keeping another large page-local inline workflow implementation active.
- Removed the now-dead inline clothing workflow implementation after the controller path was verified live and stable.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted `getClosestAspectRatio` from `Workspace.tsx` into `pages/Workspace/workspaceShared.tsx`.
- Rewired remaining page call sites to consume the shared aspect-ratio helper instead of keeping a page-local copy.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Reconnected the existing `useWorkspaceElementVideoGeneration` controller into the live page for canvas video generation.
- Reduced another large inline `Workspace.tsx` generation handler by routing it through a dedicated controller hook instead of page-local implementation.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Reconnected the existing `useWorkspaceProductSwap` controller into the live page for product-swap execution.
- Reconnected the existing `useWorkspaceElementImageGeneration` controller into the live page for canvas image re-generation.
- Reduced another pair of large inline `Workspace.tsx` handlers by routing them through dedicated controller hooks instead of page-local implementations.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted `Workspace.tsx` upscale-factor, source-size, target-size, and nearest-aspect-ratio helpers into `pages/Workspace/workspaceShared.tsx`.
- Rewired the page to consume those shared helpers instead of owning inline sizing math, trimming another small batch of top-level page noise.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted `Workspace.tsx` edit-session persistence and core design-consistency helpers into `useWorkspaceDesignConsistency`.
- Rewired the page to consume the new controller hook for session persistence, consistency context derivation, and approved-anchor validation instead of owning those helper implementations inline.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted another batch of top-level `Workspace.tsx` shared code into `pages/Workspace/workspaceShared.tsx`, including aspect-ratio config, font config, proxy/image helper utilities, viewport sizing helpers, and canvas element URL helpers.
- Rewired `Workspace.tsx` to import those shared helpers instead of owning them inline, reducing page-level top clutter and making the file more page-shell oriented.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Removed another batch of dead top-level `Workspace.tsx` code, including stale template/video-ratio config and unused inline helper components that were no longer referenced by the live page shell.
- Re-verified after the cleanup so the page keeps shrinking without regressing behavior.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted the mixed text/chip editor surface from `InputArea` into `InputAreaEditor`.
- Moved the contenteditable text-block render path, chip keyboard navigation, pending-attachment strip, and editor click/focus coordination out of `InputArea.tsx`.
- Cleaned the now-dead editor helpers/imports from `InputArea.tsx`, keeping it focused on store wiring plus high-level composition.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted the large bottom toolbar from `InputArea` into `InputAreaBottomToolbar`.
- Moved the hidden file-input entry path under the new bottom-toolbar component so upload entry behavior stays co-located with toolbar controls.
- Removed another large batch of now-dead inline toolbar/constants code from `InputArea.tsx`, dropping the file notably further.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted `InputArea` file/marker chip rendering into `InputAreaFileBlock`.
- Extracted pending-attachment chip rendering into `InputAreaPendingAttachments`.
- Extracted the active quick-skill badge into `InputAreaQuickSkillBadge`.
- Extracted the marker-edit popover into `InputAreaMarkerEditPopover`.
- Continued shrinking `InputArea` render density without touching the higher-risk text-editor keyboard state machine.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted the image/video upload panel from `InputArea` into `InputAreaMediaUploadPanel`.
- Reduced `InputArea` render bulk by moving media-upload UI and its local picker/remove interactions out of the main composer file.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted `AssistantSidebar` shell-level panel UI state, popover toggles, and task-status label derivation into `useAssistantSidebarPanelUi`.
- Reduced `AssistantSidebar` further toward a composition shell by removing inline popover toggle state and task-status branching from the component body.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted `AssistantSidebar` quick-skill preset/session synchronization into `useAssistantSidebarQuickSkills`.
- Extracted `InputArea` file/object-URL lifecycle, image-paste handling, drag/drop and picker routing, plus pending-attachment commit helpers into `useInputAreaFileHandling`.
- Rewired `InputArea` to consume the new file-handling hook and removed the duplicated local implementations.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted `AssistantSidebar` conversation-history handlers and active-conversation title derivation into `useAssistantSidebarConversationUi`.
- Continued reducing `AssistantSidebar` orchestration density so the remaining complexity is increasingly in quick-skill state and message/input coordination rather than session CRUD wiring.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted the large project/bootstrap restore flow for `Workspace.tsx` into `useWorkspaceProjectLoader`, including project reset, IndexedDB restore, initial route prompt hydration, background asset injection, and default chat-session bootstrapping.
- Extracted conversation message persistence into `useWorkspaceConversationPersistence`, so `Workspace.tsx` no longer owns the inline `messages -> conversations` synchronization effect.
- Removed another small batch of now-dead `Workspace.tsx` local plumbing after the lifecycle extraction.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted conversation-id creation, topic-memory key derivation, and clothing-session activation helpers into `useWorkspaceConversationSession`.
- Reused the extracted session/topic controller inside `Workspace.tsx` so page-level clothing workflow orchestration depends less on inline helper plumbing.
- Renamed several `docs/` files to stable ASCII filenames and updated the docs index so future AI/file-path handling is less encoding-sensitive.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Removed the dead local export-menu state and unused inline export handler from `Workspace.tsx` after confirming they were no longer wired into the live page.
- Extracted model-preference panel state, image-model localStorage sync, mode-switch confirmation flow, and `activeImageModel` derivation into `useWorkspaceModelPreferences`.
- Reduced prop-surface noise in `Workspace.tsx` by passing grouped `modelPreferences` and a grouped `modeSwitchDialog` object into the existing page-shell/sidebar prop builders.
- Continued shrinking `Workspace.tsx` page-orchestration density without touching the higher-risk canvas interaction core.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.
- Extracted text-toolbar popover UI state/effects into `useWorkspaceTextToolbarUi`.
- Extracted multi-select menu state and align/group handlers into `useWorkspaceMultiSelectTools`.
- Extracted sidebar/left-panel prop assembly into `useWorkspaceSidebarProps`.
- Continued shrinking `Workspace.tsx` controller density by moving additional UI state and grouped handlers into dedicated workspace hooks.
- Extracted derived canvas selectors/state into `useWorkspaceDerivedCanvasState`.
- Continued shrinking `Workspace.tsx` by moving `elementById`, `selectedElement`, `visibleCanvasElements`, and `rootElements` derivation out of the page file.
- Extracted canvas layer prop assembly into `useWorkspaceCanvasLayerProps`.
- Extracted page-shell composition prop assembly into `useWorkspacePageShellProps`.
- Continued shrinking `Workspace.tsx` by moving large prop-object construction out of the page file and into dedicated workspace controller hooks.
- Extracted page-level overlays/dialogs into `WorkspacePageOverlays`.
- Extracted the left-panel plus assistant-sidebar shell into `WorkspaceSidebarLayer`.
- Continued shrinking `Workspace.tsx` page-shell JSX so the file now composes shell sections at a higher level.
- Extracted the page-level canvas stage shell into `WorkspaceCanvasStage`, moving the Ctrl cursor, header bar, bottom toolbar, canvas viewport, marquee, and layer composition out of `Workspace.tsx`.
- Pre-grouped long page-level prop bundles for `WorkspaceLeftPanel`, `AssistantSidebar`, `WorkspaceCanvasElementsLayer`, and `WorkspaceCanvasOverlayLayer` before JSX rendering.
- Continued shrinking `Workspace.tsx` from render bulk toward orchestration-only composition.
- Extracted the transformed-canvas overlay cluster into `WorkspaceCanvasOverlayLayer`, so `Workspace.tsx` no longer renders guides, markers, and the floating toolbar stack inline.
- Extracted the full visible-canvas render map into `WorkspaceCanvasElementsLayer`, so `Workspace.tsx` no longer owns the per-element map branch inline.
- Continued shrinking the transformed canvas section so the page-level JSX now mostly composes canvas sub-layers instead of rendering them directly.
- Extracted the transformed-canvas alignment guide overlay into `WorkspaceAlignmentGuidesLayer`.
- Extracted the remaining per-type canvas content dispatch into `WorkspaceCanvasElementContent`.
- Continued shrinking the live canvas render section so `Workspace.tsx` now mainly coordinates group rendering, shell wiring, overlays, and toolbars instead of owning per-type child JSX.
- Extracted the common non-group canvas element wrapper into `WorkspaceCanvasElementShell`.
- Removed another small batch of now-dead inline wrapper JSX and the stale unused local scale calculations from `Workspace.tsx`.
- Extracted the transformed-canvas marker / marker-popover layer into `WorkspaceCanvasMarkersLayer`.
- Continued shrinking the live canvas render section so `Workspace.tsx` now delegates both marker overlays and the generic non-group element shell.
- Extracted the live canvas image / generated-image branch into `WorkspaceCanvasImageElement`.
- Extracted the live canvas video / generated-video branch into `WorkspaceCanvasVideoElement`.
- Continued shrinking the active `visibleCanvasElements.map(...)` branch in `Workspace.tsx` so the page-level render path now delegates all major element-type branches.
- Extracted the live canvas text-element branch into `WorkspaceCanvasTextElement`.
- Extracted the live canvas shape-element branch into `WorkspaceCanvasShapeElement`.
- Continued shrinking the active `visibleCanvasElements.map(...)` branch in `Workspace.tsx` so the page-level render path owns less per-element JSX directly.
- Extracted group-node rendering from the canvas element map into `WorkspaceCanvasGroupElement`.
- Replaced the inline canvas visibility IIFE with memoized `visibleCanvasElements` filtering and reused `elementById` for parent-group lookups.
- Removed another small batch of now-dead `Workspace.tsx` imports after the canvas group extraction.
- Removed the dead legacy inline render-helper block from `Workspace.tsx`, including the old toolbar, context-menu, text-toolbar, shape-toolbar, image-toolbar, video-toolbar, and multi-select-toolbar JSX implementations.
- Recovered only the still-live multi-select alignment / spacing / grouping handlers after the legacy block removal so the extracted `WorkspaceMultiSelectToolbar` keeps working without reintroducing the old JSX.
- Removed the old floating insert/shape/tool menu state and timer refs that became dead after the legacy render-helper cleanup.
- Extracted the `AssistantSidebar` header/session toolbar into `AssistantSidebarHeader`.
- Extracted the bottom task-status banner into `AssistantSidebarStatusBanner`.
- Removed dead local sidebar code such as the unused storyboard activation handler and unused local store actions.
- Compressed repeated quick-skill send handlers behind shared preset skill objects and a unified send helper.
- Extracted the empty-state quick-skill panel out of `AssistantSidebar` into `AssistantSidebarQuickSkills`.
- Replaced the old inline quick-skill JSX with a single component call wired to dedicated handlers.
- Removed now-dead icon/store imports from `AssistantSidebar` after the quick-skill extraction.
- Collapsed duplicated `analyzing` / `executing` task-status JSX into one render branch inside `AssistantSidebar`.
- Completed the `AssistantSidebar -> InputArea` grouped-prop migration.
- Reused `InputArea` prop-group types inside `AssistantSidebar` to remove duplicate type shapes.
- Recovered `Workspace.tsx` from an encoding-sensitive edit path and re-verified the page with `tsc`.
- Reconnected `WorkspaceTopToolbar`, `WorkspaceContextMenu`, `WorkspaceImageToolbar`, `WorkspaceVideoToolbar`, `WorkspaceMultiSelectToolbar`, `WorkspaceTextToolbar`, and `WorkspaceShapeToolbar` into the live page JSX.
- Reconnected `WorkspaceLayersPanel` into the live left-panel `layers` branch.
- Extracted and connected `WorkspaceGeneratedFilesPanel` into the live left-panel generated-files branch.
- Extracted and connected `WorkspaceLeftPanel` as the live left-panel shell.
- Extracted and connected `WorkspaceFocusedGroupBanner` into the live page shell.
- Extracted and connected `WorkspacePreviewModal` into the live page shell.
- Extracted and connected `WorkspaceModeSwitchDialog` into the live page shell.
- Extracted and connected `WorkspaceFeatureNotice` into the live page shell.
- Extracted and connected `WorkspaceTouchEditIndicator` into the live page shell.
- Extracted and connected `WorkspaceTouchEditPopup` into the live page shell.
- Extracted and connected `WorkspaceHeaderBar` into the live page shell.
- Extracted and connected `WorkspaceCtrlCursor` into the live page shell.
- Removed the temporary guarded legacy JSX for the mode-switch dialog, header bar, feature notice, touch-edit overlays, and left-panel shell.
- Continued shrinking `Workspace -> AssistantSidebar` by grouping session, panel UI, message actions, and clothing workflow callbacks.
- Simplified `AssistantSidebar -> InputArea` passthrough so grouped `inputUi` and `modelPreferences` objects are forwarded directly.
- Grouped clothing workflow callbacks through `AssistantSidebar -> MessageList -> AgentMessage`.
- Extracted the generated-files popover out of `AssistantSidebar` into `AssistantSidebarFilesPopover`.
- Extracted the history popover out of `AssistantSidebar` into `AssistantSidebarHistoryPopover`.
- Extracted `renderGenVideoToolbar` into `WorkspaceVideoToolbar`.
- Extracted `renderTextToolbar` into `WorkspaceTextToolbar`.
- Extracted `renderShapeToolbar` into `WorkspaceShapeToolbar`.
- Extracted `renderToolbar` into `WorkspaceTopToolbar`.
- Extracted the remaining `renderImageToolbar` logic into `WorkspaceImageToolbar`.
- The extracted toolbar components are now rendered directly in the final JSX instead of going through local render-wrapper helpers.
- A first pass of obvious dead state, dead helper, and unused import cleanup has now been completed in `Workspace.tsx`.
- The `Workspace -> AssistantSidebar` prop surface has started to be grouped by concern instead of staying as one long flat parameter list.
- The `AssistantSidebar -> InputArea` prop surface is now grouped as `composer`, `inputUi`, and `modelPreferences`.
- Video generated-state toolbar and config-state UI both live in the new component.
- Text formatting toolbar and its popover portals now live in the new component.
- Shape styling toolbar now lives in the new component.
- The main floating top toolbar and its nested menus now live in the new component.
- The remaining image-toolbar branching, modal routing, eraser interaction, and fast-edit composition now live in the new component.
- Verification passed with `cmd /c node_modules\.bin\tsc --noEmit --pretty false`.

## Remaining high-value targets

### P1: assistant/input orchestration density

Why it still matters:
- `Workspace.tsx` is no longer blocked by toolbar helper sprawl, but page-to-sidebar wiring is still broad.
- `InputArea.tsx` remains very large, so prop grouping is only the first step.
- `AssistantSidebar` is slimmer than before, but it still owns a dense mix of quick-skill state, conversation/session state, message/file modal UI, and input wiring.

Suggested direction:
- Continue shrinking `InputArea` prop surface.
- Continue shrinking `AssistantSidebar` prop and local UI surface now that its outer prop groups are in place.
- Continue splitting or compressing remaining `AssistantSidebar` internal logic, especially conversation state and quick-skill state that still live together in the same file.
- Decide whether some `InputArea` local UI state belongs in a dedicated hook.
- Keep consolidating cross-component type shapes instead of duplicating them.

### P2: left-panel and page-shell legacy cleanup

Why it still matters:
- The highest-value legacy guarded JSX has now been removed.
- The highest-value dead inline render-helper block has now also been removed.
- `Workspace.tsx` is cleaner, but the remaining density is now concentrated primarily in non-render controller/state logic rather than inline page JSX or giant prop-object assembly.

Suggested direction:
- Continue extracting page-level orchestration groupings where the boundaries are clear, especially remaining modal/panel orchestration and stateful helper clusters.
- Continue extracting any remaining active page-shell blocks where the boundaries are clear.
- Shift focus toward prop-surface reduction and orchestration cleanup only after the remaining canvas render density stops dominating the file.

## Recommended next order

1. Continue shrinking remaining page-shell orchestration around dialogs, overlays, and side panels.
2. Reduce prop-surface and state-plumbing density now that the major canvas/stage render shells are extracted.
3. Return to `AssistantSidebar` / `InputArea` prop-surface cleanup once the remaining workspace page shell is mostly composition plus controllers.

Current note:
- `renderToolbar`, `renderGenVideoToolbar`, `renderTextToolbar`, `renderShapeToolbar`, and `renderImageToolbar` have all been flattened into direct JSX usage.
- `Workspace.tsx` now behaves much more like a page orchestration layer plus a small set of remaining cross-cutting handlers.
- The obvious unused imports, unused toolbar leftovers, and dead local helpers in `Workspace.tsx` have been pruned, and local unused diagnostics for this file are currently at zero.
- The top toolbar, context menu, and floating toolbars are again rendered through their extracted components in live JSX.
- The active page shell is increasingly becoming an orchestration layer around extracted overlays and panels.
- Feature notices, touch-edit overlays, the page header, and the custom Ctrl cursor are now also routed through extracted components in live JSX.
- Inside `AssistantSidebar`, files/history popovers and the quick-skill empty state are now all extracted components rather than inline render blocks.
- `AssistantSidebar` header chrome and bottom status banner are now also extracted, and the remaining density is increasingly in state/handler orchestration rather than JSX bulk.
- `Workspace.tsx` no longer carries the old dead inline render implementations for the extracted top toolbar, context menu, text toolbar, shape toolbar, image toolbar, video toolbar, and multi-select toolbar.
- The live canvas render path has now started to split as well: group elements no longer render inline inside the main `visibleElements.map(...)` branch.
- The live canvas render path now routes all major element-type branches through extracted components, and the remaining density in `Workspace.tsx` is increasingly in the final dispatch layer and page-level orchestration.
- The transformed-canvas markers layer and the common non-group element shell are both now extracted, which leaves the next obvious canvas target as the remaining type-dispatch JSX inside `visibleCanvasElements.map(...)`.
- The transformed-canvas alignment guides and the per-type canvas content dispatch are now also extracted, so the canvas map is close to becoming a thin orchestration wrapper.
- The visible canvas map and overlay/toolbar cluster are now both extracted as dedicated layer components, which means the next gains will come less from JSX extraction and more from prop-surface/orchestration cleanup.
- The full canvas stage shell is now also extracted, so `Workspace.tsx` is shifting from a giant render file toward a page orchestrator with grouped props and controller logic.
- Large page-shell and canvas-layer prop builders now also live in dedicated workspace controller hooks, which further reduces `Workspace.tsx` as a coordination surface.
- The temporary guarded legacy render blocks have been removed, and the next meaningful cleanup direction is now deeper `AssistantSidebar` / `InputArea` reduction plus any remaining page-shell cleanup.

## Risks to watch

### 1. Props bloat

As more render helpers become components, props can grow quickly.
This is acceptable short-term, but it is a signal that some local state may eventually need regrouping.

### 2. Page-level closure coupling

Some handlers are still page-owned by design.
For now, keep behavior in `Workspace.tsx` and extract UI shells first.
That remains the safest migration path.

### 3. Encoding-sensitive edits

This file and `Workspace.tsx` both had prior encoding issues.
Safe practice remains:
- extract first,
- delete old inline JSX second,
- run `tsc` after each step.
- avoid broad rewrite-style file rewrites unless there is a rollback path, because encoding glitches can cascade quickly in this repo.

## Short verdict

The main problem in `Workspace.tsx` is no longer business-logic overload.
The remaining work is now mostly page-level orchestration and prop-surface cleanup rather than raw render bulk.
