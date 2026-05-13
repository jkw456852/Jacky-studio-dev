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
  "jkai-system-announcements-read-v2";
export const SYSTEM_ANNOUNCEMENTS_SYNC_EVENT =
  "jkai-system-announcements-sync";

const buildAnnouncementReadKey = (announcement: SystemAnnouncement): string =>
  [announcement.id, announcement.date, announcement.title].join("::");

const normalizeStoredReadEntries = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const hasAnnouncementBeenRead = (
  readEntries: Set<string>,
  announcement: SystemAnnouncement,
): boolean =>
  readEntries.has(buildAnnouncementReadKey(announcement)) ||
  readEntries.has(announcement.id);

// Push 前把最新公告加到最前面，内容尽量用最直白的人话写清楚。
export const SYSTEM_ANNOUNCEMENTS: SystemAnnouncement[] = [
  {
    id: "2026-05-13-workspace-visual-planning-reuse-and-toolbar-refresh-1",
    date: "2026.05.13 12:32",
    title: "工作台生图链路重做了一轮：可复用视觉编排，也能一键跳过",
    summary:
      "这一轮主要把工作台里的生图前视觉编排链路做了减法和提速：当关键词节点的提示词、参考图和关键生成参数没变时，后续重复生图会优先沿用第一次的视觉编排结果；如果你只想直接按当前关键词出图，也可以在顶部一致性面板里把‘生图前视觉编排’关掉，直接跳过编排。顺手也把一致性开关默认值、顶部工具栏入口和相关面板排版一起收了一遍。",
    features: [
      "工作台顶部一致性面板新增了‘生图前视觉编排’开关，默认开启，关闭后会直接使用当前关键词和参考图生图。",
      "当父级关键词节点的提示词、参考图和关键生成参数没有变化时，重复点击生图会优先复用最近一次视觉编排结果，大幅提升多次抽卡的生成时间。",
      "一致性检测现在默认关闭，首次进入工作台不会默认强制按锚点做一致性质检。",
      "底部工具栏里的‘电商工作流’入口已经移除，保留聊天里的电商工作流消息组件，不再和主生图工具栏混在一起。",
    ],
    fixes: [
      "修复了工作台生图时把内部视觉编排播报直接刷到聊天窗口里的问题，这类内部过程现在优先留在节点本地状态里。",
      "修正了顶部一致性面板里两个开关的排版，处理了开关出界、顺序不对、标题不齐和多余方框的问题。",
      "补了一层同源请求锁和进行中规划复用，尽量避免用户连续快点时并发起多轮相同视觉编排。",
    ],
    experiments: [
      "目前这套视觉编排复用仍主要按关键词、参考图和关键生成参数做命中判断，后面还会继续观察并发点击、缓存时机和跨节点复用的稳定性。",
      "工作台里还有一批与本次需求无关的历史 TypeScript 报错未顺手收口，这轮重点先放在生图链路、顶部面板和入口清理。",
    ],
  },
  {
    id: "2026-05-13-sidebar-main-brain-refactor-and-announcement-unread-fix-refresh-1",
    date: "2026.05.13 09:35",
    title: "侧边栏主脑重构已验收，公告未读也修好了",
    summary:
      "这一轮把工作台侧边栏从容易抢执行、容易假反馈的状态，真正收回成一个先聊天、先理解、先记住上下文的主脑入口；同时也把公告未读提示的底层判断补好了，以后不是只要看过一次公告，后面新加内容就一直不再提示。",
    features: [
      "工作台侧边栏现在已经明确回到 chat-first，用户的自然语言输入会先交给主脑理解，不再一上来就被执行链路抢走。",
      "侧边栏执行链路已经补上品牌摘要、会话约束、参考图语义和 topic pinned context 的桥接，后续继续生图时不会再像没记住上下文。",
      "侧边栏里的执行确认、执行记录、判断说明已经统一成一套展示契约，不再这里一个标准、那里一个标准。",
      "输入区模式入口已经收敛成主脑对话、图片任务、视频任务，主脑人格重新回到默认前台。",
      "Workflow Recipe Phase 3 的导入 / 测试区 / 发布区骨架说明文档已经回写为完成状态。",
    ],
    fixes: [
      "修复了系统公告未读提示失效的问题：以前只要打开过一次公告，后面即使加了新公告也可能继续被当成已读。",
      "公告已读状态现在不再只看单一 id，而是按公告标识和内容信息组合判断，后续新增或更新公告时会重新出现未读提示。",
      "侧边栏里残留的执行代理、思考过程、图像生成器、视频生成器等错误心智文案已经进一步清理。",
    ],
    experiments: [
      "工作流配方后续还会继续补分享、导出、导入闭环与兼容校验 UI，这一轮完成的是 Phase 3 骨架和状态回写，不是整条产品线的终点。",
      "原子能力节点、schema 驱动配置面板和单节点执行写回仍在后续排期里，当前先把主脑侧边栏与配方骨架两条高频链路收稳。",
    ],
  },
  {
    id: "2026-05-12-evening-workspace-style-plaza-and-account-updates-refresh-1",
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
    id: "2026-05-12-projects-announcement-and-workspace-updates-refresh-1",
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
    id: "2026-05-12-home-announcement-center-refresh-1",
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
    id: "2026-05-11-home-skill-sync-refresh-1",
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

const notifyAnnouncementSync = (): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SYSTEM_ANNOUNCEMENTS_SYNC_EVENT));
};

export const getReadAnnouncementIds = (): string[] => {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(SYSTEM_ANNOUNCEMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeStoredReadEntries(parsed);
  } catch {
    return [];
  }
};

export const markAllAnnouncementsAsRead = (): string[] => {
  const readKeys = SYSTEM_ANNOUNCEMENTS.map((item) =>
    buildAnnouncementReadKey(item),
  );
  if (!canUseLocalStorage()) return readKeys;
  window.localStorage.setItem(
    SYSTEM_ANNOUNCEMENTS_STORAGE_KEY,
    JSON.stringify(readKeys),
  );
  notifyAnnouncementSync();
  return readKeys;
};

export const subscribeAnnouncementUnreadUpdates = (
  callback: () => void,
): (() => void) => {
  if (typeof window === "undefined") return () => {};

  const handleWindowSync = () => callback();
  const handleVisibilityChange = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      callback();
    }
  };

  window.addEventListener("focus", handleWindowSync);
  window.addEventListener("storage", handleWindowSync);
  window.addEventListener(
    SYSTEM_ANNOUNCEMENTS_SYNC_EVENT,
    handleWindowSync as EventListener,
  );
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  return () => {
    window.removeEventListener("focus", handleWindowSync);
    window.removeEventListener("storage", handleWindowSync);
    window.removeEventListener(
      SYSTEM_ANNOUNCEMENTS_SYNC_EVENT,
      handleWindowSync as EventListener,
    );
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };
};

export const getUnreadAnnouncementCount = (): number => {
  const readEntries = new Set(getReadAnnouncementIds());
  return SYSTEM_ANNOUNCEMENTS.filter(
    (item) => !hasAnnouncementBeenRead(readEntries, item),
  ).length;
};
