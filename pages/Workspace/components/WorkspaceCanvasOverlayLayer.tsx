import React from "react";
import { WorkspaceAlignmentGuidesLayer } from "./WorkspaceAlignmentGuidesLayer";
import { WorkspaceCanvasMarkersLayer } from "./WorkspaceCanvasMarkersLayer";
import { WorkspaceImageToolbar } from "./WorkspaceImageToolbar";
import { WorkspaceMultiSelectToolbar } from "./WorkspaceMultiSelectToolbar";
import { WorkspaceNodeGraphLayer } from "./WorkspaceNodeGraphLayer";
import { WorkspaceShapeToolbar } from "./WorkspaceShapeToolbar";
import { WorkspaceTextToolbar } from "./WorkspaceTextToolbar";
import { WorkspaceVideoToolbar } from "./WorkspaceVideoToolbar";

type WorkspaceCanvasOverlayLayerProps = {
  nodeGraphLayer: React.ComponentProps<typeof WorkspaceNodeGraphLayer>;
  markersLayer: React.ComponentProps<typeof WorkspaceCanvasMarkersLayer>;
  imageToolbar: React.ComponentProps<typeof WorkspaceImageToolbar>;
  videoToolbar: React.ComponentProps<typeof WorkspaceVideoToolbar>;
  multiSelectToolbar: React.ComponentProps<typeof WorkspaceMultiSelectToolbar>;
  textToolbar: React.ComponentProps<typeof WorkspaceTextToolbar>;
  shapeToolbar: React.ComponentProps<typeof WorkspaceShapeToolbar>;
};

export const WorkspaceCanvasOverlayLayer: React.FC<
  WorkspaceCanvasOverlayLayerProps
> = ({
  nodeGraphLayer,
  markersLayer,
  imageToolbar,
  videoToolbar,
  multiSelectToolbar,
  textToolbar,
  shapeToolbar,
}) => (
  <>
    <WorkspaceAlignmentGuidesLayer />
    <WorkspaceNodeGraphLayer {...nodeGraphLayer} />
    <WorkspaceCanvasMarkersLayer {...markersLayer} />
    <WorkspaceImageToolbar {...imageToolbar} />
    <WorkspaceVideoToolbar {...videoToolbar} />
    <WorkspaceMultiSelectToolbar {...multiSelectToolbar} />
    <WorkspaceTextToolbar {...textToolbar} />
    <WorkspaceShapeToolbar {...shapeToolbar} />
  </>
);
