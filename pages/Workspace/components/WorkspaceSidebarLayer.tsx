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
  const isAssistantFullscreen = showAssistant && Boolean(assistant.panelUi.isFullscreen);

  return (
    <>
      {!isAssistantFullscreen ? <WorkspaceLeftPanel {...leftPanel} /> : null}
      <AnimatePresence>
        {showAssistant && <AssistantSidebar {...assistant} />}
      </AnimatePresence>
    </>
  );
});
