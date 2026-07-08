"use client";

import { memo, useCallback, useRef, useState } from "react";
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  LoaderIcon,
  XCircleIcon,
} from "lucide-react";
import {
  type ToolApprovalOption,
  type ToolCallMessagePart,
  type ToolCallMessagePartComponent,
  type ToolCallMessagePartProps,
  type ToolCallMessagePartStatus,
  useScrollLock,
  useToolCallElapsed,
} from "@assistant-ui/react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const ANIMATION_DURATION = 200;
const pressable = "active:scale-[0.98]";

export type ToolFallbackRootProps = Omit<
  React.ComponentProps<typeof Collapsible>,
  "onOpenChange" | "open"
> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
};

function ToolFallbackRoot({
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  children,
  ...props
}: ToolFallbackRootProps) {
  const collapsibleRef = useRef<HTMLDivElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      lockScroll();
      if (!isControlled) {
        setUncontrolledOpen(open);
      }
      controlledOnOpenChange?.(open);
    },
    [lockScroll, isControlled, controlledOnOpenChange],
  );

  return (
    <Collapsible
      ref={collapsibleRef}
      data-slot="tool-fallback-root"
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={cn(
        "aui-tool-fallback-root group/tool-fallback-root w-full",
        className,
      )}
      style={
        {
          "--animation-duration": `${ANIMATION_DURATION}ms`,
        } as React.CSSProperties
      }
      {...props}
    >
      {children}
    </Collapsible>
  );
}

type ToolStatus = ToolCallMessagePartStatus["type"];

const statusIconMap: Record<ToolStatus, React.ElementType> = {
  running: LoaderIcon,
  complete: CheckIcon,
  incomplete: XCircleIcon,
  "requires-action": AlertCircleIcon,
};

const formatToolDuration = (ms: number) => {
  if (ms < 1000) return "<1s";
  const seconds = ms / 1000;
  if (seconds < 10) return `${(Math.floor(seconds * 10) / 10).toFixed(1)}s`;
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
};

function ToolFallbackDuration({
  className,
  ...props
}: React.ComponentProps<"span">) {
  const elapsedMs = useToolCallElapsed();
  if (elapsedMs === undefined) return null;

  return (
    <span
      data-slot="tool-fallback-duration"
      className={cn(
        "aui-tool-fallback-duration text-muted-foreground text-xs tabular-nums",
        className,
      )}
      {...props}
    >
      {formatToolDuration(elapsedMs)}
    </span>
  );
}

function ToolFallbackTrigger({
  toolName,
  status,
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
  toolName: string;
  status?: ToolCallMessagePartStatus;
}) {
  const statusType = status?.type ?? "complete";
  const isRunning = statusType === "running";
  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";

  const Icon = statusIconMap[statusType];
  const label = isCancelled ? "Cancelled tool" : "Used tool";

  return (
    <CollapsibleTrigger
      data-slot="tool-fallback-trigger"
      className={cn(
        "aui-tool-fallback-trigger group/trigger text-muted-foreground hover:text-foreground flex w-fit origin-left items-center gap-2 py-1.5 text-sm transition-[color,scale] active:scale-[0.98]",
        className,
      )}
      {...props}
    >
      <Icon
        data-slot="tool-fallback-trigger-icon"
        className={cn(
          "aui-tool-fallback-trigger-icon size-4 shrink-0",
          isCancelled && "text-muted-foreground",
          isRunning && "animate-spin [animation-duration:0.6s]",
        )}
      />
      <span
        data-slot="tool-fallback-trigger-label"
        className={cn(
          "aui-tool-fallback-trigger-label-wrapper relative inline-block text-start leading-none",
          isCancelled && "text-muted-foreground line-through",
        )}
      >
        <span>
          {label}: <b>{toolName}</b>
        </span>
        {isRunning ? (
          <span
            aria-hidden
            data-slot="tool-fallback-trigger-shimmer"
            className="aui-tool-fallback-trigger-shimmer shimmer pointer-events-none absolute inset-0 motion-reduce:animate-none"
          >
            {label}: <b>{toolName}</b>
          </span>
        ) : null}
      </span>
      <ToolFallbackDuration />
      <ChevronDownIcon
        data-slot="tool-fallback-trigger-chevron"
        className={cn(
          "aui-tool-fallback-trigger-chevron size-4 shrink-0 transition-transform duration-(--animation-duration) ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none group-data-[state=closed]/trigger:-rotate-90 group-data-[state=open]/trigger:rotate-0",
        )}
      />
    </CollapsibleTrigger>
  );
}

function ToolFallbackContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      data-slot="tool-fallback-content"
      className={cn(
        "aui-tool-fallback-content relative overflow-hidden text-sm outline-none group/collapsible-content ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down data-[state=closed]:fill-mode-forwards data-[state=closed]:pointer-events-none data-[state=open]:duration-(--animation-duration) data-[state=closed]:duration-(--animation-duration)",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex flex-col gap-2 ps-6 pt-1 pb-2 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none group-data-[state=open]/collapsible-content:animate-in group-data-[state=open]/collapsible-content:fade-in-0 group-data-[state=open]/collapsible-content:blur-in-[2px] group-data-[state=open]/collapsible-content:slide-in-from-top-1 group-data-[state=closed]/collapsible-content:animate-out group-data-[state=closed]/collapsible-content:fade-out-0 group-data-[state=closed]/collapsible-content:blur-out-[2px] group-data-[state=closed]/collapsible-content:slide-out-to-top-1 group-data-[state=closed]/collapsible-content:duration-(--animation-duration) group-data-[state=open]/collapsible-content:duration-(--animation-duration)",
        )}
      >
        {children}
      </div>
    </CollapsibleContent>
  );
}

function ToolFallbackArgs({
  argsText,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  argsText?: string;
}) {
  if (!argsText) return null;

  return (
    <div
      data-slot="tool-fallback-args"
      className={cn("aui-tool-fallback-args", className)}
      {...props}
    >
      <pre className="aui-tool-fallback-args-value bg-muted/50 text-foreground/90 rounded-md p-2.5 text-xs whitespace-pre-wrap">
        {argsText}
      </pre>
    </div>
  );
}

function ToolFallbackResult({
  result,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  result?: unknown;
}) {
  if (result === undefined) return null;

  return (
    <div
      data-slot="tool-fallback-result"
      className={cn("aui-tool-fallback-result", className)}
      {...props}
    >
      <p className="aui-tool-fallback-result-header text-muted-foreground text-xs font-medium">
        Result:
      </p>
      <pre className="aui-tool-fallback-result-content bg-muted/50 text-foreground/90 mt-1 rounded-md p-2.5 text-xs whitespace-pre-wrap">
        {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}

function ToolFallbackDiagnosticSection({
  label,
  value,
  className,
  ...props
}: React.ComponentProps<"details"> & {
  label: string;
  value?: unknown;
}) {
  if (value === undefined) return null;

  return (
    <details
      data-slot="tool-fallback-diagnostic-section"
      className={cn("aui-tool-fallback-diagnostic-section", className)}
      {...props}
    >
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium">
        {label}
      </summary>
      <pre className="aui-tool-fallback-diagnostic-section-content bg-muted/50 text-foreground/90 mt-1 rounded-md p-2.5 text-xs whitespace-pre-wrap">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function ToolFallbackNestedMessages({
  messages,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  messages?: ToolCallMessagePart["messages"];
}) {
  if (!messages || messages.length === 0) return null;

  return (
    <div
      data-slot="tool-fallback-nested-messages"
      className={cn(
        "aui-tool-fallback-nested-messages text-muted-foreground text-xs",
        className,
      )}
      {...props}
    >
      {messages.length} nested sub-agent message
      {messages.length === 1 ? "" : "s"}
    </div>
  );
}

function ToolFallbackError({
  status,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  status?: ToolCallMessagePartStatus;
}) {
  if (status?.type !== "incomplete") return null;

  const error = status.error;
  const errorText = error
    ? typeof error === "string"
      ? error
      : JSON.stringify(error)
    : null;

  if (!errorText) return null;

  const isCancelled = status.reason === "cancelled";
  const headerText = isCancelled ? "Cancelled reason:" : "Error:";

  return (
    <div
      data-slot="tool-fallback-error"
      className={cn("aui-tool-fallback-error", className)}
      {...props}
    >
      <p className="aui-tool-fallback-error-header text-muted-foreground font-semibold">
        {headerText}
      </p>
      <p className="aui-tool-fallback-error-reason text-muted-foreground">
        {errorText}
      </p>
    </div>
  );
}

const APPROVAL_OPTION_DEFAULT_LABELS: Record<string, string> = {
  "allow-always": "Always allow",
  "allow-once": "Allow",
  "reject-always": "Always deny",
  "reject-once": "Deny",
};

const isAllowKind = (kind: string) =>
  kind === "allow-once" || kind === "allow-always";

const approvalOptionLabel = (option: ToolApprovalOption) =>
  option.label ??
  (Object.hasOwn(APPROVAL_OPTION_DEFAULT_LABELS, option.kind)
    ? APPROVAL_OPTION_DEFAULT_LABELS[option.kind]
    : undefined) ??
  option.id;

function ToolFallbackApproval({
  className,
  resume,
  interrupt,
  approval,
  respondToApproval,
  ...props
}: React.ComponentProps<"div"> &
  Partial<
    Pick<ToolCallMessagePartProps, "resume" | "respondToApproval">
  > & {
    approval?: ToolCallMessagePart["approval"];
    interrupt?: ToolCallMessagePart["interrupt"];
  }) {
  const [submitted, setSubmitted] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (
    approval != null &&
    (approval.approved !== undefined || approval.resolution !== undefined)
  ) {
    return null;
  }

  if (approval != null && !respondToApproval) {
    return (
      <div
        data-slot="tool-fallback-approval"
        className={cn(
          "aui-tool-fallback-approval text-muted-foreground rounded-xl border px-3 py-2 text-xs",
          className,
        )}
        {...props}
      >
        This tool is waiting for an official approval response, but the active
        runtime did not provide an approval handler.
      </div>
    );
  }

  const declaredOptions = respondToApproval ? approval?.options : undefined;
  const options = declaredOptions?.filter((option) =>
    Object.hasOwn(APPROVAL_OPTION_DEFAULT_LABELS, option.kind),
  );

  const respond = (approved: boolean) => {
    if (submitted) return;
    if (
      approval != null &&
      approval.approved === undefined &&
      respondToApproval
    ) {
      respondToApproval({ approved });
    } else if (interrupt) {
      resume?.({ approved });
    }
    setSubmitted(true);
  };

  const respondWithOption = (option: ToolApprovalOption) => {
    if (submitted) return;
    respondToApproval?.({ optionId: option.id });
    setSubmitted(true);
    setConfirmingId(null);
  };

  const handleOption = (option: ToolApprovalOption) => {
    if (option.confirm) {
      setConfirmingId(option.id);
    } else {
      respondWithOption(option);
    }
  };

  const confirming =
    confirmingId != null
      ? options?.find((option) => option.id === confirmingId)
      : undefined;

  if (confirming) {
    const confirmMeta =
      typeof confirming.confirm === "object" ? confirming.confirm : undefined;
    const confirmDescription =
      confirmMeta?.description ?? confirming.description;

    return (
      <div
        data-slot="tool-fallback-approval-confirm"
        className={cn(
          "aui-tool-fallback-approval-confirm flex flex-col gap-2 pt-1",
          className,
        )}
        {...props}
      >
        <p className="aui-tool-fallback-approval-confirm-title font-semibold">
          {confirmMeta?.title ?? `${approvalOptionLabel(confirming)}?`}
        </p>
        {confirmDescription ? (
          <p className="aui-tool-fallback-approval-confirm-description text-muted-foreground">
            {confirmDescription}
          </p>
        ) : null}
        {confirming.grants && confirming.grants.length > 0 ? (
          <ul className="aui-tool-fallback-approval-confirm-grants flex flex-col gap-1">
            {confirming.grants.map((grant) => (
              <li key={grant}>
                <code className="aui-tool-fallback-approval-confirm-grant bg-muted rounded px-1.5 py-0.5 text-xs">
                  {grant}
                </code>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className={pressable}
            onClick={() => respondWithOption(confirming)}
            disabled={submitted}
          >
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={pressable}
            onClick={() => setConfirmingId(null)}
            disabled={submitted}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  if (declaredOptions && declaredOptions.length > 0) {
    const allowOptions = options?.filter((option) => isAllowKind(option.kind)) ?? [];
    const rejectOptions = options?.filter((option) => !isAllowKind(option.kind)) ?? [];

    return (
      <div
        data-slot="tool-fallback-approval"
        className={cn(
          "aui-tool-fallback-approval flex flex-wrap items-center gap-2 pt-1",
          className,
        )}
        {...props}
      >
        {[...allowOptions, ...rejectOptions].map((option) => (
          <Button
            key={option.id}
            size="sm"
            variant={option === allowOptions[0] ? "default" : "outline"}
            className={pressable}
            onClick={() => handleOption(option)}
            disabled={submitted}
          >
            {approvalOptionLabel(option)}
          </Button>
        ))}
        {rejectOptions.length === 0 ? (
          <Button
            size="sm"
            variant="outline"
            className={pressable}
            onClick={() => respond(false)}
            disabled={submitted}
          >
            Deny
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-slot="tool-fallback-approval"
      className={cn(
        "aui-tool-fallback-approval flex items-center gap-2 pt-1",
        className,
      )}
      {...props}
    >
      <Button
        size="sm"
        className={pressable}
        onClick={() => respond(true)}
        disabled={submitted}
      >
        Allow
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={pressable}
        onClick={() => respond(false)}
        disabled={submitted}
      >
        Deny
      </Button>
    </div>
  );
}

const ToolFallbackImpl: ToolCallMessagePartComponent = ({
  toolCallId,
  toolName,
  argsText,
  result,
  status,
  artifact,
  mcp,
  modelContent,
  messages,
  addResult,
  resume,
  interrupt,
  approval,
  respondToApproval,
}) => {
  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";
  const isRequiresAction = status?.type === "requires-action";

  const [open, setOpen] = useState(isRequiresAction);
  const [prevRequiresAction, setPrevRequiresAction] =
    useState(isRequiresAction);
  if (isRequiresAction !== prevRequiresAction) {
    setPrevRequiresAction(isRequiresAction);
    if (isRequiresAction) setOpen(true);
  }

  return (
    <ToolFallbackRoot open={open} onOpenChange={setOpen}>
      <ToolFallbackTrigger toolName={toolName} status={status} />
      <ToolFallbackContent>
        <ToolFallbackError status={status} />
        <ToolFallbackArgs
          argsText={argsText}
          className={cn(isCancelled && "opacity-60")}
        />
        {isRequiresAction ? (
          <ToolFallbackApproval
            resume={resume}
            interrupt={interrupt}
            approval={approval}
            respondToApproval={respondToApproval}
          />
        ) : null}
        {!isCancelled ? <ToolFallbackResult result={result} /> : null}
        <ToolFallbackDiagnosticSection label="Call id" value={toolCallId} />
        <ToolFallbackDiagnosticSection label="Artifact" value={artifact} />
        <ToolFallbackDiagnosticSection label="Model content" value={modelContent} />
        <ToolFallbackDiagnosticSection label="MCP" value={mcp} />
        <ToolFallbackNestedMessages messages={messages} />
      </ToolFallbackContent>
    </ToolFallbackRoot>
  );
};

const ToolFallback = memo(ToolFallbackImpl) as unknown as ToolCallMessagePartComponent & {
  Approval: typeof ToolFallbackApproval;
  Args: typeof ToolFallbackArgs;
  Content: typeof ToolFallbackContent;
  DiagnosticSection: typeof ToolFallbackDiagnosticSection;
  Error: typeof ToolFallbackError;
  NestedMessages: typeof ToolFallbackNestedMessages;
  Result: typeof ToolFallbackResult;
  Root: typeof ToolFallbackRoot;
  Trigger: typeof ToolFallbackTrigger;
};

ToolFallback.displayName = "ToolFallback";
ToolFallback.Root = ToolFallbackRoot;
ToolFallback.Trigger = ToolFallbackTrigger;
ToolFallback.Content = ToolFallbackContent;
ToolFallback.Args = ToolFallbackArgs;
ToolFallback.DiagnosticSection = ToolFallbackDiagnosticSection;
ToolFallback.Result = ToolFallbackResult;
ToolFallback.Error = ToolFallbackError;
ToolFallback.NestedMessages = ToolFallbackNestedMessages;
ToolFallback.Approval = ToolFallbackApproval;

export {
  ToolFallback,
  ToolFallbackApproval,
  ToolFallbackArgs,
  ToolFallbackContent,
  ToolFallbackDiagnosticSection,
  ToolFallbackError,
  ToolFallbackNestedMessages,
  ToolFallbackResult,
  ToolFallbackRoot,
  ToolFallbackTrigger,
};
