"use client";

import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";
import {
  ComposerQuotePreview,
  QuoteBlock,
  SelectionToolbar,
} from "@/components/assistant-ui/quote";
import { ComposerTriggerPopover } from "@/components/assistant-ui/composer-trigger-popover";
import { DirectiveText } from "@/components/assistant-ui/directive-text";
import { DotMatrix, type DotMatrixState } from "@/components/assistant-ui/dot-matrix";
import { ThreadFollowupSuggestions } from "@/components/assistant-ui/follow-up-suggestions";
import { File as AssistantFile } from "@/components/assistant-ui/file";
import { Image as AssistantImage } from "@/components/assistant-ui/image";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { MessageTiming } from "@/components/assistant-ui/message-timing";
import { TokenUsage } from "@/components/assistant-ui/token-usage";
import {
  LexicalComposerInput,
  type DirectiveChipProps,
} from "@assistant-ui/react-lexical";
import {
  useAui,
  unstable_useMessageStallDetection,
  unstable_useMentionAdapter,
  unstable_useSlashCommandAdapter,
} from "@assistant-ui/react";
import {
  Reasoning,
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "@/components/assistant-ui/reasoning";
import { Sources } from "@/components/assistant-ui/sources";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import {
  ToolGroupContent,
  ToolGroupRoot,
  ToolGroupTrigger,
} from "@/components/assistant-ui/tool-group";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ActionBarPrimitive,
  ActionBarMorePrimitive,
  AuiIf,
  type AssistantState,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  MessagePartPrimitive,
  QueueItemPrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
  type DataMessagePartComponent,
  type GenerativeUIComponentRegistry,
  type GenerativeUIRenderProps,
  type FileMessagePartComponent,
  type ImageMessagePartComponent,
  type ToolCallMessagePartComponent,
  type Unstable_AudioMessagePartComponent,
  groupPartByType,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudSunIcon,
  CircleStopIcon,
  CopyIcon,
  DownloadIcon,
  Globe2Icon,
  ImageIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  VideoIcon,
  Volume2Icon,
  MicIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  SparklesIcon,
  SquareIcon,
  TrashIcon,
  WandSparklesIcon,
} from "lucide-react";
import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  type CSSProperties,
  type ComponentType,
  type FC,
  type MouseEvent,
  type PropsWithChildren,
} from "react";

export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart;

export type ThreadComponents = {
  AssistantMessage?: ComponentType<{ showReasoning?: boolean }> | undefined;
  ComposerInlineControls?: ComponentType | undefined;
  ComposerFooter?: ComponentType | undefined;
  getCanvasDirectivePreview?:
    | ((
        directiveId: string,
      ) => {
        previewUrl: string;
        chipPreviewUrl?: string | null;
        imageWidth?: number | null;
        imageHeight?: number | null;
        markerX?: number | null;
        markerY?: number | null;
        type?: string | null;
        kind?: "canvas" | "mark";
      } | null)
    | undefined;
  isCanvasDirectivePending?: ((directiveId: string) => boolean) | undefined;
  onComposerInputIntent?: (() => void) | undefined;
  onComposerSendIntent?: (() => Promise<boolean> | boolean) | undefined;
  onSlashCommand?: ((commandId: string) => void) | undefined;
  UserMessage?: ComponentType | undefined;
  Welcome?: ComponentType | undefined;
  Suggestions?: ComponentType | undefined;
  ToolFallback?: ToolCallMessagePartComponent | undefined;
  ToolGroup?:
    | ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>>
    | undefined;
  ReasoningGroup?:
    | ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>>
    | undefined;
  Unstable_Audio?: Unstable_AudioMessagePartComponent | undefined;
  data?:
    | {
        by_name?: Record<string, DataMessagePartComponent | undefined> | undefined;
        Fallback?: DataMessagePartComponent | undefined;
      }
    | undefined;
  generativeUI?:
    | {
        components: GenerativeUIComponentRegistry;
        Fallback?: GenerativeUIRenderProps["Fallback"] | undefined;
      }
    | undefined;
};

export type ThreadProps = {
  components?: ThreadComponents | undefined;
  showReasoning?: boolean | undefined;
};

const EMPTY_COMPONENTS: ThreadComponents = {};

const ThreadComponentsContext =
  createContext<ThreadComponents>(EMPTY_COMPONENTS);

type AssistantMessageSummary = {
  role?: string;
  metadata?: unknown;
  parts?: ReadonlyArray<{
    type?: string;
    toolName?: string;
    status?: { type?: string };
  }>;
};

type AssistantMessageMetadata = {
  modelId?: string;
  providerId?: string;
};

type AssistantMessageGroupName =
  | "group-chainOfThought"
  | "group-reasoning"
  | "group-tool"
  | "group-sources";

const groupAssistantMessagePart = groupPartByType<AssistantMessageGroupName>({
  reasoning: ["group-chainOfThought", "group-reasoning"],
  "tool-call": ["group-chainOfThought", "group-tool"],
  // Match assistant-ui's recommended part-grouping behavior so
  // `display: "standalone"` tool UIs render flat in the message flow instead
  // of being folded back into the generic tool trace group.
  "standalone-tool-call": [],
  source: ["group-sources"],
});

const isNewChatView = (state: AssistantState) =>
  state.thread.messages.length === 0 &&
  (!state.thread.isLoading || state.threads.isLoading);

const shellTextClass =
  "text-[#1f1f1f] dark:text-[#e3e3e3]";

const ghostButtonClass =
  "flex shrink-0 items-center justify-center rounded-full text-[#444746] transition-colors hover:bg-[#444746]/8 hover:text-[#1f1f1f] dark:text-[#c4c7c5] dark:hover:bg-[#c4c7c5]/10 dark:hover:text-[#e3e3e3]";

const actionButtonClass =
  "flex size-8 items-center justify-center rounded-full text-[#444746] transition-colors hover:bg-[#444746]/8 hover:text-[#1f1f1f] dark:text-[#c4c7c5] dark:hover:bg-[#c4c7c5]/10 dark:hover:text-[#e3e3e3]";

const MODEL_CONTEXT_TOOL_LABELS: Record<string, string> = {
  createImage: "图片生成工具",
  upscaleImage: "\u9ad8\u6e05\u653e\u5927\u5de5\u5177",
  createTargetElement: "画布目标工具",
  getWeather: "天气卡片工具",
  google_search: "Google 搜索工具",
  planStudioWorkflow: "Studio 工作流规划",
  webSearch: "联网搜索工具",
  web_search: "联网搜索工具",
};

const ASSISTANT_MENTION_ITEMS = [
  {
    id: "web-search",
    type: "context",
    label: "联网搜索",
    description: "本轮需要最新信息时，启用已配置的联网搜索。",
    icon: "web",
  },
  {
    id: "weather",
    type: "context",
    label: "天气",
    description: "本轮需要天气信息时，启用天气查询和天气卡片。",
    icon: "weather",
  },
] as const;

const ASSISTANT_MENTION_CATEGORIES = [
  {
    id: "context",
    label: "上下文",
    items: ASSISTANT_MENTION_ITEMS,
  },
] as const;

export const Thread: FC<ThreadProps> = ({
  components = EMPTY_COMPONENTS,
  showReasoning = true,
}) => {
  const isEmpty = useAuiState(isNewChatView);

  return (
    <ThreadComponentsContext.Provider value={components}>
      <ThreadRoot isEmpty={isEmpty} showReasoning={showReasoning} />
    </ThreadComponentsContext.Provider>
  );
};

const ThreadRoot: FC<{ isEmpty: boolean; showReasoning: boolean }> = ({
  isEmpty,
  showReasoning,
}) => {
  const { Welcome = ThreadWelcome } = useContext(ThreadComponentsContext);

  return (
    <ThreadPrimitive.Root
      className="relative flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden bg-[#fdfcfc] text-[#1f1f1f] @container dark:bg-[#0c0c0c] dark:text-[#e3e3e3]"
      style={{
        ["--thread-max-width" as string]: "48rem",
        ["--composer-radius" as string]: "32px",
      }}
    >
      <AuiIf condition={isNewChatView}>
        <div className="relative flex min-w-0 grow flex-col overflow-x-clip">
          <div className="flex min-w-0 grow flex-col items-center justify-center px-4">
            <div className="flex w-full min-w-0 max-w-3xl flex-col">
              <Welcome />
            </div>
          </div>
        </div>
      </AuiIf>

      <AuiIf condition={(state) => !isNewChatView(state)}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 overflow-hidden"
        >
          <div className="absolute inset-y-0 left-8 right-0 bg-[linear-gradient(to_bottom,#fdfcfc_0%,rgba(253,252,252,0.82)_42%,rgba(253,252,252,0.34)_74%,rgba(253,252,252,0)_100%)] backdrop-blur-[1.5px] [mask-image:linear-gradient(to_bottom,black_0%,black_58%,transparent_100%)] dark:bg-[linear-gradient(to_bottom,#0c0c0c_0%,rgba(12,12,12,0.82)_42%,rgba(12,12,12,0.34)_74%,rgba(12,12,12,0)_100%)]" />
          <div className="absolute inset-y-0 left-2 w-10 bg-[linear-gradient(to_right,rgba(253,252,252,0)_0%,rgba(253,252,252,0)_20%,rgba(253,252,252,0.42)_68%,rgba(253,252,252,0.82)_100%)] [mask-image:linear-gradient(to_bottom,black_0%,black_58%,transparent_100%)] dark:bg-[linear-gradient(to_right,rgba(12,12,12,0)_0%,rgba(12,12,12,0)_20%,rgba(12,12,12,0.42)_68%,rgba(12,12,12,0.82)_100%)]" />
        </div>
        <ThreadPrimitive.Viewport className="flex grow flex-col overflow-y-scroll pt-12">
          <div className="mb-8 flex flex-col gap-y-7 empty:hidden">
            <ThreadPrimitive.Messages>
              {() => <ThreadMessage showReasoning={showReasoning} />}
            </ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto flex w-full flex-col items-center gap-3 bg-[#fdfcfc] px-4 pb-3 dark:bg-[#0c0c0c]">
            <ThreadScrollToBottom />
            <ThreadFollowupSuggestions />
            <Composer />
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </AuiIf>
      <SelectionToolbar />
    </ThreadPrimitive.Root>
  );
};

type AssistantTypingIndicatorStatusKind =
  | "image-tool"
  | "search-tool"
  | "tool"
  | "reasoning"
  | "streaming"
  | "preparing";

const getAssistantTypingIndicatorDisplay = (
  statusKind: AssistantTypingIndicatorStatusKind,
  stalled: boolean,
): { label: string; dotState: DotMatrixState } => {
  switch (statusKind) {
    case "image-tool":
      return {
        label: stalled
          ? "\u6b63\u5728\u751f\u6210\u56fe\u7247\uff0c\u4ecd\u5728\u5904\u7406..."
          : "\u6b63\u5728\u751f\u6210\u56fe\u7247...",
        dotState: stalled ? "waiting" : "loading",
      };
    case "search-tool":
      return {
        label: stalled
          ? "\u6b63\u5728\u67e5\u8be2\u4fe1\u606f\uff0c\u4ecd\u5728\u5904\u7406..."
          : "\u6b63\u5728\u67e5\u8be2\u4fe1\u606f...",
        dotState: stalled ? "waiting" : "searching",
      };
    case "tool":
      return {
        label: stalled
          ? "\u6b63\u5728\u8c03\u7528\u5de5\u5177\uff0c\u4ecd\u5728\u5904\u7406..."
          : "\u6b63\u5728\u8c03\u7528\u5de5\u5177...",
        dotState: stalled ? "waiting" : "loading",
      };
    case "reasoning":
      return {
        label: stalled
          ? "\u6b63\u5728\u601d\u8003\uff0c\u4ecd\u5728\u5904\u7406..."
          : "\u6b63\u5728\u601d\u8003...",
        dotState: "thinking",
      };
    case "streaming":
      return {
        label: stalled
          ? "\u6b63\u5728\u7ee7\u7eed\u751f\u6210\u56de\u590d..."
          : "\u6b63\u5728\u751f\u6210\u56de\u590d...",
        dotState: stalled ? "waiting" : "streaming",
      };
    case "preparing":
      return {
        label: stalled
          ? "\u6b63\u5728\u51c6\u5907\u56de\u590d\uff0c\u4ecd\u5728\u5904\u7406..."
          : "\u6b63\u5728\u51c6\u5907\u56de\u590d...",
        dotState: stalled ? "waiting" : "loading",
      };
  }
};

const AssistantTypingIndicator: FC = () => {
  const { stalled } = unstable_useMessageStallDetection();
  const statusKind = useAuiState(
    (state): AssistantTypingIndicatorStatusKind | null => {
      if (state.message.status?.type !== "running") return null;

      const parts = state.message.parts as unknown as NonNullable<
        AssistantMessageSummary["parts"]
      >;
      const runningTool = [...parts]
        .reverse()
        .find(
          (part) => part.type === "tool-call" && part.status?.type === "running",
        );
      if (runningTool) {
        const toolName = String(runningTool.toolName || "").trim();
        if (toolName === "createImage" || toolName === "upscaleImage") {
          return "image-tool";
        }
        if (
          toolName === "getWeather" ||
          toolName === "webSearch" ||
          toolName === "web_search" ||
          toolName === "google_search"
        ) {
          return "search-tool";
        }
        return "tool";
      }

      const runningReasoning = [...parts]
        .reverse()
        .find(
          (part) => part.type === "reasoning" && part.status?.type === "running",
        );
      if (runningReasoning) return "reasoning";

      const hasAssistantContent = parts.some((part) => {
        if (part.type === "text") return true;
        if (part.type === "reasoning") return true;
        return part.type === "tool-call";
      });

      return hasAssistantContent ? "streaming" : "preparing";
    },
  );

  if (!statusKind) return null;

  const { label, dotState } = getAssistantTypingIndicatorDisplay(
    statusKind,
    stalled,
  );

  return (
    <span
      data-slot="aui_assistant-message-indicator"
      className="inline-flex items-center gap-2 rounded-full border border-[#dadce0] bg-white/90 px-3 py-1.5 text-xs font-medium text-[#5f6368] shadow-sm dark:border-[#3c4043] dark:bg-[#1e1f20]/90 dark:text-[#c4c7c5]"
      aria-label={label}
    >
      <DotMatrix
        state={dotState}
        label={label}
        className="text-[#1f3b9b] dark:text-[#a8c7fa]"
      />
      <span className="truncate">{label}</span>
    </span>
  );
};

const ThreadMessage: FC<{ showReasoning: boolean }> = ({ showReasoning }) => {
  const { AssistantMessage: AssistantMessageComponent = AssistantMessage } =
    useContext(ThreadComponentsContext);
  const { UserMessage: UserMessageComponent = UserMessage } = useContext(
    ThreadComponentsContext,
  );
  const role = useAuiState((state) => state.message.role);
  const isEditing = useAuiState((state) => state.message.composer.isEditing);

  if (isEditing) return <EditComposer />;
  if (role === "user") return <UserMessageComponent />;
  return <AssistantMessageComponent showReasoning={showReasoning} />;
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="absolute -top-12 z-10 self-center rounded-full border-[#dadce0] bg-white/90 p-4 shadow-sm backdrop-blur disabled:invisible dark:border-[#3c4043] dark:bg-[#1e1f20]/90 dark:hover:bg-[#2b2c2f]"
      >
        <ArrowDownIcon className="size-4" />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="relative flex w-full min-w-0 max-w-full grow flex-col">
      <div className="flex w-full min-w-0 max-w-full flex-col">
        <h1 className="fade-in slide-in-from-bottom-3 motion-safe:animate-in fill-mode-both relative z-10 mb-6 max-w-full text-center text-3xl leading-tight font-normal text-balance text-[#1f1f1f] delay-500 duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] dark:text-white">
          How can I help you today?
        </h1>
        <div className="relative w-full min-w-0 max-w-full">
          <div
            aria-hidden="true"
            className="fade-in zoom-in-40 blur-in-[90px] motion-safe:animate-in fill-mode-both pointer-events-none absolute top-1/2 left-1/2 h-[260px] w-[680px] max-w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-[140px] bg-[#a9d1fb]/60 blur-[90px] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-[#1b2f9c]/50"
          />
          <div className="relative z-10 w-full min-w-0 max-w-full">
            <Composer />
          </div>
        </div>
      </div>
      <AuiIf condition={(state) => isNewChatView(state) && state.composer.isEmpty}>
        <ThreadSuggestions />
      </AuiIf>
    </div>
  );
};

const ThreadSuggestions: FC = () => {
  const { Suggestions: SuggestionsComponent } = useContext(
    ThreadComponentsContext,
  );

  if (SuggestionsComponent) {
    return <SuggestionsComponent />;
  }

  return (
    <div className="mt-4 flex w-full min-w-0 max-w-full justify-center px-4">
      <div className="grid w-full min-w-0 max-w-2xl grid-cols-1 gap-2 pb-4 @lg:grid-cols-2">
        <ThreadPrimitive.Suggestions>
          {() => <ThreadSuggestionItem />}
        </ThreadPrimitive.Suggestions>
      </div>
    </div>
  );
};

const ThreadSuggestionItem: FC = () => {
  return (
    <div className="fade-in slide-in-from-bottom-2 motion-safe:animate-in fill-mode-both min-w-0 max-w-full duration-200">
      <SuggestionPrimitive.Trigger clearComposer asChild>
        <Button
          variant="ghost"
          className="h-auto w-full min-w-0 max-w-full shrink flex-col items-start justify-start gap-1 whitespace-normal rounded-3xl border border-[#dadce0] bg-white/78 px-4 py-3 text-left text-sm transition-colors hover:bg-white hover:text-[#1f1f1f] dark:border-[#3c4043] dark:bg-[#1e1f20]/78 dark:text-[#c4c7c5] dark:hover:bg-[#232427] dark:hover:text-[#e3e3e3]"
        >
          <SuggestionPrimitive.Title className="min-w-0 max-w-full wrap-break-word font-medium text-[#1f1f1f] dark:text-[#f1f3f4]" />
          <SuggestionPrimitive.Description className="min-w-0 max-w-full wrap-break-word text-xs text-[#5f6368] empty:hidden dark:text-[#9aa0a6]" />
        </Button>
      </SuggestionPrimitive.Trigger>
    </div>
  );
};

const clampMarkCoordinate = (value: unknown, fallback: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
};

const getMarkHoverPreviewStyle = (
  imageWidth: number | null | undefined,
  imageHeight: number | null | undefined,
): CSSProperties => {
  const naturalWidth = Number(imageWidth);
  const naturalHeight = Number(imageHeight);
  if (
    !Number.isFinite(naturalWidth) ||
    !Number.isFinite(naturalHeight) ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  ) {
    return { height: 176, width: 224 };
  }

  const maxWidth = 224;
  const maxHeight = 176;
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight);
  return {
    height: Math.max(72, Math.round(naturalHeight * scale)),
    width: Math.max(72, Math.round(naturalWidth * scale)),
  };
};

const MarkFocusPreview: FC<{
  className?: string;
  imageClassName?: string;
  fallbackPreviewUrl?: string | null;
  imageHeight?: number | null;
  imageWidth?: number | null;
  markerX?: number | null;
  markerY?: number | null;
  previewUrl: string;
  showPin?: boolean;
  size?: "chip" | "hover";
  style?: CSSProperties;
}> = ({
  className,
  fallbackPreviewUrl,
  imageHeight,
  imageWidth,
  imageClassName,
  markerX,
  markerY,
  previewUrl,
  showPin = false,
  size = "chip",
  style,
}) => {
  const x = clampMarkCoordinate(markerX, 0.5);
  const y = clampMarkCoordinate(markerY, 0.5);
  const xPct = x * 100;
  const yPct = y * 100;
  const animationName =
    size === "hover"
      ? "aui-mark-focus-hover"
      : "aui-mark-focus-chip";
  const canFocusMark = markerX != null && markerY != null;
  const imageUrl = canFocusMark ? previewUrl : fallbackPreviewUrl || previewUrl;

  return (
    <span
      className={cn("relative flex items-center justify-center overflow-hidden", className)}
      style={style}
    >
      <span
        className="relative block size-full shrink-0 overflow-visible"
        style={{
          animation: canFocusMark
            ? `${animationName} 3.2s cubic-bezier(0.25,0.1,0.25,1) infinite`
            : undefined,
          transformOrigin: `${xPct}% ${yPct}%`,
        }}
      >
        <img
          src={imageUrl}
          alt=""
          className={cn("absolute inset-0 size-full object-contain", imageClassName)}
        />
        {showPin && canFocusMark ? (
          <span
            className="pointer-events-none absolute"
            style={{
              left: `${xPct}%`,
              top: `${yPct}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <span
              className="relative flex flex-col items-center"
              style={{
                animation: `${animationName}-pin 3.2s cubic-bezier(0.25,0.1,0.25,1) infinite`,
                transformOrigin: "bottom center",
              }}
            >
              <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#3B82F6] shadow-lg" />
              <span className="-mt-px h-0 w-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#3B82F6]" />
            </span>
          </span>
        ) : null}
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-blue-500/65" />
    </span>
  );
};

function DirectiveChip(props: DirectiveChipProps) {
  const { directiveId, directiveType, label } = props;
  const { getCanvasDirectivePreview, isCanvasDirectivePending } =
    useContext(ThreadComponentsContext);
  const showToolIndicator = directiveType !== "command";
  const canvasPreview =
    directiveType === "canvas" || directiveType === "mark"
      ? getCanvasDirectivePreview?.(directiveId)
      : null;
  const isPending =
    (directiveType === "canvas" || directiveType === "mark") &&
    Boolean(isCanvasDirectivePending?.(directiveId));
  const canvasPreviewType = String(canvasPreview?.type || "").toLowerCase();
  const canvasPreviewIsVideo =
    canvasPreviewType === "video" ||
    canvasPreviewType === "gen-video" ||
    /^data:video\//i.test(canvasPreview?.previewUrl || "") ||
    /\.(?:mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(canvasPreview?.previewUrl || "");
  const canvasDirectiveImagePreviewUrl =
    canvasPreview?.kind === "mark"
      ? canvasPreview.previewUrl || canvasPreview.chipPreviewUrl || ""
      : canvasPreview?.previewUrl || "";

  const chip = (
    <span
      className={cn(
        "aui-directive-chip",
        isPending && "opacity-55 saturate-75 transition-opacity",
      )}
      data-directive-id={directiveId}
      data-directive-type={directiveType}
      data-directive-pending={isPending ? "true" : undefined}
    >
      {canvasPreview ? (
        <span className="aui-directive-chip-preview">
          {canvasPreviewIsVideo ? (
            <VideoIcon className="size-3" />
          ) : canvasPreview.kind === "mark" ? (
            <MarkFocusPreview
              previewUrl={canvasDirectiveImagePreviewUrl}
              fallbackPreviewUrl={canvasPreview.chipPreviewUrl}
              imageWidth={canvasPreview.imageWidth}
              imageHeight={canvasPreview.imageHeight}
              markerX={canvasPreview.markerX}
              markerY={canvasPreview.markerY}
              className="size-full rounded-[inherit]"
            />
          ) : (
            <img
              src={canvasDirectiveImagePreviewUrl}
              alt=""
              className="size-full rounded-[inherit] object-cover"
            />
          )}
        </span>
      ) : showToolIndicator ? (
        <span className="aui-directive-chip-icon">
          <WandSparklesIcon className="size-3" />
        </span>
      ) : null}
      <span className="aui-directive-chip-label">{label}</span>
    </span>
  );

  if (!canvasPreview) return chip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={6}
        hideArrow
        className="aui-directive-chip-hover-preview z-[90] rounded-xl border-0 bg-transparent p-0 text-transparent shadow-lg shadow-slate-950/16"
      >
        <div className="overflow-hidden rounded-xl bg-white/70 p-0 shadow-sm ring-1 ring-black/10 backdrop-blur dark:bg-[#171717]/70 dark:ring-white/12">
          {canvasPreviewIsVideo ? (
            <div className="flex h-32 w-40 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
              <VideoIcon className="size-8" />
            </div>
          ) : (
            canvasPreview.kind === "mark" ? (
              <MarkFocusPreview
                previewUrl={canvasDirectiveImagePreviewUrl}
                fallbackPreviewUrl={canvasPreview.chipPreviewUrl}
                imageWidth={canvasPreview.imageWidth}
                imageHeight={canvasPreview.imageHeight}
                markerX={canvasPreview.markerX}
                markerY={canvasPreview.markerY}
                showPin
                size="hover"
                style={getMarkHoverPreviewStyle(
                  canvasPreview.imageWidth,
                  canvasPreview.imageHeight,
                )}
                className="rounded-xl bg-transparent"
              />
            ) : (
              <img
                src={canvasDirectiveImagePreviewUrl}
                alt=""
                className="block max-h-44 max-w-52 rounded-xl object-contain"
              />
            )
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

const Composer: FC = () => {
  const {
    ComposerFooter,
    ComposerInlineControls,
    onComposerInputIntent,
    onComposerSendIntent,
    onSlashCommand,
  } = useContext(ThreadComponentsContext);
  const aui = useAui();
  const mention = unstable_useMentionAdapter({
    categories: ASSISTANT_MENTION_CATEGORIES,
    includeModelContextTools: {
      category: { id: "capabilities", label: "可用能力" },
      icon: "tool",
      formatLabel: (toolName) =>
        MODEL_CONTEXT_TOOL_LABELS[toolName] || toolName,
    },
    iconMap: {
      canvas: SquareIcon,
      context: SparklesIcon,
      image: ImageIcon,
      project: SparklesIcon,
      tool: WandSparklesIcon,
      capabilities: WandSparklesIcon,
      web: Globe2Icon,
      workspace: SquareIcon,
    },
    fallbackIcon: SparklesIcon,
  });
  const appendComposerDirective = useCallback(
    (item: {
      id: string;
      type: string;
      label: string;
      description?: string;
      icon?: string;
    }) => {
      const composer = aui.composer();
      const currentText = composer.getState().text;
      const directive = mention.directive.formatter.serialize(item);
      if (currentText.includes(directive)) return;

      const nextText = currentText.trim()
        ? `${currentText.trimEnd()} ${directive}`
        : directive;
      composer.setText(nextText);
    },
    [aui, mention.directive.formatter],
  );

  const slash = unstable_useSlashCommandAdapter({
    commands: [
      {
        id: "image",
        label: "图片模式",
        description:
          "打开图片参数面板；明确要求出图时才会生成。",
        icon: "image",
        execute: () => {
          onSlashCommand?.("image");
        },
      },
      {
        id: "edit-image",
        label: "改图模式",
        description:
          "打开图片参数面板，并优先参考已附图片。",
        icon: "wand",
        execute: () => {
          onSlashCommand?.("edit-image");
          if (aui.composer().getState().attachments.length > 0) {
            appendComposerDirective({
              id: "attached-images",
              type: "workspace",
              label: "已附图片",
              description:
                "让助手参考这条消息里附带的图片。",
              icon: "image",
            });
          }
        },
      },
      {
        id: "web",
        label: "联网搜索",
        description:
          "给本轮消息加上联网搜索意图。",
        icon: "globe",
        execute: () => {
          appendComposerDirective({
            id: "web-search",
            type: "context",
            label: "联网搜索",
            description:
              "当需要最新信息时启用已配置的联网搜索。",
            icon: "web",
          });
        },
      },
      {
        id: "weather",
        label: "天气",
        description:
          "给本轮消息加上天气查询意图。",
        icon: "weather",
        execute: () => {
          appendComposerDirective({
            id: "weather",
            type: "context",
            label: "天气",
            description:
              "获取某个地点的当前天气和短期预报。",
            icon: "weather",
          });
        },
      },
      {
        id: "clear-input",
        label: "清空输入",
        description: "清除当前草稿内容",
        icon: "sparkles",
        execute: () => {
          aui.thread().composer().setText("");
        },
      },
    ],
    removeOnExecute: true,
    iconMap: {
      globe: Globe2Icon,
      image: ImageIcon,
      sparkles: SparklesIcon,
      wand: WandSparklesIcon,
      weather: CloudSunIcon,
    },
    fallbackIcon: SparklesIcon,
  });

  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      <ComposerPrimitive.Root
        className="relative mx-auto flex w-full min-w-0 max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-white p-3 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.18)] dark:bg-[#1e1f20] dark:shadow-[0_2px_12px_-2px_rgba(0,0,0,0.6)]"
      >
        <ComposerQuotePreview />
        <ComposerQueue />
        <AuiIf condition={(state) => state.composer.attachments.length > 0}>
          <div className="flex flex-row gap-2.5 overflow-x-auto px-1 pt-1 pb-2.5">
            <ComposerAttachments />
          </div>
        </AuiIf>

        <ComposerPrimitive.AttachmentDropzone asChild>
          <div className="flex min-w-0 flex-col gap-2">
            <LexicalComposerInput
              directiveChip={DirectiveChip}
              autoFocus
              onPointerUpCapture={() => {
                window.requestAnimationFrame(() => onComposerInputIntent?.());
              }}
              aria-label="消息输入框，使用 @ 引用上下文，使用 / 调用命令"
              placeholder="输入消息，@ 引用上下文，/ 调用命令"
              className="relative max-h-40 min-h-10 w-full min-w-0 resize-none bg-transparent px-2 py-1.5 text-[17px] leading-6 text-[#1f1f1f] outline-none [&_.aui-directive-chip]:inline-flex [&_.aui-directive-chip]:items-center [&_.aui-directive-chip]:gap-1 [&_.aui-directive-chip]:rounded-md [&_.aui-directive-chip]:bg-[#d8e7ff] [&_.aui-directive-chip]:px-1.5 [&_.aui-directive-chip]:py-0.5 [&_.aui-directive-chip]:text-[13px] [&_.aui-directive-chip]:font-medium [&_.aui-directive-chip]:leading-none [&_.aui-directive-chip]:text-[#1f3b9b] [&_.aui-directive-chip-icon]:self-center [&_.aui-directive-chip-preview]:flex [&_.aui-directive-chip-preview]:size-4 [&_.aui-directive-chip-preview]:shrink-0 [&_.aui-directive-chip-preview]:items-center [&_.aui-directive-chip-preview]:justify-center [&_.aui-directive-chip-preview]:overflow-hidden [&_.aui-directive-chip-preview]:rounded [&_.aui-directive-chip-preview]:bg-transparent [&_.aui-directive-chip-preview]:ring-1 [&_.aui-directive-chip-preview]:ring-[#1f3b9b]/15 [&_.aui-lexical-input]:min-h-lh [&_.aui-lexical-input]:outline-none [&_.aui-lexical-placeholder]:pointer-events-none [&_.aui-lexical-placeholder]:absolute [&_.aui-lexical-placeholder]:inset-x-0 [&_.aui-lexical-placeholder]:top-0 [&_.aui-lexical-placeholder]:truncate [&_.aui-lexical-placeholder]:px-2 [&_.aui-lexical-placeholder]:py-1.5 [&_.aui-lexical-placeholder]:text-[#575b5f] dark:text-[#e3e3e3] dark:[&_.aui-directive-chip]:bg-[#233a73] dark:[&_.aui-directive-chip]:text-[#d7e3ff] dark:[&_.aui-directive-chip-preview]:ring-white/20 dark:[&_.aui-lexical-placeholder]:text-[#9aa0a6]"
            />
            <div className="flex min-w-0 items-center gap-1">
              <ComposerAddAttachment />
              <div className="flex min-w-0 flex-1 items-center">
                {ComposerInlineControls ? <ComposerInlineControls /> : null}
              </div>
              <ComposerVoiceButton />
              <ComposerSendButton onComposerSendIntent={onComposerSendIntent} />
            </div>
            {ComposerFooter ? <ComposerFooter /> : null}
          </div>
        </ComposerPrimitive.AttachmentDropzone>
        <ComposerTriggerPopover
          char="@"
          {...mention}
          emptyItemsLabel="没有匹配的引用"
        />
        <ComposerTriggerPopover
          char="/"
          {...slash}
          emptyItemsLabel="没有匹配的命令"
        />
      </ComposerPrimitive.Root>
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  );
};
const ComposerQueue: FC = () => {
  return (
    <AuiIf condition={(state) => state.composer.queue.length > 0}>
      <div className="mb-2 flex flex-col gap-1.5 rounded-[1.35rem] border border-[#dadce0] bg-[#f8fafd] px-3 py-2 text-xs text-[#444746] dark:border-[#3c4043] dark:bg-[#151617] dark:text-[#c4c7c5]">
        <div className="font-medium text-[#1f1f1f] dark:text-[#f1f3f4]">
          Queued messages
        </div>
        <ComposerPrimitive.Queue>
          {() => (
            <div className="flex min-w-0 items-center gap-2">
              <QueueItemPrimitive.Text className="min-w-0 flex-1 truncate" />
              <QueueItemPrimitive.Steer className="rounded-full px-2 py-1 font-medium text-[#1f3b9b] transition-colors hover:bg-[#1f3b9b]/10 dark:text-[#a8c7fa] dark:hover:bg-[#a8c7fa]/10">
                Run next
              </QueueItemPrimitive.Steer>
              <QueueItemPrimitive.Remove className="rounded-full px-2 py-1 font-medium text-[#5f6368] transition-colors hover:bg-[#444746]/8 hover:text-rose-600 dark:text-[#9aa0a6] dark:hover:bg-[#c4c7c5]/10 dark:hover:text-rose-300">
                Remove
              </QueueItemPrimitive.Remove>
            </div>
          )}
        </ComposerPrimitive.Queue>
      </div>
    </AuiIf>
  );
};

const ComposerVoiceButton: FC = () => {
  return (
    <AuiIf condition={(state) => state.thread.capabilities.dictation}>
      <AuiIf condition={(state) => state.composer.dictation == null}>
        <ComposerPrimitive.Dictate asChild>
          <button
            type="button"
            aria-label="Voice mode"
            className={`${ghostButtonClass} size-9`}
          >
            <MicIcon className="size-5" />
          </button>
        </ComposerPrimitive.Dictate>
      </AuiIf>
      <AuiIf condition={(state) => state.composer.dictation != null}>
        <ComposerPrimitive.StopDictation asChild>
          <button
            type="button"
            aria-label="Stop voice mode"
            className={`${ghostButtonClass} size-9 text-red-500 hover:text-red-600 dark:text-red-300 dark:hover:text-red-200`}
          >
            <SquareIcon className="size-4 animate-pulse fill-current" />
          </button>
        </ComposerPrimitive.StopDictation>
      </AuiIf>
    </AuiIf>
  );
};

const ComposerSendButton: FC<{
  onComposerSendIntent?: (() => Promise<boolean> | boolean) | undefined;
}> = ({ onComposerSendIntent }) => {
  const aui = useAui();
  const sendClass =
    "flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1f3b9b] text-white transition-colors hover:bg-[#274aad]";
  const handleClick = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      if (!onComposerSendIntent) return;
      event.preventDefault();
      const canContinue = await onComposerSendIntent();
      if (canContinue) {
        aui.thread().composer().send();
      }
    },
    [aui, onComposerSendIntent],
  );

  return (
    <>
      <AuiIf condition={(state) => !state.thread.isRunning || !state.composer.isEmpty}>
        <ComposerPrimitive.Send
          aria-label="Send message"
          className={`${sendClass} disabled:bg-[#e8eaed] disabled:text-[#1f1f1f]/40 dark:disabled:bg-[#2b2c2e] dark:disabled:text-white/30`}
          onClick={handleClick}
        >
          <ArrowUpIcon className="size-5" />
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(state) => state.thread.isRunning && state.composer.isEmpty}>
        <ComposerPrimitive.Cancel
          aria-label="Stop generating"
          className={sendClass}
        >
          <span className="size-3 rounded-[3px] bg-current" />
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </>
  );
};

const AssistantMessage: FC<{ showReasoning?: boolean }> = ({
  showReasoning = true,
}) => {
  const {
    ToolFallback: ToolFallbackComponent = ToolFallback,
    ToolGroup,
    ReasoningGroup,
    Unstable_Audio,
    data,
    generativeUI,
  } = useContext(ThreadComponentsContext);
  const actionBarPaddingTop = "pt-1.5";
  const actionBarOffsetClass = `-mb-7.5 min-h-7.5 ${actionBarPaddingTop}`;

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className="group/message fade-in slide-in-from-bottom-1 motion-safe:animate-in relative mx-auto mb-7 flex w-full max-w-3xl flex-col px-4 duration-150"
    >
      <div
        data-slot="aui_assistant-message-content"
        className={cn(
          "leading-relaxed wrap-break-word [contain-intrinsic-size:auto_24px] [content-visibility:auto]",
          shellTextClass,
        )}
      >
        <MessagePrimitive.GroupedParts
          indicator="empty"
          groupBy={(part, context) =>
            showReasoning ? groupAssistantMessagePart(part, context) : []
          }
        >
          {({ part, children }) => {
            switch (part.type) {
              case "group-chainOfThought":
                return <div data-slot="aui_chain-of-thought">{children}</div>;
              case "group-tool":
                if (ToolGroup) {
                  return <ToolGroup group={part}>{children}</ToolGroup>;
                }
                return (
                  <ToolGroupRoot variant="ghost" className="my-1">
                    <ToolGroupTrigger
                      count={part.indices.length}
                      active={part.status.type === "running"}
                    />
                    <ToolGroupContent>{children}</ToolGroupContent>
                  </ToolGroupRoot>
                );
              case "group-reasoning": {
                if (!showReasoning) {
                  return null;
                }
                if (ReasoningGroup) {
                  return <ReasoningGroup group={part}>{children}</ReasoningGroup>;
                }
                const running = part.status.type === "running";
                return (
                  <ReasoningRoot defaultOpen={running} streaming={running}>
                    <ReasoningTrigger active={running} />
                    <ReasoningContent aria-busy={running}>
                      <ReasoningText>{children}</ReasoningText>
                    </ReasoningContent>
                  </ReasoningRoot>
                );
              }
              case "group-sources":
                return <SourcesLayout>{children}</SourcesLayout>;
              case "text":
                return <MarkdownText />;
              case "reasoning":
                return showReasoning ? <Reasoning {...part} /> : null;
              case "image":
                return <AssistantImage {...part} />;
              case "file":
                return <AssistantFile {...part} />;
              case "audio":
                return Unstable_Audio ? <Unstable_Audio {...part} /> : null;
              case "tool-call":
                return part.toolUI ?? <ToolFallbackComponent {...part} />;
              case "data": {
                const DataRenderer = data?.by_name?.[part.name] ?? data?.Fallback;
                return (
                  part.dataRendererUI ??
                  (DataRenderer ? <DataRenderer {...part} /> : null)
                );
              }
              case "generative-ui":
                return generativeUI ? (
                  <MessagePrimitive.GenerativeUI
                    components={generativeUI.components}
                    Fallback={generativeUI.Fallback}
                  />
                ) : null;
              case "source":
                return <Sources {...part} />;
              case "indicator":
                return <AssistantTypingIndicator />;
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessagePrimitive.Error>
          <ErrorPrimitive.Root className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            <ErrorPrimitive.Message />
          </ErrorPrimitive.Root>
        </MessagePrimitive.Error>
      </div>
      <div
        data-slot="aui_assistant-message-footer"
        className={cn("-ml-2 flex items-center", actionBarOffsetClass)}
      >
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  const aui = useAui();

  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy" className={actionButtonClass}>
          <AuiIf condition={(state) => state.message.isCopied}>
            <CheckIcon className="size-4 animate-in zoom-in-50 fade-in duration-200 ease-out" />
          </AuiIf>
          <AuiIf condition={(state) => !state.message.isCopied}>
            <CopyIcon className="size-4 animate-in zoom-in-75 fade-in duration-150" />
          </AuiIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh" className={actionButtonClass}>
          <RefreshCwIcon className="size-4" />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
      <MessageModelMetadata className="mx-0.5 rounded-full px-2 py-1 text-[11px]" />
      <MessageTiming className="mx-0.5 rounded-full px-2 py-1 text-[11px]" />
      <TokenUsage className="mx-0.5 rounded-full px-2 py-1 text-[11px]" />
      <AuiIf condition={(state) => state.message.speech == null}>
        <ActionBarPrimitive.Speak asChild>
          <TooltipIconButton tooltip="Read aloud" className={actionButtonClass}>
            <Volume2Icon className="size-4" />
          </TooltipIconButton>
        </ActionBarPrimitive.Speak>
      </AuiIf>
      <AuiIf condition={(state) => state.message.speech != null}>
        <ActionBarPrimitive.StopSpeaking asChild>
          <TooltipIconButton tooltip="Stop reading" className={actionButtonClass}>
            <CircleStopIcon className="size-4" />
          </TooltipIconButton>
        </ActionBarPrimitive.StopSpeaking>
      </AuiIf>
      <ActionBarPrimitive.FeedbackPositive asChild>
        <TooltipIconButton
          tooltip="Helpful"
          className={cn(actionButtonClass, "data-[submitted]:text-emerald-600")}
        >
          <ThumbsUpIcon className="size-4" />
        </TooltipIconButton>
      </ActionBarPrimitive.FeedbackPositive>
      <ActionBarPrimitive.FeedbackNegative asChild>
        <TooltipIconButton
          tooltip="Not helpful"
          className={cn(actionButtonClass, "data-[submitted]:text-rose-600")}
        >
          <ThumbsDownIcon className="size-4" />
        </TooltipIconButton>
      </ActionBarPrimitive.FeedbackNegative>
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger asChild>
          <TooltipIconButton
            tooltip="More"
            className={cn(actionButtonClass, "data-[state=open]:bg-[#444746]/8")}
          >
            <MoreHorizontalIcon className="size-4" />
          </TooltipIconButton>
        </ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="z-50 min-w-[8rem] overflow-hidden rounded-xl border border-[#dadce0] bg-white/95 p-1.5 shadow-lg backdrop-blur-sm dark:border-[#3c4043] dark:bg-[#1e1f20]/95"
        >
          <ActionBarMorePrimitive.Item
            className="text-destructive hover:bg-destructive/10 hover:text-destructive flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none"
            onClick={() => void aui.message().delete()}
          >
            <TrashIcon className="size-4" />
            Delete
          </ActionBarMorePrimitive.Item>
          <ActionBarPrimitive.ExportMarkdown asChild>
            <ActionBarMorePrimitive.Item className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-[#1f1f1f] outline-none transition-colors hover:bg-[#444746]/8 dark:text-[#e3e3e3] dark:hover:bg-[#c4c7c5]/10">
              <DownloadIcon className="size-4" />
              Export as Markdown
            </ActionBarMorePrimitive.Item>
          </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  );
};

const getAssistantMessageMetadata = (
  metadata: unknown,
): AssistantMessageMetadata | null => {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  const modelId =
    typeof record.modelId === "string" && record.modelId.trim()
      ? record.modelId.trim()
      : undefined;
  const providerId =
    typeof record.providerId === "string" && record.providerId.trim()
      ? record.providerId.trim()
      : undefined;

  if (!modelId && !providerId) return null;
  return { modelId, providerId };
};

const formatMessageModelShortLabel = (
  metadata: AssistantMessageMetadata,
): string => {
  const value = metadata.modelId || metadata.providerId || "";
  if (value.length <= 18) return value;
  return `${value.slice(0, 15)}...`;
};

const MessageModelMetadata: FC<{
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}> = ({ className, side = "right" }) => {
  const metadata = useAuiState((state) =>
    getAssistantMessageMetadata(
      (state.message as AssistantMessageSummary).metadata,
    ),
  );

  if (!metadata) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-slot="message-model-metadata-trigger"
          aria-label="Message model"
          className={cn(
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center rounded-md p-1 font-mono text-xs tabular-nums transition-colors",
            className,
          )}
        >
          {formatMessageModelShortLabel(metadata)}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={8}
        data-slot="message-model-metadata-popover"
        className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 shadow-md [&_span>svg]:hidden!"
      >
        <div className="grid min-w-44 gap-1.5 text-xs">
          {metadata.providerId ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Provider</span>
              <span className="max-w-48 truncate font-mono">
                {metadata.providerId}
              </span>
            </div>
          ) : null}
          {metadata.modelId ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Model</span>
              <span className="max-w-48 truncate font-mono">
                {metadata.modelId}
              </span>
            </div>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

const isAssistantReferenceMessagePart = (part: unknown): boolean => {
  if (!part || typeof part !== "object") return false;
  const record = part as Record<string, unknown>;
  const referenceKind = String(record.assistantReferenceKind || "").trim();
  if (referenceKind === "canvas" || referenceKind === "mark") return true;

  return (
    typeof record.markerId === "string" &&
    (record.markerNormalizedX != null || record.markerNormalizedY != null)
  );
};

const UserMessageImagePart: ImageMessagePartComponent = (part) =>
  isAssistantReferenceMessagePart(part) ? null : <AssistantImage {...part} />;

const UserMessageFilePart: FileMessagePartComponent = (part) =>
  isAssistantReferenceMessagePart(part) ? null : <AssistantFile {...part} />;

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_user-message-root"
      data-role="user"
      className="group/message fade-in slide-in-from-bottom-1 motion-safe:animate-in mx-auto flex w-full max-w-3xl flex-col items-end gap-2 px-4 duration-150 [contain-intrinsic-size:auto_60px] [content-visibility:auto]"
    >
      <UserMessageAttachments />
      <div className="aui-user-message-content-wrapper relative flex w-full justify-end">
        <div className="aui-user-message-content peer block max-w-[85%] rounded-3xl bg-[#f2f0f0] px-5 py-3 text-left text-[#1f1f1f] whitespace-pre-wrap break-words empty:hidden dark:bg-[#333537] dark:text-[#e3e3e3]">
          <MessagePrimitive.Parts
            components={{
              Text: DirectiveText,
              Quote: QuoteBlock,
              Image: UserMessageImagePart,
              File: UserMessageFilePart,
            }}
          />
        </div>
        <div className="absolute top-1/2 start-0 -translate-x-full -translate-y-1/2 pe-2 opacity-0 transition-opacity peer-empty:hidden group-focus-within/message:opacity-100 group-hover/message:opacity-100 rtl:translate-x-full">
          <UserActionBar />
        </div>
      </div>
      <BranchPicker className="-me-1 justify-end" />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  const aui = useAui();

  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy" className={actionButtonClass}>
          <AuiIf condition={(state) => state.message.isCopied}>
            <CheckIcon className="size-4 animate-in zoom-in-50 fade-in duration-200 ease-out" />
          </AuiIf>
          <AuiIf condition={(state) => !state.message.isCopied}>
            <CopyIcon className="size-4 animate-in zoom-in-75 fade-in duration-150" />
          </AuiIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit" className={actionButtonClass}>
          <PencilIcon className="size-4" />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
      <TooltipIconButton
        tooltip="Delete"
        className={cn(actionButtonClass, "text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200")}
        onClick={() => void aui.message().delete()}
      >
        <TrashIcon className="size-4" />
      </TooltipIconButton>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root className="flex flex-col px-2">
      <ComposerPrimitive.Unstable_TriggerPopoverRoot>
        <ComposerPrimitive.Root className="ml-auto flex w-full max-w-[85%] flex-col rounded-[1.75rem] bg-white p-3 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.18)] dark:bg-[#1e1f20] dark:shadow-[0_2px_12px_-2px_rgba(0,0,0,0.6)]">
          <LexicalComposerInput
            directiveChip={DirectiveChip}
            autoFocus
            className="min-h-16 w-full resize-none bg-transparent px-2 py-1.5 text-[17px] leading-6 text-[#1f1f1f] outline-none [&_.aui-directive-chip]:inline-flex [&_.aui-directive-chip]:items-baseline [&_.aui-directive-chip]:gap-1 [&_.aui-directive-chip]:rounded-md [&_.aui-directive-chip]:bg-[#d8e7ff] [&_.aui-directive-chip]:px-1.5 [&_.aui-directive-chip]:py-0.5 [&_.aui-directive-chip]:text-[13px] [&_.aui-directive-chip]:font-medium [&_.aui-directive-chip]:leading-none [&_.aui-directive-chip]:text-[#1f3b9b] [&_.aui-directive-chip-icon]:self-center [&_.aui-lexical-input]:min-h-lh [&_.aui-lexical-input]:outline-none dark:text-[#e3e3e3] dark:[&_.aui-directive-chip]:bg-[#233a73] dark:[&_.aui-directive-chip]:text-[#d7e3ff]"
          />
          <div className="mt-2 flex items-center gap-1.5 self-end">
            <ComposerPrimitive.Cancel asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3.5 text-[#444746] hover:bg-[#444746]/8 hover:text-[#1f1f1f] dark:text-[#c4c7c5] dark:hover:bg-[#c4c7c5]/10 dark:hover:text-[#e3e3e3]"
              >
                Cancel
              </Button>
            </ComposerPrimitive.Cancel>
            <ComposerPrimitive.Send asChild>
              <Button
                size="sm"
                className="h-8 rounded-full bg-[#1f3b9b] px-3.5 text-white hover:bg-[#274aad]"
              >
                Update
              </Button>
            </ComposerPrimitive.Send>
          </div>
        </ComposerPrimitive.Root>
      </ComposerPrimitive.Unstable_TriggerPopoverRoot>
    </MessagePrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "inline-flex items-center gap-0.5 text-xs text-[#5e6063] dark:text-[#9aa0a6]",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous" className={actionButtonClass}>
          <ChevronLeftIcon className="size-4" />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next" className={actionButtonClass}>
          <ChevronRightIcon className="size-4" />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};

const SourcesLayout: FC<PropsWithChildren> = ({ children }) => {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-[#5e6063] dark:text-[#9aa0a6]">
        Sources
      </span>
      {children}
    </div>
  );
};
