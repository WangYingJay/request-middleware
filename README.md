# @bugfix2019/request-middleware

[![npm version](https://img.shields.io/npm/v/@bugfix2019/request-middleware.svg)](https://www.npmjs.com/package/@bugfix2019/request-middleware)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

强大的请求中间件库，支持 ctx 上下文，兼容 axios、xhr 和 fetch。

## 📖 前言

这个库的设计灵感来源于多个优秀的框架和库：

- **Express**：中间件是 `(req, res, next)`，通过 `next()` 控制后续中间件执行。[expressjs.com](https://expressjs.com/)
- **Koa**：中间件是 `(ctx, next)`，通过 `await next()` 实现经典「洋葱模型」：`next()` 前是请求前逻辑，`next()` 后是请求后逻辑。[github.com/koajs/koa](https://github.com/koajs/koa)
- **Gin**：中间件函数 `func(c *gin.Context)` 内部调用 `c.Next()`，`Next()` 前可以做前置处理，`Next()` 后可以做后置处理和耗时统计。[gin-gonic.com](https://gin-gonic.com/en/docs/examples/custom-middleware/?utm_source=chatgpt.com)

受这些启发的驱动，我们希望在前端请求层面实现类似的中间件机制。通过解耦业务逻辑和通用处理（如日志、错误处理、重试等），只需一个人维护中间件，业务同学可以专注于核心业务逻辑，大大提升开发效率和代码可维护性。

## ✨ 特性

- 🎯 **100% TypeScript** - 完整的类型支持
- 🧅 **洋葱模型** - Koa 风格的中间件机制
- 🔗 **上下文支持** - 贯穿请求生命周期的 ctx 对象
- 🔌 **适配器模式** - 支持 axios，可扩展至 xhr/fetch
- 📦 **官方中间件** - 内置日志、重试、缓存等中间件
- 🔄 **EventSource 支持** - 支持 Server-Sent Events (SSE) via @microsoft/fetch-event-source
- 🚀 **零核心依赖** - 轻量级设计

## 📦 安装

```bash
# npm
npm install @bugfix2019/request-middleware

# pnpm
pnpm add @bugfix2019/request-middleware

# yarn
yarn add @bugfix2019/request-middleware
```

## 🚀 快速开始

```typescript
import axios from 'axios';
import { 
  createMiddlewareEngine, 
  fromAxios, 
  createLoggerMiddleware 
} from '@bugfix2019/request-middleware';

// 创建 axios 实例
const axiosInstance = axios.create({
  baseURL: 'https://api.example.com',
});

// 创建中间件引擎
const engine = createMiddlewareEngine({
  adapter: fromAxios(axiosInstance),
  defaults: {
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

// 注册日志中间件
engine.use(createLoggerMiddleware({
  level: 'info',
  logRequestBody: true,
}));

// 发送请求
const response = await engine.get<{ id: string; name: string }>('/users/1');
console.log(response.data);
```

## 🧅 中间件机制

中间件采用洋葱模型，请求会依次通过所有中间件，响应则按相反顺序返回：

```
请求 → [中间件1] → [中间件2] → [中间件3] → 实际请求
响应 ← [中间件1] ← [中间件2] ← [中间件3] ← 实际响应
```

### 编写自定义中间件

```typescript
import type { Middleware } from '@bugfix2019/request-middleware';

const myMiddleware: Middleware = async (ctx, next) => {
  // 请求前处理
  console.log('请求开始:', ctx.request.url);
  ctx.setMeta('customData', { startTime: Date.now() });

  await next(); // 调用下一个中间件

  // 响应后处理
  const customData = ctx.getMeta<{ startTime: number }>('customData');
  console.log('请求完成, 耗时:', Date.now() - customData!.startTime, 'ms');
};

engine.use(myMiddleware);
```

##  上下文 (Context)

每个请求都有一个 `ctx` 对象，包含请求的完整生命周期信息：

```typescript
interface RequestContext<TReqData, TResData> {
  // 请求配置
  request: RequestConfig<TReqData>;
  
  // 响应对象 (响应阶段可用)
  response?: Response<TResData>;
  
  // 错误对象 (发生错误时可用)
  error?: Error;
  
  // 时间信息
  startTime: number;
  endTime?: number;
  duration?: number;
  
  // 请求状态: 'pending' | 'sending' | 'success' | 'error' | 'aborted'
  state: RequestState;
  
  // 元数据操作
  meta: ContextMeta;
  setMeta: <T>(key: string, value: T) => void;
  getMeta: <T>(key: string) => T | undefined;
  
  // 中止控制
  abort: () => void;
  aborted: boolean;
}
```

## 📦 官方中间件

### Logger 日志中间件

```typescript
import { createLoggerMiddleware } from '@bugfix2019/request-middleware';

const logger = createLoggerMiddleware({
  level: 'info',           // 日志级别: 'debug' | 'info' | 'warn' | 'error' | 'silent'
  logRequestBody: true,    // 是否记录请求体
  logResponseBody: false,  // 是否记录响应体
  logHeaders: false,       // 是否记录请求头
  logger: customLogger,    // 自定义日志输出器
});

engine.use(logger);
```

### 更多中间件 (即将推出)

- `createRetryMiddleware` - 请求重试
- `createCacheMiddleware` - 请求缓存
- `createErrorHandlerMiddleware` - 错误处理

## 🔧 配置请求拦截器和响应拦截器

对于 Fetch 适配器，您可以配置请求拦截器和响应拦截器来修改请求配置或响应数据：

```typescript
import { createMiddlewareEngine, createFetchAdapter } from '@bugfix2019/request-middleware';

// 创建带有拦截器的 Fetch 适配器
const adapter = createFetchAdapter({
  baseURL: 'https://api.example.com',
  interceptors: {
    // 请求拦截器：在发送请求前修改配置
    request: (config) => {
      console.log('发送请求:', config.url);
      // 添加认证头
      return {
        ...config,
        headers: {
          ...config.headers,
          'Authorization': 'Bearer ' + getToken(),
        },
      };
    },
    // 响应拦截器：在接收响应后修改数据
    response: (response) => {
      console.log('接收响应:', response.status);
      // 处理响应数据
      return {
        ...response,
        data: transformResponseData(response.data),
      };
    },
  },
});

// 创建中间件引擎
const engine = createMiddlewareEngine({
  adapter,
});
```

拦截器函数可以是同步的或异步的（返回 Promise）。

## 🔄 EventSource 支持

request-middleware 支持使用 @microsoft/fetch-event-source 进行 Server-Sent Events (SSE) 连接：

```typescript
import { createMiddlewareEngine, createEventSourceAdapter } from '@bugfix2019/request-middleware';

// 创建 EventSource 适配器
const adapter = createEventSourceAdapter({
  baseURL: 'https://api.example.com',
  onMessage: (event) => {
    console.log('收到消息:', event.data);
  },
  onOpen: (response) => {
    console.log('连接已打开，状态:', response.status);
  },
  onError: (error) => {
    console.error('连接错误:', error);
  },
  onClose: () => {
    console.log('连接已关闭');
  },
});

// 创建中间件引擎
const engine = createMiddlewareEngine({
  adapter,
});

// 发起 SSE 连接
const response = await engine.get('/events');
```

EventSource 适配器适用于需要实时数据流的场景，如聊天应用、实时通知等。

## 🔧 API 参考

### `createMiddlewareEngine(config)`

创建中间件引擎实例。

```typescript
const engine = createMiddlewareEngine({
  adapter: fromAxios(axiosInstance), // 请求适配器
  defaults: {                         // 默认请求配置
    timeout: 10000,
    headers: { 'X-Custom': 'value' },
  },
});
```

### `engine.use(middleware)`

注册中间件。

```typescript
engine.use(myMiddleware);
engine.useAll(middleware1, middleware2, middleware3);
```

### `engine.request(config)`

发送请求。

```typescript
const response = await engine.request({
  url: '/api/users',
  method: 'GET',
  params: { page: 1 },
});
```

### 快捷方法

```typescript
engine.get<TResData>(url, config?)
engine.post<TReqData, TResData>(url, data?, config?)
engine.put<TReqData, TResData>(url, data?, config?)
engine.delete<TResData>(url, config?)
engine.patch<TReqData, TResData>(url, data?, config?)
```

---

## 🧪 测试覆盖率

| 文件 | 语句覆盖率 | 分支覆盖率 | 函数覆盖率 | 行覆盖率 |
|------|-----------|-----------|-----------|---------|
| **总计** | **69.27%** | **85.32%** | **80.48%** | **69.27%** |
| src/index.ts | 0% | 0% | 0% | 0% |
| adapters/fetch.ts | 96.65% | 82.92% | 100% | 96.65% |
| adapters/eventSource.ts | 81.29% | 81.81% | 50% | 81.29% |
| adapters/axios.ts | 100% | 100% | 100% | 100% |
| adapters/index.ts | 0% | 0% | 0% | 0% |
| client/httpClient.ts | 98.8% | 86.66% | 100% | 98.8% |
| client/index.ts | 0% | 0% | 0% | 0% |
| engine/compose.ts | 97.8% | 95.23% | 100% | 97.8% |
| engine/middlewareEngine.ts | 100% | 100% | 100% | 100% |
| engine/index.ts | 100% | 100% | 100% | 100% |
| engine/middlewareTypes.ts | 0% | 0% | 0% | 0% |

---

## 📂 项目结构

```
request-middleware/
├── src/
│   ├── core/               # 核心中间件引擎
│   │   ├── engine.ts       # MiddlewareEngine 类
│   │   └── index.ts
│   ├── middlewares/        # 官方中间件
│   │   ├── logger.ts       # 日志中间件
│   │   └── index.ts
│   ├── adapters/           # 请求适配器
│   │   ├── axios.ts        # Axios 适配器
│   │   ├── fetch.ts        # Fetch 适配器
│   │   ├── eventSource.ts  # EventSource 适配器
│   │   └── index.ts
│   ├── types/              # TypeScript 类型定义
│   │   └── index.ts
│   └── index.ts            # 入口文件
├── tests/                  # 测试文件
├── dist/                   # 构建输出
├── package.json
├── tsconfig.json
├── tsup.config.ts          # 构建配置
└── README.md
```

## 🛠️ 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm run dev

# 构建
pnpm run build

# 运行测试
pnpm test

# 查看覆盖率
pnpm test -- --coverage
```

## 📦 发布到 npm

```bash
# 1. 确保构建成功
pnpm run build

# 2. 确保测试通过
pnpm test -- --run

# 3. 更新版本号
npm version patch  # 1.0.0 -> 1.0.1

# 4. 发布
npm publish --access public
```

## 📄 许可证

MIT

## 👥 贡献者

感谢以下贡献者对本项目的贡献：

<div style="display: flex; justify-content: center; align-items: flex-start; gap: 40px; flex-wrap: wrap;">
  <div style="text-align: center;">
    <a href="https://github.com/bugfix2020"><img src="https://github.com/bugfix2020.png?size=100" width="100px;" style="border-radius: 50%;border:1px solid #efefef;" alt="Polaris"/></a>
    <br/>
    <a href="https://github.com/bugfix2020"><strong>Polaris</strong></a>
    <br/>
    <sub>📧 ts02315607@gmail.com</sub>
  </div>
</div>

## 🔗 相关链接

- [Axios](https://axios-http.com/)
- [Fetch API](https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API)
- [Koa 洋葱模型](https://koajs.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vitest](https://vitest.dev/)
- [pnpm](https://pnpm.io/)

---

## ❓ 常见问题

### Q: 如何在项目中使用？
A: 直接在项目中引入 request-middleware 并结合 axios/fetch 适配器即可，无需特殊配置。

### Q: 如何自定义中间件？
A: 参考文档中的"编写自定义中间件"示例，实现 `(ctx, next) => Promise<void>` 结构即可。

### Q: 如何查看测试覆盖率？
A: 运行 `pnpm test -- --coverage` 查看详细覆盖率报告。

### Q: 如何贡献代码？
A: Fork 仓库，提交 PR，确保测试覆盖率 100%。

---

## 🙏 致谢

感谢所有为本项目做出贡献的开发者！查看完整的[贡献者列表](./CONTRIBUTORS.md)。

---

Made with ❤️ by [Polaris](https://github.com/bugfix2020)

