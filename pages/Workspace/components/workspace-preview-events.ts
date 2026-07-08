export const WORKSPACE_PREVIEW_URL_EVENT = "xc-workspace-preview-url";

export type WorkspacePreviewUrlEventDetail = {
  url: string;
  source?: string;
};

export const dispatchWorkspacePreviewUrl = (
  url: string,
  source = "assistant-sidebar",
) => {
  if (typeof window === "undefined") return;

  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) return;

  window.dispatchEvent(
    new CustomEvent<WorkspacePreviewUrlEventDetail>(
      WORKSPACE_PREVIEW_URL_EVENT,
      {
        detail: {
          url: normalizedUrl,
          source,
        },
      },
    ),
  );
};
