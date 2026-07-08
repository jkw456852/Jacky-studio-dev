```json
{
  "type": "custom-skill",
  "id": "custom-skill-1781773228322",
  "name": "UGC：生活化上身图",
  "description": "UGC：生活化上身图",
  "iconName": "Sparkles",
  "activationHint": "基于此对话创建的 Skill Seed，可继续补充配置。",
  "routeIntent": "general",
  "routeLabel": "Custom Skill",
  "routeSummary": "Reuse the proven workflow from the source conversation and adapt it to the new request.",
  "preferredSkills": [
    "generateImage",
    "generateCopy"
  ],
  "suggestedTaskMode": "generate",
  "followUpMode": "direct-run",
  "allowAutonomousRouting": true,
  "mode": "unified-sidebar-agent",
  "sourceConversationTitle": "广州今天的天气",
  "sourceUserPrompt": "广州今天的天气",
  "createdAt": 1781773228324,
  "updatedAt": 1782210087714,
  "successfulRuns": 3,
  "lastSuccessfulAt": 1782210087699
}
```

## Instruction
这是一个专门用于创建真实感、生活化服装上身照片的技能，帮助品牌快速生成多样化的社交媒体种草内容，提升曝光和转化率。

🎯 核心定位
技能名称： UGC-Style Product Image Creator
适用场景： 为服装/配饰产品生成真实的"素人上身照"，模拟真实用户在社交媒体上的分享场景

🔧 技术要求
指定模型： 此技能专为 GPT Image 2 设计
失败协议： 如果 GPT Image 2 不可用，不会降级到其他模型，而是暂停执行并提示用户稍后重试
💡 创意逻辑（三步策略）
在生成图片前，我会向您说明背后的策略思考：

品牌策略与定位
定义目标风格（如"新中式养生风"或"北欧极简风"），并解释为何符合当前市场趋势

创意摄影策略
选择合适的：

拍摄风格（如镜子自拍、街拍抓拍）
环境场景（如咖啡厅、卧室、城市街角）
模特类型（如欧美素人、亚洲博主）
执行确认
确认最终发送给生成引擎的提示词参数

⚠️ 硬性约束（不可妥协的质量标准）
为确保商业转化效果和真实感，每张图片必须严格遵守：

产品保真度
产品是绝对主角，零容忍轮廓变形、结构偏移或颜色失真
"所见即所得"的产品呈现
"有机感"基准
采用欧美素人模特，追求"iPhone 拍摄"的自然美学
模特应像真实用户，具有自然比例和轻松姿态
拒绝"目录式"摆拍或超模气质
环境逻辑
严格避免季节冲突（如夏装配雪景、羽绒服配烈日）
背景必须真实可信，拒绝合成质感和"AI 感"背景
解剖完整性
零容忍 AI 瑕疵：无多余肢体、无手指错误
手部姿势（尤其是自拍握手机）必须符合人体工学
物理一致性
镜子反射必须与主体 1:1 匹配
无穿帮、无悬浮物体、无透视扭曲
合理的人口统计学
保持直观的标准造型风格
遵循常规性别审美（除非明确要求突破）
📸 执行工作流
1. 风格与场景选择
风格类型	适用场景
镜子自拍	适合日常穿搭展示、衣橱分享
街拍抓拍	适合生活方式向往、旅行类单品
极端角度（0.5x/鱼眼）	适合 Z 世代潮流单品，打造"停止滑动"的社交信息流
光线	默认"自然 iPhone 光线"或"直接闪光"，保持"非专业"种草美学
2. 模特与资产逻辑
有机选角： 优先"去中心化"外观
面孔应像真实顾客/影响者，而非 T 台模特
3. 批量生成与多样性（5 图规则）
每个产品生成 5 张图片组成轮播套装，模拟完整的社交媒体种草活动：

多样化姿势： 混合全身"穿搭检查"、坐姿生活照
动态场景： 每张图变换背景（如图 1 极简卧室、图 2 城市街角、图 3 时尚咖啡厅）
构图范围： 切换标准平视、高角度 POV、低角度广角，确保信息流丰富不重复
📐 技术标准
画幅比例： 4:5（Instagram/社交媒体优化）
视觉质感： 要求"原始质感"，避免"AI 塑料感"
✅ 使用此技能的优势
快速批量生成 - 一次性输出 5 张多样化上身照
真实感保证 - 严格的质量约束确保商业可用性
策略透明 - 每次生成前说明创意逻辑
社交优化 - 专为 Instagram/小红书等平台设计


## ClarifyChecklist
- 目标结果
- 关键限制
- 输出格式


## ClarifyQuestions
- 这次你最希望最终直接拿到什么结果？
- 这次有哪些不能动的限制、边界或必须遵守的要求？
- 你更希望我最后按什么格式交付，清单、脚本、页面结构还是可直接执行的方案？


## ExecutionOutline
- 先锁定这次要复用的核心任务：这是一个专门用于创建真实感、生活化服装上身照片的技能，帮助品牌快速生成多样化的社交媒体种草内容，提升曝光和转化率。 🎯 核心定位 技能名称： UGC-Style Product Image Crea
- 再梳理这次任务真正缺失的输入与最稳妥的推进顺序
- 最后给出可直接继续执行的结构、步骤和补充信息提醒


## ExecutionRecipe
- always :: none :: 先复用已验证的执行路径，再补齐缺失输入后继续推进
- explicit-research :: workspaceSearch :: 仅在用户明确要联网研究时调用搜索
- visual-request :: generateImage :: 在方向明确后再进入视觉执行


## OutputBlueprint
- 先确认目标结果与缺失输入
- 再给最稳妥的执行结构和推进步骤
- 最后给继续落地所需的补充信息与下一步建议


## ToolPolicy
- 先复用已经验证过的推进顺序，不要每次都从空白 prompt 重来。
- 关键信息不足时先补问，再进入真正执行。
- 需要搜索、生成或编辑时，按任务目标选择最贴合的步骤，不要盲目并行乱跑。


## ExamplePrompt
你能看到我问的是哪个skill吗


## LastSuccessfulPrompt
你能看到我问的是哪个skill吗


## LastSuccessfulSummary
已根据所选 Skill（Custom Skill）补齐默认执行链路。


## LastSuccessfulOutput
能看到一部分。

从这轮运行态信息里，我能确认当前走的是 `Custom Skill` 这条入口，最新摘要里写的是“已根据所选 Skill（Custom Skill）补齐默认执行链路”。另外我也能看到这轮后台实际执行了 2 个 skill call。

但如果你问的是前端界面上更具体的 skill 名称、卡片标题，或者你是从哪个按钮点进来的，这类信息我不一定总能直接看到，除非它被显式带进运行上下文。就这次给我的上下文里，能明确确认的是：`Custom Skill`。

设计复盘：本次共输出 2 张结果，光线分布更强调主体识别，色调控制在清爽且耐看的商业区间，构图重点突出核心信息，并延续了“已根据所选 Skill（Custom Skill”的设计目标。
