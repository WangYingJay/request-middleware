/**
 * MiddlewareEngine 测试
 */

import { describe, it, expect, vi } from 'vitest';
import { MiddlewareEngine, createMiddlewareEngine } from '../src/engine/middlewareEngine';
import type { Middleware } from '../src/engine/middlewareTypes';

describe('MiddlewareEngine', () => {
  interface TestContext {
    logs: string[];
    data?: unknown;
  }

  describe('构造函数', () => {
    it('should be creatable without parameters', () => {
      const engine = new MiddlewareEngine<TestContext>();
      expect(engine.getMiddlewares()).toEqual([]);
    });

    it('should be initializable with options', () => {
      const mw1: Middleware<TestContext> = async (ctx, next) => next();
      const mw2: Middleware<TestContext> = async (ctx, next) => next();

      const engine = new MiddlewareEngine<TestContext>({
        middlewares: [mw1, mw2],
      });

      expect(engine.getMiddlewares()).toHaveLength(2);
    });
  });

  describe('use()', () => {
    it('should be able to register middleware', () => {
      const engine = new MiddlewareEngine<TestContext>();
      const mw: Middleware<TestContext> = async (ctx, next) => next();

      engine.use(mw);

      expect(engine.getMiddlewares()).toHaveLength(1);
      expect(engine.getMiddlewares()[0]).toBe(mw);
    });

    it('should add middlewares in registration order', () => {
      const engine = new MiddlewareEngine<TestContext>();
      const mw1: Middleware<TestContext> = async (ctx, next) => next();
      const mw2: Middleware<TestContext> = async (ctx, next) => next();

      engine.use(mw1);
      engine.use(mw2);

      const middlewares = engine.getMiddlewares();
      expect(middlewares[0]).toBe(mw1);
      expect(middlewares[1]).toBe(mw2);
    });

    it('should validate that middleware must be a function', () => {
      const engine = new MiddlewareEngine<TestContext>();

      expect(() => {
        // @ts-expect-error 测试错误输入
        engine.use('not a function');
      }).toThrow('Middleware must be a function');
    });
  });

  describe('getMiddlewares()', () => {
    it('should return a copy of middleware list', () => {
      const engine = new MiddlewareEngine<TestContext>();
      const mw: Middleware<TestContext> = async (ctx, next) => next();
      engine.use(mw);

      const middlewares1 = engine.getMiddlewares();
      const middlewares2 = engine.getMiddlewares();

      expect(middlewares1).not.toBe(middlewares2);
      expect(middlewares1).toEqual(middlewares2);
    });
  });

  describe('dispatch()', () => {
    it('should execute middlewares in onion model', async () => {
      const engine = new MiddlewareEngine<TestContext>();
      const ctx: TestContext = { logs: [] };

      engine.use(async (ctx, next) => {
        ctx.logs.push('m1-before');
        await next();
        ctx.logs.push('m1-after');
      });

      engine.use(async (ctx, next) => {
        ctx.logs.push('m2-before');
        await next();
        ctx.logs.push('m2-after');
      });

      await engine.dispatch(ctx);

      expect(ctx.logs).toEqual([
        'm1-before',
        'm2-before',
        'm2-after',
        'm1-after',
      ]);
    });

    it('should execute finalHandler correctly', async () => {
      const engine = new MiddlewareEngine<TestContext>();
      const ctx: TestContext = { logs: [] };

      engine.use(async (ctx, next) => {
        ctx.logs.push('middleware');
        await next();
      });

      const finalHandler = vi.fn(async () => {
        ctx.logs.push('final');
        ctx.data = { result: 'success' };
      });

      await engine.dispatch(ctx, finalHandler);

      expect(finalHandler).toHaveBeenCalledTimes(1);
      expect(ctx.logs).toEqual(['middleware', 'final']);
      expect(ctx.data).toEqual({ result: 'success' });
    });

    it('should support extraMiddlewares', async () => {
      const engine = new MiddlewareEngine<TestContext>();
      const ctx: TestContext = { logs: [] };

      engine.use(async (ctx, next) => {
        ctx.logs.push('global');
        await next();
      });

      const extraMw: Middleware<TestContext> = async (ctx, next) => {
        ctx.logs.push('extra');
        await next();
      };

      await engine.dispatch(ctx, undefined, [extraMw]);

      expect(ctx.logs).toEqual(['global', 'extra']);
    });

    it('extraMiddlewares 应该在全局中间件之后执行', async () => {
      const engine = new MiddlewareEngine<TestContext>();
      const ctx: TestContext = { logs: [] };

      engine.use(async (ctx, next) => {
        ctx.logs.push('g1-before');
        await next();
        ctx.logs.push('g1-after');
      });

      engine.use(async (ctx, next) => {
        ctx.logs.push('g2-before');
        await next();
        ctx.logs.push('g2-after');
      });

      const extra1: Middleware<TestContext> = async (ctx, next) => {
        ctx.logs.push('e1-before');
        await next();
        ctx.logs.push('e1-after');
      };

      const extra2: Middleware<TestContext> = async (ctx, next) => {
        ctx.logs.push('e2-before');
        await next();
        ctx.logs.push('e2-after');
      };

      await engine.dispatch(ctx, undefined, [extra1, extra2]);

      expect(ctx.logs).toEqual([
        'g1-before',
        'g2-before',
        'e1-before',
        'e2-before',
        'e2-after',
        'e1-after',
        'g2-after',
        'g1-after',
      ]);
    });

    it('错误应该向上传播', async () => {
      const engine = new MiddlewareEngine<TestContext>();
      const ctx: TestContext = { logs: [] };

      engine.use(async () => {
        throw new Error('Middleware error');
      });

      await expect(engine.dispatch(ctx)).rejects.toThrow('Middleware error');
    });

    it('finalHandler 错误应该向上传播', async () => {
      const engine = new MiddlewareEngine<TestContext>();
      const ctx: TestContext = { logs: [] };

      engine.use(async (ctx, next) => {
        ctx.logs.push('before');
        await next();
        ctx.logs.push('after');
      });

      const finalHandler = async () => {
        throw new Error('Final error');
      };

      await expect(engine.dispatch(ctx, finalHandler)).rejects.toThrow('Final error');
      expect(ctx.logs).toEqual(['before']);
    });
  });
});

describe('createMiddlewareEngine', () => {
  interface TestContext {
    value: number;
  }

  it('should create MiddlewareEngine instance', () => {
    const engine = createMiddlewareEngine<TestContext>();

    expect(engine).toBeDefined();
    expect(typeof engine.use).toBe('function');
    expect(typeof engine.getMiddlewares).toBe('function');
    expect(typeof engine.dispatch).toBe('function');
  });

  it('should support initial middlewares', () => {
    const mw: Middleware<TestContext> = async (ctx, next) => next();
    const engine = createMiddlewareEngine<TestContext>({
      middlewares: [mw],
    });

    expect(engine.getMiddlewares()).toHaveLength(1);
  });
});
