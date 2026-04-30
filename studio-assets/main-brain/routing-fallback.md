```json
{
  "id": "routing-fallback",
  "type": "routing-config",
  "rules": [
    {
      "keywords": ["logo", "vi", "品牌", "标志", "商标", "brand", "视觉识别", "品牌手册", "色彩系统"],
      "agent": "vireo",
      "priority": 2,
      "label": "品牌/VI/Logo"
    },
    {
      "keywords": ["故事板", "分镜", "九宫格", "分镜图", "storyboard", "脚本", "剧本", "镜头", "shot list", "场景设计", "体验", "氛围"],
      "agent": "cameron",
      "priority": 1,
      "label": "故事板/分镜"
    },
    {
      "keywords": ["包装", "package", "packaging", "礼盒", "瓶身", "标签", "盒子", "瓶子", "罐子", "unboxing"],
      "agent": "package",
      "priority": 10,
      "label": "包装设计"
    },
    {
      "keywords": ["动画", "motion", "动效", "gif", "animation", "视频", "video", "片头", "转场", "vfx", "3d动画"],
      "agent": "motion",
      "priority": 4,
      "label": "动效/视频/动画"
    },
    {
      "keywords": ["营销", "campaign", "推广", "电商", "亚马逊", "amazon", "副图", "listing", "主图", "详情图", "shopify", "淘宝", "天猫", "小红书", "一套", "一组", "系列", "套图"],
      "agent": "campaign",
      "priority": 5,
      "label": "电商/营销/多图系列"
    },
    {
      "keywords": ["海报", "poster", "banner", "宣传", "广告", "传单", "社交媒体", "instagram", "朋友圈", "封面", "邀请函", "贺卡", "名片", "证书", "节日", "春节", "新年", "圣诞", "中秋"],
      "agent": "poster",
      "priority": 6,
      "label": "海报/单图设计"
    },
    {
      "keywords": ["设计", "做", "生成", "画", "制作", "创作", "帮我", "图片", "图", "海报", "卡片", "素材", "风格", "一个", "几张"],
      "agent": "poster",
      "priority": 99,
      "label": "通用设计请求"
    }
  ],
  "editKeywords": ["换成", "改成", "改为", "替换", "修改", "调整", "变成", "去掉", "删除", "移除", "加上", "添加", "放大", "缩小", "旋转", "翻转", "裁剪", "去背景", "换背景", "换颜色", "改颜色", "变色", "粉色", "红色", "蓝色", "绿色", "黑色", "白色", "不要", "抠图", "高清", "放大画质", "upscale", "remove", "replace", "change", "edit", "modify", "recolor"],
  "chatPatterns": ["^(你好|hi|hello|hey|哈喽|早上好|下午好|晚上好|早安|晚安)", "^(谢谢|感谢|thanks|thank you|thx)", "^(再见|拜拜|bye|goodbye)", "^(好的|ok|okay|嗯|明白|了解|收到)", "^(你是谁|你叫什么|介绍一下|你能做什么|帮助|help)", "^(怎么用|如何使用|教我|指导)"],
  "vaguePatterns": ["^(帮我|帮忙|我想|我要|我需要).*(做|弄|搞|整).*(东西|什么|啥)?$", "^(设计|做).*(一个|一下|点)?$", "^(有什么|能做什么|可以做什么)"]
}
```

## Notes
这是本地快速路由和兜底路由使用的规则资产。

后续如果主脑完全接管路由，这里仍然保留为：

- 离线兜底
- API 不可用时的安全降级
- 可解释的人工维护入口
