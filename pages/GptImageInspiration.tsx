import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  Check,
  Compass,
  Copy,
  Download,
  Eye,
  Github,
  Image as ImageIcon,
  RefreshCw,
  Search,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import SystemAnnouncementModal from "../components/SystemAnnouncementModal";
import {
  analyzeSmartStyleImport,
  type SmartImportAnalysis,
} from "../services/gpt-image-smart-import";
import { getStudioUserAssetApi } from "../services/runtime-assets/api";
import {
  getUnreadAnnouncementCount,
  markAllAnnouncementsAsRead,
  SYSTEM_ANNOUNCEMENTS,
} from "../services/systemAnnouncements";
import {
  fetchGptImageInspiration,
  type GptImageInspirationCase,
  type GptImageInspirationCategory,
  type GptImageInspirationFacet,
  type GptImageInspirationPayload,
  type GptImageInspirationTemplate,
  type LocalizedText,
} from "../services/gpt-image-inspiration";
import { ROUTES } from "../utils/routes";

type PreviewState =
  | { type: "case"; item: GptImageInspirationCase }
  | { type: "template"; item: GptImageInspirationTemplate }
  | null;

type ImportJobState = {
  status: "idle" | "analyzing" | "success" | "error";
  preview: Exclude<PreviewState, null> | null;
  analysis: SmartImportAnalysis | null;
  error: string;
};

const UI_COPY = {
  brandTitle: "GPT-Image2 画廊",
  brandSubtitle: "",
  navCases: "案例",
  navTemplates: "模板",
  navHome: "返回首页",
  liveBadge: "实时更新的 GPT-IMAGE2 提示词画廊",
  heroTitle: "从爆款图片，到可复用 Prompt。",
  heroBody:
    "这是 awesome-gpt-image-2 的可视化入口：复制可直接复用的 Prompt，按风格或场景筛选，并一键跳转到 GitHub 源项目。",
  openSite: "浏览案例",
  openRepo: "GitHub 项目",
  metricCases: "个案例",
  metricTemplates: "个分类",
  metricUpdated: "套模板",
  galleryBadge: "复制、筛选、复用",
  galleryTitle: "爆款案例和 Prompt，一键可取。",
  galleryBody: "",
  searchPlaceholder: "搜索案例、来源、Prompt...",
  resetFilters: "重置",
  all: "全部",
  category: "分类",
  style: "风格",
  scene: "场景",
  matchingCases: "个匹配案例",
  stalePayload: "当前显示的是缓存内容",
  loading: "正在加载案例图库...",
  viewDetails: "查看详情",
  copyPrompt: "复制 Prompt",
  copied: "已复制",
  openGithubAnchor: "打开 GitHub 锚点",
  openSource: "打开来源",
  limitNote: "当前仅展示前 72 个结果，继续筛选会更接近原站体验。",
  templateBadge: "Templates",
  templateTitle: "模板区",
  templateBody:
    "这部分同样来自上游真实模板库，更适合后续接入你们自己的 workflow recipe 和 capability node。",
  openTemplateDoc: "打开模板文档",
  copyTemplate: "复制模板 Prompt",
  importStyleLibrary: "导入风格库",
  importedStyleLibrary: "已导入风格库",
  useWhen: "适用场景",
  guidance: "使用建议",
  pitfalls: "常见坑点",
  relatedCases: "关联案例",
  fullPrompt: "完整 Prompt",
  close: "关闭预览",
  noResults: "没有找到符合条件的案例，换个关键词试试。",
  importHint:
    "这里不是原样导入案例 Prompt，而是提炼成“参考图解释 + 规划约束 + Prompt 约束”的用户风格库。",
};

const formatGeneratedAt = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const looksBrokenText = (value: string | undefined) => {
  const text = String(value || "");
  if (!text) return false;
  const mojibakeHints = text.match(/[�銆鍚鈥锛]/g) || [];
  return mojibakeHints.length >= Math.max(3, Math.floor(text.length / 10));
};

const textFor = (value: LocalizedText | undefined, fallback = "") => {
  const zh = value?.zh || "";
  if (zh && !looksBrokenText(zh)) return zh;
  return value?.en || fallback;
};

const linesFor = (
  value: LocalizedText | { en: string[]; zh: string[] } | undefined,
) => {
  if (!value) return [];
  if (Array.isArray((value as { zh: string[] }).zh)) {
    const zh = ((value as { zh: string[] }).zh || []).filter(
      (item) => item && !looksBrokenText(item),
    );
    if (zh.length) return zh;
    return ((value as { en: string[] }).en || []).filter(Boolean);
  }
  return [textFor(value as LocalizedText)].filter(Boolean);
};

const facetLabel = (
  value: string,
  items: Array<GptImageInspirationFacet | GptImageInspirationCategory>,
) => {
  const match = items.find((item) => item.value === value);
  return match ? textFor(match.title, value) : value;
};

const buildTemplatePromptText = (
  template: GptImageInspirationTemplate,
  payload: GptImageInspirationPayload | null,
) => {
  const styles = template.styles.map((item) =>
    facetLabel(item, payload?.styles || []),
  );
  const scenes = template.scenes.map((item) =>
    facetLabel(item, payload?.scenes || []),
  );

  return [
    `模板名称：${textFor(template.title, template.id)}`,
    `模板定位：${textFor(template.description)}`,
    `适用场景：${textFor(template.useWhen)}`,
    styles.length ? `风格关键词：${styles.join("、")}` : "",
    scenes.length ? `场景关键词：${scenes.join("、")}` : "",
    template.tags?.length ? `补充标签：${template.tags.join("、")}` : "",
    linesFor(template.guidance).length
      ? `生成要求：\n${linesFor(template.guidance)
          .map((line) => `- ${line}`)
          .join("\n")}`
      : "",
    linesFor(template.pitfalls).length
      ? `避免事项：\n${linesFor(template.pitfalls)
          .map((line) => `- ${line}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
};

const buildCleanTemplatePromptText = (
  template: GptImageInspirationTemplate,
  payload: GptImageInspirationPayload | null,
) => {
  const styles = template.styles.map((item) =>
    facetLabel(item, payload?.styles || []),
  );
  const scenes = template.scenes.map((item) =>
    facetLabel(item, payload?.scenes || []),
  );

  return [
    `模板名称：${textFor(template.title, template.id)}`,
    `模板定位：${textFor(template.description)}`,
    `适用场景：${textFor(template.useWhen)}`,
    styles.length ? `风格关键词：${styles.join("、")}` : "",
    scenes.length ? `场景关键词：${scenes.join("、")}` : "",
    template.tags?.length ? `补充标签：${template.tags.join("、")}` : "",
    linesFor(template.guidance).length
      ? `生成要求：\n${linesFor(template.guidance)
          .map((line) => `- ${line}`)
          .join("\n")}`
      : "",
    linesFor(template.pitfalls).length
      ? `避免事项：\n${linesFor(template.pitfalls)
          .map((line) => `- ${line}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
};

const FilterChip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
      active
        ? "border-cyan-300/70 bg-cyan-300/18 text-white"
        : "border-white/12 bg-white/[0.03] text-slate-300 hover:border-white/22 hover:bg-white/[0.07] hover:text-white"
    }`}
  >
    {children}
  </button>
);

const SmartImportDialog: React.FC<{
  job: ImportJobState;
  onClose: () => void;
}> = ({ job, onClose }) => {
  if (!job.preview) return null;

  const title =
    job.preview.type === "case"
      ? job.preview.item.title
      : textFor(job.preview.item.title, job.preview.item.id);

  const modeLabel =
    job.analysis?.mode === "case_transfer"
      ? "强案例迁移"
      : job.analysis?.mode === "edit_template"
        ? "编辑模板"
        : "抽象风格库";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#050812]/84 p-4 backdrop-blur-md">
      <section className="relative flex max-h-[min(92vh,960px)] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(11,17,33,0.98),rgba(7,11,22,0.96))] shadow-[0_34px_120px_rgba(0,0,0,0.56)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-slate-200 transition hover:bg-black/50 hover:text-white"
          aria-label="关闭导入分析"
        >
          <X size={18} />
        </button>

        <div className="shrink-0 border-b border-white/10 px-6 py-5 md:px-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-200">
            Smart Import
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            导入时会先经过智能体判断，再决定该转换成什么类型的可复用资产。
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-7">
          <div className="space-y-4 pb-1">
          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-white">当前状态</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  job.status === "analyzing"
                    ? "border border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
                    : job.status === "success"
                      ? "border border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                      : job.status === "error"
                        ? "border border-rose-300/25 bg-rose-300/10 text-rose-100"
                        : "border border-white/10 bg-white/[0.05] text-slate-300"
                }`}
              >
                {job.status === "analyzing"
                  ? "正在分析转换策略"
                  : job.status === "success"
                    ? "导入成功"
                    : job.status === "error"
                      ? "导入失败"
                      : "待开始"}
              </span>
              {job.analysis ? (
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-300">
                  推荐模式：{modeLabel}
                </span>
              ) : null}
            </div>
            {job.analysis ? (
              <div className="mt-3 text-sm text-slate-300">
                置信度：{Math.round(job.analysis.confidence * 100)}%
              </div>
            ) : null}
            {job.status === "error" ? (
              <div className="mt-3 text-sm leading-7 text-rose-200">{job.error}</div>
            ) : null}
            {job.status === "success" && job.analysis?.successMessage ? (
              <div className="mt-3 text-sm leading-7 text-emerald-100">
                {job.analysis.successMessage}
              </div>
            ) : null}
          </section>

          <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-semibold text-white">转换思考过程</div>
            {job.status === "analyzing" && !job.analysis ? (
              <div className="mt-3 space-y-2 text-sm leading-7 text-slate-400">
                <div>正在判断这个案例更像抽象风格、强案例迁移，还是编辑型模板…</div>
                <div>正在提炼应该保留的主体关系、构图方式、服装姿态和光线约束…</div>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {(job.analysis?.thinking || []).map((line, index) => (
                  <div key={index} className="text-sm leading-7 text-slate-300">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </section>

          {job.analysis ? (
            <section className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-white">规划约束</div>
                <div className="mt-3 space-y-2">
                  {job.analysis.library.planningDirectives.map((line, index) => (
                    <div key={index} className="text-sm leading-7 text-slate-300">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-white">Prompt 约束</div>
                <div className="mt-3 space-y-2">
                  {job.analysis.library.promptDirectives.map((line, index) => (
                    <div key={index} className="text-sm leading-7 text-slate-300">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {job.analysis?.warnings?.length ? (
            <section className="rounded-[24px] border border-amber-300/20 bg-amber-300/10 p-4">
              <div className="text-sm font-semibold text-amber-50">风险提示</div>
              <div className="mt-3 space-y-2">
                {job.analysis.warnings.map((line, index) => (
                  <div key={index} className="text-sm leading-7 text-amber-100">
                    {line}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          </div>
        </div>
      </section>
    </div>
  );
};

const PreviewDialog: React.FC<{
  preview: PreviewState;
  payload: GptImageInspirationPayload | null;
  copiedId: string;
  importedId: string;
  onCopy: (id: string, text: string) => void;
  onImport: (preview: Exclude<PreviewState, null>) => void;
  onClose: () => void;
}> = ({ preview, payload, copiedId, importedId, onCopy, onImport, onClose }) => {
  const casesById = useMemo(
    () => new Map((payload?.cases || []).map((item) => [item.id, item])),
    [payload],
  );

  if (!preview) return null;

  const imageSrc = preview.type === "case" ? preview.item.image : preview.item.cover;
  const imageAlt =
    preview.type === "case"
      ? preview.item.imageAlt
      : textFor(preview.item.title, preview.item.id);
  const importKey =
    preview.type === "case"
      ? `case-${preview.item.id}`
      : `template-${preview.item.id}`;
  const templatePromptText =
    preview.type === "template"
      ? buildCleanTemplatePromptText(preview.item, payload)
      : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050812]/84 p-4 backdrop-blur-md">
      <section className="relative grid max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(11,17,33,0.98),rgba(7,11,22,0.96))] shadow-[0_34px_120px_rgba(0,0,0,0.56)] xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-slate-200 transition hover:bg-black/50 hover:text-white"
          aria-label={UI_COPY.close}
        >
          <X size={18} />
        </button>

        <div className="relative min-h-[320px] overflow-hidden bg-[#09101d]">
          <img src={imageSrc} alt={imageAlt} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(6,9,20,0.16))]" />
          <div className="absolute left-5 top-5 rounded-full border border-white/12 bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90">
            {preview.type === "case" ? `Case ${preview.item.id}` : "Template"}
          </div>
        </div>

        <div className="overflow-y-auto p-6 md:p-7">
          {preview.type === "case" ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <span>{facetLabel(preview.item.category, payload?.categories || [])}</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-slate-400">
                  {preview.item.sourceLabel}
                </span>
              </div>
              <h3 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
                {preview.item.title}
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {[...preview.item.styles, ...preview.item.scenes].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300"
                  >
                    {facetLabel(tag, [...(payload?.styles || []), ...(payload?.scenes || [])])}
                  </span>
                ))}
              </div>

              <section className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">{UI_COPY.fullPrompt}</div>
                  <button
                    type="button"
                    onClick={() => onCopy(`case-preview-${preview.item.id}`, preview.item.prompt)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/[0.08]"
                  >
                    {copiedId === `case-preview-${preview.item.id}` ? <Check size={14} /> : <Copy size={14} />}
                    {copiedId === `case-preview-${preview.item.id}` ? UI_COPY.copied : UI_COPY.copyPrompt}
                  </button>
                </div>
                <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap text-sm leading-7 text-slate-300">
                  {preview.item.prompt}
                </pre>
              </section>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onImport(preview)}
                  className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-300/10 px-4 py-2.5 text-sm text-fuchsia-50 transition hover:bg-fuchsia-300/16"
                >
                  {importedId === importKey ? <Check size={15} /> : <Download size={15} />}
                  {importedId === importKey ? UI_COPY.importedStyleLibrary : UI_COPY.importStyleLibrary}
                </button>
                {preview.item.sourceUrl ? (
                  <a
                    href={preview.item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.08]"
                  >
                    {UI_COPY.openSource}
                    <ArrowUpRight size={15} />
                  </a>
                ) : null}
                <a
                  href={preview.item.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2.5 text-sm text-cyan-50 transition hover:bg-cyan-300/16"
                >
                  {UI_COPY.openGithubAnchor}
                  <Github size={15} />
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <span>{facetLabel(preview.item.category, payload?.categories || [])}</span>
                {(preview.item.tags || []).slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-slate-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h3 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
                {textFor(preview.item.title, preview.item.id)}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                {textFor(preview.item.description)}
              </p>

              <section className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-white">{UI_COPY.useWhen}</div>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {textFor(preview.item.useWhen)}
                </p>
              </section>

              <section className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">{UI_COPY.fullPrompt}</div>
                  <button
                    type="button"
                    onClick={() =>
                      onCopy(`template-preview-${preview.item.id}`, templatePromptText)
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/[0.08]"
                  >
                    {copiedId === `template-preview-${preview.item.id}` ? (
                      <Check size={14} />
                    ) : (
                      <Copy size={14} />
                    )}
                    {copiedId === `template-preview-${preview.item.id}`
                      ? UI_COPY.copied
                      : UI_COPY.copyTemplate}
                  </button>
                </div>
                <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap text-sm leading-7 text-slate-300">
                  {templatePromptText}
                </pre>
              </section>

              <section className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-white">{UI_COPY.guidance}</div>
                <div className="mt-3 space-y-2">
                  {linesFor(preview.item.guidance).map((line, index) => (
                    <div key={index} className="text-sm leading-7 text-slate-300">
                      {line}
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-white">{UI_COPY.pitfalls}</div>
                <div className="mt-3 space-y-2">
                  {linesFor(preview.item.pitfalls).map((line, index) => (
                    <div key={index} className="text-sm leading-7 text-slate-300">
                      {line}
                    </div>
                  ))}
                </div>
              </section>

              {preview.item.exampleCases?.length ? (
                <section className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-sm font-semibold text-white">{UI_COPY.relatedCases}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {preview.item.exampleCases.map((caseId) => {
                      const example = casesById.get(caseId);
                      return example ? (
                        <button
                          key={caseId}
                          type="button"
                          onClick={() => window.dispatchEvent(new CustomEvent("gpt-image-preview-case", { detail: example }))}
                          className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/[0.08] hover:text-white"
                        >
                          Case {caseId}
                        </button>
                      ) : null;
                    })}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

const GptImageInspiration: React.FC = () => {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<GptImageInspirationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [style, setStyle] = useState("All");
  const [scene, setScene] = useState("All");
  const [preview, setPreview] = useState<PreviewState>(null);
  const [copiedId, setCopiedId] = useState("");
  const [importedId, setImportedId] = useState("");
  const [importJob, setImportJob] = useState<ImportJobState>({
    status: "idle",
    preview: null,
    analysis: null,
    error: "",
  });
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0);

  useEffect(() => {
    setUnreadAnnouncementCount(getUnreadAnnouncementCount());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const nextPayload = await fetchGptImageInspiration();
        if (cancelled) return;
        setPayload(nextPayload);
      } catch (nextError) {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!copiedId) return undefined;
    const timer = window.setTimeout(() => setCopiedId(""), 1800);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  useEffect(() => {
    if (!importedId) return undefined;
    const timer = window.setTimeout(() => setImportedId(""), 2400);
    return () => window.clearTimeout(timer);
  }, [importedId]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<GptImageInspirationCase>;
      if (customEvent.detail) {
        setPreview({ type: "case", item: customEvent.detail });
      }
    };
    window.addEventListener("gpt-image-preview-case", handler as EventListener);
    return () =>
      window.removeEventListener("gpt-image-preview-case", handler as EventListener);
  }, []);

  const heroCases = useMemo(
    () => (payload?.cases || []).filter((item) => item.featured).slice(0, 5),
    [payload],
  );

  const hotStripCases = useMemo(
    () => (payload?.cases || []).slice(0, 8),
    [payload],
  );

  const filteredCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (payload?.cases || []).filter((item) => {
      const matchCategory = category === "All" || item.category === category;
      const matchStyle = style === "All" || item.styles.includes(style);
      const matchScene = scene === "All" || item.scenes.includes(scene);
      const haystack = [
        item.title,
        item.prompt,
        item.promptPreview,
        item.sourceLabel,
        item.category,
        ...item.styles,
        ...item.scenes,
      ]
        .join(" ")
        .toLowerCase();
      const matchQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchCategory && matchStyle && matchScene && matchQuery;
    });
  }, [payload, query, category, style, scene]);

  const visibleCases = filteredCases.slice(0, 72);

  const metrics = useMemo(() => {
    if (!payload) return [];
    return [
      {
        label: UI_COPY.metricCases,
        value: String(payload.totalCases),
      },
      {
        label: UI_COPY.metricTemplates,
        value: String(payload.categories.length),
      },
      {
        label: UI_COPY.metricUpdated,
        value: payload.templates.length >= 20 ? "20+" : String(payload.templates.length),
      },
    ];
  }, [payload]);

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
    } catch {
      setCopiedId("");
    }
  };

  const importAsStyleLibrary = async (nextPreview: Exclude<PreviewState, null>) => {
    setImportJob({
      status: "analyzing",
      preview: nextPreview,
      analysis: null,
      error: "",
    });

    try {
      const analysis = await analyzeSmartStyleImport(nextPreview, payload);
      const saved = getStudioUserAssetApi().saveStyleLibrary(analysis.library, {
        preferredId: analysis.preferredId,
        sourceMode: "custom",
      });

      if (!saved) {
        throw new Error("导入分析完成，但保存风格库失败。");
      }

      setImportedId(
        nextPreview.type === "case"
          ? `case-${nextPreview.item.id}`
          : `template-${nextPreview.item.id}`,
      );
      setImportJob({
        status: "success",
        preview: nextPreview,
        analysis,
        error: "",
      });
    } catch (nextError) {
      setImportJob({
        status: "error",
        preview: nextPreview,
        analysis: null,
        error: nextError instanceof Error ? nextError.message : String(nextError),
      });
    }
  };

  const openAnnouncements = () => {
    setShowAnnouncements(true);
    markAllAnnouncementsAsRead();
    setUnreadAnnouncementCount(0);
  };

  return (
    <div className="min-h-screen bg-[#060914] text-slate-100">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(47,211,255,0.18),transparent_24rem),radial-gradient(circle_at_88%_0%,rgba(255,73,167,0.16),transparent_28rem),linear-gradient(180deg,#060914_0%,#0b1020_48%,#080b14_100%)]" />
        <div className="absolute left-[-8%] top-[10%] h-[22rem] w-[22rem] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-[-6%] top-[18%] h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/8 bg-[#08101dcc]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-4 md:px-8 lg:px-14">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
              <Wand2 size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.08em] text-white">
                {UI_COPY.brandTitle}
              </div>
              {UI_COPY.brandSubtitle ? (
                <div className="text-[11px] text-slate-400">{UI_COPY.brandSubtitle}</div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#gallery"
              className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/[0.08] hover:text-white md:inline-flex"
            >
              {UI_COPY.navCases}
            </a>
            <a
              href="#templates"
              className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/[0.08] hover:text-white md:inline-flex"
            >
              {UI_COPY.navTemplates}
            </a>
            <button
              type="button"
              onClick={openAnnouncements}
              className="relative rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              aria-label="打开系统公告"
            >
              <Bell size={18} />
              {unreadAnnouncementCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex min-w-[20px] items-center justify-center rounded-full bg-[#ff5a78] px-1.5 text-[11px] font-bold leading-5 text-white">
                  {unreadAnnouncementCount > 9 ? "9+" : unreadAnnouncementCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>

      <Sidebar />

      <main className="mx-auto max-w-[1480px] px-4 pb-12 pt-24 md:px-8 lg:px-14">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl md:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]" />
          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.8fr)]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.22em] text-cyan-100 uppercase">
                <Sparkles size={12} />
                {UI_COPY.liveBadge}
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white md:text-6xl">
                {UI_COPY.heroTitle}
              </h1>
              <p className="mt-5 max-w-3xl text-[15px] leading-8 text-slate-300 md:text-[17px]">
                {UI_COPY.heroBody}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href={payload?.source.siteUrl || "https://gpt-image2.canghe.ai/"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-300/15 px-5 py-3 text-sm font-medium text-cyan-50 transition hover:-translate-y-0.5 hover:bg-cyan-300/22"
                >
                  {UI_COPY.openSite}
                  <ArrowUpRight size={15} />
                </a>
                <a
                  href={payload?.source.repoUrl || "https://github.com/freestylefly/awesome-gpt-image-2"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-medium text-slate-200 transition hover:-translate-y-0.5 hover:bg-white/[0.09]"
                >
                  {UI_COPY.openRepo}
                  <Github size={15} />
                </a>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.dashboard)}
                  className="inline-flex items-center gap-2 rounded-full border border-transparent px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                >
                  {UI_COPY.navHome}
                </button>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {metrics.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)]"
                  >
                    <div className="text-2xl font-semibold tracking-[-0.04em] text-white">
                      {item.value}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-h-[540px]">
              {heroCases.map((item, index) => {
                const cardStyles = [
                  "left-8 top-6 h-[320px] w-[250px] -rotate-[5deg]",
                  "right-3 top-0 h-[270px] w-[220px] rotate-[4deg]",
                  "left-0 top-[280px] h-[220px] w-[210px] rotate-[5deg]",
                  "right-6 top-[250px] h-[220px] w-[280px] -rotate-[3deg]",
                  "left-[170px] top-[165px] h-[230px] w-[205px] rotate-[2deg]",
                ];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPreview({ type: "case", item })}
                    className={`group absolute overflow-hidden rounded-[20px] border border-white/12 bg-[#111a2c] text-left shadow-[0_24px_80px_rgba(0,0,0,0.42)] transition hover:-translate-y-2 hover:border-cyan-300/70 ${cardStyles[index] || ""}`}
                  >
                    <img
                      src={item.image}
                      alt={item.imageAlt}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <span className="absolute bottom-3 left-3 rounded-lg bg-[rgba(4,9,18,0.72)] px-2.5 py-1.5 text-xs font-extrabold text-white">
                      #{item.id}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          {hotStripCases.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreview({ type: "case", item })}
              className="group relative aspect-square overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.04] text-left"
            >
              <img
                src={item.image}
                alt={item.imageAlt}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]"
              />
              <span className="absolute bottom-2 left-2 rounded-md bg-[rgba(4,9,18,0.74)] px-2 py-1 text-xs font-extrabold text-white">
                #{item.id}
              </span>
            </button>
          ))}
        </section>

        <section id="gallery" className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold tracking-[0.22em] text-slate-300 uppercase">
                <Compass size={12} />
                {UI_COPY.galleryBadge}
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
                {UI_COPY.galleryTitle}
              </h2>
              {UI_COPY.galleryBody ? (
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
                  {UI_COPY.galleryBody}
                </p>
              ) : null}
            </div>

            <div className="flex w-full items-center gap-3 lg:max-w-[420px]">
              <div className="flex flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-slate-300">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={UI_COPY.searchPlaceholder}
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("All");
                  setStyle("All");
                  setScene("All");
                }}
                className="inline-flex h-[46px] items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-4 text-sm text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                {UI_COPY.resetFilters}
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-4 rounded-[24px] border border-white/10 bg-[#091120]/82 p-4">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {UI_COPY.category}
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={category === "All"} onClick={() => setCategory("All")}>
                  {UI_COPY.all}
                </FilterChip>
                {(payload?.categories || []).map((item) => (
                  <FilterChip
                    key={item.id}
                    active={category === item.value}
                    onClick={() => setCategory(item.value)}
                  >
                    {textFor(item.title, item.value)}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {UI_COPY.style}
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={style === "All"} onClick={() => setStyle("All")}>
                  {UI_COPY.all}
                </FilterChip>
                {(payload?.styles || []).map((item) => (
                  <FilterChip
                    key={item.id}
                    active={style === item.value}
                    onClick={() => setStyle(item.value)}
                  >
                    {textFor(item.title, item.value)}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {UI_COPY.scene}
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={scene === "All"} onClick={() => setScene("All")}>
                  {UI_COPY.all}
                </FilterChip>
                {(payload?.scenes || []).map((item) => (
                  <FilterChip
                    key={item.id}
                    active={scene === item.value}
                    onClick={() => setScene(item.value)}
                  >
                    {textFor(item.title, item.value)}
                  </FilterChip>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="text-sm text-slate-300">
              <span className="font-semibold text-white">{filteredCases.length}</span> {UI_COPY.matchingCases}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {payload?.stale ? (
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-amber-100">
                  {UI_COPY.stalePayload}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <RefreshCw size={12} />
                {payload ? formatGeneratedAt(payload.generatedAt) : "--"}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-sm text-slate-400">{UI_COPY.loading}</div>
          ) : error ? (
            <div className="mt-5 rounded-[22px] border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
              加载失败：{error}
            </div>
          ) : !visibleCases.length ? (
            <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
              {UI_COPY.noResults}
            </div>
          ) : (
            <>
              <div className="mt-6 columns-1 gap-4 md:columns-2 xl:columns-3">
                {visibleCases.map((item) => {
                  const tags = [...new Set([...item.styles, ...item.scenes])].slice(0, 4);
                  return (
                    <article
                      key={item.id}
                      className="mb-4 inline-block w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1325] shadow-[0_20px_55px_rgba(0,0,0,0.22)] transition hover:-translate-y-1 hover:border-cyan-300/20"
                    >
                      <button
                        type="button"
                        onClick={() => setPreview({ type: "case", item })}
                        className="group relative block w-full overflow-hidden text-left"
                      >
                        <img
                          src={item.image}
                          alt={item.imageAlt}
                          className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                        />
                        <span className="absolute left-3 top-3 rounded-lg bg-[rgba(4,9,18,0.74)] px-2.5 py-1.5 text-xs font-black text-white">
                          Case {item.id}
                        </span>
                        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-lg border border-cyan-300/42 bg-[rgba(4,9,18,0.76)] px-2.5 py-1.5 text-xs font-black text-white opacity-0 transition group-hover:opacity-100">
                          <Eye size={14} />
                          {UI_COPY.viewDetails}
                        </span>
                      </button>

                      <div className="p-4">
                        <div className="flex flex-wrap gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-cyan-200">
                          <span>{facetLabel(item.category, payload?.categories || [])}</span>
                          {item.sourceUrl ? (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-lime-200 transition hover:text-white"
                            >
                              {item.sourceLabel}
                            </a>
                          ) : (
                            <span className="text-lime-200">{item.sourceLabel}</span>
                          )}
                        </div>
                        <h3 className="mt-3 text-xl font-semibold leading-7 text-white">
                          {item.title}
                        </h3>
                        <p className="mt-2 line-clamp-3 min-h-[76px] text-sm leading-7 text-slate-400">
                          {item.promptPreview}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {tags.map((tag) => (
                            <span
                              key={`${item.id}-${tag}`}
                              className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs text-slate-300"
                            >
                              {facetLabel(tag, [...(payload?.styles || []), ...(payload?.scenes || [])])}
                            </span>
                          ))}
                        </div>
                        <div className="mt-5 grid grid-cols-[1fr_1fr_42px] gap-2">
                          <button
                            type="button"
                            onClick={() => copyText(`case-${item.id}`, item.prompt)}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.09]"
                          >
                            {copiedId === `case-${item.id}` ? <Check size={16} /> : <Copy size={16} />}
                            {copiedId === `case-${item.id}` ? UI_COPY.copied : UI_COPY.copyPrompt}
                          </button>
                          <button
                            type="button"
                            onClick={() => importAsStyleLibrary({ type: "case", item })}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-300/10 px-4 py-2.5 text-sm text-fuchsia-50 transition hover:bg-fuchsia-300/16"
                          >
                            {importedId === `case-${item.id}` ? (
                              <Check size={16} />
                            ) : (
                              <Download size={16} />
                            )}
                            {importedId === `case-${item.id}`
                              ? UI_COPY.importedStyleLibrary
                              : UI_COPY.importStyleLibrary}
                          </button>
                          <a
                            href={item.githubUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-300 transition hover:bg-white/[0.09] hover:text-white"
                            aria-label={UI_COPY.openGithubAnchor}
                          >
                            <Github size={17} />
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {filteredCases.length > visibleCases.length ? (
                <div className="mt-4 text-center text-sm text-slate-500">{UI_COPY.limitNote}</div>
              ) : null}
            </>
          )}
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {(payload?.categories || []).slice(0, 8).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setCategory(item.value);
                document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1325] text-left shadow-[0_20px_55px_rgba(0,0,0,0.22)]"
            >
              <div className="aspect-[1.45/1] overflow-hidden">
                <img
                  src={item.cover}
                  alt={textFor(item.title, item.value)}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(6,9,20,0.92))]" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="text-sm font-semibold text-white">
                  {textFor(item.title, item.value)}
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-300">
                  {textFor(item.description)}
                </div>
              </div>
            </button>
          ))}
        </section>

        <section id="templates" className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold tracking-[0.22em] text-slate-300 uppercase">
                <Sparkles size={12} />
                {UI_COPY.templateBadge}
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
                {UI_COPY.templateTitle}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
                {UI_COPY.templateBody}
              </p>
            </div>
            <a
              href={`${payload?.source.repoUrl || "https://github.com/freestylefly/awesome-gpt-image-2"}/blob/main/${payload?.templateDocument || "docs/templates.md"}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.08]"
            >
              {UI_COPY.openTemplateDoc}
              <ArrowUpRight size={15} />
            </a>
          </div>

          <div className="mt-6 columns-1 gap-4 md:columns-2 xl:columns-3">
            {(payload?.templates || []).map((item, index) => (
              <article
                key={item.id}
                className="mb-4 inline-block w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1325] shadow-[0_20px_55px_rgba(0,0,0,0.22)] transition hover:-translate-y-1 hover:border-fuchsia-300/20"
              >
                <button
                  type="button"
                  onClick={() => setPreview({ type: "template", item })}
                  className="group relative block w-full overflow-hidden text-left"
                >
                  <img
                    src={item.cover}
                    alt={textFor(item.title, item.id)}
                    className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                  />
                  <span className="absolute left-3 top-3 rounded-lg bg-[rgba(4,9,18,0.74)] px-2.5 py-1.5 text-xs font-black text-white">
                    Template {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-lg border border-fuchsia-300/42 bg-[rgba(4,9,18,0.76)] px-2.5 py-1.5 text-xs font-black text-white opacity-0 transition group-hover:opacity-100">
                    <Eye size={14} />
                    {UI_COPY.viewDetails}
                  </span>
                </button>
                <div className="p-4">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-fuchsia-200">
                    {facetLabel(item.category, payload?.categories || [])}
                  </div>
                  <h3 className="mt-3 text-xl font-semibold leading-7 text-white">
                    {textFor(item.title, item.id)}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-7 text-slate-400">
                    {textFor(item.description)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(item.tags || []).slice(0, 4).map((tag) => (
                      <span
                        key={`${item.id}-${tag}`}
                        className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPreview({ type: "template", item })}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.09]"
                    >
                      <Eye size={16} />
                      {UI_COPY.viewDetails}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `template-${item.id}`,
                          buildCleanTemplatePromptText(item, payload),
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-300/10 px-4 py-2.5 text-sm text-fuchsia-50 transition hover:bg-fuchsia-300/16"
                    >
                      {copiedId === `template-${item.id}` ? <Check size={16} /> : <Copy size={16} />}
                      {copiedId === `template-${item.id}` ? UI_COPY.copied : UI_COPY.copyTemplate}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <PreviewDialog
        preview={preview}
        payload={payload}
        copiedId={copiedId}
        importedId={importedId}
        onCopy={copyText}
        onImport={importAsStyleLibrary}
        onClose={() => setPreview(null)}
      />

      <SmartImportDialog
        job={importJob}
        onClose={() =>
          setImportJob({
            status: "idle",
            preview: null,
            analysis: null,
            error: "",
          })
        }
      />

      <SystemAnnouncementModal
        isOpen={showAnnouncements}
        announcements={SYSTEM_ANNOUNCEMENTS}
        onClose={() => setShowAnnouncements(false)}
      />
    </div>
  );
};

export default GptImageInspiration;
