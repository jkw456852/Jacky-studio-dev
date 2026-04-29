import { useCallback } from "react";
import { validateApprovedAnchorConsistency } from "../../../services/validators";
import {
  addTopicMemoryItem,
  extractConstraintHints,
  mergeUniqueStrings,
  rememberApprovedAsset,
  summarizeReferenceSet,
  upsertTopicSnapshot,
} from "../../../services/topic-memory";
import { useProjectStore } from "../../../stores/project.store";
import type { CanvasElement, ChatMessage } from "../../../types";
import type { DesignTaskMode } from "../../../types/common";

type UseWorkspaceDesignConsistencyArgs = {
  ensureTopicId: () => string;
  addMessage: (message: ChatMessage) => void;
};

export const useWorkspaceDesignConsistency = ({
  ensureTopicId,
  addMessage,
}: UseWorkspaceDesignConsistencyArgs) => {
  const getElementReferenceSummary = useCallback(
    (element?: CanvasElement | null, extraRefs: string[] = []) => {
      const refs = [
        ...(element?.genRefImages || []),
        element?.genRefImage || "",
        ...(element?.genVideoRefs || []),
        ...extraRefs,
      ].filter(Boolean) as string[];

      return summarizeReferenceSet(refs);
    },
    [],
  );

  const persistEditSession = useCallback(
    async (
      mode: DesignTaskMode,
      element: CanvasElement,
      details: {
        instruction: string;
        referenceUrls?: string[];
        analysis?: string;
        constraints?: string[];
        researchSummary?: string;
      },
    ) => {
      const topicId = ensureTopicId();
      const referenceSummary = getElementReferenceSummary(
        element,
        details.referenceUrls || [],
      );
      const normalizedConstraints = mergeUniqueStrings(
        extractConstraintHints(details.instruction),
        details.constraints || [],
        20,
      );
      const designSession = useProjectStore.getState().designSession;

      useProjectStore.getState().actions.updateDesignSession({
        taskMode: mode,
        referenceSummary,
        subjectAnchors: mergeUniqueStrings(
          designSession.subjectAnchors || [],
          [
            ...(details.referenceUrls || []),
            ...(element?.genRefImages || []),
            element?.genRefImage || "",
          ].filter(Boolean) as string[],
          8,
        ),
        constraints: mergeUniqueStrings(
          designSession.constraints || [],
          normalizedConstraints,
          20,
        ),
        styleHints: mergeUniqueStrings(
          designSession.styleHints || [],
          [details.analysis || "", details.researchSummary || ""].filter(
            Boolean,
          ),
          12,
        ),
        researchSummary:
          details.researchSummary || designSession.researchSummary,
      });

      if (!topicId) return;

      await upsertTopicSnapshot(topicId, {
        summaryText: referenceSummary,
        pinned: {
          constraints: normalizedConstraints,
          decisions: mergeUniqueStrings(
            useProjectStore.getState().designSession.styleHints || [],
            [mode, details.analysis || ""].filter(Boolean),
            20,
          ),
        },
      });

      await addTopicMemoryItem({
        topicId,
        type: "instruction",
        text: `[${mode}] ${details.instruction}`,
      });

      if (details.analysis) {
        await addTopicMemoryItem({
          topicId,
          type: "analysis",
          text: details.analysis,
        });
      }
    },
    [ensureTopicId, getElementReferenceSummary],
  );

  const getDesignConsistencyContext = useCallback(() => {
    const session = useProjectStore.getState().designSession;
    if (session.consistencyCheckEnabled === false) {
      return {};
    }
    const currentAnchorUrl =
      session.subjectAnchors?.[session.subjectAnchors.length - 1] || undefined;
    return {
      approvedAssetIds: session.approvedAssetIds || [],
      subjectAnchors: session.subjectAnchors || [],
      currentAnchorUrl,
      referenceSummary: session.referenceSummary,
      forbiddenChanges: session.forbiddenChanges || [],
    };
  }, []);

  const mergeConsistencyAnchorIntoReferences = useCallback(
    (referenceUrls: string[] = []) => {
      const session = useProjectStore.getState().designSession;
      const normalizedReferences = (referenceUrls || [])
        .map((url) => String(url || "").trim())
        .filter(Boolean);

      if (session.consistencyCheckEnabled === false) {
        return normalizedReferences;
      }

      const currentAnchorUrl = String(
        session.subjectAnchors?.[session.subjectAnchors.length - 1] || "",
      ).trim();

      if (!currentAnchorUrl) {
        return normalizedReferences;
      }

      return [
        currentAnchorUrl,
        ...normalizedReferences.filter((url) => url !== currentAnchorUrl),
      ];
    },
    [],
  );

  const setConsistencyCheckEnabled = useCallback((enabled: boolean) => {
    useProjectStore.getState().actions.updateDesignSession({
      consistencyCheckEnabled: enabled,
    });
  }, []);

  const setApprovedAnchor = useCallback(
    async (
      anchorUrl: string,
      options?: {
        summary?: string;
        decision?: string;
        approvedAssetId?: string;
        persistToMemory?: boolean;
        mode?: "auto" | "manual";
      },
    ) => {
      const normalizedUrl = String(anchorUrl || "").trim();
      if (!normalizedUrl) {
        return null;
      }

      const session = useProjectStore.getState().designSession;
      const summary = options?.summary || summarizeReferenceSet([normalizedUrl]);
      const approvedAssetIds = options?.approvedAssetId
        ? mergeUniqueStrings(
            session.approvedAssetIds || [],
            [options.approvedAssetId],
            12,
          )
        : session.approvedAssetIds || [];

      useProjectStore.getState().actions.updateDesignSession({
        approvedAssetIds,
        subjectAnchorMode: options?.mode || "manual",
        subjectAnchors: mergeUniqueStrings(
          (session.subjectAnchors || []).filter((url) => url !== normalizedUrl),
          [normalizedUrl],
          8,
        ),
        referenceSummary: summary,
      });

      if (
        options?.persistToMemory !== false &&
        !/^data:image\/.+;base64,/i.test(normalizedUrl)
      ) {
        const topicId = ensureTopicId();
        if (topicId) {
          try {
            await rememberApprovedAsset(topicId, {
              url: normalizedUrl,
              role: "result",
              summary,
              decision: options?.decision || "Updated design consistency anchor.",
            });
          } catch (error) {
            console.warn("[Workspace] remember approved anchor failed:", error);
          }
        }
      }

      return normalizedUrl;
    },
    [ensureTopicId],
  );

  const setApprovedAnchorFromFile = useCallback(
    async (file: File) => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () =>
          reject(reader.error || new Error("anchor_file_read_failed"));
        reader.readAsDataURL(file);
      });

      return setApprovedAnchor(dataUrl, {
        summary: file.name
          ? `Manual anchor: ${file.name}`
          : "Manual design consistency anchor",
        decision: file.name
          ? `Set uploaded image as current design anchor: ${file.name}`
          : "Set uploaded image as current design anchor.",
        persistToMemory: false,
        mode: "manual",
      });
    },
    [setApprovedAnchor],
  );

  const clearApprovedAnchor = useCallback(() => {
    useProjectStore.getState().actions.updateDesignSession({
      subjectAnchorMode: "auto",
      subjectAnchors: [],
      referenceSummary: "",
    });
  }, []);

  const validateAgainstApprovedAnchor = useCallback(
    async (candidateUrl: string, genPrompt?: string) => {
      const session = useProjectStore.getState().designSession;
      if (session.consistencyCheckEnabled === false) {
        return { pass: true, reasons: [] as string[] };
      }
      const approvedAnchor =
        session.subjectAnchors?.[session.subjectAnchors.length - 1];

      if (!approvedAnchor || !candidateUrl) {
        return { pass: true, reasons: [] as string[] };
      }

      try {
        return await validateApprovedAnchorConsistency(
          approvedAnchor,
          candidateUrl,
          session.referenceSummary || "",
          session.forbiddenChanges || [],
          genPrompt,
        );
      } catch (error) {
        console.warn("[Workspace] consistency validation skipped:", error);
        return { pass: true, reasons: [] as string[] };
      }
    },
    [],
  );

  const maybeWarnConsistencyDrift = useCallback(
    async (candidateUrl: string, label: string, genPrompt?: string) => {
      const validation = await validateAgainstApprovedAnchor(candidateUrl, genPrompt);

      if (!validation.pass) {
        const reasonText =
          validation.reasons && validation.reasons.length > 0
            ? validation.reasons.join("；")
            : "当前结果与已采用锚点存在明显偏差。";
        addMessage({
          id: `consistency-warn-${Date.now()}`,
          role: "model",
          text: `${label}与当前已采用锚点存在偏差：${reasonText}${validation.suggestedFix ? `。建议：${validation.suggestedFix}` : ""}`,
          timestamp: Date.now(),
          error: true,
        });
      }

      return validation;
    },
    [addMessage, validateAgainstApprovedAnchor],
  );

  const retryWithConsistencyFix = useCallback(
    async (
      label: string,
      initialUrl: string,
      rerun: (fixPrompt?: string) => Promise<string | null>,
      _anchorOverride?: string,
      genPrompt?: string,
    ) => {
      const validation = await maybeWarnConsistencyDrift(
        initialUrl,
        label,
        genPrompt,
      );
      if (validation.pass || !validation.suggestedFix) {
        return initialUrl;
      }

      addMessage({
        id: `consistency-retry-${Date.now()}`,
        role: "model",
        text: `${label}正在根据一致性质检建议自动修正一次：${validation.suggestedFix}`,
        timestamp: Date.now(),
      });

      const retriedUrl = await rerun(validation.suggestedFix);
      if (!retriedUrl) {
        return initialUrl;
      }

      const retriedPrompt = genPrompt
        ? `${genPrompt}\n\nConsistency fix: ${validation.suggestedFix}`
        : validation.suggestedFix;
      await maybeWarnConsistencyDrift(
        retriedUrl,
        `${label} (auto-fixed)`,
        retriedPrompt,
      );
      return retriedUrl;
    },
    [addMessage, maybeWarnConsistencyDrift],
  );

  return {
    getElementReferenceSummary,
    persistEditSession,
    getDesignConsistencyContext,
    mergeConsistencyAnchorIntoReferences,
    setConsistencyCheckEnabled,
    setApprovedAnchor,
    setApprovedAnchorFromFile,
    clearApprovedAnchor,
    validateAgainstApprovedAnchor,
    maybeWarnConsistencyDrift,
    retryWithConsistencyFix,
  };
};

