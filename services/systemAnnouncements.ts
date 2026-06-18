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
    id: "2026-06-18-workspace-sidebar-search-and-conversation-refresh-1",
    date: "2026.06.18 12:20",
    title: "工作台侧边栏这一轮终于更像前台产品了：执行方式真的生效，联网回复也更可验证",
    summary:
      "这次收的不是一两个样式小修，而是把工作台侧边栏、输入区、对话历史、联网回复和发送链路一起重新收了一遍。现在底部输入区更接近前台聊天产品，历史/产出入口回到小浮层，消息支持回填、分支、版本回看和停用态记录；另外之前最影响体感的两个问题也终于补实了：联网检索关闭后不会再偷偷跑预研究，思考模式和快速模式也会真的传到执行链路里，而不是只改个表面开关。联网回复这边也补强了过程、来源和摘录的可见性，至少能更明确看出这轮到底有没有搜、搜到了什么、引用了哪些网页。",
    features: [
      "工作台输入区和底部工具栏重新收成更前台化的结构：模式切换、技能、联网、模型偏好和发送动作都统一到一排里，输入框支持更自然的多行增长和混排回填。",
      "侧边栏对话历史、产出入口和会话卡片交互重做成更轻的小浮层 / 小菜单，补上了重命名、置顶、归档、删除和空态整理，不再一点击就盖成整屏设置板。",
      "消息现在支持版本链路、分支、回填继续编辑、点赞/点踩和失败态恢复提示；停止生成后也会保留执行记录，不再只剩一条生硬报错。",
      "联网回复卡片补上了更明确的研究状态、步骤、来源、摘录和引用展开结构，阅读时更容易判断“真的搜过了什么”和“结论来自哪里”。",
      "Gemini / OpenAI 兼容链路补上了更多 AbortSignal 透传和流式增量处理，停止生成、切换任务和长轮询中断时会更干净，不容易残留假忙碌状态。",
    ],
    fixes: [
      "修复了联网检索关闭后，工作台预研究链路仍可能继续执行网页研究的问题；现在关闭联网后不会再偷偷跑 web 预研究。",
      "修复了思考模式 / 快速模式之前体感上像没生效的问题；现在模式会真实写入 workflowMode，并影响后续执行路径。",
      "修复了研究提取阶段会把明显不适合抽正文的图片、PDF、压缩包和音视频 URL 一起送去 extract 的问题，减少无意义失败和噪音。",
      "修复了带预览图来源的附件在部分回填和发送场景下无法正确补全的问题，输入区图文混排和图片 tag 落位更稳定。",
      "修复了消息卡片、思考过程和研究展开层的一些关闭/层级问题，点弹层外部现在会正常收起，不再容易悬挂在界面上。",
    ],
    experiments: [
      "这一轮把联网回复的“可验证感”先拉到了可用版本，后面还会继续补正文内引用编号、来源悬浮预览和结论到来源的逐条映射。",
      "角色和 skill 这条线目前先做了前台化收口与交互减负，后面还会继续做功能审计，决定哪些能力应该保留、合并或下沉。",
    ],
  },
  {
    id: "2026-06-15-workspace-image-route-cutout-and-auto-size-refresh-1",
    date: "2026.06.15 21:20",
    title: "工作台图片链路这一轮收得更实了：auto 尺寸跟图走，去背景也终于真的透明了",
    summary:
      "这一轮主要收的是几条最伤使用感的图片链路。第一条是 auto 尺寸：关键词节点、参考图生图和部分回写链路以前虽然选了 auto，实际还是容易退回 1:1；现在只要有原图或参考图可用，就会优先按真实比例和尺寸推导 exact size，不再假装 auto。第二条是去背景：侧边栏让 Agent 帮忙抠图、画板图片节点去背景、带 mark 的局部改图，现在都会更明确走透明背景编辑链路，并在结果回来后继续校验是不是真的有透明通道，而不是只拿一个扩展名叫 PNG 的不透明结果糊弄过去。第三条是排查可见性：这次把用户请求、实际路由、最终结果形态也补进了生成 trace，后面再看某一张图为什么走了这个模型、这个路由，会比以前直接很多。",
    features: [
      "工作台图片生成里的 auto 尺寸现在会优先按参考图或原图的真实宽高推导比例和 exact size，不再默认掉回 1:1。",
      "smartEdit 现在同时兼容顶层参数和 Agent 包一层的嵌套 params，去背景、局部改图、带参考图编辑不再因为参数层级不同而跑偏。",
      "带 mark 的图片编辑现在会优先把完整原图、归一化坐标和标记提示一起发给模型，让它更容易准确识别用户真正点中的区域。",
      "生成 trace 现在会补上用户请求快照、实际 transport 路由和结果类型，后面排查 provider 路由、尺寸归一化和任务提交状态会更省事。",
    ],
    fixes: [
      "修复了关键词节点和部分参考图生图在选了 auto 后仍按 1:1 返回的老问题，现在 auto 会尽量跟随参考图尺寸。",
      "修复了侧边栏让 Agent 抠图、画板图片节点去背景时偶尔误走普通改图或风格化链路的问题，现在会更稳定走透明背景编辑。",
      "修复了去背景结果虽然叫 PNG 但实际没有透明通道的情况，现在结果回来后会继续做透明校验，失败就直接报出来。",
      "修复了透明校验以前只认 data URL、不认远程图片 URL 的问题，现在远程结果也会先转成可校验格式再验透明度。",
    ],
    experiments: [
      "不同供应商对透明背景、exact size 和编辑路由的兼容仍有差异，这一轮先把 OpenAI 兼容链路和工作台主路径收稳，后面还会继续观察更多 provider 组合。",
      "现在 trace 已经能看到更多请求与结果快照，后面还会继续补更完整的 route 诊断和失败修复建议，减少靠猜排查的时间。",
    ],
  },
  {
    id: "2026-05-16-workspace-ocr-text-mask-edit-refresh-1",
    date: "2026.05.16 13:32",
    title: "工作台图片改字先上 MVP 了：能识别文字框、局部蒙版改字，还能按模型切换蒙版格式",
    summary:
      "这一轮先把工作台里最核心的一段图片改字链路做成可用 MVP：现在选中图片后，系统会先识别图片里的文字块和位置框，你改动了哪一块文字，就只针对那一块自动生成局部 box mask，再走局部重绘，而不是整张图重做。为了兼容不同模型，这次还补了改字弹窗里的模型选择：如果用 GPT Image 2 这类 GPT 路线，会优先走更贴近官方要求的 alpha 透明蒙版；如果换成其它编辑模型，则继续走黑白蒙版兼容模式。这样至少先把“只改局部字、不大改整图”的使用感拉起来。",
    features: [
      "工作台图片改字现在会先返回文字块和对应位置框，不再只是给一串纯文本识别结果。",
      "你只要改动某一块文字，系统就会只对这块文字自动生成局部 box mask，再发起局部重绘，不再默认整图一起改。",
      "改字弹窗里新增了重绘模型选择，切模型时会直接作用到当前图片元素，后续重试和继续改字会沿用这次选择。",
      "针对 GPT Image 2 / GPT Image 2 All 这类模型，改字蒙版现在会优先使用透明挖空的 alpha 语义；其它模型则继续走黑白蒙版兼容模式。",
    ],
    fixes: [
      "修复了工作台原本图片改字只能按整图提示词重做、局部只改一块字时也容易把整张图一起带偏的问题。",
      "修复了 OCR 结果只有字符串没有框信息的问题，现在改字链路已经能拿到文字块坐标用于自动 mask。",
      "修复了改字相关状态仍按旧 string[] 结构流转的问题，工作台弹窗、工具栏、store 和旧兼容控制器都已统一到文字块结构。",
      "补齐了 text-extract skill 和旧文本编辑控制器对新 OCR block 结构的兼容，避免一边升级一边还有旧链路直接报类型错。",
    ],
    experiments: [
      "这一版先聚焦单块自动 box mask + 局部重绘，后面还会继续观察多行文字、密集排版、斜视透视文字和更复杂字体效果下的稳定性。",
      "当前仓库里仍有一批与本次改字需求无关的历史 TypeScript 报错未顺手清掉，这轮重点先把 OCR 改字 MVP 和 GPT alpha 蒙版兼容打通。",
    ],
  },
  {
    id: "2026-05-15-workspace-tablet-touch-trace-and-image-sizing-refresh-1",
    date: "2026.05.15 19:15",
    title: "工作台这次终于更像平板产品了：触控、节点尺寸和生成追踪一起补齐",
    summary:
      "这一轮收的不是单点小修，而是把工作台几条高频使用链路一起补顺了。第一块是安卓平板触控：现在画布已经支持双指缩放和平移、单指拖节点、空白区框选、端口触控连线，mark 也能直接点按落点，连线还能先点中再断开。第二块是图片节点尺寸：新导入的图、引用上传后的图、生成完成回写的图、Agent 回填到画布的图，都会尽量按原图比例落板，不再都挤成同一种固定尺寸。第三块是可见性和理解链路：生成正式排队时会补一条更明确的 request 日志，最近活动读取也更容易按 requestId / elementId 回看；Agent 收到图文混排和研究上下文时，也会比以前更容易理解你这一轮到底是在问、在查，还是在让它继续执行。",
    features: [
      "安卓平板上的 Workspace 画布现在已经支持双指缩放 / 平移、单指拖动节点、空白区框选、端口触控连线、mark 点按落点和连线点按断开。",
      "图片导入、引用上传、生成回写、Agent 结果入画统一改成按原图比例计算展示尺寸，节点落板不会再全都像同一套模板盒子。",
      "生成中的树节点和画布图片节点现在有更轻量的紧凑态状态卡，未选中时信息更克制，选中后再展开完整进度。",
      "最近生成活动读取现在支持按 requestId / elementId 回退本地 trace，查某一张图为什么这样生成会更直接。",
    ],
    fixes: [
      "修复了安卓平板上原本缺少连续触控生命周期的问题，画布现在能更稳定处理 touch start / move / end，不容易中途丢状态。",
      "修复了工作台里部分图片节点总按固定宽高落板的问题，现在导入、回写和引用上传后的尺寸逻辑已经统一。",
      "修复了生成活动里不够明显看出是否已经真正发出请求的问题，现在会补 request.queued 日志。",
      "修复了 Agent 在图文混排、已上传附件和研究上下文并存时更容易误判输入结构的问题，本轮会带上更完整的 inlineParts 和多模态元数据。",
    ],
    experiments: [
      "这次先把安卓平板的核心画布交互补到可用版本，后面还会继续观察更多手势边界、触控笔场景和长时间连续操作下的稳定性。",
    ],
  },
  {
    id: "2026-05-15-workspace-inline-reference-and-message-reuse-refresh-1",
    date: "2026.05.15 02:00",
    title: "工作台引用插入终于回到正常手感了，还补上了消息一键回填",
    summary:
      "这一轮主要收的是工作台聊天输入区里两个很影响连续操作的问题。第一，之前把光标点到一句话中间后，再去引用画板图片或者用 mark 插入局部引用，chip 经常跑到最前、最后或者奇怪位置；现在这条插入链路已经改回按当前光标位置落点。第二，聊天记录里已经发过的一整段图文混排消息，现在可以直接一键回填到输入框继续改，不用手工重拼。顺手也把后台生图活动流的可见性补强了：视觉编排完成后，什么时候真正发出 request、什么时候开始某一张 variant，都能更直观看到。",
    features: [
      "侧边栏消息现在支持一键“回填到输入框 / 回填”，已经发过的文字 + 引用图 + mark 混排消息可以直接恢复到输入区继续编辑。",
      "输入框里的画板引用图、mark 裁切引用、拖拽/粘贴图片现在会优先按当前光标位置插入，不再默认只往末尾追加。",
      "输入区会持续同步当前文本块和光标位置，后续在一句话中间夹杂多个引用图或局部区域引用时，插入顺序会更稳定。",
      "后台活动流重新补回了更明确的生图请求起点日志，能区分“编排结束”和“真的开始发图了”。",
    ],
    fixes: [
      "修复了工作台里点击文本中间后插入引用图 / mark，结果经常跑到开头、结尾或错位位置的问题。",
      "修复了画板软选图 pending attachment 在确认进入输入区时不看当前光标、只按追加逻辑落位的问题。",
      "修复了旧视觉编排缓存误复用历史 set 方案的问题，抽卡/改单图任务不再更容易沿用过时计划。",
      "修复了最近后台活动记录里不够明显看出是否已经真正发出生图请求的问题。",
    ],
    experiments: [
      "Agent 对图文混排消息的理解链路目前已确认按 input block 顺序发送，后面还会继续观察更多连续插图、多 mark、多轮追问下的稳定性。",
    ],
  },
  {
    id: "2026-05-14-visual-planning-and-gpt-image-sizing-guardrails-refresh-1",
    date: "2026.05.14 22:40",
    title:
      "\u89c6\u89c9\u7f16\u6392\u548c GPT Image 2 \u5c3a\u5bf8\u89c4\u5219\u8fd9\u6b21\u4e00\u8d77\u6536\u7a33\u4e86",
    summary:
      "\u8fd9\u4e00\u8f6e\u4e3b\u8981\u6536\u7684\u662f\u4e24\u4ef6\u4f1a\u76f4\u63a5\u5f71\u54cd\u751f\u56fe\u7ed3\u679c\u7684\u4e8b\u3002\u7b2c\u4e00\u4ef6\u662f\u89c6\u89c9\u7f16\u6392\u4e0d\u518d\u56e0\u4e3a\u201c\u8bf7\u5e2e\u6211\u51fa 4 \u5f20\u201d\u5c31\u8bef\u5224\u6210\u8be6\u60c5\u9875/\u5957\u56fe\u4efb\u52a1\uff0c\u73b0\u5728\u4f1a\u66f4\u504f\u5411\u8bc6\u522b\u201c\u540c\u4e00\u76ee\u6807\u7684\u5019\u9009\u56fe/\u62bd\u5361\u53d8\u4f53\u201d\uff0c\u53ea\u6709\u771f\u6b63\u51fa\u73b0\u591a\u9875\u804c\u8d23\u3001\u5957\u56fe\u7ed3\u6784\u6216\u660e\u786e\u9875\u9762\u5206\u5de5\u65f6\u624d\u4f1a\u8fdb set mode\u3002\u7b2c\u4e8c\u4ef6\u662f gpt-image-2 \u548c gpt-image-2-all \u7684\u6bd4\u4f8b/\u5206\u8fa8\u7387\u9009\u62e9\u7ec8\u4e8e\u8ddf\u5b9e\u9645\u8bf7\u6c42\u5bf9\u9f50\uff1a\u4e0d\u7b26\u5408\u5b98\u65b9\u7ea6\u675f\u7684\u76f4\u63a5\u53d8\u7070\u4e0d\u53ef\u9009\uff0c\u7b26\u5408\u5b98\u65b9\u4f46\u4e0d\u5728\u4e91\u96fe\u6587\u6863\u6807\u51c6\u5c3a\u5bf8\u91cc\u7684\u4f1a\u6807\u9ec4\uff0c\u800c\u4e14\u524d\u7aef\u770b\u5230\u7684\u771f\u5b9e\u5c3a\u5bf8\u5df2\u7ecf\u548c\u6700\u7ec8\u53d1\u7ed9\u6a21\u578b\u7684 size \u4fdd\u6301\u4e00\u81f4\u3002",
    features: [
      "\u89c6\u89c9\u7f16\u6392\u73b0\u5728\u4f1a\u660e\u786e\u533a\u5206\u201c\u5957\u56fe/\u591a\u9875\u4ea4\u4ed8\u201d\u548c\u201c\u540c\u76ee\u6807\u591a\u5f20\u5019\u9009\u56fe\u201d\uff0c\u62bd 4 \u5f20\u3001\u5019\u9009\u65b9\u6848\u3001variation \u8fd9\u7c7b\u8bf7\u6c42\u4e0d\u4f1a\u518d\u9ed8\u8ba4\u62c6\u6210\u9875\u9762\u804c\u8d23\u3002",
      "\u8be6\u60c5\u9875/\u5957\u56fe\u7684\u5224\u65ad\u6539\u6210\u66f4\u4e25\u683c\u7684\u663e\u5f0f\u5173\u952e\u8bcd\u548c\u9875\u9762\u89d2\u8272\u68c0\u6d4b\uff0c\u50cf\u201c\u5c01\u9762\u4e3b\u89c6\u89c9\u3001\u6838\u5fc3\u5356\u70b9\u3001\u529f\u80fd\u7ec6\u8282\u3001\u4f7f\u7528\u573a\u666f\u201d\u8fd9\u7c7b\u7ec4\u5408\u51fa\u73b0\u65f6\u624d\u4f1a\u66f4\u79ef\u6781\u5730\u8fdb set mode\u3002",
      "gpt-image-2 \u548c gpt-image-2-all \u7684 1K / 2K / 4K \u6620\u5c04\u73b0\u5728\u6536\u655b\u5230\u540c\u4e00\u4efd\u89c4\u5219\u8868\uff0c\u524d\u7aef\u9009\u62e9\u3001\u663e\u793a\u5c3a\u5bf8\u3001\u6700\u7ec8\u8bf7\u6c42 size \u5df2\u7ecf\u4e0d\u518d\u5404\u8d70\u5404\u7684\u3002",
      "gpt-image-2 \u7cfb\u5217\u4e0b\uff0c\u4e0d\u7b26\u5408\u5b98\u65b9\u7ea6\u675f\u7684\u6bd4\u4f8b\u4f1a\u53d8\u7070\u4e0d\u53ef\u9009\uff1b\u7b26\u5408\u5b98\u65b9\u4f46\u4e0d\u5728\u4e91\u96fe\u6587\u6863\u6807\u51c6\u5c3a\u5bf8\u5217\u8868\u91cc\u7684\u6863\u4f1a\u6807\u9ec4\u63d0\u793a\u3002",
      "\u5de5\u4f5c\u53f0\u6d88\u606f\u533a\u7684\u7528\u6237\u6c14\u6ce1\u5bbd\u5ea6\u548c\u53f3\u4fa7\u5bf9\u9f50\u4e5f\u987a\u624b\u6536\u4e86\u4e00\u8f6e\uff0c\u957f\u6d88\u606f\u548c\u5feb\u6377\u64cd\u4f5c\u5361\u7247\u73b0\u5728\u66f4\u7a33\u5b9a\u3002",
    ],
    fixes: [
      "\u4fee\u590d\u4e86\u8bf7\u6c42 4 \u5f20\u56fe\u65f6\u5bb9\u6613\u88ab\u7f16\u6392\u5668\u8bef\u89e3\u6210\u201c\u56db\u9875\u5957\u56fe\u201d\u7684\u95ee\u9898\uff0c\u907f\u514d\u7ed9\u4f60\u62c6\u51fa\u672c\u6765\u6ca1\u60f3\u8981\u7684\u9875\u9762\u804c\u8d23\u3002",
      "\u4fee\u590d\u4e86 gpt-image-2 \u7cfb\u5217\u4e4b\u524d\u4f1a\u628a\u4e0d\u5408\u89c4\u6bd4\u4f8b\u6084\u6084\u964d\u7ea7\u6210 16:9 \u6216 9:16 \u53d1\u51fa\u53bb\u7684\u95ee\u9898\uff0c\u73b0\u5728 UI \u548c\u8bf7\u6c42\u5c42\u7684\u771f\u5b9e\u884c\u4e3a\u5df2\u7ecf\u5bf9\u9f50\u3002",
      "\u4fee\u6b63\u4e86\u82e5\u5e72 2K / 4K \u6863\u4f4d\u4e0b\u4e0d\u7b26\u5408 16 \u50cf\u7d20\u5bf9\u9f50\u3001\u6700\u5927\u8fb9\u957f\u6216\u4e91\u96fe\u6587\u6863\u6807\u51c6\u9009\u9879\u7684\u5206\u8fa8\u7387\u6620\u5c04\u3002",
      "\u8865\u9f50\u4e86 gpt-image-2 \u548c gpt-image-2-all \u7684\u9ec4\u6807\u63d0\u793a\u6587\u6848\uff0c\u7528\u6237\u73b0\u5728\u80fd\u770b\u51fa\u201c\u5b98\u65b9\u53ef\u7528\u4f46\u4f9b\u5e94\u5546\u6587\u6863\u672a\u5217\u660e\u6807\u51c6\u652f\u6301\u201d\u8fd9\u79cd\u7070\u533a\u72b6\u6001\u3002",
    ],
    experiments: [
      "\u4e91\u96fe\u5bf9 gpt-image-2 \u7cfb\u5217\u7684\u6807\u51c6\u5c3a\u5bf8\u5217\u8868\u76ee\u524d\u4ecd\u7136\u662f\u6309\u6587\u6863\u767d\u540d\u5355\u505a\u6807\u9ec4\uff0c\u540e\u9762\u8fd8\u53ef\u4ee5\u7ee7\u7eed\u89c2\u5bdf\u5b9e\u9645\u63a5\u53e3\u80fd\u529b\u548c\u955c\u50cf\u5dee\u5f02\u518d\u51b3\u5b9a\u662f\u5426\u653e\u5bbd\u3002",
      "\u8fd9\u4e00\u8f6e TypeScript \u5168\u4ed3\u4ecd\u6709\u4e00\u6279\u65e7\u62a5\u9519\u672a\u987a\u624b\u6e05\u7406\uff0c\u8fd9\u6b21\u5148\u628a\u89c6\u89c9\u7f16\u6392\u5224\u65ad\u3001GPT Image 2 \u7ea6\u675f\u548c\u5de5\u4f5c\u53f0\u9009\u62e9\u4f53\u9a8c\u6536\u7a33\u3002",
    ],
  },
  {
    id: "2026-05-14-workspace-main-brain-visual-reference-fix-1",
    date: "2026.05.14 21:15",
    title: "Agent 终于能看懂你插进对话里的图片和 mark 引用了",
    summary:
      "这次补的是工作台里一个很影响使用感的真实问题：明明已经把图片插进对话框，或者已经在画布上 mark 了局部区域，Agent 回复时却还像没收到素材一样继续让你上传。现在这条链路已经补通，画布选图、插入图片、mark 裁切引用不再只是在输入区显示一个 chip，而是会作为真实附件和视觉上下文一起发给 Agent。也就是说，后续让 Agent 看图、改图、回答局部问题时，它终于能真正读到你眼前插进去的那张图和那块区域。",
    features: [
      "工作台对话发送时，画布插入图片、mark 区域引用、普通上传图片现在会统一进入同一套附件发送链路，不再各走各的。",
      "Agent 在聊天问答态下现在可以同时拿到真实附件和对应的视觉上下文，处理“看这张图”“改这个区域”“参考这块位置”这类请求会稳定很多。",
      "mark 引用在发送前会尽量补成真实可传输图片文件，不再只是界面里可见、链路里却丢失的占位 chip。",
    ],
    fixes: [
      "修复了工作台 Agent 识别不到插入图片的问题：以前输入框里明明有图片 chip，但发送时画布来源附件会被提前过滤掉。",
      "修复了 mark 引用看得见却传不过去的问题：局部裁切引用现在会和 marker 信息一起进入 Agent 请求。",
      "修复了聊天态下附件存在时参考上下文被过度清空的问题，避免 Agent 把当前视觉输入误判成“缺少素材”。",
    ],
    experiments: [
      "这次先把 Agent 读图链路补通，后面还会继续观察更多外链图、跨会话引用和连续多轮追问下的稳定性。",
    ],
  },
  {
    id: "2026-05-14-style-library-center-launch-and-style-generation-refresh-1",
    date: "2026.05.14 18:50",
    title: "风格库中心正式上线：导入、编辑、应用、生图测试都收进一套闭环了",
    summary:
      "这一轮把风格库相关链路做成了真正可用的产品闭环，不再是散落在节点和导入页里的半成品。现在站内已经有独立的风格库中心入口，可以从 GPT 画廊导入风格卡片，也可以新建自己的风格卡片；编辑器收敛成样图、关键词 Prompt、标签、风格说明四件事，并支持直接用当前关键词做样图测试。工作台关键词节点选中风格后，风格卡片的参考图、固定 Prompt、标签和风格说明也会真正参与后续生图，不再只是挂名选择。",
    features: [
      "新增独立的风格库中心入口，侧边栏和路由都已接通，可以单独浏览、编辑和经营风格卡片。",
      "GPT 画廊已重构成更完整的导入向导，导入风格时会沿用现成 Prompt、标签和封面，而不是再手工抄一遍。",
      "风格卡片编辑器已经改成卡片化最小闭环：只保留样图、关键词 Prompt、标签、风格说明，并支持点击缩略图切换封面、删除单张样图。",
      "风格卡片里新增“生成样图”面板，可以直接选模型、填关键词、选比例和数量，用纯文生图测试关键词效果，生成结果会自动回写到样图列表。",
      "风格说明的 AI 设定已外置，你现在可以直接改外部规则文件来控制说明生成风格，而不用再翻页面代码。",
      "工作台关键词节点选中风格后，风格卡片的参考图、固定 Prompt、标签、风格说明和模板约束都会真正注入到后续生图链路。",
    ],
    fixes: [
      "修复了风格卡片 AI 分析和风格说明生成有时走错模型路由的问题，现在会优先遵循全局多模态/视觉编排模型配置。",
      "修复了从画廊导入卡片后，编辑器按钮会整段时间灰掉不可操作的问题。",
      "修复了‘AI 生成风格说明’转完圈却没有任何输出的情况；当模型返回空说明或被外部设定冲掉 JSON 时，现在会有兜底和明确提示。",
      "修复了风格卡片选中后对实际生图影响太弱的问题，现在风格参考图和模板约束会进入真实生成链路。",
      "修复了画廊封面这类外链图后续进入风格参考图链路时容易反复触发 CORS 噪声的问题；导入时会优先尝试把外链封面转成可复用的本地 data URL。",
      "样图测试生图遇到服务商 429 限流时，现在会直接给出可读提示，而不是只在控制台里刷一堆原始错误。",
    ],
    experiments: [
      "风格说明的最终质感还会继续调，现在虽然已经支持外部设定文件，但仍会继续朝更接近产品级视觉原则描述的方向优化。",
      "外链图的本地化与参考图缓存这条链路已经先打通基础版本，后面还会继续观察更多图床和更多供应商组合下的稳定性。",
    ],
  },
  {
    id: "2026-05-13-style-library-governance-and-planning-override-refresh-1",
    date: "2026.05.13 18:35",
    title: "风格库和编排优先级重新理顺了：可锁风格、可禁编排、导入也更像原效果",
    summary:
      "这一轮主要把风格库在工作台里的控制权重新理顺了，避免你明明选中了自己的风格，生图前编排又把它改写成另一套东西。现在风格库可以在详情里单独设置“禁用编排”，开启后会直接按这套风格、提示词和参考图生成，不再被全局编排覆盖；从画廊或 GPT-Image 灵感里转换过来的风格库也会默认关闭编排，尽量先保住原始关键词骨架和视觉效果。同时顺手补了风格导入保真、角色管理和消息展示的一些体验整理。",
    features: [
      "风格库详情里新增了“禁用编排”开关，开启后当前风格会强制跳过生图前视觉编排，直接按风格库、关键词和参考图生成。",
      "风格库未禁用编排时，才会继续遵循全局“生图前视觉编排”开关，不再互相打架。",
      "从画廊或 GPT-Image 灵感内容转换出来的风格库现在默认禁用编排，优先保留原始提示词骨架、镜头关系和风格语气。",
      "风格库导入链路现在会显式保留 prompt backbone，并把它接进后续规划器和 prompt composer，而不是只留下泛化说明。",
      "消息区里的固定副描述已收掉，只保留更干净的主内容和思考过程入口；角色管理也补上了头像等更完整的编辑能力。",
    ],
    fixes: [
      "修复了已选中的用户风格库会在生图前编排阶段被整套改写、覆盖原有风格身份的问题。",
      "修正了风格导入后内容过度泛化、看起来不像原案例关键词效果的问题，导入结果会更偏可复用风格预设而不是二次解释稿。",
      "补齐了风格库的本地/远端存储归一化字段，避免禁用编排和 prompt backbone 只在部分链路生效。",
      "优化了工作台里风格卡片、消息卡片和若干面板文案，让状态提示更接近真实执行逻辑。",
    ],
    experiments: [
      "当前“禁用编排”是按风格库粒度生效，后面还会继续观察是否要再补更细的“只禁 style rewrite、不禁任务拆页”这类半编排模式。",
      "仓库里仍有一批与这次需求无关的历史 TypeScript 报错未一并清理，这轮重点先放在风格治理、生图优先级和导入保真。",
    ],
  },
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
    title: "侧边栏 Agent 重构已验收，公告未读也修好了",
    summary:
      "这一轮把工作台侧边栏从容易抢执行、容易假反馈的状态，真正收回成一个先聊天、先理解、先记住上下文的 Agent 入口；同时也把公告未读提示的底层判断补好了，以后不是只要看过一次公告，后面新加内容就一直不再提示。",
    features: [
      "工作台侧边栏现在已经明确回到 chat-first，用户的自然语言输入会先交给 Agent 理解，不再一上来就被执行链路抢走。",
      "侧边栏执行链路已经补上品牌摘要、会话约束、参考图语义和 topic pinned context 的桥接，后续继续生图时不会再像没记住上下文。",
      "侧边栏里的执行确认、执行记录、判断说明已经统一成一套展示契约，不再这里一个标准、那里一个标准。",
      "输入区模式入口已经收敛成 Agent 对话、图片任务、视频任务，Agent 人格重新回到默认前台。",
      "Workflow Recipe Phase 3 的导入 / 测试区 / 发布区骨架说明文档已经回写为完成状态。",
    ],
    fixes: [
      "修复了系统公告未读提示失效的问题：以前只要打开过一次公告，后面即使加了新公告也可能继续被当成已读。",
      "公告已读状态现在不再只看单一 id，而是按公告标识和内容信息组合判断，后续新增或更新公告时会重新出现未读提示。",
      "侧边栏里残留的执行代理、思考过程、图像生成器、视频生成器等错误心智文案已经进一步清理。",
    ],
    experiments: [
      "工作流配方后续还会继续补分享、导出、导入闭环与兼容校验 UI，这一轮完成的是 Phase 3 骨架和状态回写，不是整条产品线的终点。",
      "原子能力节点、schema 驱动配置面板和单节点执行写回仍在后续排期里，当前先把 Agent 侧边栏与配方骨架两条高频链路收稳。",
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
