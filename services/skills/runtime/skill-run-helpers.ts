import {
  getDefaultSkillRunRecorder,
  type RecordedRunStart,
  type SkillRunRecorder,
  type StartRunFromLegacyArgs,
} from "../runs/skill-run-recorder.ts";
import type { LegacySkillResolverOptions } from "../legacy/legacy-skill-catalog.ts";
import type { RuntimeSkillData } from "../identity/skill-identity-resolver.ts";

export interface MetadataLike {
  skillData?: RuntimeSkillData | null;
  conversationId?: string;
  messageId?: string;
  allowAutonomousRouting?: boolean;
  skillFollowUpMode?: string;
}

export interface RecordRunFromExecutionContextArgs {
  metadata?: MetadataLike | null;
  prompt: string;
  attachments?: Array<Record<string, unknown>>;
  conversationId?: string;
  messageId?: string;
  triggerMode?: StartRunFromLegacyArgs["triggerMode"];
  initialStatus?: StartRunFromLegacyArgs["initialStatus"];
  contextSnapshot?: unknown;
  resolverOptions?: LegacySkillResolverOptions;
  recorder?: SkillRunRecorder;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const recordRunFromExecutionContext = (
  args: RecordRunFromExecutionContextArgs,
): RecordedRunStart | null => {
  const recorder = args.recorder ?? getDefaultSkillRunRecorder();
  const metadata = args.metadata ?? null;
  const skillData = metadata?.skillData ?? null;
  const legacyConfig =
    skillData && isRecord(skillData.config) ? (skillData.config as Record<string, unknown>) : null;

  if (!skillData && !legacyConfig) return null;

  return recorder.startRunFromLegacy({
    skillData,
    legacyConfig,
    conversationId: args.conversationId ?? metadata?.conversationId,
    messageId: args.messageId ?? metadata?.messageId,
    prompt: args.prompt,
    attachments: args.attachments,
    contextSnapshot: args.contextSnapshot,
    triggerMode: args.triggerMode,
    initialStatus: args.initialStatus,
    resolverOptions: args.resolverOptions,
  });
};

export const finalizeRunFromExecutionOutcome = (
  runId: string,
  outcome:
    | { kind: "success"; output?: { text?: string; artifacts?: Array<Record<string, unknown>>; structured?: unknown } }
    | { kind: "failure"; error: { code: string; message: string; stage?: string } }
    | { kind: "cancelled" },
  recorder: SkillRunRecorder = getDefaultSkillRunRecorder(),
) => {
  const current = recorder.store.get(runId);
  if (!current) return null;
  // success / failure paths require we leave 'queued' first; auto-walk through
  // running so callers do not need to track lifecycle bookkeeping themselves.
  if (
    (outcome.kind === "success" || outcome.kind === "failure") &&
    current.status === "queued"
  ) {
    recorder.markRunning(runId);
  }
  return recorder.finishWith(runId, outcome);
};
