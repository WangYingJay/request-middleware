/**
 * 中间件组合函数 - 实现洋葱模型
 * 
 * 设计参考：
 * - Koa 的 compose 函数
 * - Gin 的 c.Next() 模型
 * - Express 的中间件链
 * 
 * 执行顺序示意：
 * ```
 * middleware1 前置逻辑
 *   → middleware2 前置逻辑
 *     → middleware3 前置逻辑
 *       → finalHandler
 *     ← middleware3 后置逻辑
 *   ← middleware2 后置逻辑
 * ← middleware1 后置逻辑
 * ```
 */

import type { Middleware, NextFunction } from './middlewareTypes';

/**
 * 组合中间件数组为单一执行函数
 * 
 * @template C - 上下文类型
 * @param middlewares - 中间件数组
 * @param finalHandler - 可选的最终处理函数
 * @returns 组合后的执行函数
 * 
 * @example
 * ```ts
 * const composed = composeMiddlewares(
 *   [loggerMiddleware, authMiddleware],
 *   () => adapter.request(ctx.request)
 * );
 * await composed(ctx);
 * ```
 */
export function composeMiddlewares<C = Record<string, unknown>>(
  middlewares: Middleware<C>[],
  finalHandler?: () => Promise<void>
): (ctx: C) => Promise<void> {
  // 验证中间件数组
  if (!Array.isArray(middlewares)) {
    throw new TypeError('Middlewares must be an array');
  }

  for (const middleware of middlewares) {
    if (typeof middleware !== 'function') {
      throw new TypeError('Middleware must be a function');
    }
  }

  return async function composed(ctx: C): Promise<void> {
    // 用于检测 next() 是否被重复调用
    let currentIndex = -1;

    async function dispatch(index: number): Promise<void> {
      // 检测 next() 被重复调用
      if (index <= currentIndex) {
        throw new Error('next() called multiple times');
      }
      currentIndex = index;

      // 获取当前中间件
      const middleware = middlewares[index];

      if (index === middlewares.length) {
        // 所有中间件执行完毕，执行 finalHandler（如果存在）
        if (finalHandler) {
          await finalHandler();
        }
        return;
      }

      if (!middleware) {
        return;
      }

      // 创建 next 函数，调用下一个中间件
      const next: NextFunction = () => dispatch(index + 1);

      // 执行当前中间件
      await middleware(ctx, next);
    }

    // 从第一个中间件开始执行
    await dispatch(0);
  };
}
