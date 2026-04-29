import React from "react";

type WorkspaceGenerationStatusCardProps = {
  title: string;
  lines?: string[];
  tone?: "default" | "berserk";
  className?: string;
};

const DOT_COLUMNS = 19;
const DOT_COUNT = DOT_COLUMNS * DOT_COLUMNS;

const buildDotStyle = (index: number): React.CSSProperties => {
  const row = Math.floor(index / DOT_COLUMNS);
  const column = index % DOT_COLUMNS;
  const delay = Number((((row * 0.03) + (column * 0.02)) % 0.42).toFixed(2));
  const centerX = (DOT_COLUMNS - 1) / 2;
  const centerY = (DOT_COLUMNS - 1) * 0.54;
  const distanceX = column - centerX;
  const distanceY = row - centerY;
  const maxDistance = Math.hypot(centerX, centerY);
  const normalizedDistance = Math.min(
    1,
    Math.hypot(distanceX, distanceY) / maxDistance,
  );
  const focus = Number((1 - normalizedDistance).toFixed(3));
  const easedFocus = Number(Math.pow(focus, 1.35).toFixed(3));

  return {
    ["--workspace-dot-delay" as string]: `${delay}s`,
    ["--workspace-dot-focus" as string]: easedFocus,
    ["--workspace-dot-rest-scale" as string]: `${(0.34 + (easedFocus * 0.7)).toFixed(3)}`,
    ["--workspace-dot-peak-scale" as string]: `${(0.7 + (easedFocus * 1.5)).toFixed(3)}`,
    ["--workspace-dot-rest-opacity" as string]: `${(0.08 + (easedFocus * 0.26)).toFixed(3)}`,
    ["--workspace-dot-peak-opacity" as string]: `${(0.24 + (easedFocus * 0.76)).toFixed(3)}`,
  };
};

const renderDots = (layerClassName: string) => (
  <div className={`workspace-gen-dot-layer ${layerClassName}`}>
    {Array.from({ length: DOT_COUNT }, (_, index) => (
      <span
        key={`${layerClassName}-dot-${index}`}
        className="workspace-gen-dot"
        style={buildDotStyle(index)}
      />
    ))}
  </div>
);

export const WorkspaceGenerationStatusCard: React.FC<
  WorkspaceGenerationStatusCardProps
> = ({
  title,
  lines,
  tone = "default",
  className = "",
}) => {
  const surfaceToneClass =
    tone === "berserk"
      ? "workspace-gen-surface-berserk"
      : "workspace-gen-surface-default";

  return (
    <div
      className={`workspace-gen-surface ${surfaceToneClass} relative h-full w-full overflow-hidden rounded-[28px] ${className}`}
    >
      <div className="workspace-gen-header">
        <div className="workspace-gen-title">{title}</div>
      </div>

      <div className="workspace-gen-field">
        {renderDots("workspace-gen-dot-layer-base")}
        {renderDots("workspace-gen-dot-layer-active workspace-gen-dot-layer-center")}
        {Array.isArray(lines) && lines.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-5 top-[72px] bottom-5 z-[2] overflow-hidden px-1">
            <div className="flex h-full items-start">
              <div className="w-full space-y-1.5 overflow-hidden pt-1">
                {lines.slice(-10).map((line, index) => (
                  <div
                    key={`${title}-line-${index}`}
                    className="text-[11px] leading-4 text-slate-700/95 drop-shadow-[0_1px_0_rgba(255,255,255,0.78)]"
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
