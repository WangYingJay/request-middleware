/**
 * HTTP Client 测试
 */

import { describe, it, expect, vi } from 'vitest';
import { createHttpClient } from '../src/client/httpClient';
import type { HttpAdapter, RequestConfig } from '../src/engine';

describe('createHttpClient', () => {
  it('should create an HTTP client instance', () => {
    const mockAdapter: HttpAdapter = {
      request: vi.fn(),
    };

    const client = createHttpClient({
      adapter: mockAdapter,
    });

    expect(client).toBeDefined();
    expect(typeof client.request).toBe('function');
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.delete).toBe('function');
    expect(typeof client.patch).toBe('function');
  });

  it('should use default configuration', async () => {
    const mockAdapter: HttpAdapter = {
      request: vi.fn().mockResolvedValue({
        data: { message: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as RequestConfig,
      }),
    };

    const client = createHttpClient({
      adapter: mockAdapter,
      defaults: {
        baseURL: 'https://api.example.com',
        headers: { 'Authorization': 'Bearer token' },
      },
    });

    await client.get('/users');

    expect(mockAdapter.request).toHaveBeenCalledWith({
      baseURL: 'https://api.example.com',
      headers: { 'Authorization': 'Bearer token' },
      url: '/users',
      method: 'GET',
    });
  });

  it('should handle GET requests correctly', async () => {
    const mockAdapter: HttpAdapter = {
      request: vi.fn().mockResolvedValue({
        data: [{ id: 1, name: 'John' }],
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config: {} as RequestConfig,
      }),
    };

    const client = createHttpClient({
      adapter: mockAdapter,
    });

    const response = await client.get('/users', {
      params: { page: 1 },
      headers: { 'Accept': 'application/json' },
    });

    expect(mockAdapter.request).toHaveBeenCalledWith({
      url: '/users',
      method: 'GET',
      params: { page: 1 },
      headers: { 'Accept': 'application/json' },
    });

    expect(response).toEqual({
      data: [{ id: 1, name: 'John' }],
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      config: {} as RequestConfig,
    });
  });

  it('should handle POST requests correctly', async () => {
    const mockAdapter: HttpAdapter = {
      request: vi.fn().mockResolvedValue({
        data: { id: 1, name: 'John' },
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'application/json' },
        config: {} as RequestConfig,
      }),
    };

    const client = createHttpClient({
      adapter: mockAdapter,
    });

    const userData = { name: 'John', email: 'john@example.com' };
    const response = await client.post('/users', userData, {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(mockAdapter.request).toHaveBeenCalledWith({
      url: '/users',
      method: 'POST',
      data: userData,
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response).toEqual({
      data: { id: 1, name: 'John' },
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'application/json' },
      config: {} as RequestConfig,
    });
  });

  it('should handle PUT requests correctly', async () => {
    const mockAdapter: HttpAdapter = {
      request: vi.fn().mockResolvedValue({
        data: { id: 1, name: 'John Updated' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config: {} as RequestConfig,
      }),
    };

    const client = createHttpClient({
      adapter: mockAdapter,
    });

    const userData = { name: 'John Updated' };
    const response = await client.put('/users/1', userData);

    expect(mockAdapter.request).toHaveBeenCalledWith({
      url: '/users/1',
      method: 'PUT',
      data: userData,
      headers: {},
    });

    expect(response.data).toEqual({ id: 1, name: 'John Updated' });
  });

  it('should handle DELETE requests correctly', async () => {
    const mockAdapter: HttpAdapter = {
      request: vi.fn().mockResolvedValue({
        data: null,
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {} as RequestConfig,
      }),
    };

    const client = createHttpClient({
      adapter: mockAdapter,
    });

    const response = await client.delete('/users/1');

    expect(mockAdapter.request).toHaveBeenCalledWith({
      url: '/users/1',
      method: 'DELETE',
      headers: {},
    });

    expect(response.status).toBe(204);
  });

  it('should handle PATCH requests correctly', async () => {
    const mockAdapter: HttpAdapter = {
      request: vi.fn().mockResolvedValue({
        data: { id: 1, name: 'John', email: 'john@example.com' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config: {} as RequestConfig,
      }),
    };

    const client = createHttpClient({
      adapter: mockAdapter,
    });

    const updateData = { email: 'john@example.com' };
    const response = await client.patch('/users/1', updateData);

    expect(mockAdapter.request).toHaveBeenCalledWith({
      url: '/users/1',
      method: 'PATCH',
      data: updateData,
      headers: {},
    });

    expect((response.data as any).email).toBe('john@example.com');
  });

  it('should support middleware', async () => {
    const mockAdapter: HttpAdapter = {
      request: vi.fn().mockResolvedValue({
        data: 'response',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as RequestConfig,
      }),
    };

    const middleware = vi.fn(async (ctx, next) => {
      ctx.state.modified = true;
      await next();
    });

    const client = createHttpClient({
      adapter: mockAdapter,
      middlewares: [middleware],
    });

    await client.get('/test');

    expect(middleware).toHaveBeenCalled();
  });

  it('should handle adapter errors', async () => {
    const mockAdapter: HttpAdapter = {
      request: vi.fn().mockRejectedValue(new Error('Network error')),
    };

    const client = createHttpClient({
      adapter: mockAdapter,
    });

    await expect(client.get('/test')).rejects.toThrow('Network error');
  });
});