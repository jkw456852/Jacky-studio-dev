import React from "react";
import { WorkspaceContextMenu } from "./WorkspaceContextMenu";
import { WorkspaceFeatureNotice } from "./WorkspaceFeatureNotice";
import { WorkspaceModeSwitchDialog } from "./WorkspaceModeSwitchDialog";
import { WorkspacePreviewModal } from "./WorkspacePreviewModal";
import { WorkspaceTouchEditIndicator } from "./WorkspaceTouchEditIndicator";
import { WorkspaceTouchEditPopup } from "./WorkspaceTouchEditPopup";

type WorkspacePageOverlaysProps = {
  contextMenu: React.ComponentProps<typeof WorkspaceContextMenu>;
  previewModal: React.ComponentProps<typeof WorkspacePreviewModal>;
  modeSwitchDialog: React.ComponentProps<typeof WorkspaceModeSwitchDialog>;
  featureNotice: React.ComponentProps<typeof WorkspaceFeatureNotice>;
  touchEditIndicator: React.ComponentProps<typeof WorkspaceTouchEditIndicator>;
  touchEditPopup: React.ComponentProps<typeof WorkspaceTouchEditPopup>;
};

export const WorkspacePageOverlays: React.FC<WorkspacePageOverlaysProps> = ({
  contextMenu,
  previewModal,
  modeSwitchDialog,
  featureNotice,
  touchEditIndicator,
  touchEditPopup,
}) => (
  <>
    <WorkspaceContextMenu {...contextMenu} />
    <WorkspacePreviewModal {...previewModal} />
    <WorkspaceModeSwitchDialog {...modeSwitchDialog} />
    <WorkspaceFeatureNotice {...featureNotice} />
    <WorkspaceTouchEditIndicator {...touchEditIndicator} />
    <WorkspaceTouchEditPopup {...touchEditPopup} />
  </>
);
