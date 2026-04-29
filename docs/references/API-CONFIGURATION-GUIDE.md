# API 配置指南

Jacky-Studio / JK 现已支持多种 Gemini API 提供商，让您可以根据自己的网络环境和需求灵活选择。

## 🌟 支持的 API 提供商

### 1. Gemini 原生 API
- **提供商**: Google 官方
- **优势**: 最稳定、最新特性支持
- **要求**: 需要科学上网
- **适用场景**: 海外用户或有稳定翻墙环境的用户

### 2. 云雾 API ⭐ 推荐
- **提供商**: 云雾 API 服务 (https://yunwu.ai)
- **优势**: 国内可直接访问，无需翻墙
- **特点**: 美国高防免费均衡选择
- **适用场景**: 国内用户的首选方案

### 3. 自定义代理
- **提供商**: 自己搭建或第三方代理
- **优势**: 完全自主控制
- **要求**: 需要自己配置代理服务器
- **适用场景**: 有技术能力的高级用户

## 📖 配置步骤

### 方法一：通过设置界面配置（推荐）

1. **打开设置**
   - 在应用界面中找到设置按钮（通常是齿轮图标）
   - 点击打开 "API 配置" 模态框

2. **选择 API 提供商**
   - 选择以下三个选项之一：
     - `Gemini 原生` - Google 官方 API
     - `云雾 API` - 国内可访问 ⭐
     - `自定义` - 使用自定义代理

3. **输入 API Key**
   - 在 "API Key" 输入框中填入您的 Gemini API Key
   - 如果选择云雾 API，请使用云雾提供的 API Key
   - API Key 将安全存储在本地浏览器，不会上传到任何服务器

4. **配置自定义 URL（仅自定义模式）**
   - 如果选择 "自定义" 模式，需要输入完整的代理服务器 URL
   - 例如：`https://api.your-proxy.com`

5. **保存配置**
   - 点击 "保存配置" 按钮
   - 等待验证完成，看到 "已保存" 提示即成功

### 方法二：修改环境变量（开发者）

编辑 `.env.local` 文件：

```env
# 默认 API Key
VITE_GEMINI_API_KEY=your_api_key_here
GEMINI_API_KEY=your_api_key_here

# 云雾API主站地址
VITE_YUNWU_API_URL=https://yunwu.ai
```

**注意**: 环境变量只是默认值，实际运行时仍需在设置界面中配置。

## 🔑 如何获取 API Key

### Gemini 原生 API Key
1. 访问 [Google AI Studio](https://aistudio.google.com/)
2. 登录您的 Google 账号
3. 点击 "Get API Key" 创建新的 API Key
4. 复制生成的 API Key

### 云雾 API Key
1. 访问 [云雾 API 官网](https://yunwu.ai)
2. 注册账号或登录
3. 在控制台中获取您的 API Key
4. 复制 API Key 并在设置中选择 "云雾 API" 提供商

## 💾 数据存储说明

所有 API 配置信息都存储在浏览器的 `localStorage` 中：

- `gemini_api_key` - Gemini 原生 API Key
- `yunwu_api_key` - 云雾 API Key
- `custom_api_key` - 自定义 API Key
- `api_provider` - 选择的 API 提供商 (`gemini` | `yunwu` | `custom`)
- `custom_api_url` - 自定义 API URL（仅自定义模式）

**安全提示**: 
- ✅ API Key 仅存储在您的本地浏览器
- ✅ 不会上传到任何第三方服务器
- ✅ 清除浏览器数据会清除这些配置

## 🎯 使用示例

### 场景 1: 国内用户使用云雾 API

```
1. 打开设置
2. 选择 "云雾 API"
3. 输入云雾提供的 API Key
4. 保存配置
5. 开始使用，无需翻墙！
```

### 场景 2: 海外用户使用 Gemini 原生

```
1. 打开设置
2. 选择 "Gemini 原生"
3. 输入 Google AI Studio 的 API Key
4. 保存配置
5. 享受官方服务的稳定性
```

### 场景 3: 使用自己的代理服务器

```
1. 打开设置
2. 选择 "自定义"
3. 输入自定义代理 URL: https://your-proxy.com
4. 输入对应的 API Key
5. 保存配置
```

## 🔧 技术实现细节

### API 提供商切换逻辑

系统会根据用户选择的提供商自动配置 baseURL：

```typescript
// 云雾 API
if (provider === 'yunwu') {
    baseUrl = 'https://yunwu.ai';
}

// 自定义 API
if (provider === 'custom') {
    baseUrl = localStorage.getItem('custom_api_url');
}

// Gemini 原生 - 使用默认 URL
```

### 支持的功能

所有 API 提供商都支持以下功能：
- ✅ 文本对话（Chat）
- ✅ 图像生成（Image Generation）
- ✅ 视频生成（Video Generation）
- ✅ 图像分析（Image Analysis）
- ✅ 文本提取（Text Extraction）
- ✅ 网络搜索（Web Search）

## ⚠️ 常见问题

### Q: 为什么选择云雾 API 后还是无法访问？
A: 请确认：
1. API Key 是否正确
2. 云雾 API 账户是否有足够余额
3. 网络连接是否正常

### Q: 可以同时使用多个 API 提供商吗？
A: 当前版本同一时间只能使用一个提供商，但可以随时在设置中切换。

### Q: 切换 API 提供商后需要重启应用吗？
A: 不需要，保存配置后即刻生效。

### Q: API Key 会过期吗？
A: 请查看对应提供商的文档。通常 Google AI Studio 的免费 API Key 没有过期时间，但有使用限额。

## 📞 支持与反馈

如遇到问题或有改进建议，请通过以下方式联系：

- 提交 GitHub Issue
- 访问云雾 API 官网获取技术支持

---

**最后更新**: 2026/2/9  
**版本**: v1.0.0
