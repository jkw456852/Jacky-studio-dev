---

## name: everything-claude-code

description: >
综合 Skill：整合 everything-claude-code 项目的核心 agents、skills、rules 和工作流。
涵盖编码规范、后端模式、TDD、安全审查、多代理编排等最佳实践。
适用于 TypeScript / Python / Go / Java 全栈项目。

# Everything Claude Code — 综合 Skill

> 来源： <https://github.com/affaan-m/everything-claude-code>Anthropic Hackathon 获奖项目，经过 10+ 个月生产环境打磨。

## 何时激活

- 开始新项目或新模块开发
- 进行代码审查、重构、安全检查
- 需要 TDD 工作流指导
- 设计 API、数据库、缓存架构
- 多代理任务编排与并行执行
- 需要跨会话记忆持久化

---

## Part 1：通用编码规范（Common Coding Standards）

### 核心原则

1. **Readability First** — 代码被阅读的次数远多于编写次数，命名要清晰自描述
2. **KISS** — 最简单的可行方案，避免过度设计
3. **DRY** — 提取公共逻辑，避免复制粘贴
4. **YAGNI** — 不要提前构建未需要的功能

### 命名规范

```typescript
// ✅ 变量：描述性名称
const isUserAuthenticated = true
const totalRevenue = 1000

// ✅ 函数：动词-名词模式
async function fetchMarketData(marketId: string) {}
function isValidEmail(email: string): boolean {}

// ❌ 避免
const flag = true
function market(id: string) {}
```

### 不可变性原则（CRITICAL）

```typescript
// ✅ 始终使用展开运算符
const updatedUser = { ...user, name: 'New Name' }
const updatedArray = [...items, newItem]

// ❌ 禁止直接修改
user.name = 'New Name'  // BAD
items.push(newItem)     // BAD
```

### 错误处理

```typescript
// ✅ 完整的错误处理
async function fetchData(url: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('Fetch failed:', error)
    throw new Error('Failed to fetch data')
  }
}
```

### 异步最佳实践

```typescript
// ✅ 并行执行
const [users, markets, stats] = await Promise.all([
  fetchUsers(), fetchMarkets(), fetchStats()
])

// ❌ 不必要的串行
const users = await fetchUsers()
const markets = await fetchMarkets()
```

### 代码异味检测

```typescript
// ❌ 深层嵌套 → ✅ 提前返回
if (!user) return
if (!user.isAdmin) return
if (!market?.isActive) return
// Do something

// ❌ 魔法数字 → ✅ 命名常量
const MAX_RETRIES = 3
const DEBOUNCE_DELAY_MS = 500
```

### 文件组织

```plain
src/
├── app/          # Next.js App Router / 页面
├── components/   # React 组件（ui/ forms/ layouts/）
├── hooks/        # 自定义 React Hooks
├── lib/          # 工具函数、API 客户端、常量
├── types/        # TypeScript 类型定义
└── styles/       # 全局样式
```

### 文件命名

```plain
components/Button.tsx        # PascalCase（组件）
hooks/useAuth.ts             # camelCase + use 前缀
lib/formatDate.ts            # camelCase（工具函数）
types/market.types.ts        # camelCase + .types 后缀
```
