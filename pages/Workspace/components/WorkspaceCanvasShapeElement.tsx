import React from "react";
import type { CanvasElement } from "../../../types";

type WorkspaceCanvasShapeElementProps = {
  element: CanvasElement;
};

export const WorkspaceCanvasShapeElement: React.FC<
  WorkspaceCanvasShapeElementProps
> = ({ element }) => {
  if (element.type !== "shape") return null;

  const strokeWidth =
    element.strokeColor === "transparent" ? 0 : element.strokeWidth || 2;
  const cornerRadius = element.cornerRadius
    ? (element.cornerRadius / Math.min(element.width, element.height)) * 100
    : 0;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      {element.shapeType === "square" && (
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          rx={cornerRadius}
          fill={element.fillColor}
          stroke={element.strokeColor}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {element.shapeType === "circle" && (
        <circle
          cx="50"
          cy="50"
          r="50"
          fill={element.fillColor}
          stroke={element.strokeColor}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {element.shapeType === "triangle" && (
        <polygon
          points="50,0 100,100 0,100"
          fill={element.fillColor}
          stroke={element.strokeColor}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      )}
      {element.shapeType === "star" && (
        <polygon
          points="50 2 61 35 98 35 68 57 79 91 50 70 21 91 32 57 2 35 39 35"
          fill={element.fillColor}
          stroke={element.strokeColor}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      )}
      {element.shapeType === "arrow-right" && (
        <polygon
          points="0,30 60,30 60,10 100,50 60,90 60,70 0,70"
          fill={element.fillColor}
          stroke={element.strokeColor}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      )}
      {element.shapeType === "arrow-left" && (
        <polygon
          points="100,30 40,30 40,10 0,50 40,90 40,70 100,70"
          fill={element.fillColor}
          stroke={element.strokeColor}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      )}
      {element.shapeType === "bubble" && (
        <path
          d="M10,10 Q90,10 90,50 Q90,90 50,90 L30,100 L40,85 Q10,80 10,50 Q10,10 50,10"
          fill={element.fillColor}
          stroke={element.strokeColor}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};
