import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

type EcommerceWorkflowDebugRecord = {
  recordedAt: string;
  sessionId: string;
  stage: string;
  note?: string;
  snapshot: unknown;
};

const PRIMARY_ROOT_DIR = path.join(
  process.cwd(),
  ".jk-studio-runtime",
  "ecommerce-workflow-debug",
);
const LEGACY_ROOT_DIR = path.join(
  process.cwd(),
  ".xc-studio-runtime",
  "ecommerce-workflow-debug",
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
  return path.join(ensureRootDir(), `ecommerce-workflow-debug-${getTodayKey()}.jsonl`);
}

function getLatestSnapshotPath(): string {
  return path.join(ensureRootDir(), "latest-ecommerce-workflow-debug.json");
}

function cleanupOldFiles(): void {
  const rootDir = ensureRootDir();
  const files = fs
    .readdirSync(rootDir)
    .filter((name) => /^ecommerce-workflow-debug-\d{8}\.jsonl$/.test(name))
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

function normalizeRecord(body: any): EcommerceWorkflowDebugRecord {
  const sessionId = String(body?.sessionId || "").trim();
  const stage = String(body?.stage || "").trim();
  if (!sessionId) {
    throw new Error("session_id_required");
  }
  if (!stage) {
    throw new Error("stage_required");
  }
  if (!body || typeof body !== "object" || body.snapshot === undefined) {
    throw new Error("snapshot_required");
  }

  return {
    recordedAt: new Date().toISOString(),
    sessionId,
    stage,
    note: String(body?.note || "").trim().slice(0, 400) || undefined,
    snapshot: body.snapshot,
  };
}

function writeRecord(record: EcommerceWorkflowDebugRecord) {
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

export function apiEcommerceWorkflowDebugPlugin(): Plugin {
  return {
    name: "vite-plugin-api-ecommerce-workflow-debug",
    configureServer(server) {
      server.middlewares.use("/api/debug-ecommerce-workflow", async (req, res) => {
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
            sessionId: record.sessionId,
            stage: record.stage,
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
