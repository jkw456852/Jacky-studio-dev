export const PLATFORM_OPTIONS = [
  { label: '淘宝', value: 'taobao' },
  { label: '天猫', value: 'tmall' },
  { label: '京东', value: 'jd' },
  { label: '拼多多', value: 'pdd' },
  { label: '抖音电商', value: 'douyin' },
  { label: '小红书', value: 'xiaohongshu' },
  { label: 'Amazon', value: 'amazon' },
  { label: 'Shopify', value: 'shopify' },
];

export const LANGUAGE_OPTIONS = [
  { label: '无文字(纯视觉)', value: 'visual-only' },
  { label: '中文简体', value: 'zh-CN' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Español', value: 'es' },
];

export const CLARITY_OPTIONS = ['1K', '2K', '4K'] as const;

export const COUNT_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

export const REQUIREMENT_TEMPLATES = [
  {
    id: 'ecom_clean',
    label: '标准电商棚拍',
    text: '标准电商棚拍风格：主体清晰、颜色准确、背景干净，突出面料与版型细节。',
  },
  {
    id: 'lux_soft',
    label: '轻奢质感',
    text: '轻奢质感：柔光棚拍、细节丰富、面料质感高级、画面干净克制。',
  },
  {
    id: 'detail_points',
    label: '详情页卖点',
    text: '详情页卖点图组：包含细节特写与卖点呈现，信息清晰，突出工艺、功能与材质。',
  },
  {
    id: 'lookbook',
    label: 'Lookbook 氛围',
    text: 'Lookbook 风格：自然姿态与生活方式氛围，商品细节清晰可见，整体高级统一。',
  },
  {
    id: 'promo',
    label: '促销导购',
    text: '促销导购风格：视觉抓眼，卖点明确，适合活动节点转化。',
  },
] as const;

export const REQUIREMENT_TAGS = {
  style: ['极简', '干净', '高级灰', '轻奢', '复古', '韩系'],
  background: ['纯白背景', '浅灰背景', '影棚背景', '自然场景'],
  camera: ['正面', '45°侧面', '细节微距', '面料特写'],
  focus: ['突出版型', '突出面料纹理', '突出工艺细节', '突出卖点文案'],
};
