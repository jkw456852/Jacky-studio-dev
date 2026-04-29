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
}) => (
  <>
    <WorkspaceLeftPanel {...leftPanel} />
    <AnimatePresence>
      {showAssistant && <AssistantSidebar {...assistant} />}
    </AnimatePresence>
  </>
));
