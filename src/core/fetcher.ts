import { resolveResponse } from '../helper/resolve-response'
import { omitNilOfObj } from '../helper/utils'
import { HttpMethod } from '../types/types'
import { HttpError } from './error'

const DEFAULT_TIMEOUT = 10_000
export interface FetcherOptions extends RequestInit {
    /** 以下四个选项经常在 createFetcher 中全局固定 */
    baseURL?: string
    authKey?: string
    businessErrorCodesMap?: Record<string, string> // 业务错误码：提示信息
    timeout?: number

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
        authKey,
        businessErrorCodesMap,
        timeout = DEFAULT_TIMEOUT,

        urlParams,
        method = 'GET',
        body,
        ...rest
    } = options

    if (!baseURL || !endpoint) {
        throw new Error('baseURL/endpoint cannot be empty.')
    }
    const url = buildUrl(baseURL, endpoint, urlParams)
    const headers = buildHeader(authKey, rest.headers)
    const finalBody = buildBody(body!, headers as Record<string, string>)

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
            response.status === 401 && authKey && localStorage.removeItem(authKey)
            throw new HttpError(response.status, { url, method })
        }

        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
            const res = await response.json()
            return resolveResponse(res, businessErrorCodesMap) as T
        }

        return response.text() as unknown as T
    } catch (error) {
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
function buildHeader(authKey?: string, customHeaders?: HeadersInit) {
    const defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
    }

    if (authKey) {
        const token = localStorage.getItem(authKey)
        token && (defaultHeaders[authKey] = token)
    }

    return { ...defaultHeaders, ...(customHeaders ?? {}) }
}

// 构建请求体
function buildBody(body: BodyInit, headers: Record<string, string>) {
    let finalBody: string | FormData | undefined

    if (body instanceof FormData) {
        delete headers['Content-Type']
        return body
    } else {
        finalBody = typeof body === 'string' ? body : JSON.stringify(body)
    }

    return finalBody
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
