# 亚马逊服装主图常用角度/镜头库（参考）

> 用途：作为 XC‑STUDIO「服装棚拍组图工作流」的镜头知识库/模板，在“分析→出 plan”阶段从中挑选合适镜头，并为每个镜头生成 prompt。

## 1) 通用镜头类型（服装上身类）

### A. Hero 主图（全身正面）

- **目的**：一眼展示整体轮廓、长度比例、上身效果。
- **构图**：全身或 3/4 身；人物居中；留白适中；背景纯白。
- **要点**：服装边缘清晰、无裁切关键部位（领口/下摆/袖窿）。

### B. 3/4 正面（站姿更“有型”）

- **目的**：展示身形曲线、侧向线条、贴合度。
- **要点**：动作自然但不遮挡关键结构线（侧缝、收腰、褶皱）。

### C. 背面（Back view）

- **目的**：展示后背结构、领口后片、背部剪裁与长度。
- **要点**：头发避免遮挡后领/后背关键细节；背部平整。

### D. 侧面（Side view，若需要）

- **目的**：展示厚度、侧缝线、侧开衩、轮廓。
- **要点**：避免手臂完全贴身遮挡侧线；可用轻微“手扶腰”但不挡衣服。

### E. 面料/弹力演示（Pull/Stretch demo）

- **目的**：强调弹力、柔软、贴肤、回弹。
- **动作**：轻拉下摆/侧摆/胸前面料（力度适中）。
- **注意**：不要拉到变形夸张；避免露出内衣等敏感区域；保持白底。

### F. 细节特写（Detail close‑up）

- **目的**：展示领口包边、缝线、拼接、纹理、面料光泽。
- **构图**：胸口/肩部/腋下/下摆等关键区域；尽量不出现多余饰品。

## 2) 适配规则（用于“分析→选镜头”）

- **单件上衣/背心**：优先 A（全身/3/4）+ E（弹力演示）+ F（领口/袖窿/下摆细节）+ C（背面）。
- **套装**：优先 A（全身正面）+ C（背面）+ D（侧面）+ F（细节）；动作以“站姿稳定、展示比例”为主，避免大幅扭转导致上/下装错位。
- **连衣裙/外套**：A + C + D + F；若有开衩/收腰/翻领，增加对应特写。

## 3) 可直接用于代码的镜头模板（建议 JSON 结构）

```json
[
  {
    "key": "hero_full_front",
    "name": "全身正面主图",
    "when": ["top", "dress", "set", "outerwear"],
    "priority": 1,
    "promptHint": "full body, front view, centered, pure white background (#FFFFFF)"
  },
  {
    "key": "three_quarter_front",
    "name": "3/4 正面",
    "when": ["top", "dress", "set", "outerwear"],
    "priority": 2,
    "promptHint": "three-quarter front view, natural pose, no occlusion, pure white background"
  },
  {
    "key": "back_view",
    "name": "背面展示",
    "when": ["top", "dress", "set", "outerwear"],
    "priority": 2,
    "promptHint": "back view, hair not covering neckline, pure white background"
  },
  {
    "key": "side_view",
    "name": "侧面展示",
    "when": ["top", "dress", "set", "outerwear", "pants", "skirt"],
    "priority": 3,
    "promptHint": "side view, show silhouette, pure white background"
  },
  {
    "key": "stretch_demo",
    "name": "弹力/面料演示",
    "when": ["top", "dress", "set"],
    "priority": 1,
    "promptHint": "hands gently pulling hem to show stretch, tasteful, pure white background"
  },
  {
    "key": "detail_neckline",
    "name": "领口细节特写",
    "when": ["top", "dress", "outerwear"],
    "priority": 2,
    "promptHint": "close-up on neckline stitching and edge finishing, pure white background"
  }
]
```

## 4) 白底强约束（与生成/后处理配套）

- 生成阶段 prompt 固定包含： **纯白背景 #FFFFFF、无道具、无场景、无纹理/渐变**。
- 最终输出建议增加后处理：背景移除 + 叠加纯白底，确保“绝对白底”。

---

> 备注：以上为“镜头/构图知识库”抽象，不涉及任何第三方站点私有代码或接口，可直接用于你项目的 plan 模板与 prompt 生成。
