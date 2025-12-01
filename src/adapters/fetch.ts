/**
 * Fetch 适配器
 * 
 * 将原生 fetch API 适配为统一的 HttpAdapter 接口
 */

import type { RequestConfig, ResponseData, HttpAdapter } from '../engine';

/**
 * Fetch 适配器配置
 */
export interface FetchAdapterConfig {
  /** 基础 URL */
  baseURL?: string;
  /** 默认请求头 */
  defaultHeaders?: Record<string, string>;
  /** 自定义 fetch 实现（用于 Node.js 环境或测试）*/
  customFetch?: typeof fetch;
  /** 请求和响应拦截器 */
  interceptors?: {
    /** 请求拦截器 */
    request?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
    /** 响应拦截器 */
    response?: (response: ResponseData) => ResponseData | Promise<ResponseData>;
  };
}

/**
 * 构建完整 URL
 */
function buildUrl(config: RequestConfig, baseURL?: string): string {
  let url = config.url;

  // 处理 baseURL
  if (baseURL && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = baseURL.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
  }

  // 处理 query params
  if (config.params && Object.keys(config.params).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(config.params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  return url;
}

/**
 * 将 Headers 对象转换为普通对象
 */
function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * 解析响应体
 */
async function parseResponseBody<T>(
  response: Response,
  responseType?: string
): Promise<T> {
  switch (responseType) {
    case 'text':
      return (await response.text()) as T;
    case 'blob':
      return (await response.blob()) as T;
    case 'arraybuffer':
      return (await response.arrayBuffer()) as T;
    case 'json':
    default:
      // 尝试解析 JSON，如果失败则返回原始文本
      const text = await response.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as T;
      }
  }
}

/**
 * 创建 Fetch 适配器
 * 
 * @param config 适配器配置
 * @returns HttpAdapter 实例
 * 
 * @example
 * ```ts
 * const adapter = createFetchAdapter({
 *   baseURL: 'https://api.example.com',
 *   defaultHeaders: { 'Content-Type': 'application/json' }
 * });
 * ```
 */
export function createFetchAdapter(config: FetchAdapterConfig = {}): HttpAdapter {
  const { baseURL, defaultHeaders = {}, customFetch, interceptors } = config;
  const fetchFn = customFetch || fetch;

  return {
    async request<TReqData = unknown, TResData = unknown>(
      requestConfig: RequestConfig<TReqData>
    ): Promise<ResponseData<TResData>> {
      // 应用请求拦截器
      let processedConfig: RequestConfig<any> = requestConfig;
      if (interceptors?.request) {
        processedConfig = await interceptors.request(requestConfig);
      }

      const url = buildUrl(processedConfig, processedConfig.baseURL || baseURL);

      // 构建请求头
      const headers: Record<string, string> = {
        ...defaultHeaders,
        ...processedConfig.headers,
      };

      // 如果有 body 且没有设置 Content-Type，自动添加
      if (processedConfig.data && !headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }

      // 构建 fetch 配置
      const fetchConfig: RequestInit = {
        method: processedConfig.method,
        headers,
      };

      // 处理请求体
      if (processedConfig.data !== undefined) {
        if (
          typeof processedConfig.data === 'object' &&
          !(processedConfig.data instanceof FormData) &&
          !(processedConfig.data instanceof Blob) &&
          !(processedConfig.data instanceof ArrayBuffer)
        ) {
          fetchConfig.body = JSON.stringify(processedConfig.data);
        } else {
          fetchConfig.body = processedConfig.data as BodyInit;
        }
      }

      // 处理超时
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let abortController: AbortController | undefined;

      if (processedConfig.timeout && processedConfig.timeout > 0) {
        abortController = new AbortController();
        fetchConfig.signal = abortController.signal;
        timeoutId = setTimeout(() => {
          abortController?.abort();
        }, processedConfig.timeout);
      }

      try {
        const response = await fetchFn(url, fetchConfig);

        // HTTP 错误状态码处理
        if (!response.ok) {
          const error = new Error(`HTTP Error: ${response.status} ${response.statusText}`);
          (error as Error & { status: number }).status = response.status;
          throw error;
        }

        const data = await parseResponseBody<TResData>(response, processedConfig.responseType);

        let result: ResponseData<any> = {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: headersToObject(response.headers),
          config: processedConfig as RequestConfig<TReqData>,
        };

        // 应用响应拦截器
        if (interceptors?.response) {
          result = await interceptors.response(result);
        }

        return result as ResponseData<TResData>;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    },
  };
}

/**
 * 创建 Fetch 适配器的快捷方法
 * 
 * @param baseURL 基础 URL
 * @returns HttpAdapter 实例
 */
export function fetchAdapter(baseURL?: string): HttpAdapter {
  return createFetchAdapter({ baseURL });
}
