# Main Brain Internal Interface

## Purpose

This document defines how the unified sidebar "main brain" should interact with internal workspace capabilities.

The governing principles are:

- The main brain receives the user's raw input first.
- It decides whether the request is primarily:
  - direct answer
  - research or investigation
  - planning
  - workspace execution
- User examples must be treated as evidence of intent, not hardcoded workflow templates.
- Capability boundaries must stay modular so orchestration can evolve without collapsing into brittle rule stacks.
- Every implementation round must end by automatically scheduling and entering the next round, not by stopping on summary alone.

## Entry Point

Current coordinator entry:

- [hooks/useAgentOrchestrator.ts](/E:/ai网站/XC-STUDIO/hooks/useAgentOrchestrator.ts)

Unified sidebar main-brain mode is currently identified by:

- `metadata.allowAutonomousRouting === true`
- `metadata.skillData.id === "autonomous-main-brain"`
- `metadata.skillData.config.mode === "unified-sidebar-agent"`

When those conditions are met, the request should be treated as a raw main-brain request, not pre-forced into generation.

## Input Contract

The main brain should reason over the full request package:

- `message`: raw user text
- `attachments`: current uploaded files
- `uploadedAttachments`: hosted attachment URLs when available
- `context`: current workspace and project context
- `metadata`: orchestration hints, not rigid workflow commands

Important metadata fields:

- `taskMode`
- `allowAutonomousRouting`
- `enableWebSearch`
- `agentSelectionMode`
- `pinnedAgentId`
- `multimodalContext.referenceImageUrls`
- `multimodalContext.referencePolicy`
- `multimodalContext.uploadedAttachmentCount`
- `multimodalContext.isolateVisualQa`
- `multimodalContext.research`

## Internal Modules

### Routing Intent Module

File:

- [services/agents/orchestrator-routing.ts](/E:/ai网站/XC-STUDIO/services/agents/orchestrator-routing.ts)

Responsibilities:

- infer request mode from raw input
- detect unified sidebar main-brain entry
- detect when fresh visual Q&A should remain in answer mode
- build reusable fallback routing decisions

Core exports:

- `inferTaskModeFromRequest`
- `isUnifiedSidebarAgent`
- `shouldPreferAutonomousChatFallback`
- `buildUnifiedSidebarRoutingDecision`
- `buildAutonomousChatRoutingDecision`
- `buildFallbackRoutingDecision`

### Multimodal Context Module

File:

- [services/agents/orchestrator-multimodal.ts](/E:/ai网站/XC-STUDIO/services/agents/orchestrator-multimodal.ts)

Responsibilities:

- resolve topic id for the current conversation
- normalize uploaded-only vs mixed reference policies
- inherit prior result images only for real follow-up edits
- isolate fresh screenshot Q&A from stale history when needed
- build normalized execution metadata for downstream agents

Core exports:

- `resolveTopicId`
- `getReferenceResolutionPolicy`
- `collectInheritedReferenceUrls`
- `resolveMultimodalReferences`
- `buildExecutionTaskMetadata`

### Environment Input Protocol Module

File:

- [services/agents/environment-input-protocol.ts](/E:/ai网站/XC-STUDIO/services/agents/environment-input-protocol.ts)

Responsibilities:

- normalize how execution code resolves `ATTACHMENT_N` markers
- prefer hosted URLs when available, but fall back to base64 when needed
- auto-inject a primary attachment token when image generation is missing an explicit reference
- normalize multi-reference payloads into a single resolved `referenceImages` surface
- infer edit-time aspect ratio from marker crops when the request comes from a selected region

Core exports:

- `applyEnvironmentReferenceProtocol`

### Routing Execution Module

File:

- [services/agents/orchestrator-routing-execution.ts](/E:/ai网站/XC-STUDIO/services/agents/orchestrator-routing-execution.ts)

Responsibilities:

- run pipeline detection as a bounded pre-routing branch
- resolve final routing decision from unified-sidebar, local route, pinned role, remote route, and fallback sources
- keep route resolution reusable outside the React hook layer

Core exports:

- `maybeResolvePipeline`
- `resolveRoutingDecision`

### Main Brain Runtime Module

Files:

- [services/agents/main-brain-runtime.ts](/E:/ai网站/XC-STUDIO/services/agents/main-brain-runtime.ts)
- [services/agents/main-brain-progress.ts](/E:/ai网站/XC-STUDIO/services/agents/main-brain-progress.ts)
- [services/agents/main-brain-recovery.ts](/E:/ai网站/XC-STUDIO/services/agents/main-brain-recovery.ts)
- [services/agents/main-brain-output.ts](/E:/ai网站/XC-STUDIO/services/agents/main-brain-output.ts)

Responsibilities:

- run a bounded multi-step main-brain decision loop instead of a single route-then-stop hop
- keep the raw user request stable while appending runtime observations after each tool round
- track explicit runtime decisions, snapshots, and stop reasons
- let the main brain decide whether to answer now, ask for missing input, or continue with another tool round
- separate runtime state progression from UI progress copy
- isolate recovery logic such as repeated-failure detection, wait-for-input detection, and round health summaries
- isolate final user-visible output assembly from runtime stop reasons and raw plan fragments

Core exports:

- `runMainBrainRuntime`
- `buildMainBrainProgressMessage`
- `inferMainBrainRuntimeAction`
- `summarizeMainBrainSkillRound`
- `detectMainBrainRepeatedFailedLoop`
- `resolveMainBrainOutput`

### Preparation Module

File:

- [services/agents/orchestrator-preparation.ts](/E:/ai网站/XC-STUDIO/services/agents/orchestrator-preparation.ts)

Responsibilities:

- upload transient attachments and validate passthrough
- assemble fresh project context for the current turn
- resolve topic id and pinned context for the turn
- normalize optimizer and explicit-role pin behavior before routing

Core exports:

- `prepareOrchestratorContext`

### Task Assembly Module

File:

- [services/agents/orchestrator-task-assembly.ts](/E:/ai网站/XC-STUDIO/services/agents/orchestrator-task-assembly.ts)

Responsibilities:

- build role prompt overlays from routing decisions
- normalize temporary auto-role session state
- build immediate response tasks
- build downstream execution tasks

Core exports:

- `buildRolePromptAddonFromDecision`
- `buildAutoRoleSessionState`
- `buildImmediateResponseTask`
- `buildExecutionTask`

### Session Sync Module

File:

- [services/agents/orchestrator-session-sync.ts](/E:/ai网站/XC-STUDIO/services/agents/orchestrator-session-sync.ts)

Responsibilities:

- sync resolved task state back into design session state
- sync reference summary and constraint decisions back into topic memory
- persist approved generated assets as downstream anchors

Core exports:

- `syncDesignSessionState`
- `syncTopicSnapshotState`
- `persistApprovedAssetsToTopic`

### Proposal Execution Module

File:

- [services/agents/orchestrator-proposal-execution.ts](/E:/ai网站/XC-STUDIO/services/agents/orchestrator-proposal-execution.ts)

Responsibilities:

- build execution tasks from approved proposal entries
- sync proposal-generated assets back into design session and topic memory
- keep proposal execution on the same asset-persistence contract as normal agent execution

Core exports:

- `buildProposalExecutionTask`
- `syncProposalApprovedAssets`

## Decision Policy

The main brain should decide in this order:

1. Read the raw request and current attachments first.
2. Judge the user's real objective, not only surface keywords.
3. Prefer direct answering when the user is asking about attached content.
4. Prefer research only when external facts or missing context are actually needed.
5. Prefer execution only when an answer alone cannot complete the task.
6. Reuse specialists when useful, but do not route there prematurely.

## Multimodal Isolation Rule

Fresh screenshot Q&A is a special orchestration case:

- If the user uploads a fresh image and asks what it is, how it works, what is wrong, or what it shows, the system should answer from that fresh image first.
- Old conversation history and prior generated design assets must not dominate that turn.
- This is implemented through `multimodalContext.isolateVisualQa` and resolved reference selection.

## What The Main Brain Must Not Do

- Do not hardcode user examples as prompt branches or fixed workflows.
- Do not force every image-bearing message into image generation.
- Do not assume sidebar chat attachments belong to the canvas.
- Do not treat metadata as a rigid command language unless the caller explicitly pins behavior.

## Coordinator Contract

`useAgentOrchestrator` should remain a thin coordinator that:

- uploads transient attachments when needed
- prepares per-turn context through a dedicated preparation module
- prepares project and topic context
- calls routing execution, multimodal normalization, task assembly, runtime, and session sync modules
- creates the downstream `AgentTask`
- persists outcome summaries back into topic memory and design session state
- executes proposal branches through the same normalized execution and persistence contracts

It should not keep growing new inline intent heuristics or attachment-policy branches.

## Runtime Contract

The autonomous main brain should now follow a bounded runtime loop:

1. `understand`
2. `decide`
3. `execute` when tool calls are truly needed
4. `observe`
5. `replan`
6. `respond` or continue another round

This loop is intentionally bounded for safety and debuggability:

- default max turns: `3`
- default max execution rounds: `2`
- runtime observations should be appended as state evidence, not overwrite the original user request
- runtime stop reasons are explicit and can distinguish:
  - `responded`
  - `wait-for-input`
  - `max-execution-rounds`
  - `stalled`
  - `max-turns`

For implementation workflow:

- every planning round must reserve its final todo item for "evaluate current state, schedule the next round, and immediately continue"
- the autonomous system should not terminate a work cycle with summary-only or closeout-only tasks
- progress sync is part of the loop, not the end of the loop

## Callable Surface

### Capability Registry Module

File:

- [services/agents/main-brain-capability-registry.ts](/E:/ai网站/XC-STUDIO/services/agents/main-brain-capability-registry.ts)

Responsibilities:

- define a stable machine-readable registry of internal modules, executable skills, and specialist agents
- keep compatibility aliases such as `xcaiOneclick` mapped to the visible `jkaiOneclick` capability
- generate a compact capability summary that can be injected into the main-brain planning prompt
- make the callable surface explicit instead of relying on prompt memory or scattered module names

Core exports:

- `MAIN_BRAIN_CAPABILITY_REGISTRY`
- `listMainBrainCapabilities`
- `findMainBrainCapability`
- `buildMainBrainCapabilityPromptSummary`

The main brain should treat internal capabilities as callable modules with stable responsibilities:

- `prepareOrchestratorContext`
  - prepares attachments, project context, topic context, and pinned state for the current turn
- `resolveRoutingDecision`
  - decides whether the current turn should answer directly, route to a specialist, or continue autonomous handling
- `buildExecutionTaskMetadata`
  - converts multimodal/reference context into normalized downstream metadata
- `buildExecutionTask`
  - assembles the final downstream `AgentTask`
- `runMainBrainRuntime`
  - runs the bounded understand/decide/execute/observe/replan/respond loop
- `syncDesignSessionState`
  - writes approved outcomes back into design-session memory
- `syncTopicSnapshotState`
  - writes turn-level conclusions back into topic memory

In prompt terms:

- coordinator modules are awareness-only capabilities and must not be emitted as `skillCalls`
- specialist agents are routing targets and must not be emitted as `skillCalls`
- executable skills are the only callable entries that may appear inside `skillCalls`

## Current Status

Based on the current codebase state:

- coordinator decomposition is in progress and already split across routing, preparation, multimodal, task-assembly, session-sync, queue, result-handlers, and proposal-execution modules
- bounded autonomous runtime has been introduced through `main-brain-runtime.ts`
- progress copy has been separated into `main-brain-progress.ts`
- recovery heuristics have been separated into `main-brain-recovery.ts`
- final autonomous output resolution has been separated into `main-brain-output.ts`
- attachment marker, hosted URL, and base64 fallback handling have been separated into `environment-input-protocol.ts`
- analyze-plan prompt construction has been extracted into `analyze-plan-prompt.ts`
- capability discovery has been extracted into `main-brain-capability-registry.ts` and is now injected into the planning prompt
- agent JSON / response normalization has been extracted into `agent-response-normalizer.ts`
- forced image execution guard has been extracted into `forced-image-guard.ts`
- skill aliasing and execution preference normalization have been extracted into `skill-call-normalizer.ts`
- `EnhancedBaseAgent` is still too large and still contains mixed concerns:
  - legacy one-click flow
  - deep reference injection and attachment resolution
  - result extraction and post-generation summary helpers
  - cache helpers

## Next Refactor Targets

- extract deep reference injection and asset attachment preparation into a dedicated execution-preprocessor module
- keep one-click legacy compatibility, but isolate it behind a dedicated adapter instead of leaving it inline in `EnhancedBaseAgent`
- promote recovery heuristics into a first-class verify / retry policy contract
- extend the environment-input protocol so inherited references and topic-level anchors also flow through the same contract

- current default turn limit: 3
- current default execution-round limit: 2

That means the system has moved beyond a pure single-shot route-and-reply model, while still not pretending to be an unbounded background agent.

## Remaining Cleanup Path

- shrink `useAgentOrchestrator.ts` further into a thin coordinator
- continue extracting reusable runtime delegates out of `EnhancedBaseAgent`
- remove obsolete inline helper remnants and mojibake text
- standardize user-facing fallback messages
- keep future workflow additions behind module contracts instead of inline branching
