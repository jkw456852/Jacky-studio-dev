import fs from "fs";

export type BrowserCompetitorImageCandidate = {
  url: string;
  origin: string;
  name?: string;
};

export type BrowserCompetitorExtractResult = {
  status: "success" | "login_required" | "unavailable" | "failed";
  finalUrl?: string;
  title?: string;
  html?: string;
  candidates: BrowserCompetitorImageCandidate[];
  debug: Record<string, any>;
};

export type TaobaoDetailAccessValidationResult = {
  verified: boolean;
  reason:
    | "detail_api_verified"
    | "detail_api_not_observed"
    | "login_required"
    | "validation_failed";
  finalUrl?: string;
  title?: string;
  debug: Record<string, any>;
  message?: string;
};

type BrowserRuntime = {
  chromium: {
    launch: (options: Record<string, any>) => Promise<any>;
    launchPersistentContext: (
      userDataDir: string,
      options: Record<string, any>,
    ) => Promise<any>;
  };
};

export type CompetitorBrowserLaunchOptions = {
  executablePath?: string | null;
  profileDir?: string | null;
  storageStatePath?: string | null;
  headless?: boolean;
};

const DEFAULT_BROWSER_EXECUTABLES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const DETAIL_API_PATTERN =
  /(mtop\.taobao\.detail\.(?:data\.get|getdetail)|mtop\.tmall\.detail|detail|desc)/i;
const LOGIN_URL_PATTERN = /login\.(?:m\.)?taobao\.com|havanaone\/login/i;

function safeFileExists(targetPath: string | undefined | null): boolean {
  if (!targetPath) return false;
  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function readEnvValue(primaryKey: string, legacyKey: string): string {
  return String(process.env[primaryKey] || process.env[legacyKey] || "").trim();
}

export function resolveBrowserExecutablePath(): string | null {
  const preferred = readEnvValue(
    "JK_STUDIO_COMPETITOR_BROWSER_EXECUTABLE",
    "XC_STUDIO_COMPETITOR_BROWSER_EXECUTABLE",
  );
  if (safeFileExists(preferred)) {
    return preferred;
  }

  for (const candidate of DEFAULT_BROWSER_EXECUTABLES) {
    if (safeFileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveStorageStatePath(): string | null {
  const target = readEnvValue(
    "JK_STUDIO_COMPETITOR_BROWSER_STORAGE_STATE",
    "XC_STUDIO_COMPETITOR_BROWSER_STORAGE_STATE",
  );
  return safeFileExists(target) ? target : null;
}

function resolveBrowserProfileDir(): string | null {
  const target = readEnvValue(
    "JK_STUDIO_COMPETITOR_BROWSER_PROFILE_DIR",
    "XC_STUDIO_COMPETITOR_BROWSER_PROFILE_DIR",
  );
  return safeFileExists(target) ? target : null;
}

function shouldRunHeadless(): boolean {
  return (
    readEnvValue(
      "JK_STUDIO_COMPETITOR_BROWSER_HEADLESS",
      "XC_STUDIO_COMPETITOR_BROWSER_HEADLESS",
    ) || "true"
  )
    .toLowerCase() !== "false";
}

function normalizeAbsoluteUrl(rawUrl: string, baseUrl: string): string | null {
  const normalized = String(rawUrl || "").trim();
  if (!normalized || /^(data:|blob:|javascript:)/i.test(normalized)) {
    return null;
  }

  try {
    if (/^\/\//.test(normalized)) {
      return `https:${normalized}`;
    }
    return new URL(normalized, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractUrlMatches(text: string): string[] {
  if (!text) return [];

  const matches = new Set<string>();
  const patterns = [
    /https?:\/\/[^"'`\s<>()]+(?:png|jpe?g|webp)(?:\?[^"'`\s<>()]*)?/gi,
    /\/\/[^"'`\s<>()]+(?:png|jpe?g|webp)(?:\?[^"'`\s<>()]*)?/gi,
    /https?:\/\/[^"'`\s<>()]*(?:alicdn|tbcdn|taobaocdn|imgextra|img\.alicdn|gw\.alicdn)[^"'`\s<>()]*/gi,
  ];

  for (const pattern of patterns) {
    const found = text.match(pattern) || [];
    for (const match of found) {
      matches.add(match);
    }
  }

  return [...matches];
}

function parseMaybeJsonpPayload(text: string): any | null {
  const normalized = String(text || "").trim();
  if (!normalized) return null;

  const directStart = normalized.startsWith("{") ? normalized : "";
  if (directStart) {
    try {
      return JSON.parse(normalized);
    } catch {
      return null;
    }
  }

  const jsonpMatch = normalized.match(/^[\w$.]+\(([\s\S]+)\)\s*;?\s*$/);
  if (!jsonpMatch) return null;
  try {
    return JSON.parse(jsonpMatch[1]);
  } catch {
    return null;
  }
}

function responseLooksLikeTaobaoLoginGate(
  url: string,
  bodyText: string,
  payload: any,
): boolean {
  if (LOGIN_URL_PATTERN.test(url) || LOGIN_URL_PATTERN.test(bodyText)) {
    return true;
  }

  const retList = Array.isArray(payload?.ret) ? payload.ret : [];
  if (
    retList.some((item) =>
      /(RGV587|FAIL_SYS|SESSION_EXPIRED|LOGIN|被挤爆|请稍后重试)/i.test(
        String(item || ""),
      ),
    )
  ) {
    return true;
  }

  return LOGIN_URL_PATTERN.test(String(payload?.data?.url || "")) ||
    LOGIN_URL_PATTERN.test(String(payload?.data?.h5url || ""));
}

function responseLooksLikeTaobaoDetailSuccess(
  payload: any,
  bodyText: string,
  status: number,
): boolean {
  if (status >= 400) {
    return false;
  }

  const retList = Array.isArray(payload?.ret) ? payload.ret : [];
  if (
    retList.some((item) =>
      /(SUCCESS|调用成功|success)/i.test(String(item || "")),
    )
  ) {
    return true;
  }

  const data = payload?.data;
  if (data && typeof data === "object") {
    const keys = Object.keys(data);
    if (
      keys.some((key) => /item|sku|seller|price|apiStack|resource/i.test(key))
    ) {
      return true;
    }
  }

  return /"apiStack"|"item"|"seller"|"skuBase"|"price"/i.test(bodyText);
}

async function loadPlaywrightRuntime(): Promise<BrowserRuntime | null> {
  try {
    return (await import("playwright-core")) as unknown as BrowserRuntime;
  } catch {
    return null;
  }
}

export async function validateTaobaoDetailAccessWithContext(options: {
  context: any;
  page?: any;
  itemId?: string;
}): Promise<TaobaoDetailAccessValidationResult> {
  const itemId = String(options.itemId || "732156220927").trim() || "732156220927";
  const targetUrl = `https://h5.m.taobao.com/awp/core/detail.htm?id=${encodeURIComponent(itemId)}`;
  const page =
    options.page && typeof options.page.isClosed === "function" && !options.page.isClosed()
      ? options.page
      : await options.context.newPage();

  let detailApiSeen = false;
  let detailApiVerified = false;
  let loginRequired = false;
  const debug: Record<string, any> = {
    targetUrl,
    observedResponses: [] as Array<Record<string, any>>,
  };

  const onResponse = async (response: any) => {
    const url = String(response.url() || "");
    if (!DETAIL_API_PATTERN.test(url) && !LOGIN_URL_PATTERN.test(url)) {
      return;
    }

    const headers = response.headers();
    const contentType = String(headers["content-type"] || "").toLowerCase();
    let bodyText = "";

    try {
      if (/(json|javascript|text|html)/i.test(contentType)) {
        bodyText = await response.text();
      }
    } catch {
      bodyText = "";
    }

    const payload = parseMaybeJsonpPayload(bodyText);
    const loginGate = responseLooksLikeTaobaoLoginGate(url, bodyText, payload);
    const detailSuccess = DETAIL_API_PATTERN.test(url)
      ? responseLooksLikeTaobaoDetailSuccess(payload, bodyText, response.status())
      : false;

    if (DETAIL_API_PATTERN.test(url)) {
      detailApiSeen = true;
    }
    if (loginGate) {
      loginRequired = true;
    }
    if (detailSuccess) {
      detailApiVerified = true;
    }

    debug.observedResponses.push({
      url,
      status: response.status(),
      contentType,
      loginGate,
      detailSuccess,
    });
  };

  page.on("response", onResponse);

  try {
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    for (let index = 0; index < 6; index += 1) {
      if (detailApiVerified || loginRequired) {
        break;
      }
      await page.waitForTimeout(1000);
    }

    const finalUrl = page.url();
    const title = await page.title();
    const html = await page.content();

    if (LOGIN_URL_PATTERN.test(finalUrl) || /<title[^>]*>\s*登录\s*<\/title>/i.test(html)) {
      loginRequired = true;
    }

    debug.finalUrl = finalUrl;
    debug.title = title;
    debug.detailApiSeen = detailApiSeen;
    debug.detailApiVerified = detailApiVerified;
    debug.loginRequired = loginRequired;

    if (detailApiVerified && !loginRequired) {
      return {
        verified: true,
        reason: "detail_api_verified",
        finalUrl,
        title,
        debug,
        message:
          "\u5df2\u901a\u8fc7\u6dd8\u5b9d\u8be6\u60c5\u63a5\u53e3\u6821\u9a8c\uff0c\u53ef\u4ee5\u4fdd\u5b58\u4e3a\u4ec5\u4f9b\u5f53\u524d\u6d4f\u89c8\u5668\u4f7f\u7528\u7684\u4e2a\u4eba\u767b\u5f55\u6001\u3002",
      };
    }

    if (loginRequired) {
      return {
        verified: false,
        reason: "login_required",
        finalUrl,
        title,
        debug,
        message:
          "\u8fd9\u6b21\u4e2a\u4eba\u767b\u5f55\u6001\u8fd8\u6ca1\u6709\u901a\u8fc7\u6dd8\u5b9d\u8be6\u60c5\u63a5\u53e3\u9a8c\u771f\u3002\u8bf7\u5728\u5f39\u51fa\u7684\u6d4f\u89c8\u5668\u91cc\u786e\u8ba4\u5df2\u7ecf\u8fdb\u5165\u771f\u5b9e\u5546\u54c1\u8be6\u60c5\u9875\uff0c\u5e76\u5b8c\u6210\u53ef\u80fd\u51fa\u73b0\u7684\u767b\u5f55\u6216\u98ce\u63a7\u6821\u9a8c\u540e\u518d\u70b9\u201c\u6211\u5df2\u767b\u5f55\u5b8c\u6210\u201d\u3002",
      };
    }

    if (!detailApiSeen) {
      return {
        verified: false,
        reason: "detail_api_not_observed",
        finalUrl,
        title,
        debug,
        message:
          "\u8fd8\u6ca1\u6709\u89c2\u5bdf\u5230\u53ef\u7528\u7684\u6dd8\u5b9d\u8be6\u60c5\u63a5\u53e3\u8fd4\u56de\uff0c\u5f53\u524d\u53ef\u80fd\u4ecd\u505c\u7559\u5728\u58f3\u9875\u3001\u8df3\u8f6c\u9875\u6216\u98ce\u63a7\u9875\u3002\u8bf7\u5148\u5728\u6d4f\u89c8\u5668\u91cc\u6253\u5f00\u5230\u771f\u5b9e\u8be6\u60c5\u9875\u540e\u518d\u786e\u8ba4\u3002",
      };
    }

    return {
      verified: false,
      reason: "validation_failed",
      finalUrl,
      title,
      debug,
      message:
        "\u5df2\u547d\u4e2d\u6dd8\u5b9d\u8be6\u60c5\u63a5\u53e3\uff0c\u4f46\u8fd4\u56de\u7ed3\u679c\u4ecd\u4e0d\u50cf\u53ef\u7528\u7684\u8be6\u60c5\u6570\u636e\u3002\u8bf7\u7ee7\u7eed\u5728\u5f53\u524d\u6d4f\u89c8\u5668\u5185\u5b8c\u6210\u9a8c\u8bc1\u540e\u518d\u91cd\u8bd5\u3002",
    };
  } catch (error: any) {
    return {
      verified: false,
      reason: "validation_failed",
      debug: {
        ...debug,
        error: String(error?.message || error || "taobao_detail_validation_failed"),
      },
      message:
        "\u6dd8\u5b9d\u8be6\u60c5\u63a5\u53e3\u9a8c\u771f\u5931\u8d25\uff0c\u8bf7\u786e\u8ba4\u5f39\u51fa\u7684\u767b\u5f55\u7a97\u53e3\u4ecd\u7136\u53ef\u7528\uff0c\u7136\u540e\u518d\u8bd5\u4e00\u6b21\u3002",
    };
  } finally {
    if (typeof page.off === "function") {
      page.off("response", onResponse);
    }
  }
}

export async function tryExtractCompetitorDeckWithBrowser(options: {
  targetUrl: string;
  mobileTargetUrl?: string | null;
  launchOptions?: CompetitorBrowserLaunchOptions;
}): Promise<BrowserCompetitorExtractResult> {
  const playwright = await loadPlaywrightRuntime();
  if (!playwright?.chromium) {
    return {
      status: "unavailable",
      candidates: [],
      debug: {
        browserLibraryAvailable: false,
      },
    };
  }

  const executablePath =
    options.launchOptions?.executablePath || resolveBrowserExecutablePath();
  if (!executablePath) {
    return {
      status: "unavailable",
      candidates: [],
      debug: {
        browserLibraryAvailable: true,
        browserExecutableFound: false,
      },
    };
  }

  const targetUrl = String(options.mobileTargetUrl || options.targetUrl || "").trim();
  const storageStatePath =
    options.launchOptions?.storageStatePath || resolveStorageStatePath();
  const profileDir =
    options.launchOptions?.profileDir || resolveBrowserProfileDir();
  const launchHeadless =
    typeof options.launchOptions?.headless === "boolean"
      ? options.launchOptions.headless
      : shouldRunHeadless();
  const candidates = new Map<string, BrowserCompetitorImageCandidate>();
  const debug: Record<string, any> = {
    browserLibraryAvailable: true,
    browserExecutableFound: true,
    executablePath,
    targetUrl,
    headless: launchHeadless,
    storageStatePath,
    profileDir,
    responseSummaries: [] as Array<Record<string, any>>,
  };

  const pushCandidate = (rawUrl: string, origin: string, name = "") => {
    const absoluteUrl = normalizeAbsoluteUrl(rawUrl, targetUrl);
    if (!absoluteUrl) return;
    if (candidates.has(absoluteUrl)) return;
    candidates.set(absoluteUrl, {
      url: absoluteUrl,
      origin,
      name: String(name || "").trim() || undefined,
    });
  };

  let loginRequired = false;
  let context: any = null;
  let browser: any = null;

  try {
    const commonContextOptions = {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
      locale: "zh-CN",
      extraHTTPHeaders: {
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      storageState: storageStatePath || undefined,
    };

    if (profileDir) {
      context = await playwright.chromium.launchPersistentContext(profileDir, {
        executablePath,
        headless: launchHeadless,
        args: ["--disable-blink-features=AutomationControlled", "--lang=zh-CN"],
        ...commonContextOptions,
      });
      debug.browserMode = "persistent-profile";
    } else {
      browser = await playwright.chromium.launch({
        executablePath,
        headless: launchHeadless,
        args: ["--disable-blink-features=AutomationControlled", "--lang=zh-CN"],
      });
      context = await browser.newContext(commonContextOptions);
      debug.browserMode = storageStatePath ? "ephemeral-storage-state" : "ephemeral";
    }

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    page.on("response", async (response: any) => {
      const url = String(response.url() || "");
      if (!DETAIL_API_PATTERN.test(url) && !LOGIN_URL_PATTERN.test(url)) {
        return;
      }

      const headers = response.headers();
      const contentType = String(headers["content-type"] || "").toLowerCase();
      let bodyText = "";

      try {
        if (/(json|javascript|text|html)/i.test(contentType)) {
          bodyText = await response.text();
        }
      } catch {
        bodyText = "";
      }

      const payload = parseMaybeJsonpPayload(bodyText);
      const summary = {
        url,
        status: response.status(),
        contentType,
        loginGate: responseLooksLikeTaobaoLoginGate(url, bodyText, payload),
      };
      debug.responseSummaries.push(summary);

      if (summary.loginGate) {
        loginRequired = true;
      }

      for (const match of extractUrlMatches(bodyText)) {
        pushCandidate(match, "browser-network");
      }
    });

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    for (let index = 0; index < 4; index += 1) {
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 0.9);
      });
    }
    await page.waitForTimeout(2500);

    const finalUrl = page.url();
    const title = await page.title();
    const html = await page.content();
    const pageSignals = await page.evaluate(() => {
      const imageCandidates: Array<{ url: string; name?: string; origin: string }> =
        [];
      const attrs = [
        "src",
        "data-src",
        "data-original",
        "data-lazy-src",
        "data-ks-lazyload",
      ];

      for (const image of Array.from(document.querySelectorAll("img"))) {
        for (const attr of attrs) {
          const value = image.getAttribute(attr);
          if (!value) continue;
          imageCandidates.push({
            url: value,
            name: image.getAttribute("alt") || undefined,
            origin: "browser-dom",
          });
        }
      }

      for (const element of Array.from(document.querySelectorAll<HTMLElement>("[style]"))) {
        const styleValue = element.style?.backgroundImage || "";
        const match = styleValue.match(/url\((?:["']?)([^"')]+)(?:["']?)\)/i);
        if (match?.[1]) {
          imageCandidates.push({
            url: match[1],
            origin: "browser-style",
          });
        }
      }

      return {
        textSample: String(document.body?.innerText || "").slice(0, 400),
        imageCandidates,
      };
    });

    for (const candidate of pageSignals.imageCandidates || []) {
      pushCandidate(candidate.url, candidate.origin, candidate.name || "");
    }
    for (const match of extractUrlMatches(html)) {
      pushCandidate(match, "browser-html");
    }

    if (LOGIN_URL_PATTERN.test(finalUrl) || /<title[^>]*>\s*登录\s*<\/title>/i.test(html)) {
      loginRequired = true;
    }

    debug.finalUrl = finalUrl;
    debug.title = title;
    debug.htmlLength = html.length;
    debug.textSample = pageSignals.textSample;
    debug.candidateCount = candidates.size;

    const resultStatus =
      candidates.size > 0 && !loginRequired
        ? "success"
        : loginRequired
          ? "login_required"
          : "failed";

    return {
      status: resultStatus,
      finalUrl,
      title,
      html,
      candidates: [...candidates.values()],
      debug,
    };
  } catch (error: any) {
    return {
      status: "failed",
      candidates: [...candidates.values()],
      debug: {
        ...debug,
        error: String(error?.message || error || "browser_extract_failed"),
      },
    };
  } finally {
    try {
      if (context) {
        await context.close();
      }
    } catch {
      // Ignore close failures.
    }
    try {
      if (browser) {
        await browser.close();
      }
    } catch {
      // Ignore close failures.
    }
  }
}
