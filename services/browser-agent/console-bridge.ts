export type BrowserConsoleLevel = "log" | "info" | "warn" | "error";

export type BrowserConsoleEvent = {
  id: string;
  level: BrowserConsoleLevel;
  timestamp: number;
  source?: string;
  message: string;
  payload?: string[];
};

type ConsoleListener = (event: BrowserConsoleEvent) => void;

const MAX_EVENTS = 500;
const MAX_PAYLOAD_CHARS_PER_EVENT = 4000;
const MAX_READ_WINDOW = 50;
const listeners = new Set<ConsoleListener>();
const events: BrowserConsoleEvent[] = [];
let installed = false;

const ORIGINAL_CONSOLE = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

const redactSensitiveText = (value: string): string => {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]")
    .replace(/sk-[A-Za-z0-9]+/g, "sk-[REDACTED]")
    .replace(/AIza[0-9A-Za-z\-_]+/g, "AIza[REDACTED]");
};

const safeStringify = (value: unknown): string => {
  if (typeof value === "string") return redactSensitiveText(value);
  try {
    return redactSensitiveText(JSON.stringify(value));
  } catch {
    return redactSensitiveText(String(value));
  }
};

const summarizePayload = (args: unknown[]): string[] => {
  const joined = args.map((item) => safeStringify(item));
  const summary = joined.join(" ");
  if (summary.length <= MAX_PAYLOAD_CHARS_PER_EVENT) return joined;
  return [
    `${summary.slice(0, MAX_PAYLOAD_CHARS_PER_EVENT)}...(truncated len=${summary.length})`,
  ];
};

const getSourceFromStack = (): string | undefined => {
  const stack = new Error().stack?.split("\n").slice(3) || [];
  const firstFrame = stack.find((line) => line.includes(".ts") || line.includes(".js"));
  if (!firstFrame) return undefined;
  return firstFrame.trim();
};

const pushEvent = (event: BrowserConsoleEvent) => {
  events.push(event);
  while (events.length > MAX_EVENTS) {
    events.shift();
  }
  listeners.forEach((listener) => listener(event));
};

const captureConsoleCall = (level: BrowserConsoleLevel, args: unknown[]) => {
  const payload = summarizePayload(args);
  const message = payload.join(" ").slice(0, MAX_PAYLOAD_CHARS_PER_EVENT);
  pushEvent({
    id: `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    timestamp: Date.now(),
    source: getSourceFromStack(),
    message,
    payload,
  });
};

const captureWindowError = (args: {
  level: BrowserConsoleLevel;
  source: string;
  message: string;
  payload?: unknown[];
}) => {
  const payload = summarizePayload(args.payload || []);
  pushEvent({
    id: `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level: args.level,
    timestamp: Date.now(),
    source: args.source,
    message: redactSensitiveText(String(args.message || "").slice(0, MAX_PAYLOAD_CHARS_PER_EVENT)),
    payload,
  });
};

export const ensureBrowserConsoleBridge = () => {
  if (installed || typeof window === "undefined") return;
  installed = true;

  console.log = (...args: unknown[]) => {
    ORIGINAL_CONSOLE.log(...args);
    captureConsoleCall("log", args);
  };
  console.info = (...args: unknown[]) => {
    ORIGINAL_CONSOLE.info(...args);
    captureConsoleCall("info", args);
  };
  console.warn = (...args: unknown[]) => {
    ORIGINAL_CONSOLE.warn(...args);
    captureConsoleCall("warn", args);
  };
  console.error = (...args: unknown[]) => {
    ORIGINAL_CONSOLE.error(...args);
    captureConsoleCall("error", args);
  };

  window.addEventListener("error", (event) => {
    captureWindowError({
      level: "error",
      source: "window.error",
      message: String(event.message || "Unhandled window error"),
      payload: [
        {
          filename: event.filename || null,
          lineno: event.lineno || null,
          colno: event.colno || null,
          error:
            event.error instanceof Error
              ? {
                  name: event.error.name,
                  message: event.error.message,
                  stack: event.error.stack || null,
                }
              : String(event.error || ""),
        },
      ],
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    captureWindowError({
      level: "error",
      source: "window.unhandledrejection",
      message:
        reason instanceof Error
          ? reason.message || reason.name || "Unhandled promise rejection"
          : String(reason || "Unhandled promise rejection"),
      payload: [
        reason instanceof Error
          ? {
              name: reason.name,
              message: reason.message,
              stack: reason.stack || null,
            }
          : reason,
      ],
    });
  });
};

export const readRecentConsoleEvents = (opts?: {
  level?: BrowserConsoleLevel;
  sourceIncludes?: string;
  limit?: number;
}) => {
  const level = opts?.level;
  const sourceIncludes = String(opts?.sourceIncludes || "").trim();
  const limit = Math.max(
    1,
    Math.min(MAX_READ_WINDOW, Number.parseInt(String(opts?.limit || MAX_READ_WINDOW), 10) || MAX_READ_WINDOW),
  );
  const filtered = events.filter((event) => {
    if (level && event.level !== level) return false;
    if (
      sourceIncludes &&
      !String(event.source || "").toLowerCase().includes(sourceIncludes.toLowerCase())
    ) {
      return false;
    }
    return true;
  });
  return filtered.slice(-limit);
};

export const subscribeConsoleEvents = (listener: ConsoleListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
