import type { AgentTaskMetadata } from '../../types/agent.types';
import type { DesignSessionState } from '../../types/common';
import {
  extractConstraintHints,
  mergeUniqueStrings,
  rememberApprovedAsset,
  summarizeReferenceSet,
  upsertTopicSnapshot,
} from '../topic-memory.ts';

interface DesignSessionActions {
  updateDesignSession: (updates: Partial<DesignSessionState>) => void;
}

interface SyncDesignSessionOptions {
  projectActions: DesignSessionActions;
  existingDesignSession: DesignSessionState;
  metadata?: AgentTaskMetadata;
  inferredTaskMode: string;
  message: string;
  referenceSummary: string;
  referenceImageUrls: string[];
}

interface SyncTopicSnapshotOptions {
  topicId: string;
  existingDesignSession: DesignSessionState;
  metadata?: AgentTaskMetadata;
  message: string;
  referenceSummary: string;
}

interface PersistApprovedAssetsOptions {
  topicId: string;
  approvedUrls: string[];
  decisionLabel: string;
}

export const syncDesignSessionState = ({
  projectActions,
  existingDesignSession,
  metadata,
  inferredTaskMode,
  message,
  referenceSummary,
  referenceImageUrls,
}: SyncDesignSessionOptions) => {
  const sessionConstraints = extractConstraintHints(message);

  projectActions.updateDesignSession({
    taskMode: inferredTaskMode as DesignSessionState['taskMode'],
    referenceSummary,
    subjectAnchors: referenceImageUrls.slice(0, 8),
    styleHints: mergeUniqueStrings(
      [
        ...(existingDesignSession?.styleHints || []),
        typeof metadata?.creationMode === 'string' ? metadata.creationMode : '',
        typeof metadata?.multimodalContext?.research?.reportBrief === 'string'
          ? metadata.multimodalContext.research.reportBrief
          : '',
      ].filter(Boolean),
      [],
      8,
    ),
    constraints: mergeUniqueStrings(
      [
        ...(existingDesignSession?.constraints || []),
        ...sessionConstraints,
      ],
      [],
      20,
    ),
    researchSummary:
      typeof metadata?.multimodalContext?.research?.reportBrief === 'string'
        ? metadata.multimodalContext.research.reportBrief
        : existingDesignSession?.researchSummary,
    referenceWebPages: Array.isArray(metadata?.multimodalContext?.referenceWebPages)
      ? metadata.multimodalContext.referenceWebPages.slice(0, 8)
      : existingDesignSession?.referenceWebPages,
  });
};

export const syncTopicSnapshotState = async ({
  topicId,
  existingDesignSession,
  metadata,
  message,
  referenceSummary,
}: SyncTopicSnapshotOptions) => {
  const sessionConstraints = extractConstraintHints(message);
  const researchBrief = metadata?.multimodalContext?.research?.reportBrief;
  const topicConstraints = mergeUniqueStrings(
    sessionConstraints,
    typeof researchBrief === 'string' && researchBrief ? [researchBrief] : [],
    20,
  );
  const topicDecisions = mergeUniqueStrings(
    existingDesignSession?.styleHints || [],
    typeof metadata?.creationMode === 'string' ? [metadata.creationMode] : [],
    20,
  );

  await upsertTopicSnapshot(topicId, {
    summaryText: referenceSummary || existingDesignSession?.referenceSummary || '',
    pinned: {
      constraints: topicConstraints,
      decisions: topicDecisions,
    },
  });
};

export const persistApprovedAssetsToTopic = async ({
  topicId,
  approvedUrls,
  decisionLabel,
}: PersistApprovedAssetsOptions) => {
  for (const url of approvedUrls.slice(0, 4)) {
    await rememberApprovedAsset(topicId, {
      url,
      role: 'result',
      summary: summarizeReferenceSet([url]),
      decision: decisionLabel,
    });
  }
};
