/**
 * compose 函数测试
 */

import { describe, it, expect, vi } from 'vitest';
import { composeMiddlewares } from '../src/engine/compose';
import type { Middleware } from '../src/engine/middlewareTypes';

describe('composeMiddlewares', () => {
  // 定义测试用的上下文类型
  interface TestContext {
    logs: string[];
    value: number;
  }

  it('should execute middlewares in onion model order', async () => {
    const ctx: TestContext = { logs: [], value: 0 };

    const middleware1: Middleware<TestContext> = async (ctx, next) => {
      ctx.logs.push('m1-before');
      await next();
      ctx.logs.push('m1-after');
    };

    const middleware2: Middleware<TestContext> = async (ctx, next) => {
      ctx.logs.push('m2-before');
      await next();
      ctx.logs.push('m2-after');
    };

    const middleware3: Middleware<TestContext> = async (ctx, next) => {
      ctx.logs.push('m3-before');
      await next();
      ctx.logs.push('m3-after');
    };

    const composed = composeMiddlewares([middleware1, middleware2, middleware3]);
    await composed(ctx);

    expect(ctx.logs).toEqual([
      'm1-before',
      'm2-before',
      'm3-before',
      'm3-after',
      'm2-after',
      'm1-after',
    ]);
  });

  it('should execute finalHandler correctly', async () => {
    const ctx: TestContext = { logs: [], value: 0 };

    const middleware: Middleware<TestContext> = async (ctx, next) => {
      ctx.logs.push('middleware-before');
      await next();
      ctx.logs.push('middleware-after');
    };

    const finalHandler = async () => {
      ctx.logs.push('final-handler');
      ctx.value = 42;
    };

    const composed = composeMiddlewares([middleware], finalHandler);
    await composed(ctx);

    expect(ctx.logs).toEqual([
      'middleware-before',
      'final-handler',
      'middleware-after',
    ]);
    expect(ctx.value).toBe(42);
  });

  it('如果 next() 被多次调用应该抛出错误', async () => {
    const ctx: TestContext = { logs: [], value: 0 };

    const badMiddleware: Middleware<TestContext> = async (ctx, next) => {
      await next();
      await next(); // 第二次调用应该抛错
    };

    const composed = composeMiddlewares([badMiddleware]);

    await expect(composed(ctx)).rejects.toThrow('next() called multiple times');
  });

  it('如果中间件不调用 next，后续中间件不应该执行', async () => {
    const ctx: TestContext = { logs: [], value: 0 };

    const middleware1: Middleware<TestContext> = async (ctx, next) => {
      ctx.logs.push('m1-before');
      // 故意不调用 next()
      ctx.logs.push('m1-after');
    };

    const middleware2: Middleware<TestContext> = async (ctx, next) => {
      ctx.logs.push('m2-before');
      await next();
      ctx.logs.push('m2-after');
    };

    const composed = composeMiddlewares([middleware1, middleware2]);
    await composed(ctx);

    expect(ctx.logs).toEqual(['m1-before', 'm1-after']);
  });

  it('空中间件数组应该直接执行 finalHandler', async () => {
    const ctx: TestContext = { logs: [], value: 0 };
    const finalHandler = vi.fn(async () => {
      ctx.value = 100;
    });

    const composed = composeMiddlewares<TestContext>([], finalHandler);
    await composed(ctx);

    expect(finalHandler).toHaveBeenCalledTimes(1);
    expect(ctx.value).toBe(100);
  });

  it('空中间件数组且无 finalHandler 应该正常完成', async () => {
    const ctx: TestContext = { logs: [], value: 0 };

    const composed = composeMiddlewares<TestContext>([]);
    await composed(ctx);

    expect(ctx.logs).toEqual([]);
    expect(ctx.value).toBe(0);
  });

  it('中间件抛出的错误应该向上传播', async () => {
    const ctx: TestContext = { logs: [], value: 0 };

    const errorMiddleware: Middleware<TestContext> = async () => {
      throw new Error('Test error');
    };

    const composed = composeMiddlewares([errorMiddleware]);

    await expect(composed(ctx)).rejects.toThrow('Test error');
  });

  it('finalHandler 抛出的错误应该向上传播', async () => {
    const ctx: TestContext = { logs: [], value: 0 };

    const middleware: Middleware<TestContext> = async (ctx, next) => {
      ctx.logs.push('before');
      await next();
      ctx.logs.push('after'); // 这不应该执行
    };

    const finalHandler = async () => {
      throw new Error('Final handler error');
    };

    const composed = composeMiddlewares([middleware], finalHandler);

    await expect(composed(ctx)).rejects.toThrow('Final handler error');
    expect(ctx.logs).toEqual(['before']); // after 不应该执行
  });

  it('should validate that middlewares must be an array', () => {
    expect(() => {
      // @ts-expect-error 测试错误输入
      composeMiddlewares('not an array');
    }).toThrow('Middlewares must be an array');
  });

  it('should validate that each middleware must be a function', () => {
    expect(() => {
      // @ts-expect-error 测试错误输入
      composeMiddlewares([() => {}, 'not a function']);
    }).toThrow('Middleware must be a function');
  });

  it('中间件可以修改上下文', async () => {
    const ctx: TestContext = { logs: [], value: 0 };

    const middleware1: Middleware<TestContext> = async (ctx, next) => {
      ctx.value = 10;
      await next();
      ctx.value += 1; // 11
    };

    const middleware2: Middleware<TestContext> = async (ctx, next) => {
      ctx.value *= 2; // 20
      await next();
      ctx.value += 2; // 22 + 2 = 24... wait, let me trace this
    };

    const finalHandler = async () => {
      ctx.value += 100; // 20 + 100 = 120
    };

    const composed = composeMiddlewares([middleware1, middleware2], finalHandler);
    await composed(ctx);

    // 执行顺序：
    // m1-before: value = 10
    // m2-before: value = 10 * 2 = 20
    // finalHandler: value = 20 + 100 = 120
    // m2-after: value = 120 + 2 = 122
    // m1-after: value = 122 + 1 = 123
    expect(ctx.value).toBe(123);
  });
});
