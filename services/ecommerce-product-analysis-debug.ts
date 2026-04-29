type PersistEcommerceProductAnalysisDebugSnapshotOptions = {
  stage: string;
  payload: Record<string, unknown>;
};

const shouldPersistEcommerceProductAnalysisDebugSnapshot = (): boolean => {
  if (typeof window === "undefined") return false;
  const host = String(window.location.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
};

export const persistEcommerceProductAnalysisDebugSnapshot = async (
  options: PersistEcommerceProductAnalysisDebugSnapshotOptions,
) => {
  if (!shouldPersistEcommerceProductAnalysisDebugSnapshot()) {
    return;
  }

  try {
    const response = await fetch("/api/debug-ecommerce-product-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: options.stage,
        payload: options.payload,
      }),
    });

    if (!response.ok) {
      const failureText = await response.text().catch(() => "");
      console.warn("[ecommerceProductAnalysisDebug] snapshot persist failed", {
        stage: options.stage,
        status: response.status,
        bodyPreview: failureText.slice(0, 200),
      });
      return;
    }

    const persisted = await response.json().catch(() => null);
    console.info("[ecommerceProductAnalysisDebug] snapshot persisted", {
      stage: options.stage,
      latestSnapshotPath: persisted?.latestSnapshotPath || null,
      dailyLogPath: persisted?.dailyLogPath || null,
    });
  } catch (error) {
    console.warn("[ecommerceProductAnalysisDebug] snapshot persist failed", {
      stage: options.stage,
      error: error instanceof Error ? error.message : String(error || "unknown_error"),
    });
  }
};
