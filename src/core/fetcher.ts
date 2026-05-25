import { resolveResponse } from '../helper/resolve-response'
import { omitNilOfObj } from '../helper/utils'
import { HttpMethod } from '../types'
import { BusinessError, HttpError } from './error'

const DEFAULT_TIMEOUT = 10_000
export interface FetcherOptions extends RequestInit {
    /** 以下选项经常在 createFetcher 中全局固定 */
    baseURL?: string
    authStorageKey?: string
    authHeaderKey?: string
    businessErrorCodesMap?: Record<string, string> // 业务错误码：提示信息
    timeout?: number
    /** 自定义存储实例，默认使用 localStorage */
    storage?: Storage

    urlParams?: Record<string, unknown>
    method?: HttpMethod
}

/**
 * 请求 fetcher 核心方法
 */
export const fetcher = async <T = unknown>(
    endpoint: string,
    options: FetcherOptions
): Promise<T> => {
    const {
        baseURL,
        authStorageKey,
        authHeaderKey,
        businessErrorCodesMap,
        timeout = DEFAULT_TIMEOUT,
        storage,
        urlParams,
        method = 'GET',
        body,
        ...rest
    } = options

    if (!baseURL || !endpoint) {
        throw new Error('baseURL/endpoint cannot be empty.')
    }
    const url = buildUrl(baseURL, endpoint, urlParams)
    const headers = buildHeader(authStorageKey, authHeaderKey, rest.headers, storage)
    const finalBody = buildBody(body, headers as Record<string, string>)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
        const response = await fetch(url, {
            ...rest,
            method,
            headers,
            body: finalBody,
            signal: controller.signal
        })

        if (!response.ok) {
            if (response.status === 401 && authStorageKey) {
                getStorage(storage).removeItem(authStorageKey)
            }
            throw new HttpError(response.status, { url, method })
        }

        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
            const res = await response.json()
            return resolveResponse(res, businessErrorCodesMap) as T
        }

        return response.text() as unknown as T
    } catch (error) {
        // 已经是已知的 API 错误，直接透传
        if (error instanceof HttpError || error instanceof BusinessError) {
            throw error
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new HttpError(408, { url, method })
        }
        // 其他错误 - 网络错误 / 跨域 / 连接失败 等
        throw new HttpError(999, { url, method })
    } finally {
        clearTimeout(timeoutId)
    }
}

// 构建请求 url
function buildUrl(baseURL: string, endpoint: string, urlParams?: Record<string, unknown>): string {
    let url: string

    const isFullUrl = baseURL.startsWith('http://') || baseURL.startsWith('https://')
    if (isFullUrl) {
        const base = new URL(baseURL)
        const pathname = base.pathname.replace(/\/$/, '')
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
        url = new URL(pathname + normalizedEndpoint, base.origin).toString()
    } else {
        url = `${baseURL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`
    }

    if (urlParams && typeof urlParams === 'object') {
        const filteredUrlParams = omitNilOfObj(urlParams)
        if (Object.keys(filteredUrlParams).length > 0) {
            const searchParams = new URLSearchParams(filteredUrlParams as Record<string, string>)
            url += (url.includes('?') ? '&' : '?') + searchParams.toString()
        }
    }

    return url
}

// 构建请求头
function buildHeader(
    authStorageKey?: string,
    authHeaderKey?: string,
    customHeaders?: HeadersInit,
    storage?: Storage
) {
    const defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
    }

    if (authStorageKey && authHeaderKey) {
        const token = getStorage(storage).getItem(authStorageKey)
        token && (defaultHeaders[authHeaderKey] = token)
    }

    const custom: Record<string, string> = {}
    if (customHeaders) {
        if (customHeaders instanceof Headers) {
            customHeaders.forEach((value, key) => {
                custom[key] = value
            })
        } else if (Array.isArray(customHeaders)) {
            for (const [key, value] of customHeaders) {
                custom[key] = value
            }
        } else {
            Object.assign(custom, customHeaders)
        }
    }

    return { ...defaultHeaders, ...custom }
}

// 获取存储实例，SSR 环境下安全回退
function getStorage(storage?: Storage): Storage {
    if (storage) return storage
    if (typeof localStorage !== 'undefined') return localStorage
    throw new Error(
        'localStorage is not available in this environment. ' +
            'Please provide a custom storage via the `storage` option.'
    )
}

// 构建请求体
function buildBody(body: BodyInit | null | undefined, headers: Record<string, string>) {
    if (body == null) return undefined

    if (body instanceof FormData) {
        delete headers['Content-Type']
        return body
    }

    return typeof body === 'string' ? body : JSON.stringify(body)
}

export function createFetcher(defaultOptions: Partial<FetcherOptions>) {
    return async <T = unknown>(endpoint: string, customOptions: FetcherOptions): Promise<T> => {
        const mergedOptions = {
            ...defaultOptions,
            ...customOptions,
            headers: {
                ...defaultOptions.headers,
                ...customOptions.headers
            }
        }

        return fetcher<T>(endpoint, mergedOptions)
    }
}

export type RequestFn = <T = unknown>(endpoint: string, options: FetcherOptions) => Promise<T>
