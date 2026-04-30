import React, { useEffect, useMemo, useState } from "react";

type WorkspaceGenerationStatusCardProps = {
  title: string;
  lines?: string[];
  tone?: "default" | "berserk";
  className?: string;
};

const DOT_COLUMNS = 19;
const DOT_COUNT = DOT_COLUMNS * DOT_COLUMNS;
const MAX_VISIBLE_LINES = 3;

const CHAIN_STEP_LABELS: Record<string, string> = {
  classify_request: "识别任务",
  extract_reference_roles: "识别参考图分工",
  separate_reference_roles: "拆分参考图角色",
  lock_output_as_single_poster: "锁定单张海报",
  define_layout_inheritance: "继承版式框架",
  define_layout_inheritance_from_ref1: "沿用参考图1版式",
  map_products_to_scene: "映射主体到场景",
  map_ref2_ref3_ref4_into_product_hierarchy: "整理产品主次关系",
  set_color_mood_from_ref5: "提取参考图5色调",
  set_color_mood_from_ref5_only: "只继承参考图5色调",
  apply_color_mood_from_ref5_only: "应用参考图5色调",
  constrain_copy_density_for_model_fit: "控制文案密度",
  compose_single_poster_prompt: "生成单图提示词",
  compose_generation_prompt: "生成执行提示词",
  generate: "开始生图",
  evaluate_brand_and_product_fidelity: "校验品牌与产品一致性",
};

const renderDots = (layerClassName: string) => (
  <div className={`workspace-gen-dot-layer ${layerClassName}`}>
    {Array.from({ length: DOT_COUNT }, (_, index) => (
      <span
        key={`${layerClassName}-${index}`}
        className="workspace-gen-dot"
        style={buildDotStyle(index)}
      />
    ))}
  </div>
);

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

const clipText = (value: string, maxLength = 88) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trim()}...`
    : normalized;
};

const shortenValue = (value: string, maxLength = 42) =>
  clipText(
    String(value || "")
      .replace(/\s+/g, " ")
      .trim(),
    maxLength,
  );

const uniqueList = (values: string[]) =>
  Array.from(
    new Set(
      values
        .map((item) => String(item || "").replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  );

const normalizeTitle = (value: string) => {
  const title = String(value || "").trim();
  if (!title) return "处理中";
  return title
    .replace("正在执行当前生图", "正在生图")
    .replace("正在编排执行方案", "正在整理执行方案")
    .replace("正在修复规划结果", "正在整理规划结果");
};

const humanizeChainStep = (step: string, index: number) => {
  const normalized = String(step || "")
    .trim()
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, "_");
  if (!normalized) return `步骤${index + 1}`;
  return CHAIN_STEP_LABELS[normalized] || `步骤${index + 1}`;
};

const extractFlowSteps = (line: string) => {
  if (!/->|→/.test(line)) return [];
  const normalized = line.replace(/^.*?[：:]\s*/, "");
  return uniqueList(
    normalized
      .split(/->|→/)
      .map((item, index) => humanizeChainStep(item, index))
      .filter(Boolean),
  );
};

const humanizeLine = (input: string) => {
  let line = String(input || "").replace(/\s+/g, " ").trim();
  if (!line) return "";

  const flowSteps = extractFlowSteps(line);
  if (flowSteps.length > 0) {
    return `流程：${flowSteps.join(" → ")}`;
  }

  line = line.replace(/^这样判断的核心原因是[:：]?\s*/i, "判断：");
  line = line.replace(/^任务意图归类为[:：]?\s*/i, "任务：");
  line = line.replace(/^任务判断[:：]?\s*/i, "任务：");
  line = line.replace(/^思考[:：]?\s*/i, "思路：");
  line = line.replace(/^输出规格[:：]?\s*/i, "规格：");
  line = line.replace(/^输出目标[:：]?\s*/i, "目标：");
  line = line.replace(/^准备调用生图模型[:：]?\s*/i, "模型：");
  line = line.replace(/^当前生图模型[:：]?\s*/i, "模型：");
  line = line.replace(/^参数[:：]?\s*/i, "参数：");
  line = line.replace(/^当前批次[:：]?\s*/i, "批次：");
  line = line.replace(/^参考图[:：]?\s*/i, "参考：");
  line = line.replace(/^编排完成[:：]?\s*/i, "编排：");
  line = line.replace(/^策略理由[:：]?\s*/i, "策略：");
  line = line.replace(/^判断原因[:：]?\s*/i, "判断：");
  line = line.replace(/^继续动作[:：]?\s*/i, "下一步：");
  line = line.replace(/^角色脑[:：]?\s*/i, "角色：");
  line = line.replace(
    /^开始组合参考图分工与提示词策略$/i,
    "正在整理参考图分工与提示词",
  );
  line = line.replace(
    /^已完成视觉编排，正在请求生图$/i,
    "编排完成，正在请求生图",
  );
  line = line.replace(/\bgpt-image-2-all\b/gi, "GPT Image 2");
  line = line.replace(/\bgpt-image-2\b/gi, "GPT Image 2");
  line = line.replace(/\bsingle\b/gi, "单图");
  line = line.replace(/\bset\b/gi, "组图");
  line = line.replace(/requestedImageCount\s*=\s*(\d+)/gi, "输出数量 $1");

  return clipText(line, 92);
};

const toCompactThought = (line: string) => {
  const normalized = String(line || "").trim();
  if (!normalized) return "";

  if (normalized.startsWith("流程：")) {
    return "";
  }
  if (normalized.startsWith("任务：")) {
    return `任务定为 ${shortenValue(normalized.slice(3), 30)}`;
  }
  if (normalized.startsWith("判断：")) {
    return `判断 ${shortenValue(normalized.slice(3), 36)}`;
  }
  if (normalized.startsWith("思路：")) {
    return `思路 ${shortenValue(normalized.slice(3), 36)}`;
  }
  if (normalized.startsWith("策略：")) {
    return `策略 ${shortenValue(normalized.slice(3), 34)}`;
  }
  if (normalized.startsWith("参考：")) {
    return `${shortenValue(normalized, 22)}`;
  }
  if (normalized.startsWith("模型：")) {
    return `${shortenValue(normalized, 24)}`;
  }
  if (normalized.startsWith("参数：")) {
    return `${shortenValue(normalized, 28)}`;
  }
  if (normalized.startsWith("规格：")) {
    return `${shortenValue(normalized, 24)}`;
  }
  if (normalized.startsWith("目标：")) {
    return `目标 ${shortenValue(normalized.slice(3), 32)}`;
  }
  if (normalized.startsWith("下一步：")) {
    return `接着 ${shortenValue(normalized.slice(4), 28)}`;
  }
  if (normalized.startsWith("角色：")) {
    return `角色 ${shortenValue(normalized.slice(3), 28)}`;
  }
  if (normalized.startsWith("编排：")) {
    return `编排 ${shortenValue(normalized.slice(3), 28)}`;
  }

  return shortenValue(normalized, 40);
};

const buildViewModel = (title: string, lines?: string[]) => {
  const header = normalizeTitle(title);
  const normalizedLines = uniqueList((lines || []).map(humanizeLine)).filter(
    (line) => line && line !== header,
  );

  const latestFlowLine =
    normalizedLines
      .slice()
      .reverse()
      .find((line) => line.startsWith("流程：")) || "";
  const flowSteps = extractFlowSteps(latestFlowLine);
  const currentStep = shortenValue(
    flowSteps[flowSteps.length - 1] ||
      normalizedLines[normalizedLines.length - 1] ||
      header ||
      "等待模型返回",
    24,
  );
  const compactLines = uniqueList(
    normalizedLines
      .map(toCompactThought)
      .filter(Boolean)
      .filter((line) => line !== currentStep),
  );

  return {
    header,
    currentStep,
    streamLines: compactLines,
  };
};

export const WorkspaceGenerationStatusCard: React.FC<
  WorkspaceGenerationStatusCardProps
> = ({ title, lines, tone = "default", className = "" }) => {
  const surfaceToneClass =
    tone === "berserk"
      ? "workspace-gen-surface-berserk"
      : "workspace-gen-surface-default";

  const viewModel = useMemo(() => buildViewModel(title, lines), [lines, title]);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount((current) => Math.min(current, viewModel.streamLines.length));
  }, [viewModel.streamLines.length]);

  useEffect(() => {
    if (visibleCount >= viewModel.streamLines.length) return;
    const timer = window.setTimeout(
      () => {
        setVisibleCount((current) =>
          Math.min(current + 1, viewModel.streamLines.length),
        );
      },
      visibleCount === 0 ? 280 : 520,
    );
    return () => window.clearTimeout(timer);
  }, [viewModel.streamLines.length, visibleCount]);

  const renderedLines = useMemo(
    () =>
      viewModel.streamLines
        .slice(0, visibleCount)
        .slice(-MAX_VISIBLE_LINES),
    [viewModel.streamLines, visibleCount],
  );

  const showCurrentStep =
    Boolean(viewModel.currentStep) && viewModel.currentStep !== viewModel.header;
  const showWaitingPulse = !showCurrentStep && renderedLines.length === 0;

  return (
    <div
      className={`workspace-gen-surface ${surfaceToneClass} relative h-full w-full overflow-hidden rounded-[28px] ${className}`}
    >
      <div className="workspace-gen-phase-row">
        <span className="workspace-gen-phase-dot" />
        <div className="workspace-gen-title">{viewModel.header}</div>
      </div>

      <div className="workspace-gen-field">
        {renderDots("workspace-gen-dot-layer-base")}
        {renderDots("workspace-gen-dot-layer-active workspace-gen-dot-layer-center")}

        <div className="workspace-gen-stream-shell">
          {showCurrentStep ? (
            <div className="workspace-gen-current-line">
              {viewModel.currentStep}
            </div>
          ) : null}

          {showWaitingPulse ? (
            <div className="workspace-gen-waiting" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          ) : null}

          {renderedLines.length ? (
            <div className="workspace-gen-stream-list">
              {renderedLines.map((line, index) => (
                <div
                  key={`${title}-${line}-${index}`}
                  className="workspace-gen-stream-item"
                  style={{
                    animationDelay: `${Math.min(index * 120, 360)}ms`,
                  }}
                >
                  <span className="workspace-gen-stream-marker" />
                  <span className="workspace-gen-stream-text">{line}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
