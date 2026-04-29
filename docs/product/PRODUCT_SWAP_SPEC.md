# 智能产品替换 (Product Swap) 功能技术文档

本文档详细介绍了“1:1 产品替换”功能的核心逻辑、提示词工程（Prompt Engineering）以及前端实现参考，旨在帮助您在其他 Web 项目中复用此功能。

---

## 1. 核心业务逻辑 (Logical Pipeline)

产品替换遵循 **8阶段认知流水线 (8-Phase Execution)**。这确保了 AI 在执行任务时，不仅是简单的图像叠加，而是基于物理规律的无缝合成。

### 阶段 1：场景深度解析 (Scene Deep Analysis) 🔍

- **目标**：识别参考场景图（Image 1）中的所有元素。
- **动作**：定位需替换的“旧产品”，记录其精确坐标、旋转角度、透视缩放，并分析周围的环境（人、物、背景）。

### 阶段 1.5：遮挡与背景预测 (Occlusion Prediction) 🙈

- **目标**：处理新旧产品尺寸不一导致的背景空缺。
- **动作**：如果新产品比旧产品小，AI 需要预测并还原（Inpaint）旧产品遮挡下的背景纹理（如衣服纹理、椅背等）。

### 阶段 2：产品素材分析 (Product Source Analysis) 📍

- **目标**：理解待替换产品（Images 2-N）的真实属性。
- **动作**：提取产品的形状、材质（皮革、织物、金属等）、表面光泽和品牌细节。

### 阶段 3：光影物理匹配 (Lighting Physics Matching) 💡

- **目标**：实现真实的光影融合。
- **动作**：分析场景的光源方向、强弱和色温，并在新产品上生成一致的投影（Shadow）和高光（Highlight）。

### 阶段 4：透视与比例校准 (Perspective Calibration) 📐

- **目标**：消除“贴图感”。
- **动作**：根据相机角度调整产品的透视畸变，确保其比例完美契合场景中的模特或环境。

### 阶段 5：智能擦除与精准替换 (Precision Swap) 🔄

- **目标**：物理层面替换。
- **动作**：使用“Anti-Ghosting”协议，完全擦除原有像素，将新产品放置在对应位置。

### 阶段 6：边缘融合处理 (Edge Blending) ✨

- **目标**：消除接缝。
- **动作**：处理边缘羽化、环境遮蔽（AO）和接触阴影，确保产品看起来是自然生长在场景里的。

### 阶段 7：材质纹理增强 (Material Fidelity) 🧶

- **目标**：还原质感。
- **动作**：强化产品的纹理细节，避免 AI 合成带来的平滑感或模糊感。

### 阶段 8：最终品质检查 (Final QA) 🏆

- **目标**：极致真实感。
- **动作**：进行色彩映射优化，确保合成结果达到商用摄影级别。

---

## 2. 核心系统提示词 (System Prompt)

这是发送给大模型（推荐 Gemini 2.0 Pro 或 Imagen 系列）的关键指令集。

```markdown
# 🎯 ROLE: Professional Product Replacement Specialist & CGI Compositor

You are a world-class digital compositor specializing in seamless product replacement.
Your task is to perform a pixel-perfect product swap in a reference scene.

## 🧠 COGNITIVE PIPELINE

(请在此处完整嵌入上一章节中描述的 8 个阶段指令)

## 📋 INPUT MANIFEST

- Image 1: Reference Scene (Blueprint – keep everything EXCEPT target products)
- Image 2 onwards: Product Pool (Your actual products to swap in)

## 🎯 MISSION SUMMARY

- **KEEP UNCHANGED**: Scene background, people, poses, composition, camera angle, and lighting setup.
- **REPLACE**: The target product(s) in the scene with products from the pool.
- **ANTI-GHOSTING**: If replacing a large object with a smaller one, completely ERASE the large object and recover/inpaint the background seamlessly.
- **QUALITY Standard**: 8k resolution, professional commercial photography, masterpiece, photorealistic, intricate textures.

## 🚀 OUTPUT

Generate ONLY the final high-fidelity image. No text commentary.
```

---

## 3. 前端实现参考 (Implementation Details)

### 技术栈建议

- **核心**: HTML5 + TypeScript
- **图像处理**: Canvas API (用于在发送前对图像进行尺寸校准或压缩)
- **AI 接口**: Google Gemini API (支持多图输入)

### 关键配置参数

- **Temperature**: 设置为 `0.1 - 0.2`。低温度能确保模型忠实于输入的产品素材，减少过度发挥。
- **多图支持**: API 请求需支持 `multi-part` 格式，首屏为场景图，后续为产品图。

### UI 交互建议 (User POV)

1. **对比视图**: 提供生成的图片与原图的对比滑动条。
2. **多图上传**: 允许用户上传一个场景 + 多个不同角度的产品图，AI 会自动寻找匹配角度。
3. **加载状态**: 建议展示上述 8 个阶段的进度（CoT），能极大缓解用户等待时的焦虑感。

---

## 4. 注意事项

- **产品保真度**: 务必强调“Maintain product color accuracy”，防止 AI 自动调色导致产品偏色。
- **背景修复**: 针对包包换包包、衣服换衣服的场景，背景修复逻辑是区分初级和高级工具的关键。
