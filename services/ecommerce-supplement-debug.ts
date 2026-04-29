type PersistEcommerceSupplementDebugSnapshotOptions = {
  stage: string;
  payload: Record<string, unknown>;
};

const shouldPersistEcommerceSupplementDebugSnapshot = (): boolean => {
  if (typeof window === "undefined") return false;
  const host = String(window.location.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
};

export const persistEcommerceSupplementDebugSnapshot = async (
  options: PersistEcommerceSupplementDebugSnapshotOptions,
) => {
  if (!shouldPersistEcommerceSupplementDebugSnapshot()) {
    return;
  }

  try {
    const response = await fetch("/api/debug-ecommerce-supplement", {
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
      console.warn("[ecommerceSupplementDebug] snapshot persist failed", {
        stage: options.stage,
        status: response.status,
        bodyPreview: failureText.slice(0, 200),
      });
      return;
    }

    const persisted = await response.json().catch(() => null);
    console.info("[ecommerceSupplementDebug] snapshot persisted", {
      stage: options.stage,
      latestSnapshotPath: persisted?.latestSnapshotPath || null,
      dailyLogPath: persisted?.dailyLogPath || null,
    });
  } catch (error) {
    console.warn("[ecommerceSupplementDebug] snapshot persist failed", {
      stage: options.stage,
      error: error instanceof Error ? error.message : String(error || "unknown_error"),
    });
  }
};
