const DEFAULT_PROPOSAL_MESSAGE = "已为您生成以下方案。";

const normalizeTrailingCommas = (value: string) =>
  value.replace(/,\s*([\]}])/g, "$1");

const normalizeArrayPayload = (parsed: unknown) =>
  Array.isArray(parsed)
    ? { proposals: parsed, message: DEFAULT_PROPOSAL_MESSAGE }
    : parsed;

const tryParseJson = (value: string): any => {
  const cleaned = normalizeTrailingCommas(value.trim());
  return normalizeArrayPayload(JSON.parse(cleaned));
};

const unwrapCodeFence = (value: string) => {
  const trimmed = value.trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  return codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;
};

const THINKING_LINE_RE =
  /^(先|我先|先去|先来|先帮你|正在|接着|然后|下一步|我会先|先联网|先核实|先确认|先看一下)/;

const normalizeThinkingLine = (value: unknown): string => {
  const text = String(value || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 240 ? `${text.slice(0, 239).trim()}...` : text;
};

export const extractVisibleThoughtTrace = (value: string): string[] => {
  const normalized = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized
    .split("\n")
    .map((line) => normalizeThinkingLine(line))
    .filter(Boolean);

  const directThoughts = lines.filter((line) => THINKING_LINE_RE.test(line));
  if (directThoughts.length > 0) {
    return Array.from(new Set(directThoughts));
  }

  // Previously we had a fallback that returned every line as a "thought" when
  // the text wasn't JSON-shaped and every line was short. That caused a
  // visible bug: when the LLM streamed a plain final answer (no JSON, no
  // thinking markers like "先/我先/正在/..."), the entire answer body was
  // mirrored into thoughtTrace, so the UI's "查看思考过程" panel showed the
  // same content as the final reply. Final visible answers are not thoughts.
  // If the response doesn't contain any explicit thinking-marker line, we
  // simply have no extractable thoughts.
  return [];
};

const extractBalancedJsonSegment = (
  input: string,
  openChar: "{" | "[",
  closeChar: "}" | "]",
) => {
  let depth = 0;
  let start = -1;
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (char === "\\") {
        isEscaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openChar) {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === closeChar && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return input.slice(start, index + 1);
      }
    }
  }

  return null;
};

const tryParseEmbeddedJsonWithThoughtPrefix = (input: string): any | null => {
  const objectSegment = extractBalancedJsonSegment(input, "{", "}");
  const arraySegment = objectSegment ? null : extractBalancedJsonSegment(input, "[", "]");
  const jsonSegment = objectSegment || arraySegment;
  if (!jsonSegment) return null;

  const jsonStart = input.indexOf(jsonSegment);
  const prefix = jsonStart > 0 ? input.slice(0, jsonStart).trim() : "";
  const parsed = tryParseJson(jsonSegment);
  const thoughtTrace = extractVisibleThoughtTrace(prefix);

  if (thoughtTrace.length === 0) {
    return parsed;
  }

  const mergedTrace = Array.isArray((parsed as any)?.thoughtTrace)
    ? Array.from(
        new Set([
          ...thoughtTrace,
          ...(parsed as any).thoughtTrace
            .map((item: unknown) => normalizeThinkingLine(item))
            .filter(Boolean),
        ]),
      )
    : thoughtTrace;

  return {
    ...parsed,
    thoughtTrace: mergedTrace,
  };
};

export const normalizeAgentJsonResponse = (response: string): any => {
  const raw = String(response || "");
  const unwrapped = unwrapCodeFence(raw);
  const visibleThoughtTrace = extractVisibleThoughtTrace(unwrapped);

  const prefixedJson = tryParseEmbeddedJsonWithThoughtPrefix(unwrapped);
  if (prefixedJson) {
    return prefixedJson;
  }

  if (
    visibleThoughtTrace.length > 0 &&
    !unwrapped.trim().startsWith("{") &&
    !unwrapped.trim().startsWith("[")
  ) {
    return {
      message: unwrapped.trim(),
      skillCalls: [],
      thoughtTrace: visibleThoughtTrace,
    };
  }

  try {
    return tryParseJson(unwrapped);
  } catch (error) {
    console.warn(
      "[Agent] JSON parse failed, trying more aggressive extraction",
      error,
    );
  }

  try {
    const embeddedJson = tryParseEmbeddedJsonWithThoughtPrefix(unwrapped);
    if (embeddedJson) {
      return embeddedJson;
    }
  } catch (deepError) {
    console.warn("[Agent] Deep JSON extraction failed too", deepError);
  }

  const cleanedResponse = raw
    .replace(/```json:generation\s*[\s\S]*?```/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const thoughtTrace = extractVisibleThoughtTrace(cleanedResponse);

  return {
    message: cleanedResponse,
    skillCalls: [],
    ...(thoughtTrace.length > 0 ? { thoughtTrace } : {}),
  };
};
