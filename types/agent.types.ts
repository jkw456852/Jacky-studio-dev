export type { ProjectContext } from './common';
import type { ProjectContext } from './common';
import type { ImageTextPolicy, PromptLanguagePolicy } from '../services/providers/types';
import type { SearchResponse } from '../services/research/search.service';

export type AgentType =
  | 'coco'
  | 'vireo'
  | 'cameron'
  | 'poster'
  | 'package'
  | 'motion'
  | 'campaign'
  | 'prompt-optimizer';

export interface AgentInfo {
  id: AgentType;
  name: string;
  avatar: string;
  description: string;
  capabilities: string[];
  color: string;
}

export interface AgentRoleDraft {
  title: string;
  summary: string;
  instructions: string[];
}

export type RoleSource = 'system' | 'user' | 'temporary' | 'promoted';

export type RoleStatus = 'draft' | 'active' | 'archived';

export type RoleGovernanceMode =
  | 'manual_only'
  | 'draft_only'
  | 'approval_required'
  | 'auto_manage';

export interface StudioRoleEntity {
  id: string;
  slug: string;
  title: string;
  summary: string;
  baseAgentId: AgentType;
  source: RoleSource;
  status: RoleStatus;
  tags: string[];
  useWhen: string[];
  avoidWhen: string[];
  toolPolicy: {
    allowedSkills?: string[];
    blockedSkills?: string[];
    canRouteSubtasks: boolean;
    canUseNetworkResearch: boolean;
  };
  routingPolicy: {
    priority: number;
    keywords: string[];
    preferredTaskModes: string[];
    autoRouteEligible: boolean;
  };
  promptLayers: {
    systemBaseline: string;
    mainBrainShared: string;
    durableRoleAddon: string;
  };
  governance: {
    mode: RoleGovernanceMode;
    requiresHumanApproval: boolean;
    allowMainBrainPromotion: boolean;
    allowMainBrainArchive: boolean;
    allowMainBrainMutation: boolean;
  };
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface StudioTemporaryRoleDraft {
  id: string;
  targetRoleId?: string | null;
  targetBaseAgentId: AgentType;
  title: string;
  summary: string;
  instructions: string[];
  roleStrategy: 'reuse' | 'augment' | 'create';
  roleStrategyReason: string;
  sourceTaskId?: string;
  sourceConversationId?: string;
  promotionSuggested: boolean;
  promotedRoleId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface StudioRoleVersionRecord {
  id: string;
  roleId: string;
  version: number;
  changeType: 'create' | 'update' | 'promote' | 'archive' | 'rollback';
  summary: string;
  diffPreview?: string;
  snapshot: StudioRoleEntity;
  actor: 'user' | 'main_brain' | 'system';
  createdAt: number;
}

export type MainBrainMutationResource =
  | 'role'
  | 'role-addon'
  | 'main-brain-soul'
  | 'main-brain-user'
  | 'main-brain-workflow'
  | 'main-brain-memory'
  | 'main-brain-heartbeat'
  | 'main-brain-bootstrap';

export type MainBrainMutationOperation =
  | 'read'
  | 'create'
  | 'update'
  | 'archive'
  | 'promote'
  | 'delete'
  | 'bind'
  | 'suggest';

export interface MainBrainMutationEnvelope {
  resource: MainBrainMutationResource;
  operation: MainBrainMutationOperation;
  targetId?: string;
  targetBaseAgentId?: AgentType;
  payload?: Record<string, unknown>;
  governanceMode?: RoleGovernanceMode;
  requiresHumanApproval?: boolean;
  reason: string;
}

export interface MainBrainRoleGovernanceAction {
  action:
    | 'read'
    | 'bind'
    | 'draft_create'
    | 'draft_update'
    | 'promote'
    | 'archive'
    | 'addon_update'
    | 'suggest_replacement';
  capabilityId?: string;
  mutation?: MainBrainMutationEnvelope;
  targetRoleId?: string;
  targetBaseAgentId?: AgentType;
  governanceMode?: RoleGovernanceMode;
  requiresHumanApproval?: boolean;
  promptAddonText?: string;
  reason: string;
}

export interface MainBrainRoleGovernanceAudit {
  summary?: string;
  actions: MainBrainRoleGovernanceAction[];
}

export interface AgentResearchCitation {
  title: string;
  url: string;
}

export interface AgentResearchContext {
  requestId: string;
  query: string;
  mode: SearchResponse['mode'];
  provider?: SearchResponse['provider'];
  suggestedQueries: string[];
  reportBrief: string;
  reportFull: string;
  citations: AgentResearchCitation[];
}

export interface AgentReferenceWebPage {
  title: string;
  url: string;
  snippet?: string;
}

export interface AgentMultimodalContext {
  referenceImageUrls: string[];
  referenceWebPages?: AgentReferenceWebPage[];
  referenceSummary?: string;
  hasReferences?: boolean;
  referencePolicy?: 'default' | 'uploaded-only';
  uploadedAttachmentCount?: number;
  isolateVisualQa?: boolean;
  research?: AgentResearchContext;
}

export interface AgentTaskMetadata {
  topicId?: string;
  enableWebSearch?: boolean;
  webResearchStatus?: 'skipped' | 'success' | 'failed';
  webResearchError?: string;
  allowAutonomousRouting?: boolean;
  agentSelectionMode?: 'auto' | 'manual';
  pinnedAgentId?: AgentType;
  selectedRoleId?: string;
  selectedRoleSource?: RoleSource;
  baseAgentId?: AgentType;
  roleGovernanceMode?: RoleGovernanceMode;
  allowMainBrainRoleMutation?: boolean;
  allowMainBrainRolePromotion?: boolean;
  roleStrategy?: 'reuse' | 'augment' | 'create';
  roleStrategyReason?: string;
  roleDraft?: AgentRoleDraft;
  rolePromptAddon?: string;
  rolePromptLabel?: string;
  internalCall?: boolean;
  requestId?: string;
  timeoutMs?: number;
  taskMode?: string;
  creationMode?: 'agent' | 'image' | 'video';
  workflowMode?: 'fast' | 'designer';
  preferredAspectRatio?: string;
  preferredImageModel?: string;
  preferredImageProviderId?: string | null;
  preferredImageSize?: '1K' | '2K' | '4K';
  preferredImageCount?: 1 | 2 | 3 | 4;
  promptLanguagePolicy?: PromptLanguagePolicy;
  textRenderPolicy?: ImageTextPolicy;
  imageHostProvider?: string;
  forceSkills?: boolean;
  executeProposalId?: string;
  selectedSkillCalls?: SkillCall[];
  skillData?: {
    id?: string;
    pluginId?: string;
    name?: string;
    iconName?: string;
    config?: Record<string, unknown>;
  };
  brandContextSummary?: string;
  topicPinnedContext?: string;
  conversationConstraintSummary?: string;
  referenceIntentSummary?: string;
  memoryCaptureSummary?: string;
  knowledgeCaptureItems?: string[];
  multimodalContext?: AgentMultimodalContext;
}

export interface AgentRoutingDecision {
  action?: 'route' | 'clarify' | 'respond';
  targetAgent: AgentType;
  taskType: string;
  complexity: 'simple' | 'complex';
  handoffMessage: string;
  confidence: number;
  roleStrategy?: 'reuse' | 'augment' | 'create';
  roleStrategyReason?: string;
  roleDraft?: AgentRoleDraft;
  message?: string;
  questions?: string[];
  suggestions?: string[];
}

export type TaskStatus = 'pending' | 'analyzing' | 'executing' | 'completed' | 'failed';

export interface AgentProposal {
  id: string;
  title: string;
  description: string;
  preview?: string;
  skillCalls: SkillCall[];
}

export interface AgentTask {
  id: string;
  agentId: AgentType;
  status: TaskStatus;
  progressMessage?: string;  // 实时进度消息（如"收集灵感..."、"生成图片中..."）
  progressStep?: number;     // 当前步骤 (1-based)
  totalSteps?: number;       // 总步骤数
  progressLog?: string[];    // 所有历史步骤消息（用于展开显示思考过程）
  input: {
    message: string;
    attachments?: File[];
    uploadedAttachments?: string[]; // 已上传到图床的公网 URL
    context: ProjectContext;
    metadata?: AgentTaskMetadata;
  };
  output?: {
    message: string;
    analysis?: string;
    preGenerationMessage?: string;
    postGenerationSummary?: string;
    questions?: string[];
    suggestions?: string[];
    proposals?: AgentProposal[];
    assets?: GeneratedAsset[];
    imageUrls?: string[];
    skillCalls?: SkillCall[];
    adjustments?: string[];
    roleGovernanceAudit?: MainBrainRoleGovernanceAudit;
    runtime?: AgentTaskRuntimeEnvelope;
    error?: { message: string; code?: string; details?: unknown };
  };
  createdAt: number;
  updatedAt: number;
}

export interface AgentTaskRuntimeEnvelope {
  mode: 'direct-response' | 'skill-execution' | 'autonomous-main-brain';
  stopReason?:
    | 'responded'
    | 'max-turns'
    | 'max-execution-rounds'
    | 'empty-plan'
    | 'wait-for-input'
    | 'stalled';
  stopReasonLabel?:
    | 'answered'
    | 'need-user-input'
    | 'retry-limit'
    | 'stalled'
    | 'turn-limit'
    | 'empty-plan';
  proposalCount?: number;
  assetCount?: number;
  skillCallCount?: number;
  successfulSkillCount?: number;
  failedSkillCount?: number;
  executionRounds?: number;
  turnCount?: number;
}

export interface GeneratedAsset {
  id: string;
  type: 'image' | 'video' | 'text';
  url: string;
  metadata: {
    prompt?: string;
    model?: string;
    agentId: AgentType;
    width?: number;
    height?: number;
  };
}



export interface SkillCall {
  skillName: string;
  params: Record<string, any>;
  result?: any;
  error?: string;
}

export type MainBrainCapabilityKind =
  | 'skill'
  | 'internal-module'
  | 'specialist-agent'
  | 'governance-skill';

export type MainBrainCapabilityAuditChannel =
  | 'skillCalls'
  | 'roleGovernanceAudit'
  | 'routing-only'
  | 'awareness-only';

export interface MainBrainCapabilityField {
  name: string;
  description: string;
  required?: boolean;
}

export interface MainBrainCapabilityPermissionPolicy {
  governanceModes?: RoleGovernanceMode[];
  requiresRoleMutation?: boolean;
  requiresRolePromotion?: boolean;
  requireHumanApprovalByDefault?: boolean;
}

export interface MainBrainCapabilityDefinition {
  id: string;
  kind: MainBrainCapabilityKind;
  label: string;
  purpose: string;
  plannerSummary?: string;
  useWhen: string[];
  avoidWhen?: string[];
  inputs?: MainBrainCapabilityField[];
  outputs?: string[];
  sideEffects?: string[];
  aliases?: string[];
  tags?: string[];
  auditChannel?: MainBrainCapabilityAuditChannel;
  executorKey?: string;
  mutation?: {
    resource: MainBrainMutationResource;
    operation: MainBrainMutationOperation;
  };
  permissionPolicy?: MainBrainCapabilityPermissionPolicy;
  exampleAction?: Record<string, unknown>;
}
