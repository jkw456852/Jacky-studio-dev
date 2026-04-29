import React from "react";

export const WorkspaceAlignmentGuidesLayer: React.FC = () => (
  <>
    <div
      id="workspace-align-guide-v"
      className="absolute pointer-events-none z-[9998] hidden"
      style={{
        left: 0,
        top: -1000000,
        width: 3,
        height: 2000000,
        background: "#f43f5e",
      }}
    />
    <div
      id="workspace-align-guide-h"
      className="absolute pointer-events-none z-[9998] hidden"
      style={{
        left: -1000000,
        top: 0,
        width: 2000000,
        height: 3,
        background: "#f43f5e",
      }}
    />
  </>
);
