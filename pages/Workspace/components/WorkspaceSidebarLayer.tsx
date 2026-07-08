import React, { lazy, memo, Suspense } from "react";
import { AssistantSidebar as AssistantSidebarLayout } from "@/components/assistant-ui/assistant-sidebar";
import type { AssistantSidebarProps } from "./assistantSidebar.types";
import { WorkspaceLeftPanel } from "./WorkspaceLeftPanel";

const AssistantSidebar = lazy(async () => {
  const module = await import("./assistantSidebarAiSdkRuntime.runtime.tsx");
  return { default: module.AssistantSidebarAiSdkRuntime };
});

const AssistantSidebarPaneFallback = () => (
  <div className="flex h-full min-h-0 w-full flex-col bg-[#fdfcfc] text-[#1f1f1f] dark:bg-[#0c0c0c] dark:text-[#e3e3e3]">
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <div className="h-3 w-24 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
        <div className="h-12 animate-pulse rounded-3xl bg-black/5 dark:bg-white/8" />
        <div className="h-20 animate-pulse rounded-3xl bg-black/5 dark:bg-white/8" />
        <p className="text-xs text-[#5f6368] dark:text-[#bdc1c6]">
          Loading assistant sidebar...
        </p>
      </div>
    </div>
  </div>
);

type AssistantSidebarModuleBoundaryProps = {
  children: React.ReactNode;
  resetKey: string;
};

type AssistantSidebarModuleBoundaryState = {
  error: Error | null;
};

class AssistantSidebarModuleBoundary extends React.Component<
  AssistantSidebarModuleBoundaryProps,
  AssistantSidebarModuleBoundaryState
> {
  state: AssistantSidebarModuleBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[assistant-sidebar] failed to load module", error);
  }

  componentDidUpdate(previousProps: AssistantSidebarModuleBoundaryProps) {
    if (
      this.state.error &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-0 w-full items-center justify-center bg-[#fdfcfc] px-6 text-[#1f1f1f] dark:bg-[#0c0c0c] dark:text-[#e3e3e3]">
          <div className="max-w-sm rounded-2xl border border-black/10 bg-white p-5 text-sm shadow-sm dark:border-white/10 dark:bg-[#171717]">
            <div className="font-medium">Assistant sidebar failed to load.</div>
            <div className="mt-2 leading-6 text-[#5f6368] dark:text-[#bdc1c6]">
              The assistant-ui module failed during Vite dynamic import. Refresh
              the page or restart the dev server after fixing the compile error.
            </div>
            <button
              type="button"
              className="mt-4 rounded-full bg-[#1f1f1f] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#333] dark:bg-white dark:text-[#111] dark:hover:bg-[#e8eaed]"
              onClick={() => window.location.reload()}
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

type WorkspaceSidebarLayerProps = {
  leftPanel: React.ComponentProps<typeof WorkspaceLeftPanel>;
  assistant: AssistantSidebarProps;
  showAssistant: boolean;
  mainContent: React.ReactNode;
};

const AssistantSidebarPane: React.FC<{
  assistant: AssistantSidebarProps;
  resetKey: string;
}> = ({ assistant, resetKey }) => (
  <AssistantSidebarModuleBoundary resetKey={resetKey}>
    <Suspense fallback={<AssistantSidebarPaneFallback />}>
      <AssistantSidebar {...assistant} />
    </Suspense>
  </AssistantSidebarModuleBoundary>
);

export const WorkspaceSidebarLayer: React.FC<WorkspaceSidebarLayerProps> = memo(({
  leftPanel,
  assistant,
  showAssistant,
  mainContent,
}) => {
  const isAssistantFullscreen =
    showAssistant && Boolean(assistant.panelUi.isFullscreen);

  return (
    <>
      {!isAssistantFullscreen ? <WorkspaceLeftPanel {...leftPanel} /> : null}
      {showAssistant ? (
        isAssistantFullscreen ? (
          <AssistantSidebarPane
            assistant={assistant}
            resetKey={`${showAssistant}:${assistant.panelUi.isFullscreen}`}
          />
        ) : (
          <AssistantSidebarLayout
            sidebar={
              <AssistantSidebarPane
                assistant={assistant}
                resetKey={`${showAssistant}:${assistant.panelUi.isFullscreen}`}
              />
            }
          >
            {mainContent}
          </AssistantSidebarLayout>
        )
      ) : mainContent}
    </>
  );
});
