import { resolveResponse } from '../helper/resolve-response'
import { omitNilOfObj } from '../helper/utils'
import { HttpMethod } from '../types'
import { BusinessError, HttpError } from './error'

const DEFAULT_TIMEOUT = 10_000
export type ResponseResolver<T = unknown> = (
    response: unknown,
    businessErrorCodesMap: Record<string, string>
) => T

export interface FetcherOptions extends Omit<RequestInit, 'body' | 'method'> {
    /** 以下选项经常在 createFetcher 中全局固定 */
    baseURL?: string
    authStorageKey?: string | (() => string | null | undefined)
    authHeaderKey?: string
    businessErrorCodesMap?: Record<string, string> // 业务错误码：提示信息
    timeout?: number
    /** 自定义存储实例，默认使用 localStorage */
    storage?: Storage
    /** 自定义响应解包函数，默认使用 resolveResponse（期望 { code, data, message } 结构） */
    responseResolver?: ResponseResolver

    urlParams?: Record<string, unknown>
    method?: HttpMethod
    body?: unknown
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
        responseResolver = resolveResponse,
        urlParams,
        method = 'GET',
        body,
        signal,
        ...rest
    } = options

    if (!baseURL || !endpoint) {
        throw new Error('baseURL/endpoint cannot be empty.')
    }
    const url = buildUrl(baseURL, endpoint, urlParams)
    const headers = buildHeader(authStorageKey, authHeaderKey, rest.headers, storage)
    const finalBody = buildBody(body, headers)

    const controller = new AbortController()
    let timeoutAbort = false
    const onAbort = () => {
        if (signal && 'reason' in signal) {
            controller.abort(signal.reason)
            return
        }
        controller.abort()
    }
    if (signal?.aborted) {
        onAbort()
    } else {
        signal?.addEventListener('abort', onAbort, { once: true })
    }
    const timeoutId = setTimeout(() => {
        timeoutAbort = true
        controller.abort(new DOMException('The request timed out.', 'TimeoutError'))
    }, timeout)

    try {
        const response = await fetch(url, {
            ...rest,
            method,
            headers,
            body: finalBody,
            signal: controller.signal
        })

        if (!response.ok) {
            if (response.status === 401 && authStorageKey && typeof authStorageKey === 'string') {
                getStorage(storage).removeItem(authStorageKey)
            }
            throw new HttpError(response.status, { url, method })
        }

        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
            const res = await response.json()
            return responseResolver(res, businessErrorCodesMap ?? {}) as T
        }

        return response.text() as unknown as T
    } catch (error) {
        // 已经是已知的 API 错误，直接透传
        if (error instanceof HttpError || error instanceof BusinessError) {
            throw error
        }
        if (controller.signal.aborted || isAbortError(error)) {
            throw new HttpError(timeoutAbort ? 408 : 499, { url, method })
        }
        // 其他错误 - 网络错误 / 跨域 / 连接失败 等
        throw new HttpError(999, { url, method })
    } finally {
        clearTimeout(timeoutId)
        signal?.removeEventListener('abort', onAbort)
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
    authStorageKey?: string | (() => string | null | undefined),
    authHeaderKey?: string,
    customHeaders?: HeadersInit,
    storage?: Storage
): Record<string, string> {
    const defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
    }

    if (authStorageKey && authHeaderKey) {
        const token =
            typeof authStorageKey === 'function'
                ? authStorageKey()
                : getStorage(storage).getItem(authStorageKey)
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
function buildBody(body: unknown, headers: Record<string, string>): BodyInit | undefined {
    if (body == null) return undefined

    if (isFormData(body)) {
        deleteContentType(headers)
        return body
    }

    if (isBodyInit(body)) {
        if (typeof body !== 'string') {
            deleteDefaultJsonContentType(headers)
        }
        return body
    }

    return JSON.stringify(body)
}

export function createFetcher(defaultOptions: Partial<FetcherOptions>) {
    return async <T = unknown>(endpoint: string, customOptions: FetcherOptions): Promise<T> => {
        const mergedOptions = {
            ...defaultOptions,
            ...customOptions,
            headers: mergeHeaders(defaultOptions.headers, customOptions.headers)
        }

        return fetcher<T>(endpoint, mergedOptions)
    }
}

export type RequestFn = <T = unknown>(endpoint: string, options: FetcherOptions) => Promise<T>

function mergeHeaders(
    defaultHeaders?: HeadersInit,
    customHeaders?: HeadersInit
): Record<string, string> | undefined {
    if (!defaultHeaders && !customHeaders) return undefined
    return {
        ...headersToRecord(defaultHeaders),
        ...headersToRecord(customHeaders)
    }
}

function headersToRecord(headers?: HeadersInit): Record<string, string> {
    const record: Record<string, string> = {}
    if (!headers) return record

    if (headers instanceof Headers) {
        headers.forEach((value, key) => {
            record[key] = value
        })
        return record
    }

    if (Array.isArray(headers)) {
        for (const [key, value] of headers) {
            record[key] = value
        }
        return record
    }

    return { ...headers }
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError'
}

function isBodyInit(body: unknown): body is BodyInit {
    return (
        typeof body === 'string' ||
        isBlob(body) ||
        isArrayBuffer(body) ||
        isArrayBufferView(body) ||
        isReadableStream(body) ||
        isURLSearchParams(body)
    )
}

function isFormData(body: unknown): body is FormData {
    return typeof FormData !== 'undefined' && body instanceof FormData
}

function isBlob(body: unknown): body is Blob {
    return typeof Blob !== 'undefined' && body instanceof Blob
}

function isURLSearchParams(body: unknown): body is URLSearchParams {
    return typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams
}

function isReadableStream(body: unknown): body is ReadableStream {
    return typeof ReadableStream !== 'undefined' && body instanceof ReadableStream
}

function isArrayBuffer(body: unknown): body is ArrayBuffer {
    return typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer
}

function isArrayBufferView(body: unknown): body is ArrayBufferView<ArrayBuffer> {
    return ArrayBuffer.isView(body) && body.buffer instanceof ArrayBuffer
}

function deleteContentType(headers: Record<string, string>) {
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'content-type') {
            delete headers[key]
        }
    }
}

function deleteDefaultJsonContentType(headers: Record<string, string>) {
    for (const [key, value] of Object.entries(headers)) {
        if (
            key.toLowerCase() === 'content-type' &&
            value.toLowerCase().includes('application/json')
        ) {
            delete headers[key]
        }
    }
}
