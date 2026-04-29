import React from "react";
import { ChevronDown, ChevronRight, Image as ImageIcon } from "lucide-react";
import type { ChatMessage } from "../../../types";

type BrowserSessionView = NonNullable<
  NonNullable<ChatMessage["agentData"]>["browserSession"]
>;

type AgentBrowserSessionCardProps = {
  session: BrowserSessionView;
  onPreview: (url: string) => void;
};

const STATUS_TONE: Record<
  string,
  {
    chip: string;
    dot: string;
  }
> = {
  pending: {
    chip: "border-gray-200 bg-gray-50 text-gray-600",
    dot: "bg-gray-400",
  },
  running: {
    chip: "border-blue-200 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  completed: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  completed_with_errors: {
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  failed: {
    chip: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
  cancelled: {
    chip: "border-gray-200 bg-gray-100 text-gray-600",
    dot: "bg-gray-400",
  },
  skipped: {
    chip: "border-gray-200 bg-gray-100 text-gray-500",
    dot: "bg-gray-400",
  },
};

const getTone = (status: string) => STATUS_TONE[status] || STATUS_TONE.pending;

const shouldOpenStepByDefault = (
  step: NonNullable<BrowserSessionView["steps"]>[number],
) =>
  step.status === "running" ||
  step.status === "failed" ||
  Boolean(step.error) ||
  (step.media?.length || 0) > 0;

export const AgentBrowserSessionCard: React.FC<
  AgentBrowserSessionCardProps
> = ({ session, onPreview }) => {
  const [expanded, setExpanded] = React.useState(true);
  const [openStepIds, setOpenStepIds] = React.useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        (session.steps || []).map((step) => [step.id, shouldOpenStepByDefault(step)]),
      ),
  );

  React.useEffect(() => {
    setOpenStepIds((current) =>
      Object.fromEntries(
        (session.steps || []).map((step) => [
          step.id,
          current[step.id] ?? shouldOpenStepByDefault(step),
        ]),
      ),
    );
  }, [session.steps]);

  const stepStats = session.stepStats;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start justify-between gap-3 px-3.5 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                getTone(session.status).chip
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${getTone(session.status).dot}`}
              />
              {session.statusLabel || session.status}
            </span>
            {session.targetElementLabel ? (
              <span className="truncate text-[11px] text-slate-500">
                {session.targetElementLabel}
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[13px] font-semibold text-slate-900">
            {session.title || "\u6267\u884c\u6b65\u9aa4"}
          </div>
          {session.summary ? (
            <div className="mt-1 text-[12px] leading-5 text-slate-600">
              {session.summary}
            </div>
          ) : null}
          {session.diagnosisSummary ? (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-5 text-amber-800">
              {session.diagnosisSummary}
            </div>
          ) : null}
          {session.repairSummary ? (
            <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] leading-5 text-emerald-800">
              {session.repairSummary}
            </div>
          ) : null}
          {session.repairNotes && session.repairNotes.length > 0 ? (
            <div className="mt-2 space-y-1 text-[11px] text-slate-600">
              {session.repairNotes.slice(0, 4).map((note, index) => (
                <div
                  key={`repair-note-${index}`}
                  className="rounded-lg bg-slate-50 px-2.5 py-2 leading-5"
                >
                  {`• ${note}`}
                </div>
              ))}
            </div>
          ) : null}
          {session.diagnosisIssues && session.diagnosisIssues.length > 0 ? (
            <div className="mt-2 space-y-1 text-[11px] text-amber-700">
              {session.diagnosisIssues.slice(0, 4).map((issue, index) => (
                <div
                  key={`diagnosis-issue-${index}`}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 leading-5"
                >
                  {`\u2022 ${issue}`}
                </div>
              ))}
            </div>
          ) : null}
          {stepStats ? (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                {`\u5171 ${stepStats.total} \u6b65`}
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                {`\u5b8c\u6210 ${stepStats.completed}`}
              </span>
              {stepStats.running > 0 ? (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                  {`\u8fdb\u884c\u4e2d ${stepStats.running}`}
                </span>
              ) : null}
              {stepStats.failed > 0 ? (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">
                  {`\u5931\u8d25 ${stepStats.failed}`}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="pt-0.5 text-slate-400">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-slate-100 px-3.5 py-3">
          <div className="space-y-2.5">
            {(session.steps || []).map((step, index) => {
              const isOpen = openStepIds[step.id] ?? shouldOpenStepByDefault(step);
              const media = step.media || [];
              const tone = getTone(step.status);
              return (
                <div
                  key={step.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenStepIds((current) => ({
                        ...current,
                        [step.id]: !isOpen,
                      }))
                    }
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[12px] font-semibold text-slate-900">
                          {step.title}
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone.chip}`}
                        >
                          {step.statusLabel || step.status}
                        </span>
                        {step.actionLabel ? (
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                            {step.actionLabel}
                          </span>
                        ) : null}
                      </div>
                      {step.summary ? (
                        <div className="mt-1 text-[11px] leading-5 text-slate-600">
                          {step.summary}
                        </div>
                      ) : null}
                    </div>
                    <div className="pt-0.5 text-slate-400">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-slate-200 bg-white/80 px-3 py-3">
                      {step.error ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] leading-5 text-red-700">
                          {step.error}
                        </div>
                      ) : null}

                      {media.length > 0 ? (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {media.map((item, mediaIndex) => (
                            <button
                              key={`${step.id}-${item.url}-${mediaIndex}`}
                              type="button"
                              onClick={() => onPreview(item.url)}
                              className="group/media overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
                              style={{ width: 132 }}
                            >
                              <div className="aspect-square overflow-hidden bg-slate-100">
                                <img
                                  src={item.url}
                                  alt={item.title}
                                  className="h-full w-full object-cover transition duration-300 group-hover/media:scale-[1.03]"
                                />
                              </div>
                              <div className="border-t border-slate-200 bg-white px-2 py-1.5">
                                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-700">
                                  <ImageIcon size={11} />
                                  <span className="truncate">{item.title}</span>
                                </div>
                                {item.subtitle ? (
                                  <div className="mt-0.5 truncate text-[10px] text-slate-500">
                                    {item.subtitle}
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {step.resultSummary && step.resultSummary.length > 0 ? (
                        <div className="space-y-1.5">
                          {step.resultSummary.map((line, lineIndex) => (
                            <div
                              key={`${step.id}-result-${lineIndex}`}
                              className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-5 text-slate-600"
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {step.inputSummary && step.inputSummary.length > 0 ? (
                        <div className="mt-3">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            {"\u8f93\u5165"}
                          </div>
                          <div className="space-y-1.5">
                            {step.inputSummary.map((line, lineIndex) => (
                              <div
                                key={`${step.id}-input-${lineIndex}`}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] leading-5 text-slate-500"
                              >
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
