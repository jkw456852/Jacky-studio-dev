export interface SystemAnnouncement {
  id: string;
  date: string;
  title: string;
  summary: string;
  features: string[];
  fixes: string[];
  experiments: string[];
}

export const SYSTEM_ANNOUNCEMENTS_STORAGE_KEY =
  "jkai-system-announcements-read";

// Push 前把最新公告加到最前面，内容尽量用最直白的人话写清楚。
export const SYSTEM_ANNOUNCEMENTS: SystemAnnouncement[] = [
  {
    id: "2026-05-12-evening-workspace-style-plaza-and-account-updates",
    date: "2026.05.12 19:40",
    title: "新增 GPT 画廊，重做风格广场，账号中心也并回统一导航了",
    summary:
      "这一轮不是小修小补，而是把几块用户能直接看到的主界面一起改了：站内新增了 GPT-Image2 画廊页面，风格资源广场从旧的说明堆叠模式重做成更像真实图库的卡片广场，账号中心也正式并回全站统一导航；同时把风格封面、导入复用、临时风格分类和批量清理这些实际会频繁用到的细节一起补齐。",
    features: [
      "站内新增了 GPT-Image2 画廊页面，现在可以直接浏览案例、筛选风格、查看模板，并把内容导入到风格库。",
      "GPT-Image2 画廊整体文案已经重写成更贴近页面真实用途的表达，不再像开发测试页。",
      "账号中心已经接入全站统一导航，不再是单独一套返回逻辑，切页方式和首页、项目页、工作台保持一致。",
      "风格资源广场已经从旧的详情堆叠模式重做成单栏卡片广场，浏览时更像真实图片库。",
      "风格卡片交互已经改成单击直接启用、双击打开编辑弹窗，不再依赖侧边栏修改。",
      "风格编辑弹窗现在支持上传封面、删除封面，管理卡片时终于可以直接处理视觉封面。",
      "从 GPT 画廊导入到风格库的卡片会自动复用原封面，不用再手动补图。",
    ],
    fixes: [
      "修复了账号中心改版后导致页面打不开的导入错误，详情页现在可以正常进入。",
      "修正了临时风格被误归到用户资产的问题，运行时风格和用户自建风格现在会分开显示。",
      "风格广场已经补上批量删除、全选和反选，整理卡片时不用一张张点。",
      "风格卡片下面原本长期占位的详细说明已经改成悬停展示，浏览时不再被说明文本压住版面。",
      "风格卡片中间那层遮挡封面的深色文字框已经删除，卡面浏览终于回到以图片为主。",
    ],
    experiments: [
      "全站浅色 / 深色模式切换已经确认可做，但还需要继续把各页面里的硬编码颜色逐步抽离，尤其是 GPT 画廊这类深色页面。",
      "工作流配方、原子能力节点和更完整的能力配置闭环还在继续推进，当前这批改动主要先把高频页面和风格链路修顺。",
    ],
  },
  {
    id: "2026-05-12-projects-announcement-and-workspace-updates",
    date: "2026.05.12 14:30",
    title: "公告更清爽了，项目和工作台也补齐了一批实用更新",
    summary:
      "这次把公告弹窗重做得更简洁，项目页也补上了同款公告入口；另外把项目封面、图片拖拽上传、模型偏好和局部修图结果回传这些日常最常碰到的体验一起顺手补齐了。",
    features: [
      "系统公告弹窗换成了更简洁的新版样式，信息更聚焦，不再像一大块厚重卡片。",
      "项目页右上角也加了和首页一样的公告按钮、未读红点和未读数量，两个页面现在是同一套体验。",
      "最近项目列表会优先拿该项目第一次上传图片的小图当封面，比以前更接近真实内容。",
      "首页和工作台聊天区都支持把图片直接拖进去上传，少点一步文件选择。",
      "工作台里的模型偏好入口已经补回正确位置，可以直接改图片和视频的偏好模型。",
    ],
    fixes: [
      "优化网站流畅性。",
      "增加网站稳定性。",
    ],
    experiments: [
      "工作台里已经接入工作流配方中心骨架，先覆盖导入、smoke test、发布、回滚和放入画板这条主链路，但整体还属于实验阶段。",
      "工作流配方相关的协议、执行器、校验器和预设 recipe 已开始铺底，后面还会继续补运行时细节和更完整的 UI 闭环。",
    ],
  },
  {
    id: "2026-05-12-home-announcement-center",
    date: "2026.05.12 10:30",
    title: "首页现在有系统公告了",
    summary:
      "以后点右上角铃铛，就能直接看到这次到底更新了什么，不用再靠猜。",
    features: [
      "首页右上角的铃铛现在会弹出系统公告窗口。",
      "铃铛有未读公告时，会显示红色小气泡和未读数量。",
      "公告内容会分成新功能、问题修复、实验功能三块来看，一眼就能懂。",
    ],
    fixes: [
      "把过去那种看起来像通知、但其实点了没内容的空按钮补成可用版本了。",
      "首页快捷能力现在和侧边栏用的是同一套能力来源，避免两边显示不一致。",
    ],
    experiments: [
      "公告未读状态目前先存在浏览器本地，适合单机先跑通，后面可以再接后台发布系统。",
    ],
  },
  {
    id: "2026-05-11-home-skill-sync",
    date: "2026.05.11 19:30",
    title: "首页能力入口做了一轮清理",
    summary:
      "把首页里一批已经废弃、容易误导人的旧能力入口清掉了，保留现在真正还在用的。",
    features: [
      "首页快捷能力入口已经按侧边栏当前能力同步。",
      "点首页能力后，会把对应模式和技能一起带进工作台。",
    ],
    fixes: [
      "清掉了大部分已经废弃但还挂在首页上的旧入口，减少误点。",
    ],
    experiments: [
      "后面还会继续把首页和工作台的能力配置抽成统一维护方式，减少重复配置。",
    ],
  },
];

const canUseLocalStorage = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const getReadAnnouncementIds = (): string[] => {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(SYSTEM_ANNOUNCEMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

export const markAllAnnouncementsAsRead = (): string[] => {
  const ids = SYSTEM_ANNOUNCEMENTS.map((item) => item.id);
  if (!canUseLocalStorage()) return ids;
  window.localStorage.setItem(
    SYSTEM_ANNOUNCEMENTS_STORAGE_KEY,
    JSON.stringify(ids),
  );
  return ids;
};

export const getUnreadAnnouncementCount = (): number => {
  const readIds = new Set(getReadAnnouncementIds());
  return SYSTEM_ANNOUNCEMENTS.filter((item) => !readIds.has(item.id)).length;
};
