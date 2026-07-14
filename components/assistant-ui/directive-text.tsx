"use client";

import { memo, type ComponentType } from "react";
import {
  unstable_defaultDirectiveFormatter,
  type TextMessagePartComponent,
  type Unstable_DirectiveFormatter,
} from "@assistant-ui/react";

type IconComponent = ComponentType<{ className?: string }>;

type CreateDirectiveTextOptions = {
  iconMap?: Record<string, IconComponent>;
  fallbackIcon?: IconComponent;
};

const HIDDEN_ASSISTANT_REFERENCE_RE = /(^|\n)\[Canvas (?:mark )?reference\]/u;

export const stripHiddenAssistantReferenceText = (text: string): string => {
  const match = HIDDEN_ASSISTANT_REFERENCE_RE.exec(text);
  if (!match) return text;

  const markerStart = match.index + (match[1] === "\n" ? 1 : 0);
  return text.slice(0, markerStart).trimEnd();
};

const renderChip = (
  text: string,
  type: string | undefined,
  iconMap: Record<string, IconComponent> | undefined,
  fallbackIcon: IconComponent | undefined,
) => {
  const Icon =
    (type && iconMap?.[type]) ||
    fallbackIcon ||
    null;

  return (
    <span
      data-directive-chip=""
      data-directive-type={type || ""}
      className="inline-flex items-baseline gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[13px] font-medium text-slate-700"
    >
      {Icon ? <Icon className="size-3 self-center" /> : null}
      <span>{text}</span>
    </span>
  );
};

export const createDirectiveText = (
  formatter: Unstable_DirectiveFormatter = unstable_defaultDirectiveFormatter,
  options: CreateDirectiveTextOptions = {},
): TextMessagePartComponent => {
  const DirectiveTextImpl: TextMessagePartComponent = ({ text }) => {
    const visibleText = stripHiddenAssistantReferenceText(text);
    if (!visibleText) return null;

    const segments = formatter.parse(visibleText);
    return (
      <p className="m-0 whitespace-pre-wrap break-words leading-6">
        {segments.map((segment, index) => {
          if (segment.kind === "text") {
            return <span key={`${index}-text`}>{segment.text}</span>;
          }
          return (
            <span key={`${index}-directive`}>
              {renderChip(
                segment.label,
                segment.type,
                options.iconMap,
                options.fallbackIcon,
              )}
            </span>
          );
        })}
      </p>
    );
  };

  return memo(DirectiveTextImpl);
};

export const DirectiveText = createDirectiveText();
