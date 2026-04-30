export const STUDIO_REGISTRY_MANIFEST = {
  "version": 1,
  "generatedAt": "2026-04-30T07:24:00.519Z",
  "sourceRoot": "studio-assets",
  "primaryAgentIds": [
    "cameron",
    "campaign",
    "coco",
    "motion",
    "package",
    "poster",
    "prompt-optimizer",
    "vireo"
  ],
  "sharedInstructions": {
    "imagenGoldenFormula": "# Imagen 3.0 Prompting Standard (GOLDEN FORMULA)",
    "jsonRules": "CRITICAL: You MUST respond with ONLY valid JSON. Do NOT include markdown code blocks or any text before/after the JSON.",
    "interactionRules": "# Interaction Principles",
    "corePlanningBrain": "# Shared Core Brain",
    "deliverableDecompositionBrain": "# Shared Deliverable Decomposition",
    "planningSelfCheckBrain": "# Shared Planning Self-Check",
    "unifiedAgentBrain": "# Shared Core Brain\n# Shared Deliverable Decomposition\n# Shared Planning Self-Check\n# Role Overlay Principle\n- 你们本质上共享同一个底层脑子。当前角色只是任务覆盖层，决定你的专业偏向、输出风格与可调用能力，不改变你的基础思考质量。\n- 先用统一脑子思考，再用当前角色语气、领域知识和工具规则完成输出。"
  },
  "routing": {
    "rules": [
      {
        "keywords": [
          "logo",
          "vi",
          "品牌",
          "标志",
          "商标",
          "brand",
          "视觉识别",
          "品牌手册",
          "色彩系统"
        ],
        "agent": "vireo",
        "priority": 2,
        "label": "品牌/VI/Logo"
      },
      {
        "keywords": [
          "故事板",
          "分镜",
          "九宫格",
          "分镜图",
          "storyboard",
          "脚本",
          "剧本",
          "镜头",
          "shot list",
          "场景设计",
          "体验",
          "氛围"
        ],
        "agent": "cameron",
        "priority": 1,
        "label": "故事板/分镜"
      },
      {
        "keywords": [
          "包装",
          "package",
          "packaging",
          "礼盒",
          "瓶身",
          "标签",
          "盒子",
          "瓶子",
          "罐子",
          "unboxing"
        ],
        "agent": "package",
        "priority": 10,
        "label": "包装设计"
      },
      {
        "keywords": [
          "动画",
          "motion",
          "动效",
          "gif",
          "animation",
          "视频",
          "video",
          "片头",
          "转场",
          "vfx",
          "3d动画"
        ],
        "agent": "motion",
        "priority": 4,
        "label": "动效/视频/动画"
      },
      {
        "keywords": [
          "营销",
          "campaign",
          "推广",
          "电商",
          "亚马逊",
          "amazon",
          "副图",
          "listing",
          "主图",
          "详情图",
          "shopify",
          "淘宝",
          "天猫",
          "小红书",
          "一套",
          "一组",
          "系列",
          "套图"
        ],
        "agent": "campaign",
        "priority": 5,
        "label": "电商/营销/多图系列"
      },
      {
        "keywords": [
          "海报",
          "poster",
          "banner",
          "宣传",
          "广告",
          "传单",
          "社交媒体",
          "instagram",
          "朋友圈",
          "封面",
          "邀请函",
          "贺卡",
          "名片",
          "证书",
          "节日",
          "春节",
          "新年",
          "圣诞",
          "中秋"
        ],
        "agent": "poster",
        "priority": 6,
        "label": "海报/单图设计"
      },
      {
        "keywords": [
          "设计",
          "做",
          "生成",
          "画",
          "制作",
          "创作",
          "帮我",
          "图片",
          "图",
          "海报",
          "卡片",
          "素材",
          "风格",
          "一个",
          "几张"
        ],
        "agent": "poster",
        "priority": 99,
        "label": "通用设计请求"
      }
    ],
    "editKeywords": [
      "换成",
      "改成",
      "改为",
      "替换",
      "修改",
      "调整",
      "变成",
      "去掉",
      "删除",
      "移除",
      "加上",
      "添加",
      "放大",
      "缩小",
      "旋转",
      "翻转",
      "裁剪",
      "去背景",
      "换背景",
      "换颜色",
      "改颜色",
      "变色",
      "粉色",
      "红色",
      "蓝色",
      "绿色",
      "黑色",
      "白色",
      "不要",
      "抠图",
      "高清",
      "放大画质",
      "upscale",
      "remove",
      "replace",
      "change",
      "edit",
      "modify",
      "recolor"
    ],
    "chatPatterns": [
      "^(你好|hi|hello|hey|哈喽|早上好|下午好|晚上好|早安|晚安)",
      "^(谢谢|感谢|thanks|thank you|thx)",
      "^(再见|拜拜|bye|goodbye)",
      "^(好的|ok|okay|嗯|明白|了解|收到)",
      "^(你是谁|你叫什么|介绍一下|你能做什么|帮助|help)",
      "^(怎么用|如何使用|教我|指导)"
    ],
    "vaguePatterns": [
      "^(帮我|帮忙|我想|我要|我需要).*(做|弄|搞|整).*(东西|什么|啥)?$",
      "^(设计|做).*(一个|一下|点)?$",
      "^(有什么|能做什么|可以做什么)"
    ],
    "promptBlock": "## 3. 品牌/VI/Logo → Vireo\n触发词：logo、vi、品牌、标志、商标、brand、视觉识别、品牌手册、色彩系统\n→ targetAgent: \"vireo\"\n\n## 4. 故事板/分镜 → Cameron\n触发词：故事板、分镜、九宫格、分镜图、storyboard、脚本、剧本、镜头、shot list、场景设计、体验、氛围\n→ targetAgent: \"cameron\"\n\n## 5. 包装设计 → Package\n触发词：包装、package、packaging、礼盒、瓶身、标签、盒子、瓶子、罐子、unboxing\n→ targetAgent: \"package\"\n\n## 6. 动效/视频/动画 → Motion\n触发词：动画、motion、动效、gif、animation、视频、video、片头、转场、vfx、3d动画\n→ targetAgent: \"motion\"\n\n## 7. 电商/营销/多图系列 → Campaign\n触发词：营销、campaign、推广、电商、亚马逊、amazon、副图、listing、主图、详情图、shopify、淘宝、天猫、小红书、一套、一组、系列、套图\n→ targetAgent: \"campaign\"\n\n## 8. 海报/单图设计 → Poster\n触发词：海报、poster、banner、宣传、广告、传单、社交媒体、instagram、朋友圈、封面、邀请函、贺卡、名片、证书、节日、春节、新年、圣诞、中秋\n→ targetAgent: \"poster\""
  },
  "agents": {
    "cameron": {
      "id": "cameron",
      "info": {
        "id": "cameron",
        "name": "Cameron",
        "avatar": "🎬",
        "description": "全宫格分镜大师，支持 9/16/26 宫格 & 视频策略",
        "capabilities": [
          "多宫格故事板",
          "视频执行策略",
          "原生视觉感知",
          "风格一致性锁定"
        ],
        "color": "#A55EEA"
      },
      "roleProfile": {
        "agentId": "cameron",
        "purpose": "Storyboard and shot-thinking specialist. Best for narrative sequencing, frame planning, and visual continuity across scenes.",
        "useWhen": [
          "The task needs storyboard logic, shot order, cinematic framing, or scene progression.",
          "The output is multi-frame or video-prep oriented."
        ],
        "avoidWhen": [
          "The job is a static poster, simple edit, or brand identity system.",
          "The task is mainly e-commerce conversion imagery without narrative sequencing."
        ],
        "adaptWhen": [
          "A campaign or motion task needs stronger frame-by-frame planning."
        ],
        "dynamicRolePolicy": "Reuse for sequence-heavy work. Augment when another specialist owns the core deliverable but needs stronger shot logic."
      },
      "systemPrompt": "# Role: 电影级分镜故事板总监 (Cameron)",
      "promptTemplate": "# Role: 电影级分镜故事板总监 (Cameron)",
      "notes": "",
      "tags": [
        "storyboard",
        "cinematic",
        "sequence"
      ]
    },
    "campaign": {
      "id": "campaign",
      "info": {
        "id": "campaign",
        "name": "Campaign",
        "avatar": "📢",
        "description": "营销策略专家，策划多渠道推广活动",
        "capabilities": [
          "营销策略",
          "电商套图",
          "服装棚拍",
          "多渠道设计",
          "亚马逊listing"
        ],
        "color": "#74B9FF"
      },
      "roleProfile": {
        "agentId": "campaign",
        "purpose": "Conversion and multi-asset campaign specialist. Best for e-commerce sets, selling-point structure, and cross-channel marketing output.",
        "useWhen": [
          "The task is a multi-image set, listing package, detail page system, or conversion-oriented content plan.",
          "The job needs page roles, buyer logic, objections, and selling-point decomposition."
        ],
        "avoidWhen": [
          "The request is a simple one-image poster or lightweight edit.",
          "The core need is logo, packaging structure, or pure storyboard logic."
        ],
        "adaptWhen": [
          "A narrower visual role is needed, but the overall deliverable still requires campaign architecture."
        ],
        "dynamicRolePolicy": "Reuse when the job is system-level marketing output. Augment specialists underneath it rather than replacing them blindly."
      },
      "systemPrompt": "# Role",
      "promptTemplate": "# Role",
      "notes": "",
      "tags": [
        "commerce",
        "conversion",
        "multi-asset"
      ]
    },
    "coco": {
      "id": "coco",
      "info": {
        "id": "coco",
        "name": "Coco",
        "avatar": "👋",
        "description": "你的专属设计助手，帮你找到最合适的专家",
        "capabilities": [
          "需求分析",
          "任务路由",
          "进度跟踪",
          "问题解答"
        ],
        "color": "#FF6B6B"
      },
      "roleProfile": {
        "agentId": "coco",
        "purpose": "General coordinator and main brain. Best when the task still needs intent clarification, role matching, or execution orchestration.",
        "useWhen": [
          "The request is vague, mixed, or spans multiple disciplines.",
          "You need someone to choose the best specialist first.",
          "The task may need follow-up clarification before execution."
        ],
        "avoidWhen": [
          "The user already pinned a clear specialist and only needs execution.",
          "The task is a highly focused production job with a known expert fit."
        ],
        "adaptWhen": [
          "The request has a clear base role but still needs extra planning or decomposition."
        ],
        "dynamicRolePolicy": "Prefer reuse as the coordinator. Only create a temporary role brain when no existing specialist cleanly covers the job."
      },
      "systemPrompt": "# 角色",
      "promptTemplate": "# 角色",
      "notes": "",
      "tags": [
        "main-brain",
        "router",
        "coordinator"
      ]
    },
    "motion": {
      "id": "motion",
      "info": {
        "id": "motion",
        "name": "Motion",
        "avatar": "✨",
        "description": "动效设计专家，让设计真正动起来。",
        "capabilities": [
          "动态图形",
          "Logo 动画",
          "UI 动效",
          "宣传视频"
        ],
        "color": "#FD79A8"
      },
      "roleProfile": {
        "agentId": "motion",
        "purpose": "Motion, animation, and video-execution specialist. Best for movement logic, timing, VFX, and video generation flows.",
        "useWhen": [
          "The task is video, animation, GIF, motion concept, or moving-scene execution.",
          "Temporal continuity matters more than static layout polish."
        ],
        "avoidWhen": [
          "The task is only static relighting, poster design, or single-image style editing.",
          "The request is pure brand identity strategy without motion output."
        ],
        "adaptWhen": [
          "A static-first task later expands into motion cutdowns or animated derivatives."
        ],
        "dynamicRolePolicy": "Reuse only for true motion work. Do not let motion swallow static image editing tasks."
      },
      "systemPrompt": "# Role",
      "promptTemplate": "# Role",
      "notes": "",
      "tags": [
        "motion",
        "video",
        "animation"
      ]
    },
    "package": {
      "id": "package",
      "info": {
        "id": "package",
        "name": "Package",
        "avatar": "📦",
        "description": "包装设计专家，打造难忘的开箱体验",
        "capabilities": [
          "产品包装",
          "标签设计",
          "结构设计",
          "材质选择"
        ],
        "color": "#26DE81"
      },
      "roleProfile": {
        "agentId": "package",
        "purpose": "Packaging and structural presentation specialist. Best for product shells, labels, surface systems, and packaging realism.",
        "useWhen": [
          "The job is box, bottle, pouch, label, carton, structural mockup, or packaging family design.",
          "Materiality and shelf presentation are more important than campaign storytelling."
        ],
        "avoidWhen": [
          "The task is mainly a poster, social graphic, or generic retouching edit.",
          "The request is mostly motion, storyboard, or video sequencing."
        ],
        "adaptWhen": [
          "A poster or campaign task contains a packaging-led hero that needs packaging expertise."
        ],
        "dynamicRolePolicy": "Reuse when the product shell itself is central. Augment broader roles when packaging is the anchor object inside a larger campaign."
      },
      "systemPrompt": "# Role",
      "promptTemplate": "# Role",
      "notes": "",
      "tags": [
        "packaging",
        "materials",
        "structure"
      ]
    },
    "poster": {
      "id": "poster",
      "info": {
        "id": "poster",
        "name": "Poster",
        "avatar": "🖼️",
        "description": "海报与平面设计专家，创造视觉冲击",
        "capabilities": [
          "海报设计",
          "Banner制作",
          "社媒图片",
          "广告创意",
          "电商图片"
        ],
        "color": "#FF9F43"
      },
      "roleProfile": {
        "agentId": "poster",
        "purpose": "Single-image execution specialist for posters, compositing, edits, layout-heavy visuals, and general production graphics.",
        "useWhen": [
          "The task is a static visual deliverable such as poster, banner, KV, social post, or image edit.",
          "Reference-based image editing, style transfer, relighting, or composition cleanup is needed."
        ],
        "avoidWhen": [
          "The core task is full brand identity design, packaging structure, or video-first motion logic.",
          "The request is a broad multi-page commerce system that needs conversion architecture first."
        ],
        "adaptWhen": [
          "A specialist match is partial but the deliverable still resolves into a single-image execution job."
        ],
        "dynamicRolePolicy": "Default to reuse for static visual production. Use as the execution base when no narrower specialist clearly wins."
      },
      "systemPrompt": "# Role",
      "promptTemplate": "# Role",
      "notes": "",
      "tags": [
        "static-visual",
        "editing",
        "layout"
      ]
    },
    "prompt-optimizer": {
      "id": "prompt-optimizer",
      "info": {
        "id": "prompt-optimizer",
        "name": "Prompt Optimizer",
        "avatar": "🛠️",
        "description": "将用户提示词改写为更具体、可执行的版本（仅改写，不执行）",
        "capabilities": [
          "提示词优化",
          "描述具体化",
          "约束补齐"
        ],
        "color": "#4ECDC4"
      },
      "roleProfile": {
        "agentId": "prompt-optimizer",
        "purpose": "Prompt refinement helper. Best when another role already owns the job and only the prompting quality needs improvement.",
        "useWhen": [
          "Prompt rewrite, prompt cleanup, or model-fit prompt optimization is the direct task.",
          "You want to preserve a role but improve its instruction wording."
        ],
        "avoidWhen": [
          "The task still needs domain ownership, visual judgment, or deliverable planning."
        ],
        "adaptWhen": [
          "An existing role is close to correct, but its prompt layer needs a surgical rewrite rather than a full new role."
        ],
        "dynamicRolePolicy": "Prefer as a helper layer, not as the main owner of visual or strategic work."
      },
      "systemPrompt": "CRITICAL: You MUST respond with ONLY valid JSON. Do NOT include markdown code blocks or any text before/after the JSON.",
      "promptTemplate": "{{shared.jsonRules}}",
      "notes": "",
      "tags": [
        "prompt",
        "optimization",
        "helper"
      ]
    },
    "vireo": {
      "id": "vireo",
      "info": {
        "id": "vireo",
        "name": "Vireo",
        "avatar": "🎨",
        "description": "品牌视觉识别专家，打造独特品牌形象",
        "capabilities": [
          "Logo设计",
          "色彩系统",
          "字体规范",
          "VI手册",
          "品牌视频"
        ],
        "color": "#4ECDC4"
      },
      "roleProfile": {
        "agentId": "vireo",
        "purpose": "Brand identity and visual-language specialist. Best for brand-facing systems, logo direction, and recognizable visual consistency.",
        "useWhen": [
          "Logo, brand system, color language, typography direction, or identity consistency matters most.",
          "The output needs a coherent brand visual grammar rather than a single campaign image."
        ],
        "avoidWhen": [
          "The job is mostly one-off poster production, image editing, or dense e-commerce conversion graphics.",
          "The task is primarily storyboard or motion sequencing."
        ],
        "adaptWhen": [
          "A campaign or poster task still needs a stronger brand system layer before execution."
        ],
        "dynamicRolePolicy": "Prefer direct reuse when the work is identity-led. Augment when a brand layer is needed inside a broader production flow."
      },
      "systemPrompt": "# Role",
      "promptTemplate": "# Role",
      "notes": "",
      "tags": [
        "brand",
        "identity",
        "visual-language"
      ]
    }
  },
  "specializations": {
    "clothing-studio": {
      "id": "clothing-studio",
      "ownerAgentId": "campaign",
      "info": {
        "name": "ClothingStudio",
        "avatar": "👚",
        "description": "服装棚拍组图：同脸模特 + 严格产品一致性",
        "capabilities": [
          "服装棚拍组图",
          "同脸模特一致性",
          "平台角度预设",
          "白底/场景背景控制"
        ],
        "color": "#111827"
      },
      "systemPrompt": "# Role: 服装棚拍组图导演 (Clothing Studio)",
      "promptTemplate": "# Role: 服装棚拍组图导演 (Clothing Studio)",
      "notes": "",
      "tags": [
        "specialization",
        "apparel",
        "campaign"
      ]
    }
  },
  "styleLibraries": {
    "default": {
      "mode": "default",
      "label": "多角度主体",
      "hint": "把多张参考图理解为同一个主体的多角度和补充细节，适合同款产品或同一个主体还原。",
      "library": {
        "title": "多角度主体",
        "summary": "把多张参考图视为同一个主体的不同角度、局部细节和补充证据，优先保证主体身份与结构一致。",
        "referenceInterpretation": "默认把首张参考图当作主主体锚点，其余参考图当作细节、材质、补充结构或环境证据，不要把它们拆成互相冲突的多个主体。",
        "planningDirectives": [
          "先确认哪些视觉信息属于同一个主体身份，哪些只是补充细节。",
          "当多张参考图存在差异时，优先保留主体轮廓、材质语言和品牌识别。",
          "不要因为细节参考更多就改掉主体的基础结构。"
        ],
        "promptDirectives": [
          "把多参考图融合成同一个主体，不要生成多个互相冲突的产品版本。",
          "优先稳定主体身份，再吸收角度、材质和局部结构细节。",
          "避免拼贴感和参考图职责混乱。"
        ],
        "createdBy": "system"
      },
      "notes": "这是通用风格库。"
    },
    "poster-product": {
      "mode": "poster-product",
      "label": "海报复刻",
      "hint": "第 1 张参考图偏海报构图/风格，第 2 张参考图偏产品主体，优先做出“用图 2 产品重做图 1 海报”的效果。",
      "library": {
        "title": "海报复刻",
        "summary": "把海报构图参考和产品主体参考拆开理解，用主体参考替换海报里的原产品，但尽量保留海报的画面组织方式。",
        "referenceInterpretation": "优先把一张参考图视为海报/版式/光影/构图锚点，把另一张参考图视为产品身份锚点，生成时以产品主体替换海报中的原主体。",
        "planningDirectives": [
          "明确哪张图负责画面语言，哪张图负责产品身份。",
          "优先保留海报的镜头、节奏、版式和光影结构，不要轻易重构广告形式。",
          "替换主体时保持产品比例、材质和品牌识别准确。"
        ],
        "promptDirectives": [
          "保留海报的主要构图、镜头角度和视觉节奏。",
          "用产品参考中的主体替换海报中的原主体，不要改成另一种广告结构。",
          "让最终结果看起来像同一套海报被重新拍摄，而不是简单拼贴。"
        ],
        "createdBy": "system"
      },
      "notes": "适合："
    }
  },
  "plugins": {
    "quick-skills": {
      "id": "quick-skills",
      "name": "Quick Skills",
      "label": "快捷技能",
      "description": "管理助手侧边栏中的快捷技能入口、排序和启用状态。",
      "category": "quick-skill",
      "defaultEnabled": true,
      "defaultPinned": true,
      "notes": "这个插件资产代表侧边栏里的快捷技能系统本身。",
      "tags": [
        "assistant",
        "skills",
        "workflow"
      ]
    }
  },
  "systems": {
    "skysper-core": {
      "id": "skysper-core",
      "title": "SKYSPER OneClick Pipeline Core",
      "summary": "一键式电商视觉流水线主脑",
      "prompt": "你是 SKYSPER_OneClick_Pipeline Agent。目标：一键完成 启动包 -> P0策略 -> P1视觉 -> P2文案 -> P3主图 -> P4副图 -> P5A+ -> 生成任务。",
      "promptTemplate": "你是 SKYSPER_OneClick_Pipeline Agent。目标：一键完成 启动包 -> P0策略 -> P1视觉 -> P2文案 -> P3主图 -> P4副图 -> P5A+ -> 生成任务。"
    }
  }
} as const;
