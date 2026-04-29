import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

type StoredCompetitorPageImportImage = {
  url: string;
  name?: string;
  origin?: string;
  score?: number;
  width?: number;
  height?: number;
};

type StoredCompetitorPageImportRecord = {
  importId: string;
  clientId: string;
  source: "taobao-live-page";
  pageUrl: string;
  title: string;
  platformHint?: string;
  images: StoredCompetitorPageImportImage[];
  submittedAt: string;
};

const PRIMARY_ROOT_DIR = path.join(
  process.cwd(),
  ".jk-studio-runtime",
  "competitor-page-import",
);
const LEGACY_ROOT_DIR = path.join(
  process.cwd(),
  ".xc-studio-runtime",
  "competitor-page-import",
);

function resolveRootDir(): string {
  if (fs.existsSync(PRIMARY_ROOT_DIR)) {
    return PRIMARY_ROOT_DIR;
  }
  if (fs.existsSync(LEGACY_ROOT_DIR)) {
    return LEGACY_ROOT_DIR;
  }
  return PRIMARY_ROOT_DIR;
}
const MAX_BODY_BYTES = 1_500_000;
const MAX_IMAGES = 99;
const MAX_QUEUE_SIZE = 6;

function sanitizeClientId(clientId: string): string {
  const normalized = String(clientId || "").trim();
  if (!/^[a-zA-Z0-9_-]{12,128}$/.test(normalized)) {
    throw new Error("invalid_client_id");
  }
  return normalized;
}

function ensureClientDir(clientId: string): string {
  const safeClientId = sanitizeClientId(clientId);
  const clientDir = path.join(resolveRootDir(), safeClientId);
  fs.mkdirSync(clientDir, { recursive: true });
  return clientDir;
}

function normalizeHttpUrl(value: string): string {
  const normalized = String(value || "").trim();
  if (!/^https?:\/\//i.test(normalized)) {
    return "";
  }
  try {
    const parsed = new URL(normalized);
    return parsed.toString();
  } catch {
    return "";
  }
}

function isLikelyImageUrl(value: string): boolean {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) {
    return false;
  }
  if (/\.(css|js|map|json|html?|woff2?|ttf|eot)(?:$|[?#])/i.test(normalized)) {
    return false;
  }
  if (/\.(png|jpe?g|webp|gif|bmp|avif)(?:$|[?#_])/i.test(normalized)) {
    return true;
  }
  return /(img\.alicdn|gw\.alicdn|gtms\d+\.alicdn|imgextra|bao\/uploaded|uploaded\/i\d+\/|O1CN)/i.test(
    normalized,
  );
}

function normalizeImage(rawImage: any): StoredCompetitorPageImportImage | null {
  const url = normalizeHttpUrl(rawImage?.url);
  if (!url) {
    return null;
  }
  if (!isLikelyImageUrl(url)) {
    return null;
  }

  const name = String(rawImage?.name || "").trim().slice(0, 200);
  const origin = String(rawImage?.origin || "").trim().slice(0, 80);
  const score =
    typeof rawImage?.score === "number" && Number.isFinite(rawImage.score)
      ? Math.round(rawImage.score * 100) / 100
      : undefined;
  const width =
    typeof rawImage?.width === "number" && Number.isFinite(rawImage.width)
      ? Math.max(0, Math.round(rawImage.width))
      : undefined;
  const height =
    typeof rawImage?.height === "number" && Number.isFinite(rawImage.height)
      ? Math.max(0, Math.round(rawImage.height))
      : undefined;

  return {
    url,
    name: name || undefined,
    origin: origin || undefined,
    score,
    width,
    height,
  };
}

function normalizeRecord(body: any): StoredCompetitorPageImportRecord {
  const clientId = sanitizeClientId(body?.clientId);
  const pageUrl = normalizeHttpUrl(body?.pageUrl || body?.url);
  if (!pageUrl) {
    throw new Error("page_url_required");
  }

  const title =
    String(body?.title || "").trim().slice(0, 200) ||
    String(body?.pageTitle || "").trim().slice(0, 200) ||
    pageUrl;
  const platformHint = String(body?.platformHint || "").trim().slice(0, 40);
  const images = Array.isArray(body?.images)
    ? body.images
        .map((image: any) => normalizeImage(image))
        .filter(
          (
            image,
          ): image is StoredCompetitorPageImportImage => Boolean(image),
        )
    : [];

  const dedupedImages: StoredCompetitorPageImportImage[] = Array.from(
    new Map<string, StoredCompetitorPageImportImage>(
      images.map((image) => [image.url, image]),
    ).values(),
  ).slice(0, MAX_IMAGES);

  if (dedupedImages.length === 0) {
    throw new Error("no_usable_images_found");
  }

  return {
    importId: `cpi_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`,
    clientId,
    source: "taobao-live-page",
    pageUrl,
    title,
    platformHint: platformHint || undefined,
    images: dedupedImages,
    submittedAt: new Date().toISOString(),
  };
}

function getRecordPaths(clientId: string): string[] {
  const clientDir = ensureClientDir(clientId);
  return fs
    .readdirSync(clientDir)
    .filter((filename) => filename.endsWith(".json"))
    .map((filename) => path.join(clientDir, filename))
    .sort((left, right) => {
      const leftStat = fs.statSync(left);
      const rightStat = fs.statSync(right);
      return rightStat.mtimeMs - leftStat.mtimeMs;
    });
}

function writeRecord(record: StoredCompetitorPageImportRecord) {
  const clientDir = ensureClientDir(record.clientId);
  const targetPath = path.join(clientDir, `${record.importId}.json`);
  fs.writeFileSync(targetPath, JSON.stringify(record, null, 2), "utf8");

  const staleFiles = getRecordPaths(record.clientId).slice(MAX_QUEUE_SIZE);
  for (const staleFile of staleFiles) {
    try {
      fs.unlinkSync(staleFile);
    } catch {
      // Ignore cleanup failures.
    }
  }
}

function readRecord(filePath: string): StoredCompetitorPageImportRecord | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const images = Array.isArray((parsed as any).images)
      ? (parsed as any).images
          .map((image: any) => normalizeImage(image))
          .filter(
            (
              image,
            ): image is StoredCompetitorPageImportImage => Boolean(image),
          )
          .slice(0, MAX_IMAGES)
      : [];
    if (images.length === 0) {
      return null;
    }
    return {
      importId: String((parsed as any).importId || "").trim() || path.basename(filePath, ".json"),
      clientId: sanitizeClientId(String((parsed as any).clientId || "").trim()),
      source: "taobao-live-page",
      pageUrl: normalizeHttpUrl((parsed as any).pageUrl || (parsed as any).url),
      title: String((parsed as any).title || "").trim().slice(0, 200),
      platformHint: String((parsed as any).platformHint || "").trim().slice(0, 40) || undefined,
      images,
      submittedAt:
        String((parsed as any).submittedAt || "").trim() || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function consumeLatestRecord(
  clientId: string,
): StoredCompetitorPageImportRecord | null {
  for (const filePath of getRecordPaths(clientId)) {
    const record = readRecord(filePath);
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore delete failures and continue returning the record if possible.
    }
    if (record) {
      return record;
    }
  }
  return null;
}

function readLatestRecord(
  clientId: string,
): StoredCompetitorPageImportRecord | null {
  for (const filePath of getRecordPaths(clientId)) {
    const record = readRecord(filePath);
    if (record) {
      return record;
    }
  }
  return null;
}

async function readJsonBody(req: any): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const rawBody = Buffer.concat(chunks);
  if (rawBody.byteLength > MAX_BODY_BYTES) {
    throw new Error("payload_too_large");
  }
  if (rawBody.byteLength === 0) {
    return {};
  }
  try {
    return JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new Error("invalid_json_body");
  }
}

function writeJson(
  res: any,
  statusCode: number,
  payload: any,
  options?: { cors?: boolean },
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.cors) {
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(payload));
}

function writeCorsPreflight(res: any) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });
  res.end();
}

export function apiCompetitorPageImportPlugin(): Plugin {
  return {
    name: "vite-plugin-api-competitor-page-import",
    configureServer(server) {
      server.middlewares.use("/api/competitor-page-import", async (req, res) => {
        const requestUrl = new URL(req.url || "/", "http://localhost");
        const pathname = requestUrl.pathname.replace(
          /^\/api\/competitor-page-import/,
          "",
        ) || "/";

        if (pathname === "/submit") {
          if (req.method === "OPTIONS") {
            writeCorsPreflight(res);
            return;
          }

          if (req.method !== "POST") {
            writeJson(
              res,
              405,
              { error: "method_not_allowed" },
              { cors: true },
            );
            return;
          }

          try {
            const body = await readJsonBody(req);
            const record = normalizeRecord(body);
            writeRecord(record);
            writeJson(
              res,
              200,
              {
                ok: true,
                importId: record.importId,
                submittedAt: record.submittedAt,
                imageCount: record.images.length,
              },
              { cors: true },
            );
          } catch (error: any) {
            const message = String(error?.message || "submit_failed");
            const statusCode =
              message === "invalid_client_id" ||
              message === "page_url_required" ||
              message === "invalid_json_body" ||
              message === "no_usable_images_found"
                ? 400
                : message === "payload_too_large"
                  ? 413
                  : 500;
            writeJson(
              res,
              statusCode,
              { error: message },
              { cors: true },
            );
          }
          return;
        }

        if (pathname === "/pending/latest" || pathname === "/pending/consume") {
          if (req.method !== "POST") {
            writeJson(res, 405, { error: "method_not_allowed" });
            return;
          }

          try {
            const body = await readJsonBody(req);
            const clientId = sanitizeClientId(body?.clientId);
            const record =
              pathname === "/pending/consume"
                ? consumeLatestRecord(clientId)
                : readLatestRecord(clientId);
            if (!record) {
              writeJson(res, 404, { error: "pending_import_not_found" });
              return;
            }

            writeJson(res, 200, {
              ok: true,
              importId: record.importId,
              submittedAt: record.submittedAt,
              source: record.source,
              url: record.pageUrl,
              title: record.title,
              platformHint: record.platformHint,
              extractionMode: "browser",
              images: record.images,
            });
          } catch (error: any) {
            const message = String(error?.message || "consume_failed");
            writeJson(
              res,
              message === "invalid_client_id" ? 400 : 500,
              { error: message },
            );
          }
          return;
        }

        writeJson(res, 404, { error: "not_found" });
      });
    },
  };
}
