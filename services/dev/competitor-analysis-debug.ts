import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

type CompetitorAnalysisDebugRecord = {
  recordedAt: string;
  deckId: string;
  deckName?: string;
  providerId?: string | null;
  baseUrl?: string | null;
  requestedModel?: string | null;
  responseId?: string | null;
  responseModel?: string | null;
  finishReason?: string | null;
  imageCount?: number;
  payloadSummary?: unknown;
  imageTransportSummary?: unknown;
  imageInputDiagnostics?: unknown;
  attemptTrace?: unknown;
  finalStage?: string | null;
  responseFormat?: string | null;
  parseError?: string | null;
  failureReason?: string | null;
  rawText?: string;
  parsedPayload?: unknown;
  normalizedAnalysis?: unknown;
};

const PRIMARY_ROOT_DIR = path.join(
  process.cwd(),
  ".jk-studio-runtime",
  "competitor-analysis-debug",
);
const LEGACY_ROOT_DIR = path.join(
  process.cwd(),
  ".xc-studio-runtime",
  "competitor-analysis-debug",
);
const MAX_BODY_BYTES = 3_500_000;
const MAX_LOG_FILES = 12;

function resolveRootDir(): string {
  if (fs.existsSync(PRIMARY_ROOT_DIR)) return PRIMARY_ROOT_DIR;
  if (fs.existsSync(LEGACY_ROOT_DIR)) return LEGACY_ROOT_DIR;
  return PRIMARY_ROOT_DIR;
}

function ensureRootDir(): string {
  const rootDir = resolveRootDir();
  fs.mkdirSync(rootDir, { recursive: true });
  return rootDir;
}

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function getDailyLogPath(): string {
  return path.join(ensureRootDir(), `competitor-analysis-debug-${getTodayKey()}.jsonl`);
}

function getLatestSnapshotPath(): string {
  return path.join(ensureRootDir(), "latest-competitor-analysis-debug.json");
}

function cleanupOldFiles(): void {
  const rootDir = ensureRootDir();
  const files = fs
    .readdirSync(rootDir)
    .filter((name) => /^competitor-analysis-debug-\d{8}\.jsonl$/.test(name))
    .map((name) => path.join(rootDir, name))
    .sort((left, right) => {
      const leftStat = fs.statSync(left);
      const rightStat = fs.statSync(right);
      return rightStat.mtimeMs - leftStat.mtimeMs;
    });

  files.slice(MAX_LOG_FILES).forEach((filePath) => {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore cleanup failures.
    }
  });
}

async function readJsonBody(req: NodeJS.ReadableStream): Promise<any> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error("payload_too_large");
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function normalizeRecord(body: any): CompetitorAnalysisDebugRecord {
  const deckId = String(body?.deckId || "").trim();
  if (!deckId) {
    throw new Error("deck_id_required");
  }

  const rawText = String(body?.rawText || "");
  if (!rawText.trim()) {
    throw new Error("raw_text_required");
  }

  return {
    recordedAt: new Date().toISOString(),
    deckId,
    deckName: String(body?.deckName || "").trim().slice(0, 240) || undefined,
    providerId: String(body?.providerId || "").trim() || undefined,
    baseUrl: String(body?.baseUrl || "").trim() || undefined,
    requestedModel: String(body?.requestedModel || "").trim() || undefined,
    responseId: String(body?.responseId || "").trim() || undefined,
    responseModel: String(body?.responseModel || "").trim() || undefined,
    finishReason: String(body?.finishReason || "").trim() || undefined,
    imageCount:
      typeof body?.imageCount === "number" && Number.isFinite(body.imageCount)
        ? Math.max(0, Math.round(body.imageCount))
        : undefined,
    payloadSummary: body?.payloadSummary,
    imageTransportSummary: body?.imageTransportSummary,
    imageInputDiagnostics: body?.imageInputDiagnostics,
    attemptTrace: body?.attemptTrace,
    finalStage: body?.finalStage == null ? null : String(body.finalStage),
    responseFormat: body?.responseFormat == null ? null : String(body.responseFormat),
    parseError: body?.parseError == null ? null : String(body.parseError),
    failureReason:
      body?.failureReason == null ? null : String(body.failureReason),
    rawText,
    parsedPayload: body?.parsedPayload,
    normalizedAnalysis: body?.normalizedAnalysis,
  };
}

function writeRecord(record: CompetitorAnalysisDebugRecord) {
  const dailyLogPath = getDailyLogPath();
  const latestSnapshotPath = getLatestSnapshotPath();
  fs.appendFileSync(dailyLogPath, `${JSON.stringify(record)}\n`, "utf8");
  fs.writeFileSync(latestSnapshotPath, JSON.stringify(record, null, 2), "utf8");
  cleanupOldFiles();
  return {
    dailyLogPath,
    latestSnapshotPath,
  };
}

export function apiCompetitorAnalysisDebugPlugin(): Plugin {
  return {
    name: "vite-plugin-api-competitor-analysis-debug",
    configureServer(server) {
      server.middlewares.use("/api/debug-competitor-analysis", async (req, res) => {
        const writeJson = (status: number, payload: Record<string, unknown>) => {
          res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(payload));
        };

        if (req.method !== "POST") {
          writeJson(405, { error: "Method not allowed" });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const record = normalizeRecord(body);
          const result = writeRecord(record);
          writeJson(200, {
            ok: true,
            deckId: record.deckId,
            recordedAt: record.recordedAt,
            dailyLogPath: result.dailyLogPath,
            latestSnapshotPath: result.latestSnapshotPath,
          });
        } catch (error: any) {
          const message = String(error?.message || "debug_record_write_failed");
          writeJson(message === "payload_too_large" ? 413 : 400, { error: message });
        }
      });
    },
  };
}
