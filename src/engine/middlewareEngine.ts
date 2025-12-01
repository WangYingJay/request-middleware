/**
 * 中间件引擎 - 核心实现
 * 
 * 职责：
 * - 管理中间件列表（全局）
 * - 按注册顺序执行中间件链
 * - 支持在 dispatch 时附加额外中间件
 * - 不关心 context 的具体结构
 * - 不做任何错误处理，交给上层 catchException 统一处理
 */

import type {
  Middleware,
  MiddlewareEngineOptions,
  IMiddlewareEngine,
} from './middlewareTypes';
import { composeMiddlewares } from './compose';

/**
 * 中间件引擎类
 * 
 * @template C - 上下文类型，默认为 Record<string, unknown>
 * 
 * @example
 * ```ts
 * // 创建引擎
 * const engine = new MiddlewareEngine<HttpContext>();
 * 
 * // 注册中间件
 * engine.use(loggerMiddleware);
 * engine.use(authMiddleware);
 * 
 * // 执行中间件链
 * const ctx: HttpContext = { request: config, state: {} };
 * await engine.dispatch(ctx, async () => {
 *   ctx.response = await adapter.request(ctx.request);
 * });
 * ```
 */
export class MiddlewareEngine<C = Record<string, unknown>> implements IMiddlewareEngine<C> {
  private middlewares: Middleware<C>[] = [];

  constructor(options?: MiddlewareEngineOptions<C>) {
    if (options?.middlewares) {
      this.middlewares = [...options.middlewares];
    }
  }

  /**
   * 注册中间件
   * 
   * @param middleware 中间件函数
   */
  use(middleware: Middleware<C>): void {
    if (typeof middleware !== 'function') {
      throw new TypeError('Middleware must be a function');
    }
    this.middlewares.push(middleware);
  }

  /**
   * 获取已注册的中间件列表
   * 
   * 主要用于调试和测试
   */
  getMiddlewares(): Middleware<C>[] {
    return [...this.middlewares];
  }

  /**
   * 执行中间件链
   * 
   * @param ctx 上下文对象
   * @param finalHandler 可选的最终处理函数（如实际发送请求）
   * @param extraMiddlewares 可选的本次执行额外中间件（per-request 中间件）
   * 
   * @throws 中间件或 finalHandler 抛出的任何错误都会直接向上传播
   */
  async dispatch(
    ctx: C,
    finalHandler?: () => Promise<void>,
    extraMiddlewares?: Middleware<C>[]
  ): Promise<void> {
    // 合并中间件：全局中间件 + 额外中间件
    const allMiddlewares: Middleware<C>[] = extraMiddlewares
      ? [...this.middlewares, ...extraMiddlewares]
      : this.middlewares;

    // 组合并执行中间件链
    const composed = composeMiddlewares(allMiddlewares, finalHandler);
    await composed(ctx);
  }
}

/**
 * 创建中间件引擎的工厂函数
 * 
 * @template C - 上下文类型
 * @param options 引擎配置
 * @returns 中间件引擎实例
 * 
 * @example
 * ```ts
 * const engine = createMiddlewareEngine<HttpContext>({
 *   middlewares: [loggerMiddleware, authMiddleware]
 * });
 * ```
 */
export function createMiddlewareEngine<C = Record<string, unknown>>(
  options?: MiddlewareEngineOptions<C>
): IMiddlewareEngine<C> {
  return new MiddlewareEngine<C>(options);
}
