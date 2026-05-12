import React, { memo } from "react";
import { AnimatePresence } from "framer-motion";
import { AssistantSidebar } from ".";
import { WorkspaceLeftPanel } from "./WorkspaceLeftPanel";

type WorkspaceSidebarLayerProps = {
  leftPanel: React.ComponentProps<typeof WorkspaceLeftPanel>;
  assistant: React.ComponentProps<typeof AssistantSidebar>;
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
      <AnimatePresence>
        {shouldShowAssistant ? <AssistantSidebar {...assistant} /> : null}
      </AnimatePresence>
    </>
  );
});
