const normalizeEscapedNewlines = (value: string): string =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n");

const HUMAN_PROGRESS_FIELDS = [
  "message",
  "preGenerationMessage",
  "postGenerationSummary",
];

const INTERNAL_PROGRESS_LINE_RE =
  /(?:\bparams\b|\bskillCalls\b|\btool_calls\b|\bproviderId\b|\bproviderBaseUrl\b|\brequestId\b|\bpayload\b|\bdiagnostics\b|\bpromptChars\b|\bhistoryCount\b|\bestimatedPayloadChars\b|\bincludePageExtracts\b|\bmaxExtractPages\b|\bcitationOrdinals\b|\broleGovernanceAudit\b|\btargetRoleId\b|\brequiresHumanApproval\b|\bcustom_\d+\b|\bdata:image\/|\[Frontstage Skill Contract\]|\[Current Request\]|\[Runtime State Snapshot\]|\[Original User Request\])/i;

const INTERNAL_PROGRESS_BLOCK_RE =
  /\[(?:Frontstage Skill Contract|Current Request|Runtime State Snapshot|Original User Request|Upstream Workflow Context)\]/i;

const INTERNAL_PROGRESS_PHRASE_KEYWORDS = [
  "workflow contract",
  "missing prerequisite steps",
  "backfill",
  "auto-repaired",
];

const STRUCTURED_PROGRESS_RE =
  /[\{\[]\s*"(?:analysis|message|preGenerationMessage|postGenerationSummary|skillCalls|params|answerSegments|suggestions)"/i;

const MANY_JSON_KEYS_RE = /"[A-Za-z_][A-Za-z0-9_]*"\s*:/g;

const containsInternalProgressPhrase = (value: string): boolean => {
  const normalized = String(value || "").toLowerCase();
  return INTERNAL_PROGRESS_PHRASE_KEYWORDS.some((keyword) =>
    normalized.includes(keyword),
  );
};

const trimWrappedQuotes = (value: string): string => {
  const normalized = String(value || "").trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    return normalized.slice(1, -1).trim();
  }
  return normalized;
};

const truncateText = (value: string, maxChars: number): string => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.length > maxChars
    ? `${normalized.slice(0, Math.max(0, maxChars - 1))}...`
    : normalized;
};

const extractJsonStringField = (
  raw: string,
  field: string,
): string | null => {
  const source = String(raw || "");
  if (!source) return null;
  const needle = `"${field}"`;
  let searchFrom = 0;

  while (true) {
    const keyIndex = source.indexOf(needle, searchFrom);
    if (keyIndex < 0) return null;
    let cursor = keyIndex + needle.length;
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    if (source[cursor] !== ":") {
      searchFrom = keyIndex + 1;
      continue;
    }
    cursor += 1;
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    if (source[cursor] !== '"') {
      searchFrom = keyIndex + 1;
      continue;
    }
    cursor += 1;

    let out = "";
    while (cursor < source.length) {
      const ch = source[cursor];
      if (ch === "\\") {
        const next = source[cursor + 1];
        if (next === undefined) break;
        if (next === "n") out += "\n";
        else if (next === "t") out += "\t";
        else if (next === "r") out += "";
        else if (next === '"' || next === "\\" || next === "/") out += next;
        else out += next;
        cursor += 2;
        continue;
      }
      if (ch === '"') break;
      out += ch;
      cursor += 1;
    }

    return out;
  }
};

const looksStructured = (value: string): boolean => {
  const normalized = String(value || "");
  if (!normalized) return false;
  if (STRUCTURED_PROGRESS_RE.test(normalized)) return true;
  const matches = normalized.match(MANY_JSON_KEYS_RE);
  return Boolean(matches && matches.length >= 3);
};

const harvestHumanProgressFields = (value: string): string => {
  const fragments: string[] = [];
  const seen = new Set<string>();

  for (const field of HUMAN_PROGRESS_FIELDS) {
    const extracted = extractJsonStringField(value, field);
    const cleaned = trimWrappedQuotes(String(extracted || "")).trim();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    fragments.push(cleaned);
  }

  return fragments.join("\n");
};

export const sanitizeAgentProgressMessage = (value: unknown): string => {
  const normalized = normalizeEscapedNewlines(String(value || "")).trim();
  if (!normalized) return "";
  if (INTERNAL_PROGRESS_BLOCK_RE.test(normalized)) return "";

  if (looksStructured(normalized)) {
    return truncateText(harvestHumanProgressFields(normalized), 320);
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const cleanedLines: string[] = [];
  for (const line of lines) {
    if (INTERNAL_PROGRESS_LINE_RE.test(line)) continue;
    if (containsInternalProgressPhrase(line)) continue;
    if (/^[{}\[\],]+$/.test(line)) continue;
    if (/^"?[A-Za-z_][A-Za-z0-9_]*"?\s*:\s*[\{\[]?/.test(line)) {
      const [, valuePart = ""] = line.split(/:\s*/, 2);
      const cleanedValue = truncateText(
        trimWrappedQuotes(valuePart.replace(/[{}\[\],]+$/g, "")),
        240,
      );
      if (cleanedValue && !INTERNAL_PROGRESS_LINE_RE.test(cleanedValue)) {
        cleanedLines.push(cleanedValue);
      }
      continue;
    }
    cleanedLines.push(truncateText(line, 240));
  }

  return Array.from(new Set(cleanedLines)).join("\n").trim();
};

export const sanitizeAgentProgressLog = (messages: unknown[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const message of Array.isArray(messages) ? messages : []) {
    const cleaned = sanitizeAgentProgressMessage(message);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
  }

  return result;
};

export const appendSanitizedProgressMessage = (
  progressLog: unknown[],
  progressMessage: unknown,
): string[] => {
  const log = sanitizeAgentProgressLog(progressLog);
  const nextMessage = sanitizeAgentProgressMessage(progressMessage);
  if (!nextMessage) return log;

  const lastMessage = log[log.length - 1] || "";
  if (
    lastMessage &&
    nextMessage !== lastMessage &&
    nextMessage.length > lastMessage.length &&
    nextMessage.startsWith(lastMessage)
  ) {
    return [...log.slice(0, -1), nextMessage];
  }

  if (!lastMessage || lastMessage !== nextMessage) {
    return [...log, nextMessage];
  }

  return log;
};
