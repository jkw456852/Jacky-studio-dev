import type { AgentTask } from '../../types/agent.types.ts';
import {
  isImageGenerationSkillName,
  isVisualReferenceResolutionSkillName,
} from '../skills/skill-manifest.ts';
import {
  applyEnvironmentReferenceProtocol,
  type EnvironmentReferenceProtocolDependencies,
} from './environment-input-protocol.ts';
import {
  assertSkillExists,
  ensureSkillParamsObject,
  injectExecutionPreferences,
} from './skill-call-normalizer.ts';

export interface SkillExecutionPreprocessResult {
  call: any;
  diagnostics: {
    referencesResolved?: {
      sourceCount: number;
      injectedCount: number;
      truncated: boolean;
      omittedCount: number;
      autoInjectedAttachmentToken?: string;
    };
  };
}

export interface SkillExecutionPreprocessorDependencies {
  applyEnvironmentReferenceProtocolFn?: typeof applyEnvironmentReferenceProtocol;
}

export const injectVisualConsistencyDefaults = (call: any, task: AgentTask) => {
  if (!isImageGenerationSkillName(call.skillName)) {
    return call;
  }

  if (typeof call.params.referenceStrength !== 'number') {
    call.params.referenceStrength = 0.75;
  }
  if (!call.params.referencePriority) {
    call.params.referencePriority =
      task.input.context.designSession?.subjectAnchors?.length &&
      task.input.context.designSession.subjectAnchors.length > 1
        ? 'all'
        : 'first';
  }
  if (!call.params.referenceMode) {
    call.params.referenceMode = 'product';
  }
  if (!call.params.consistencyContext) {
    call.params.consistencyContext = {
      approvedAssetIds: task.input.context.designSession?.approvedAssetIds || [],
      subjectAnchors: task.input.context.designSession?.subjectAnchors || [],
      referenceSummary: task.input.context.designSession?.referenceSummary,
      forbiddenChanges: task.input.context.designSession?.forbiddenChanges || [],
    };
  }

  return call;
};

export const shouldResolveVisualReferences = (skillName: string) =>
  isVisualReferenceResolutionSkillName(skillName);

export const validateForcedAttachmentRequirements = (call: any, task: AgentTask) => {
  if (
    !(
      (call.skillName === 'generateImage' ||
        call.skillName === 'generateVideo' ||
        call.skillName === 'smartEdit') &&
      task.input.metadata?.forceSkills
    )
  ) {
    return;
  }

  const refKey = call.skillName === 'smartEdit' ? 'sourceUrl' : 'referenceImage';
  const refVal = call.params?.[refKey];
  const requiresAttachment =
    (typeof refVal === 'string' && refVal.startsWith('ATTACHMENT_')) ||
    call.skillName === 'smartEdit';

  if (
    requiresAttachment &&
    (!task.input.attachments || task.input.attachments.length === 0)
  ) {
    throw new Error(
      '执行方案时缺少参考附件，请先在输入区保留产品图或标记图后再执行。',
    );
  }
};

export const prepareSkillExecutionCall = async ({
  call,
  task,
  callIndex,
  maxReferenceImages,
  dependencies,
  protocolDependencies,
}: {
  call: any;
  task: AgentTask;
  callIndex: number;
  maxReferenceImages: number;
  dependencies?: SkillExecutionPreprocessorDependencies;
  protocolDependencies?: EnvironmentReferenceProtocolDependencies;
}): Promise<SkillExecutionPreprocessResult> => {
  ensureSkillParamsObject(call);
  assertSkillExists(call);
  injectExecutionPreferences(call, task);
  validateForcedAttachmentRequirements(call, task);
  injectVisualConsistencyDefaults(call, task);

  const applyEnvironmentReferenceProtocolFn =
    dependencies?.applyEnvironmentReferenceProtocolFn || applyEnvironmentReferenceProtocol;

  const resolvedRefs = shouldResolveVisualReferences(call.skillName)
    ? await applyEnvironmentReferenceProtocolFn({
        task,
        call,
        callIndex,
        maxReferenceImages,
        dependencies: protocolDependencies,
      })
    : null;

  return {
    call,
    diagnostics: {
      referencesResolved: resolvedRefs
        ? {
            sourceCount: resolvedRefs.sourceCount,
            injectedCount: resolvedRefs.references.length,
            truncated: resolvedRefs.truncated,
            omittedCount: resolvedRefs.omittedCount,
            autoInjectedAttachmentToken: resolvedRefs.autoInjectedAttachmentToken,
          }
        : undefined,
    },
  };
};
