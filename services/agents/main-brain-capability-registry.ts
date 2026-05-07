import type { MainBrainCapabilityDefinition } from '../../types/agent.types';

const INTERNAL_MODULE_CAPABILITIES: MainBrainCapabilityDefinition[] = [
  {
    id: 'prepareOrchestratorContext',
    kind: 'internal-module',
    label: 'Prepare Orchestrator Context',
    purpose:
      'Prepare attachments, project state, topic memory, inferred mode, and pinned routing state for the current turn.',
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
  },
  {
    id: 'resolveRoutingDecision',
    kind: 'internal-module',
    label: 'Resolve Routing Decision',
    purpose:
      'Choose whether the turn should respond directly, stay autonomous, or hand off to a specialist agent.',
    useWhen: [
      'After context preparation and before building an execution task.',
    ],
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
  },
  {
    id: 'buildExecutionTaskMetadata',
    kind: 'internal-module',
    label: 'Build Execution Task Metadata',
    purpose:
      'Normalize multimodal references, uploaded attachments, and topic context into downstream execution metadata.',
    useWhen: [
      'When execution or specialist handoff needs clean multimodal metadata.',
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
  },
  {
    id: 'buildExecutionTask',
    kind: 'internal-module',
    label: 'Build Execution Task',
    purpose:
      'Assemble the downstream AgentTask with role overlays, metadata, attachments, and execution payload.',
    useWhen: ['After routing is decided and execution should begin.'],
    inputs: [
      { name: 'routingDecision', description: 'Resolved routing result.', required: true },
      { name: 'preparedContext', description: 'Prepared orchestration context.', required: true },
      { name: 'metadata', description: 'Normalized execution metadata.' },
    ],
    outputs: ['AgentTask'],
    tags: ['task', 'assembly', 'execution'],
  },
  {
    id: 'runMainBrainRuntime',
    kind: 'internal-module',
    label: 'Run Main Brain Runtime',
    purpose:
      'Run the bounded decide-act-observe loop so the main brain can continue after tool results instead of stopping after one pass.',
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
  },
  {
    id: 'syncDesignSessionState',
    kind: 'internal-module',
    label: 'Sync Design Session State',
    purpose:
      'Write approved outcomes, subject anchors, and session-level constraints back into design session memory.',
    useWhen: ['After successful execution or proposal approval.'],
    inputs: [
      { name: 'task', description: 'Completed task state.', required: true },
      { name: 'assets', description: 'Generated or approved assets.' },
    ],
    outputs: ['updatedDesignSession'],
    sideEffects: ['Updates design-session memory.'],
    tags: ['persist', 'session', 'memory'],
  },
  {
    id: 'syncTopicSnapshotState',
    kind: 'internal-module',
    label: 'Sync Topic Snapshot State',
    purpose:
      'Persist turn-level conclusions, summaries, constraints, and approved assets into topic memory.',
    useWhen: ['After answer, execution, or proposal completion.'],
    inputs: [
      { name: 'topicId', description: 'Active topic identifier.', required: true },
      { name: 'task', description: 'Completed task state.', required: true },
    ],
    outputs: ['updatedTopicSnapshot'],
    sideEffects: ['Updates topic memory.'],
    tags: ['persist', 'topic', 'memory'],
  },
];

const SKILL_CAPABILITIES: MainBrainCapabilityDefinition[] = [
  {
    id: 'generateImage',
    kind: 'skill',
    label: 'Generate Image',
    purpose: 'Create new images from prompt and optional references.',
    useWhen: ['The user explicitly wants a new image, visual direction, or generated variant.'],
    avoidWhen: ['The user is only asking what an image is or how something works.'],
    inputs: [
      { name: 'prompt', description: 'Image generation prompt.', required: true },
      { name: 'referenceImage', description: 'Single reference image URL or attachment marker.' },
      { name: 'referenceImages', description: 'Multiple reference images for subject consistency.' },
      { name: 'aspectRatio', description: 'Target aspect ratio such as 1:1 or 4:5.' },
      { name: 'model', description: 'Chosen image model.' },
    ],
    outputs: ['imageUrls', 'assets'],
    sideEffects: ['Consumes image generation quota or provider calls.'],
    tags: ['visual', 'generate', 'image'],
  },
  {
    id: 'generateVideo',
    kind: 'skill',
    label: 'Generate Video',
    purpose: 'Create a video clip from prompt and optional frame references.',
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
  },
  {
    id: 'extractText',
    kind: 'skill',
    label: 'Extract Text',
    purpose: 'Read text from uploaded images or regions.',
    useWhen: ['The user asks what text appears in an image or screenshot.'],
    inputs: [
      { name: 'sourceUrl', description: 'Attachment marker or image URL.', required: true },
    ],
    outputs: ['recognizedText'],
    tags: ['ocr', 'image-understanding', 'analysis'],
  },
  {
    id: 'analyzeRegion',
    kind: 'skill',
    label: 'Analyze Region',
    purpose: 'Inspect a marked or cropped region inside an image.',
    useWhen: ['The user points at a specific area and asks what it contains or what is wrong there.'],
    inputs: [
      { name: 'sourceUrl', description: 'Attachment marker or image URL.', required: true },
      { name: 'region', description: 'Crop or region coordinates.' },
    ],
    outputs: ['analysis'],
    tags: ['analysis', 'image-understanding', 'region'],
  },
  {
    id: 'generateCopy',
    kind: 'skill',
    label: 'Generate Copy',
    purpose: 'Produce product, campaign, or marketing copy.',
    useWhen: ['The user wants wording, headlines, selling points, or script text.'],
    inputs: [
      { name: 'prompt', description: 'Copywriting request.', required: true },
    ],
    outputs: ['copy', 'variants'],
    tags: ['text', 'copywriting'],
  },
  {
    id: 'smartEdit',
    kind: 'skill',
    label: 'Smart Edit',
    purpose: 'Edit an existing image by removing, replacing, recoloring, or refining content.',
    useWhen: ['The user wants to change an existing image rather than generate a new one from scratch.'],
    inputs: [
      { name: 'sourceUrl', description: 'Attachment marker or image URL.', required: true },
      { name: 'instruction', description: 'Edit instruction.', required: true },
    ],
    outputs: ['imageUrls', 'assets'],
    sideEffects: ['Consumes image editing quota or provider calls.'],
    tags: ['edit', 'image'],
  },
  {
    id: 'touchEdit',
    kind: 'skill',
    label: 'Touch Edit',
    purpose: 'Apply local or manual-feeling image edits to existing content.',
    useWhen: ['The request is a small visual correction, local adjustment, or touch-up.'],
    inputs: [
      { name: 'sourceUrl', description: 'Attachment marker or image URL.', required: true },
      { name: 'instruction', description: 'Touch edit request.', required: true },
    ],
    outputs: ['imageUrls', 'assets'],
    sideEffects: ['Consumes image editing quota or provider calls.'],
    tags: ['edit', 'retouch', 'image'],
  },
  {
    id: 'export',
    kind: 'skill',
    label: 'Export',
    purpose: 'Export completed results into a deliverable output format.',
    useWhen: ['The user asks to export, package, or deliver a finished artifact.'],
    inputs: [
      { name: 'assets', description: 'Assets or content to export.', required: true },
      { name: 'format', description: 'Requested export format.' },
    ],
    outputs: ['downloadUrl', 'exportArtifact'],
    tags: ['delivery', 'export'],
  },
  {
    id: 'jkaiOneclick',
    kind: 'skill',
    label: 'JKAI OneClick Workflow',
    purpose: 'Run the legacy one-click orchestrated workflow through a compatibility adapter.',
    useWhen: ['A bundled legacy one-click workflow is explicitly needed.'],
    inputs: [
      { name: 'request', description: 'Workflow request payload.', required: true },
    ],
    outputs: ['workflowSummary', 'assets', 'structuredResult'],
    aliases: ['xcaiOneclick'],
    tags: ['workflow', 'compatibility', 'legacy'],
  },
];

const SPECIALIST_AGENT_CAPABILITIES: MainBrainCapabilityDefinition[] = [
  {
    id: 'coco',
    kind: 'specialist-agent',
    label: 'Coco',
    purpose: 'Generalist visual copilot for broad multimodal understanding and lightweight execution.',
    useWhen: ['The task is mixed, ambiguous, or better handled by the default visual generalist.'],
    tags: ['generalist', 'default'],
  },
  {
    id: 'poster',
    kind: 'specialist-agent',
    label: 'Poster Agent',
    purpose: 'Poster, layout, and campaign visual composition specialist.',
    useWhen: ['The task is primarily poster design, key visual layout, or campaign composition.'],
    tags: ['design', 'poster', 'layout'],
  },
  {
    id: 'package',
    kind: 'specialist-agent',
    label: 'Package Agent',
    purpose: 'Packaging and physical product presentation specialist.',
    useWhen: ['The task concerns product packaging, box design, or physical presentation.'],
    tags: ['packaging', 'product'],
  },
  {
    id: 'motion',
    kind: 'specialist-agent',
    label: 'Motion Agent',
    purpose: 'Motion, animation, and video-focused specialist.',
    useWhen: ['The task requires motion storytelling, short clips, or animated presentation.'],
    tags: ['motion', 'video'],
  },
  {
    id: 'campaign',
    kind: 'specialist-agent',
    label: 'Campaign Agent',
    purpose: 'Campaign strategy, market framing, and commerce-oriented creative specialist.',
    useWhen: ['The task mixes creative direction with market, audience, or commerce goals.'],
    tags: ['campaign', 'marketing', 'commerce'],
  },
  {
    id: 'cameron',
    kind: 'specialist-agent',
    label: 'Cameron',
    purpose: 'Photography-oriented specialist for framing, shot logic, and visual realism.',
    useWhen: ['The task is photo-centric and needs shot planning or photographic realism.'],
    tags: ['photo', 'camera'],
  },
  {
    id: 'vireo',
    kind: 'specialist-agent',
    label: 'Vireo',
    purpose: 'Concept and style exploration specialist for visual direction work.',
    useWhen: ['The task is exploratory, style-seeking, or concept-heavy.'],
    tags: ['concept', 'style'],
  },
  {
    id: 'prompt-optimizer',
    kind: 'specialist-agent',
    label: 'Prompt Optimizer',
    purpose: 'Prompt rewriting and clarification specialist before downstream execution.',
    useWhen: ['The user explicitly wants prompt optimization or the route is optimizer-first.'],
    tags: ['prompt', 'rewrite', 'clarify'],
  },
];

export const MAIN_BRAIN_CAPABILITY_REGISTRY: MainBrainCapabilityDefinition[] = [
  ...INTERNAL_MODULE_CAPABILITIES,
  ...SKILL_CAPABILITIES,
  ...SPECIALIST_AGENT_CAPABILITIES,
];

const normalizeCapabilityId = (value: string) => value.trim().toLowerCase();

export const listMainBrainCapabilities = (
  kinds?: MainBrainCapabilityDefinition['kind'][],
): MainBrainCapabilityDefinition[] => {
  if (!kinds || kinds.length === 0) {
    return [...MAIN_BRAIN_CAPABILITY_REGISTRY];
  }
  const kindSet = new Set(kinds);
  return MAIN_BRAIN_CAPABILITY_REGISTRY.filter((item) => kindSet.has(item.kind));
};

export const findMainBrainCapability = (
  capabilityId: string,
): MainBrainCapabilityDefinition | undefined => {
  const target = normalizeCapabilityId(capabilityId);
  return MAIN_BRAIN_CAPABILITY_REGISTRY.find((item) => {
    if (normalizeCapabilityId(item.id) === target) return true;
    return (item.aliases || []).some((alias) => normalizeCapabilityId(alias) === target);
  });
};

const summarizeCapabilityInputs = (capability: MainBrainCapabilityDefinition) => {
  const inputs = capability.inputs || [];
  if (inputs.length === 0) {
    return 'no explicit inputs';
  }
  return inputs
    .slice(0, 3)
    .map((field) => `${field.name}${field.required ? '*' : ''}`)
    .join(', ');
};

export const buildMainBrainCapabilityPromptSummary = ({
  preferredSkills = [],
  includeInternalModules = true,
  includeSpecialists = true,
}: {
  preferredSkills?: string[];
  includeInternalModules?: boolean;
  includeSpecialists?: boolean;
} = {}): string => {
  const sections: string[] = [];
  const preferredSet = new Set(preferredSkills.map((item) => normalizeCapabilityId(item)));

  if (includeInternalModules) {
    sections.push(
      '[Coordinator Modules: awareness only, not valid skillCalls]',
      ...INTERNAL_MODULE_CAPABILITIES.map(
        (capability) =>
          `- ${capability.id}: ${capability.purpose} Inputs: ${summarizeCapabilityInputs(capability)}.`,
      ),
    );
  }

  const prioritizedSkills = [
    ...SKILL_CAPABILITIES.filter((capability) =>
      preferredSet.has(normalizeCapabilityId(capability.id)) ||
      (capability.aliases || []).some((alias) => preferredSet.has(normalizeCapabilityId(alias))),
    ),
    ...SKILL_CAPABILITIES.filter(
      (capability) =>
        !preferredSet.has(normalizeCapabilityId(capability.id)) &&
        !(capability.aliases || []).some((alias) => preferredSet.has(normalizeCapabilityId(alias))),
    ),
  ];

  sections.push(
    '[Executable Skills: these are the only items that may appear in skillCalls]',
    ...prioritizedSkills.map((capability) => {
      const aliases =
        capability.aliases && capability.aliases.length > 0
          ? ` Aliases: ${capability.aliases.join(', ')}.`
          : '';
      return `- ${capability.id}: ${capability.purpose} Use when: ${capability.useWhen[0]} Inputs: ${summarizeCapabilityInputs(capability)}.${aliases}`;
    }),
  );

  if (includeSpecialists) {
    sections.push(
      '[Specialist Agents: routing targets, not skillCalls]',
      ...SPECIALIST_AGENT_CAPABILITIES.map(
        (capability) =>
          `- ${capability.id}: ${capability.purpose} Use when: ${capability.useWhen[0]}.`,
      ),
    );
  }

  return sections.join('\n');
};
