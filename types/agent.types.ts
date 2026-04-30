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
  research?: AgentResearchContext;
}

export interface AgentTaskMetadata {
  topicId?: string;
  enableWebSearch?: boolean;
  agentSelectionMode?: 'auto' | 'manual';
  pinnedAgentId?: AgentType;
  roleStrategy?: 'reuse' | 'augment' | 'create';
  roleStrategyReason?: string;
  roleDraft?: AgentRoleDraft;
  rolePromptAddon?: string;
  rolePromptLabel?: string;
  internalCall?: boolean;
  requestId?: string;
  timeoutMs?: number;
  creationMode?: 'agent' | 'image' | 'video';
  workflowMode?: 'fast' | 'designer';
  preferredAspectRatio?: string;
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
    error?: { message: string; code?: string; details?: unknown };
  };
  createdAt: number;
  updatedAt: number;
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
