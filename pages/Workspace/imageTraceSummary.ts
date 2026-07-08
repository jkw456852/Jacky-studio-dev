import type {
  ImageResultSnapshot,
  ImageTransportRequestSnapshot,
  ImageUserRequestSnapshot,
} from "../../types/image-generation.types";

const readText = (value: unknown): string | null => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const pushUnique = (target: string[], value: string | null | undefined) => {
  const normalized = String(value || "").trim();
  if (!normalized) return;
  if (!target.includes(normalized)) {
    target.push(normalized);
  }
};

export const buildImageTraceSummaryLines = (args: {
  userRequestSnapshot?: ImageUserRequestSnapshot | null;
  transportRequestSnapshot?: ImageTransportRequestSnapshot | null;
  resultSnapshot?: ImageResultSnapshot | null;
  traceStatus?: string | null;
  traceModel?: string | null;
}): string[] => {
  const lines: string[] = [];
  const requested = args.userRequestSnapshot || null;
  const transport = args.transportRequestSnapshot || null;
  const result = args.resultSnapshot || null;
  const traceStatus = readText(args.traceStatus);
  const traceModel = readText(args.traceModel);

  if (traceStatus) {
    pushUnique(lines, `生成状态: ${traceStatus}`);
  }

  if (requested) {
    const requestedModel = readText(requested.requestedModel);
    const requestedRatio = readText(requested.requestedAspectRatio);
    const requestedSize = readText(requested.requestedExactSize || requested.requestedImageSize);
    const requestedQuality = readText(requested.requestedImageQuality);

    if (requestedModel) {
      pushUnique(lines, `用户要求模型: ${requestedModel}`);
    } else if (traceModel) {
      pushUnique(lines, `当前模型: ${traceModel}`);
    }

    if (requestedRatio || requestedSize || requestedQuality) {
      pushUnique(
        lines,
        `用户要求: ${[
          requestedRatio ? `比例 ${requestedRatio}` : null,
          requestedSize ? `分辨率 ${requestedSize}` : null,
          requestedQuality ? `质量 ${requestedQuality}` : null,
        ]
          .filter(Boolean)
          .join(" / ")}`,
      );
    }

    if (requested.referenceCount > 0) {
      pushUnique(lines, `参考图: ${requested.referenceCount} 张`);
    }
    if (requested.hasMask) {
      pushUnique(lines, "包含蒙版编辑");
    }
  } else if (traceModel) {
    pushUnique(lines, `当前模型: ${traceModel}`);
  }

  if (transport) {
    const resolvedModel = readText(transport.resolvedModel);
    const resolvedRatio = readText(transport.resolvedAspectRatio);
    const resolvedSize = readText(transport.resolvedSize);
    const providerId = readText(transport.providerId);
    const requestMode = readText(transport.requestMode);
    const payloadMode = readText(transport.payloadMode);
    const effectiveRoute = readText(transport.effectiveRoute || transport.route);

    if (resolvedModel) {
      pushUnique(lines, `实际模型: ${resolvedModel}`);
    }
    if (resolvedRatio || resolvedSize) {
      pushUnique(
        lines,
        `协商结果: ${[
          resolvedRatio ? `比例 ${resolvedRatio}` : null,
          resolvedSize ? `分辨率 ${resolvedSize}` : null,
        ]
          .filter(Boolean)
          .join(" / ")}`,
      );
    }
    if (providerId) {
      pushUnique(lines, `Provider: ${providerId}`);
    }
    if (requestMode || payloadMode) {
      pushUnique(
        lines,
        `下发方式: ${[requestMode, payloadMode].filter(Boolean).join(" / ")}`,
      );
    }
    if (effectiveRoute) {
      pushUnique(lines, `接口路由: ${effectiveRoute}`);
    }
    if (transport.referenceCount > 0 && (!requested || transport.referenceCount !== requested.referenceCount)) {
      pushUnique(lines, `实际参考图: ${transport.referenceCount} 张`);
    }
    if (transport.hasMask && (!requested || !requested.hasMask)) {
      pushUnique(lines, "实际走了蒙版编辑");
    }
    (transport.warnings || [])
      .map((item) => readText(item?.message))
      .filter(Boolean)
      .slice(0, 4)
      .forEach((message) => {
        pushUnique(lines, `参数调整: ${message}`);
      });
  }

  if (result) {
    const taskId = readText(result.taskId);
    if (result.status === "submitted" && taskId) {
      pushUnique(lines, `任务已提交: ${taskId}`);
    } else if (result.status === "completed") {
      pushUnique(lines, "结果已返回");
    } else if (result.status === "failed") {
      pushUnique(lines, `结果失败${result.error ? `: ${result.error}` : ""}`);
    }
  }

  return lines;
};

