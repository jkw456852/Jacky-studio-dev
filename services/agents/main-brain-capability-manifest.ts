import type {
  MainBrainCapabilityDefinition,
  MainBrainMutationEnvelope,
} from '../../types/agent.types';

const governanceExample = (
  action: Record<string, unknown>,
  mutation?: MainBrainMutationEnvelope,
): Record<string, unknown> => ({
  ...action,
  ...(mutation ? { mutation } : {}),
});

export const INTERNAL_MODULE_CAPABILITIES: MainBrainCapabilityDefinition[] = [
  {
    id: 'prepareOrchestratorContext',
    kind: 'internal-module',
    label: 'Prepare Orchestrator Context',
    purpose:
      'Prepare attachments, project state, topic memory, inferred mode, and pinned routing state for the current turn.',
    plannerSummary:
      'Awareness-only coordinator module that prepares attachments, topic memory, and normalized request context before routing or execution.',
    useWhen: [
      'Before routing or execution when the current turn needs normalized workspace context.',
    ],
    inputs: [
      { name: 'message', description: 'Raw user request.', required: true },
      {
        name: 'attachments',
        description: 'Fresh files uploaded with the current turn.',
      },
      {
        name: 'projectContext',
        description: 'Workspace project context and conversation state.',
        required: true,
      },
      { name: 'metadata', description: 'Routing and orchestration hints.' },
    ],
    outputs: [
      'uploadedUrls',
      'updatedContext',
      'topicId',
      'topicPinnedContext',
      'inferredTaskMode',
      'messageForExecution',
      'pinnedAgent',
    ],
    sideEffects: [
      'May upload attachments.',
      'May write topic memory hints for the active topic.',
    ],
    tags: ['prepare', 'context', 'attachments', 'memory'],
    auditChannel: 'awareness-only',
    executorKey: 'prepareOrchestratorContext',
  },
  {
    id: 'resolveRoutingDecision',
    kind: 'internal-module',
    label: 'Resolve Routing Decision',
    purpose:
      'Choose whether the turn should respond directly, stay autonomous, or continue into a downstream execution path.',
    plannerSummary:
      'Awareness-only routing module that resolves direct response, autonomous continuation, or downstream execution path selection.',
    useWhen: ['After context preparation and before building an execution task.'],
    inputs: [
      { name: 'message', description: 'Current user request.', required: true },
      {
        name: 'context',
        description: 'Prepared project context for this turn.',
        required: true,
      },
      {
        name: 'metadata',
        description: 'Pinned agent, autonomous mode, and routing hints.',
      },
    ],
    outputs: ['targetAgent', 'action', 'taskType', 'complexity', 'handoffMessage'],
    tags: ['route', 'decide'],
    auditChannel: 'routing-only',
    executorKey: 'resolveRoutingDecision',
  },
  {
    id: 'buildExecutionTaskMetadata',
    kind: 'internal-module',
    label: 'Build Execution Task Metadata',
    purpose:
      'Normalize multimodal references, uploaded attachments, and topic context into downstream execution metadata.',
    plannerSummary:
      'Awareness-only metadata module that normalizes multimodal references, uploaded URLs, and topic context for downstream execution.',
    useWhen: [
      'When execution or downstream role selection needs clean multimodal metadata.',
    ],
    inputs: [
      { name: 'message', description: 'Current user request.', required: true },
      {
        name: 'attachments',
        description: 'Resolved current-turn files.',
      },
      {
        name: 'uploadedUrls',
        description: 'Hosted attachment URLs when available.',
      },
      {
        name: 'context',
        description: 'Prepared project context.',
        required: true,
      },
    ],
    outputs: ['multimodalContext', 'topicPinnedContext', 'taskMode'],
    tags: ['multimodal', 'metadata', 'normalize'],
    auditChannel: 'awareness-only',
    executorKey: 'buildExecutionTaskMetadata',
  },
  {
    id: 'buildExecutionTask',
    kind: 'internal-module',
    label: 'Build Execution Task',
    purpose:
      'Assemble the downstream AgentTask with role overlays, metadata, attachments, and execution payload.',
    plannerSummary:
      'Awareness-only task assembly module that packages routing decisions, role overlays, and metadata into the downstream task.',
    useWhen: ['After routing is decided and execution should begin.'],
    inputs: [
      { name: 'routingDecision', description: 'Resolved routing result.', required: true },
      { name: 'preparedContext', description: 'Prepared orchestration context.', required: true },
      { name: 'metadata', description: 'Normalized execution metadata.' },
    ],
    outputs: ['AgentTask'],
    tags: ['task', 'assembly', 'execution'],
    auditChannel: 'awareness-only',
    executorKey: 'buildExecutionTask',
  },
  {
    id: 'runMainBrainRuntime',
    kind: 'internal-module',
    label: 'Run Main Brain Runtime',
    purpose:
      'Run the bounded decide-act-observe loop so the main brain can continue after tool results instead of stopping after one pass.',
    plannerSummary:
      'Awareness-only runtime loop module that lets the main brain observe results and replan across bounded rounds.',
    useWhen: ['When autonomous main-brain mode is active.'],
    inputs: [
      { name: 'task', description: 'Current AgentTask.', required: true },
      {
        name: 'analyzeAndPlan',
        description: 'Planner function that returns JSON plan output.',
        required: true,
      },
      {
        name: 'executeSkills',
        description: 'Skill execution function.',
        required: true,
      },
      {
        name: 'extractAssets',
        description: 'Asset extraction function.',
        required: true,
      },
    ],
    outputs: ['turns', 'observations', 'finalPlan', 'allSkillResults', 'allAssets'],
    sideEffects: ['May execute multiple bounded skill rounds.'],
    tags: ['runtime', 'loop', 'observe', 'replan'],
    auditChannel: 'awareness-only',
    executorKey: 'runMainBrainRuntime',
  },
  {
    id: 'syncDesignSessionState',
    kind: 'internal-module',
    label: 'Sync Design Session State',
    purpose:
      'Write approved outcomes, subject anchors, and session-level constraints back into design session memory.',
    plannerSummary:
      'Awareness-only persistence module that syncs approved outcomes and constraints back into design-session memory.',
    useWhen: ['After successful execution or proposal approval.'],
    inputs: [
      { name: 'task', description: 'Completed task state.', required: true },
      { name: 'assets', description: 'Generated or approved assets.' },
    ],
    outputs: ['updatedDesignSession'],
    sideEffects: ['Updates design-session memory.'],
    tags: ['persist', 'session', 'memory'],
    auditChannel: 'awareness-only',
    executorKey: 'syncDesignSessionState',
  },
  {
    id: 'syncTopicSnapshotState',
    kind: 'internal-module',
    label: 'Sync Topic Snapshot State',
    purpose:
      'Persist turn-level conclusions, summaries, constraints, and approved assets into topic memory.',
    plannerSummary:
      'Awareness-only persistence module that syncs turn conclusions and approved assets into topic memory.',
    useWhen: ['After answer, execution, or proposal completion.'],
    inputs: [
      { name: 'topicId', description: 'Active topic identifier.', required: true },
      { name: 'task', description: 'Completed task state.', required: true },
    ],
    outputs: ['updatedTopicSnapshot'],
    sideEffects: ['Updates topic memory.'],
    tags: ['persist', 'topic', 'memory'],
    auditChannel: 'awareness-only',
    executorKey: 'syncTopicSnapshotState',
  },
];

export const SKILL_CAPABILITIES: MainBrainCapabilityDefinition[] = [
  {
    id: 'generateImage',
    kind: 'skill',
    label: 'Generate Image',
    purpose: 'Create or edit images through an explicit tool contract with model, size, ratio, quality, reference, and output controls.',
    plannerSummary:
      'Executable visual generation skill with a normalized request contract, capability negotiation, and provider-aware output controls.',
    useWhen: ['The user explicitly wants a new image, visual direction, or generated variant.'],
    avoidWhen: ['The user is only asking what an image is or how something works.'],
    inputs: [
      { name: 'prompt', description: 'Image generation prompt.', required: true },
      { name: 'providerId', description: 'Provider profile that resolves endpoint and API key.' },
      { name: 'operation', description: 'generate or edit, depending on whether references and mask are used.' },
      { name: 'referenceImage', description: 'Single reference image URL or attachment marker.' },
      { name: 'referenceImages', description: 'Multiple reference images for subject consistency.' },
      { name: 'maskImage', description: 'Optional mask for edit workflows.' },
      { name: 'aspectRatio', description: 'Target aspect ratio such as 1:1 or 4:5.' },
      { name: 'imageSize', description: 'Preset resolution tier such as 1K, 2K, or 4K.' },
      { name: 'exactSize', description: 'Exact WxH output when the chosen model supports it.' },
      { name: 'imageQuality', description: 'Normalized quality tier for the output.' },
      { name: 'background', description: 'transparent, opaque, or auto.' },
      { name: 'outputFormat', description: 'png, jpeg, or webp.' },
      { name: 'model', description: 'Chosen image model.' },
    ],
    outputs: ['imageUrls', 'assets'],
    sideEffects: ['Consumes image generation quota or provider calls.'],
    tags: ['visual', 'generate', 'image'],
    auditChannel: 'skillCalls',
    executorKey: 'generateImage',
  },
  {
    id: 'generateVideo',
    kind: 'skill',
    label: 'Generate Video',
    purpose: 'Create a video clip from prompt and optional frame references.',
    plannerSummary:
      'Executable video generation skill for creating motion output from prompt and optional reference frames.',
    useWhen: ['The user explicitly asks for motion content or video generation.'],
    inputs: [
      { name: 'prompt', description: 'Video generation prompt.', required: true },
      { name: 'startFrame', description: 'Optional start frame.' },
      { name: 'endFrame', description: 'Optional end frame.' },
      { name: 'duration', description: 'Target duration.' },
    ],
    outputs: ['videoUrls', 'assets'],
    sideEffects: ['Consumes video generation quota or provider calls.'],
    tags: ['visual', 'generate', 'video'],
    auditChannel: 'skillCalls',
    executorKey: 'generateVideo',
  },
  {
    id: 'extractText',
    kind: 'skill',
    label: 'Extract Text',
    purpose: 'Read text from uploaded images or regions.',
    plannerSummary:
      'Executable OCR-style skill for reading visible text from images or marked regions.',
    useWhen: ['The user asks what text appears in an image or screenshot.'],
    inputs: [
      { name: 'sourceUrl', description: 'Attachment marker or image URL.', required: true },
    ],
    outputs: ['recognizedText'],
    tags: ['ocr', 'image-understanding', 'analysis'],
    auditChannel: 'skillCalls',
    executorKey: 'extractText',
  },
  {
    id: 'analyzeRegion',
    kind: 'skill',
    label: 'Analyze Region',
    purpose: 'Inspect a marked or cropped region inside an image.',
    plannerSummary:
      'Executable analysis skill for inspecting a marked or cropped image region.',
    useWhen: ['The user points at a specific area and asks what it contains or what is wrong there.'],
    inputs: [
      { name: 'sourceUrl', description: 'Attachment marker or image URL.', required: true },
      { name: 'region', description: 'Crop or region coordinates.' },
    ],
    outputs: ['analysis'],
    tags: ['analysis', 'image-understanding', 'region'],
    auditChannel: 'skillCalls',
    executorKey: 'analyzeRegion',
  },
  {
    id: 'generateCopy',
    kind: 'skill',
    label: 'Generate Copy',
    purpose: 'Produce product, campaign, or marketing copy.',
    plannerSummary:
      'Executable copywriting skill for headlines, selling points, scripts, and product text.',
    useWhen: ['The user wants wording, headlines, selling points, or script text.'],
    inputs: [{ name: 'prompt', description: 'Copywriting request.', required: true }],
    outputs: ['copy', 'variants'],
    tags: ['text', 'copywriting'],
    auditChannel: 'skillCalls',
    executorKey: 'generateCopy',
  },
  {
    id: 'smartEdit',
    kind: 'skill',
    label: 'Smart Edit',
    purpose: 'Edit an existing image by removing, replacing, recoloring, or refining content.',
    plannerSummary:
      'Executable image editing skill for removal, replacement, recolor, or refinement on an existing image.',
    useWhen: ['The user wants to change an existing image rather than generate a new one from scratch.'],
    inputs: [
      { name: 'sourceUrl', description: 'Attachment marker or image URL.', required: true },
      { name: 'instruction', description: 'Edit instruction.', required: true },
    ],
    outputs: ['imageUrls', 'assets'],
    sideEffects: ['Consumes image editing quota or provider calls.'],
    tags: ['edit', 'image'],
    auditChannel: 'skillCalls',
    executorKey: 'smartEdit',
  },
  {
    id: 'touchEdit',
    kind: 'skill',
    label: 'Touch Edit',
    purpose: 'Apply local or manual-feeling image edits to existing content.',
    plannerSummary:
      'Executable touch-up skill for smaller local-feeling corrections on existing images.',
    useWhen: ['The request is a small visual correction, local adjustment, or touch-up.'],
    inputs: [
      { name: 'sourceUrl', description: 'Attachment marker or image URL.', required: true },
      { name: 'instruction', description: 'Touch edit request.', required: true },
    ],
    outputs: ['imageUrls', 'assets'],
    sideEffects: ['Consumes image editing quota or provider calls.'],
    tags: ['edit', 'retouch', 'image'],
    auditChannel: 'skillCalls',
    executorKey: 'touchEdit',
  },
  {
    id: 'workspaceSearch',
    kind: 'skill',
    label: 'Workspace Search',
    purpose: 'Run workspace-backed live web research, collect search results, and return structured evidence for replanning.',
    plannerSummary:
      'Executable search skill for fresh facts, comparisons, and online verification through the workspace search pipeline.',
    useWhen: [
      'The user asks for fresh facts, schedules, events, prices, comparisons, investigation, or other external information that should be verified online.',
    ],
    avoidWhen: [
      'Attached research results already answer the question well enough and no additional verification is needed.',
    ],
    inputs: [
      { name: 'query', description: 'The exact search query to run.', required: true },
      { name: 'mode', description: 'web, images, or web+images depending on the task.' },
      { name: 'includePageExtracts', description: 'Whether to extract readable text from top pages.' },
      { name: 'maxExtractPages', description: 'How many top pages to extract after search.' },
    ],
    outputs: ['summary', 'citations', 'webResults', 'imageResults', 'extractedPages'],
    sideEffects: ['Consumes the configured search provider quota and may trigger page extraction requests.'],
    tags: ['research', 'search', 'facts', 'web'],
    auditChannel: 'skillCalls',
    executorKey: 'workspaceSearch',
  },
  {
    id: 'export',
    kind: 'skill',
    label: 'Export',
    purpose: 'Export completed results into a deliverable output format.',
    plannerSummary:
      'Executable export skill for packaging completed results into a deliverable output format.',
    useWhen: ['The user asks to export, package, or deliver a finished artifact.'],
    inputs: [
      { name: 'assets', description: 'Assets or content to export.', required: true },
      { name: 'format', description: 'Requested export format.' },
    ],
    outputs: ['downloadUrl', 'exportArtifact'],
    tags: ['delivery', 'export'],
    auditChannel: 'skillCalls',
    executorKey: 'export',
  },
  {
    id: 'jkaiOneclick',
    kind: 'skill',
    label: 'JKAI OneClick Workflow',
    purpose: 'Run the legacy one-click orchestrated workflow through a compatibility adapter.',
    plannerSummary:
      'Executable compatibility workflow skill for the legacy one-click pipeline.',
    useWhen: ['A bundled legacy one-click workflow is explicitly needed.'],
    inputs: [{ name: 'request', description: 'Workflow request payload.', required: true }],
    outputs: ['workflowSummary', 'assets', 'structuredResult'],
    aliases: ['xcaiOneclick'],
    tags: ['workflow', 'compatibility', 'legacy'],
    auditChannel: 'skillCalls',
    executorKey: 'jkaiOneclick',
  },
];

export const GOVERNANCE_CAPABILITIES: MainBrainCapabilityDefinition[] = [
  {
    id: 'roleLibraryRead',
    kind: 'governance-skill',
    label: 'Role Library Read',
    purpose:
      'Inspect durable roles, temporary drafts, routing eligibility, tool policy, and governance status before choosing or proposing a role action.',
    plannerSummary:
      'Planner-only governance capability for reading durable roles, drafts, and governance constraints before choosing a role action.',
    useWhen: [
      'Before binding a role to the current task, suggesting a replacement, or deciding whether role mutation is allowed.',
    ],
    inputs: [
      { name: 'selectedRoleId', description: 'Currently selected durable role when present.' },
      { name: 'roles', description: 'Available durable role library and temporary draft state.' },
      { name: 'metadata', description: 'Governance flags such as roleGovernanceMode and allowMainBrainRoleMutation.' },
    ],
    outputs: ['roleSummary', 'governanceConstraints', 'recommendedAction'],
    tags: ['role', 'governance', 'read'],
    auditChannel: 'roleGovernanceAudit',
    executorKey: 'read',
    mutation: { resource: 'role', operation: 'read' },
    permissionPolicy: {
      governanceModes: ['manual_only', 'draft_only', 'approval_required', 'auto_manage'],
    },
    exampleAction: governanceExample(
      {
        action: 'read',
        capabilityId: 'roleLibraryRead',
        reason: '先读取角色库与治理约束，再决定是否绑定或建议改写。',
      },
      {
        resource: 'role',
        operation: 'read',
        reason: '先读取角色库与治理约束，再决定是否绑定或建议改写。',
      },
    ),
  },
  {
    id: 'roleDraftCreate',
    kind: 'governance-skill',
    label: 'Role Draft Create',
    purpose:
      'Propose a new temporary or durable role draft when the current task needs a role that does not yet exist.',
    plannerSummary:
      'Planner-only governance capability for creating a temporary role draft when no durable role fits the task.',
    useWhen: [
      'When no existing durable role fits the task well and governance allows only draft-stage creation or recommendation.',
    ],
    inputs: [
      { name: 'targetBaseAgentId', description: 'The specialist shell that should execute the role.', required: true },
      { name: 'title', description: 'Role title candidate.', required: true },
      { name: 'summary', description: 'Why this role is needed.', required: true },
      { name: 'instructions', description: 'Task-scoped or durable role instructions.' },
    ],
    outputs: ['roleDraftProposal'],
    sideEffects: ['Should be reported via roleGovernanceAudit and must respect governance approval rules.'],
    tags: ['role', 'governance', 'draft'],
    auditChannel: 'roleGovernanceAudit',
    executorKey: 'draft_create',
    mutation: { resource: 'role', operation: 'create' },
    permissionPolicy: {
      governanceModes: ['draft_only', 'approval_required', 'auto_manage'],
    },
    exampleAction: governanceExample(
      {
        action: 'draft_create',
        capabilityId: 'roleDraftCreate',
        targetBaseAgentId: 'poster',
        reason: '当前任务需要新角色草案来沉淀可复用执行方式。',
      },
      {
        resource: 'role',
        operation: 'create',
        targetBaseAgentId: 'poster',
        reason: '当前任务需要新角色草案来沉淀可复用执行方式。',
      },
    ),
  },
  {
    id: 'roleDraftUpdate',
    kind: 'governance-skill',
    label: 'Role Draft Update',
    purpose:
      'Propose updates to an existing temporary or durable role draft instead of silently editing prompts.',
    plannerSummary:
      'Planner-only governance capability for updating a role draft when a selected role almost fits but needs better boundaries or instructions.',
    useWhen: [
      'When a selected role almost fits but needs clarified boundaries, tool policy, or role instructions for better execution.',
    ],
    inputs: [
      { name: 'targetRoleId', description: 'The durable role being revised when present.' },
      { name: 'changeSummary', description: 'What should be changed and why.', required: true },
      { name: 'instructions', description: 'Updated role instructions or governance notes.' },
    ],
    outputs: ['roleDraftPatch'],
    sideEffects: ['Should be reported via roleGovernanceAudit and must not bypass approval requirements.'],
    tags: ['role', 'governance', 'update'],
    auditChannel: 'roleGovernanceAudit',
    executorKey: 'draft_update',
    mutation: { resource: 'role', operation: 'update' },
    permissionPolicy: {
      governanceModes: ['draft_only', 'approval_required', 'auto_manage'],
    },
    exampleAction: governanceExample(
      {
        action: 'draft_update',
        capabilityId: 'roleDraftUpdate',
        targetRoleId: 'role_brand_designer',
        reason: '当前长期角色可用，但需要补充更清晰的边界与执行要求。',
      },
      {
        resource: 'role',
        operation: 'update',
        targetId: 'role_brand_designer',
        reason: '当前长期角色可用，但需要补充更清晰的边界与执行要求。',
      },
    ),
  },
  {
    id: 'rolePromote',
    kind: 'governance-skill',
    label: 'Role Promote',
    purpose:
      'Recommend or perform promotion from a temporary role draft into a durable role asset when governance allows it.',
    plannerSummary:
      'Planner-only governance capability for promoting a stable temporary role draft into a durable role asset.',
    useWhen: ['When a temporary role proved stable enough to become a durable reusable role.'],
    inputs: [
      { name: 'draftId', description: 'Temporary role draft identifier.', required: true },
      { name: 'targetRoleId', description: 'Existing durable role to overwrite, or omit for a new durable role.' },
      { name: 'governanceMode', description: 'Current governance mode for the selected role or session.' },
    ],
    outputs: ['promotionPlan'],
    sideEffects: ['Must be reported via roleGovernanceAudit and require approval unless auto-manage is explicitly allowed.'],
    tags: ['role', 'governance', 'promote'],
    auditChannel: 'roleGovernanceAudit',
    executorKey: 'promote',
    mutation: { resource: 'role', operation: 'promote' },
    permissionPolicy: {
      governanceModes: ['approval_required', 'auto_manage'],
      requiresRolePromotion: true,
      requireHumanApprovalByDefault: true,
    },
    exampleAction: governanceExample(
      {
        action: 'promote',
        capabilityId: 'rolePromote',
        targetRoleId: 'role_brand_designer',
        reason: '该临时角色已经稳定，可升级为长期角色资产。',
      },
      {
        resource: 'role',
        operation: 'promote',
        targetId: 'role_brand_designer',
        reason: '该临时角色已经稳定，可升级为长期角色资产。',
      },
    ),
  },
  {
    id: 'roleArchive',
    kind: 'governance-skill',
    label: 'Role Archive',
    purpose:
      'Recommend archiving a low-quality, obsolete, or conflicting durable role under explicit governance rules.',
    plannerSummary:
      'Planner-only governance capability for archiving obsolete or conflicting durable roles under explicit governance policy.',
    useWhen: [
      'When a durable role is clearly obsolete, duplicated, or harmful and the current governance policy explicitly allows archive suggestions or automatic management.',
    ],
    inputs: [
      { name: 'targetRoleId', description: 'Role proposed for archive.', required: true },
      { name: 'reason', description: 'Why the role should be archived.', required: true },
    ],
    outputs: ['archivePlan'],
    sideEffects: ['Must be reported via roleGovernanceAudit and should default to recommendation instead of silent archive.'],
    tags: ['role', 'governance', 'archive'],
    auditChannel: 'roleGovernanceAudit',
    executorKey: 'archive',
    mutation: { resource: 'role', operation: 'archive' },
    permissionPolicy: {
      governanceModes: ['approval_required', 'auto_manage'],
      requiresRoleMutation: true,
      requireHumanApprovalByDefault: true,
    },
    exampleAction: governanceExample(
      {
        action: 'archive',
        capabilityId: 'roleArchive',
        targetRoleId: 'role_old_strategy',
        reason: '该长期角色已过时，且有更安全的新版本替代。',
      },
      {
        resource: 'role',
        operation: 'archive',
        targetId: 'role_old_strategy',
        reason: '该长期角色已过时，且有更安全的新版本替代。',
      },
    ),
  },
  {
    id: 'roleAddonUpdate',
    kind: 'governance-skill',
    label: 'Role Addon Update',
    purpose:
      'Directly update the current specialist shell\'s durable prompt addon when the user explicitly wants long-term behavioral changes without creating a full role draft.',
    plannerSummary:
      'Planner-only governance capability for directly rewriting the current specialist shell durable addon when the user explicitly asks for a long-term behavior change.',
    useWhen: [
      'When the user asks to directly rewrite the current expert or agent long-term setting, and governance allows durable mutation of the current shell addon.',
    ],
    inputs: [
      { name: 'targetBaseAgentId', description: 'The specialist shell whose durable addon should be updated.', required: true },
      { name: 'promptAddonText', description: 'The full durable addon text to persist.', required: true },
      { name: 'reason', description: 'Why this durable addon update is needed.', required: true },
    ],
    outputs: ['addonUpdatePlan'],
    sideEffects: ['Must be reported via roleGovernanceAudit and should only auto-execute when governance explicitly allows durable mutation.'],
    tags: ['role', 'governance', 'addon', 'update'],
    auditChannel: 'roleGovernanceAudit',
    executorKey: 'addon_update',
    mutation: { resource: 'role-addon', operation: 'update' },
    permissionPolicy: {
      governanceModes: ['approval_required', 'auto_manage'],
      requiresRoleMutation: true,
      requireHumanApprovalByDefault: true,
    },
    exampleAction: governanceExample(
      {
        action: 'addon_update',
        capabilityId: 'roleAddonUpdate',
        targetBaseAgentId: 'poster',
        promptAddonText: '输出海报方案前先给出版式结构拆解，再明确主视觉层级、标题节奏、CTA 与留白约束。',
        reason: '用户明确要求长期改写当前专家的行为设定。',
      },
      {
        resource: 'role-addon',
        operation: 'update',
        targetBaseAgentId: 'poster',
        payload: {
          promptAddonText: '输出海报方案前先给出版式结构拆解，再明确主视觉层级、标题节奏、CTA 与留白约束。',
        },
        reason: '用户明确要求长期改写当前专家的行为设定。',
      },
    ),
  },
  {
    id: 'roleBindToTask',
    kind: 'governance-skill',
    label: 'Role Bind To Task',
    purpose:
      'Bind a durable selected role or a temporary role draft to the current task so execution honors its base shell and role instructions.',
    plannerSummary:
      'Planner-only governance capability for binding a selected durable role or draft to the current task execution path.',
    useWhen: [
      'When the user selected a role explicitly or the planner concludes a known role should govern the current execution.',
    ],
    inputs: [
      { name: 'selectedRoleId', description: 'Durable role identifier when available.' },
      { name: 'targetBaseAgentId', description: 'Base specialist shell chosen for execution.', required: true },
      { name: 'reason', description: 'Why this role binding matches the task.', required: true },
    ],
    outputs: ['roleBindingDecision'],
    tags: ['role', 'governance', 'binding'],
    auditChannel: 'roleGovernanceAudit',
    executorKey: 'bind',
    mutation: { resource: 'role', operation: 'bind' },
    permissionPolicy: {
      governanceModes: ['manual_only', 'draft_only', 'approval_required', 'auto_manage'],
    },
    exampleAction: governanceExample(
      {
        action: 'bind',
        capabilityId: 'roleBindToTask',
        targetRoleId: 'role_brand_designer',
        targetBaseAgentId: 'poster',
        reason: '当前任务与该长期角色的定位一致。',
      },
      {
        resource: 'role',
        operation: 'bind',
        targetId: 'role_brand_designer',
        targetBaseAgentId: 'poster',
        reason: '当前任务与该长期角色的定位一致。',
      },
    ),
  },
  {
    id: 'roleSuggestReplacement',
    kind: 'governance-skill',
    label: 'Role Suggest Replacement',
    purpose:
      'Suggest a better durable role or specialist shell when the currently selected role is mismatched for the task.',
    plannerSummary:
      'Planner-only governance capability for suggesting a safer or better fitting role when the selected one mismatches the task.',
    useWhen: [
      'When the selected role conflicts with the task, attachments, governance policy, or tool boundary and a safer alternative should be recommended.',
    ],
    inputs: [
      { name: 'selectedRoleId', description: 'Currently selected role or draft.' },
      { name: 'recommendedRoleId', description: 'Better durable role candidate when one exists.' },
      { name: 'recommendedBaseAgentId', description: 'Fallback specialist shell if no durable role exists.' },
    ],
    outputs: ['replacementSuggestion'],
    tags: ['role', 'governance', 'replacement'],
    auditChannel: 'roleGovernanceAudit',
    executorKey: 'suggest_replacement',
    mutation: { resource: 'role', operation: 'suggest' },
    permissionPolicy: {
      governanceModes: ['manual_only', 'draft_only', 'approval_required', 'auto_manage'],
    },
    exampleAction: governanceExample(
      {
        action: 'suggest_replacement',
        capabilityId: 'roleSuggestReplacement',
        targetRoleId: 'role_brand_designer',
        targetBaseAgentId: 'campaign',
        reason: '当前选中角色与任务目标不匹配，更适合切换到 campaign 壳或对应长期角色。',
      },
      {
        resource: 'role',
        operation: 'suggest',
        targetId: 'role_brand_designer',
        targetBaseAgentId: 'campaign',
        reason: '当前选中角色与任务目标不匹配，更适合切换到 campaign 壳或对应长期角色。',
      },
    ),
  },
];

export const SPECIALIST_AGENT_CAPABILITIES: MainBrainCapabilityDefinition[] = [
  {
    id: 'coco',
    kind: 'specialist-agent',
    label: 'Coco',
    purpose: 'Generalist visual copilot for broad multimodal understanding and lightweight execution.',
    plannerSummary:
      'Routing-only generalist specialist shell for broad multimodal understanding and lightweight execution.',
    useWhen: ['The task is mixed, ambiguous, or better handled by the default visual generalist.'],
    tags: ['generalist', 'default'],
    auditChannel: 'routing-only',
    executorKey: 'coco',
  },
  {
    id: 'poster',
    kind: 'specialist-agent',
    label: 'Poster Agent',
    purpose: 'Poster, layout, and campaign visual composition specialist.',
    plannerSummary:
      'Routing-only specialist shell for poster design, key visual layout, and campaign composition.',
    useWhen: ['The task is primarily poster design, key visual layout, or campaign composition.'],
    tags: ['design', 'poster', 'layout'],
    auditChannel: 'routing-only',
    executorKey: 'poster',
  },
  {
    id: 'package',
    kind: 'specialist-agent',
    label: 'Package Agent',
    purpose: 'Packaging and physical product presentation specialist.',
    plannerSummary:
      'Routing-only specialist shell for packaging and physical product presentation tasks.',
    useWhen: ['The task concerns product packaging, box design, or physical presentation.'],
    tags: ['packaging', 'product'],
    auditChannel: 'routing-only',
    executorKey: 'package',
  },
  {
    id: 'motion',
    kind: 'specialist-agent',
    label: 'Motion Agent',
    purpose: 'Motion, animation, and video-focused specialist.',
    plannerSummary:
      'Routing-only specialist shell for motion storytelling, animation, and short video tasks.',
    useWhen: ['The task requires motion storytelling, short clips, or animated presentation.'],
    tags: ['motion', 'video'],
    auditChannel: 'routing-only',
    executorKey: 'motion',
  },
  {
    id: 'campaign',
    kind: 'specialist-agent',
    label: 'Campaign Agent',
    purpose: 'Campaign strategy, market framing, and commerce-oriented creative specialist.',
    plannerSummary:
      'Routing-only specialist shell for campaign strategy, audience framing, and commerce-oriented creative work.',
    useWhen: ['The task mixes creative direction with market, audience, or commerce goals.'],
    tags: ['campaign', 'marketing', 'commerce'],
    auditChannel: 'routing-only',
    executorKey: 'campaign',
  },
  {
    id: 'cameron',
    kind: 'specialist-agent',
    label: 'Cameron',
    purpose: 'Photography-oriented specialist for framing, shot logic, and visual realism.',
    plannerSummary:
      'Routing-only specialist shell for photography logic, framing, and visual realism.',
    useWhen: ['The task is photo-centric and needs shot planning or photographic realism.'],
    tags: ['photo', 'camera'],
    auditChannel: 'routing-only',
    executorKey: 'cameron',
  },
  {
    id: 'vireo',
    kind: 'specialist-agent',
    label: 'Vireo',
    purpose: 'Concept and style exploration specialist for visual direction work.',
    plannerSummary:
      'Routing-only specialist shell for concept ideation and style exploration.',
    useWhen: ['The task is exploratory, style-seeking, or concept-heavy.'],
    tags: ['concept', 'style'],
    auditChannel: 'routing-only',
    executorKey: 'vireo',
  },
  {
    id: 'prompt-optimizer',
    kind: 'specialist-agent',
    label: 'Prompt Optimizer',
    purpose: 'Prompt rewriting and clarification specialist before downstream execution.',
    plannerSummary:
      'Routing-only specialist shell for prompt rewriting, clarification, and optimizer-first flows.',
    useWhen: ['The user explicitly wants prompt optimization or the route is optimizer-first.'],
    tags: ['prompt', 'rewrite', 'clarify'],
    auditChannel: 'routing-only',
    executorKey: 'prompt-optimizer',
  },
];

export const MAIN_BRAIN_CAPABILITY_MANIFEST: MainBrainCapabilityDefinition[] = [
  ...INTERNAL_MODULE_CAPABILITIES,
  ...GOVERNANCE_CAPABILITIES,
  ...SKILL_CAPABILITIES,
  ...SPECIALIST_AGENT_CAPABILITIES,
];
