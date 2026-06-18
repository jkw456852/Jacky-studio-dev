import React, { lazy, memo, Suspense } from "react";
import type { AssistantSidebarProps } from "./AssistantSidebar";
import { WorkspaceLeftPanel } from "./WorkspaceLeftPanel";

const AssistantSidebar = lazy(async () => {
  const module = await import("./AssistantSidebar");
  return { default: module.AssistantSidebar };
});

type WorkspaceSidebarLayerProps = {
  leftPanel: React.ComponentProps<typeof WorkspaceLeftPanel>;
  assistant: AssistantSidebarProps;
  showAssistant: boolean;
};

export const WorkspaceSidebarLayer: React.FC<WorkspaceSidebarLayerProps> = memo(({
  leftPanel,
  assistant,
  showAssistant,
}) => {
  const isWorkflowRecipesOpen = leftPanel.leftPanelMode === "workflow-recipes";
  const isAssistantFullscreen =
    showAssistant && !isWorkflowRecipesOpen && Boolean(assistant.panelUi.isFullscreen);
  const shouldShowAssistant = showAssistant && !isWorkflowRecipesOpen;

  return (
    <>
      {!isAssistantFullscreen ? <WorkspaceLeftPanel {...leftPanel} /> : null}
      <Suspense fallback={null}>
        {shouldShowAssistant ? <AssistantSidebar {...assistant} /> : null}
      </Suspense>
    </>
  );
});
