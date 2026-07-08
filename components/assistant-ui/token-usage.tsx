"use client";

import { useAuiState } from "@assistant-ui/react";
import { getThreadMessageTokenUsage } from "@assistant-ui/react-ai-sdk";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { FC } from "react";

const formatTokenCount = (value: number | undefined): string => {
  if (value === undefined) return "--";
  if (value < 1000) return String(Math.round(value));
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}k`;
};

export const TokenUsage: FC<{
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}> = ({ className, side = "right" }) => {
  const usage = useAuiState((state) =>
    getThreadMessageTokenUsage(state.message),
  );

  if (!usage?.totalTokens) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-slot="token-usage-trigger"
          aria-label="Token usage"
          className={cn(
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center rounded-md p-1 font-mono text-xs tabular-nums transition-colors",
            className,
          )}
        >
          {formatTokenCount(usage.totalTokens)} tok
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={8}
        data-slot="token-usage-popover"
        className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 shadow-md [&_span>svg]:hidden!"
      >
        <div className="grid min-w-36 gap-1.5 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Total</span>
            <span className="font-mono tabular-nums">
              {formatTokenCount(usage.totalTokens)}
            </span>
          </div>
          {usage.inputTokens !== undefined ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Input</span>
              <span className="font-mono tabular-nums">
                {formatTokenCount(usage.inputTokens)}
              </span>
            </div>
          ) : null}
          {usage.outputTokens !== undefined ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Output</span>
              <span className="font-mono tabular-nums">
                {formatTokenCount(usage.outputTokens)}
              </span>
            </div>
          ) : null}
          {usage.reasoningTokens !== undefined ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Reasoning</span>
              <span className="font-mono tabular-nums">
                {formatTokenCount(usage.reasoningTokens)}
              </span>
            </div>
          ) : null}
          {usage.cachedInputTokens !== undefined ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Cached input</span>
              <span className="font-mono tabular-nums">
                {formatTokenCount(usage.cachedInputTokens)}
              </span>
            </div>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
