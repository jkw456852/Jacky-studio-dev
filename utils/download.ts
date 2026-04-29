import JSZip from "jszip";

const DATA_OR_BLOB_URL_RE = /^(data:|blob:)/i;

const sanitizeFilenamePart = (value: string): string =>
  String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const inferExtensionFromContentType = (contentType: string | null): string => {
  const normalized = String(contentType || "").toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  if (normalized.includes("svg")) return "svg";
  if (normalized.includes("bmp")) return "bmp";
  if (normalized.includes("mp4")) return "mp4";
  if (normalized.includes("webm")) return "webm";
  return "";
};

const inferExtensionFromUrl = (url: string): string => {
  try {
    const pathname = new URL(url, window.location.href).pathname;
    const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
    return match?.[1]?.toLowerCase() || "";
  } catch {
    const match = String(url || "").match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
    return match?.[1]?.toLowerCase() || "";
  }
};

const ensureFilename = (
  baseFilename: string,
  extensionHint?: string,
): string => {
  const sanitized = sanitizeFilenamePart(baseFilename) || "download";
  if (/\.[a-z0-9]{2,5}$/i.test(sanitized)) {
    return sanitized;
  }
  const normalizedExtension = sanitizeFilenamePart(extensionHint || "");
  return normalizedExtension ? `${sanitized}.${normalizedExtension}` : sanitized;
};

const triggerAnchorDownload = (href: string, filename: string) => {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

export const downloadFromUrls = async (
  candidateUrls: Array<string | null | undefined>,
  baseFilename: string,
): Promise<void> => {
  const normalizedCandidates = Array.from(
    new Set(
      candidateUrls
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );

  if (normalizedCandidates.length === 0 || typeof document === "undefined") {
    return;
  }

  let lastError: unknown = null;

  for (const candidateUrl of normalizedCandidates) {
    try {
      if (DATA_OR_BLOB_URL_RE.test(candidateUrl)) {
        const filename = ensureFilename(
          baseFilename,
          inferExtensionFromUrl(candidateUrl) || "png",
        );
        triggerAnchorDownload(candidateUrl, filename);
        return;
      }

      const response = await fetch(candidateUrl, {
        mode: "cors",
        credentials: "omit",
      });
      if (!response.ok) {
        throw new Error(`download request failed: ${response.status}`);
      }

      const blob = await response.blob();
      const extension =
        inferExtensionFromContentType(response.headers.get("content-type")) ||
        inferExtensionFromUrl(candidateUrl) ||
        "png";
      const filename = ensureFilename(baseFilename, extension);
      const objectUrl = URL.createObjectURL(blob);
      try {
        triggerAnchorDownload(objectUrl, filename);
      } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
      return;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError));
  }
};

const fetchBlobFromCandidates = async (
  candidateUrls: Array<string | null | undefined>,
): Promise<{ blob: Blob; extension: string }> => {
  const normalizedCandidates = Array.from(
    new Set(
      candidateUrls
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );

  if (normalizedCandidates.length === 0) {
    throw new Error("no download candidates");
  }

  let lastError: unknown = null;

  for (const candidateUrl of normalizedCandidates) {
    try {
      if (DATA_OR_BLOB_URL_RE.test(candidateUrl)) {
        const response = await fetch(candidateUrl);
        const blob = await response.blob();
        return {
          blob,
          extension:
            inferExtensionFromContentType(blob.type) ||
            inferExtensionFromUrl(candidateUrl) ||
            "png",
        };
      }

      const response = await fetch(candidateUrl, {
        mode: "cors",
        credentials: "omit",
      });
      if (!response.ok) {
        throw new Error(`download request failed: ${response.status}`);
      }

      const blob = await response.blob();
      return {
        blob,
        extension:
          inferExtensionFromContentType(response.headers.get("content-type")) ||
          inferExtensionFromUrl(candidateUrl) ||
          "png",
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError || "download failed"));
};

export const downloadUrlGroupsAsZip = async (
  entries: Array<{
    candidateUrls: Array<string | null | undefined>;
    baseFilename: string;
  }>,
  zipBaseFilename: string,
): Promise<void> => {
  if (typeof document === "undefined") {
    return;
  }

  const normalizedEntries = entries.filter(
    (entry) =>
      Array.isArray(entry.candidateUrls) &&
      entry.candidateUrls.some((item) => String(item || "").trim()),
  );

  if (normalizedEntries.length === 0) {
    return;
  }

  const zip = new JSZip();

  await Promise.all(
    normalizedEntries.map(async (entry, index) => {
      const { blob, extension } = await fetchBlobFromCandidates(entry.candidateUrls);
      const filename = ensureFilename(
        entry.baseFilename || `download-${index + 1}`,
        extension,
      );
      zip.file(filename, blob);
    }),
  );

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipUrl = URL.createObjectURL(zipBlob);
  try {
    triggerAnchorDownload(
      zipUrl,
      ensureFilename(zipBaseFilename || "downloads", "zip"),
    );
  } finally {
    setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
  }
};
