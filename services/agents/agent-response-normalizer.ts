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

export const normalizeAgentJsonResponse = (response: string): any => {
  const raw = String(response || "");
  const unwrapped = unwrapCodeFence(raw);

  try {
    return tryParseJson(unwrapped);
  } catch (error) {
    console.warn(
      "[Agent] JSON parse failed, trying more aggressive extraction",
      error,
    );
  }

  try {
    const objectSegment = extractBalancedJsonSegment(unwrapped, "{", "}");
    if (objectSegment) {
      return tryParseJson(objectSegment);
    }

    const arraySegment = extractBalancedJsonSegment(unwrapped, "[", "]");
    if (arraySegment) {
      return tryParseJson(arraySegment);
    }
  } catch (deepError) {
    console.warn("[Agent] Deep JSON extraction failed too", deepError);
  }

  const cleanedResponse = raw
    .replace(/```json:generation\s*[\s\S]*?```/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { message: cleanedResponse, skillCalls: [] };
};
