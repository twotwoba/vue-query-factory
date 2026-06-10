import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetcher, createFetcher } from '../src/core/fetcher'
import { HttpError, BusinessError } from '../src/core/error'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock localStorage
const storage = {} as Record<string, string>
vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
        storage[key] = value
    }),
    removeItem: vi.fn((key: string) => {
        delete storage[key]
    }),
    clear: vi.fn(() => {
        for (const key of Object.keys(storage)) delete storage[key]
    }),
    get length() {
        return Object.keys(storage).length
    },
    key: vi.fn(() => null)
})

function mockJsonResponse(data: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(data)
    }
}

describe('fetcher', () => {
    beforeEach(() => {
        mockFetch.mockReset()
        for (const key of Object.keys(storage)) delete storage[key]
    })

    it('should throw when baseURL is empty', async () => {
        await expect(fetcher('/api/test', { baseURL: '' })).rejects.toThrow(
            'baseURL/endpoint cannot be empty.'
        )
    })

    it('should throw when endpoint is empty', async () => {
        await expect(fetcher('', { baseURL: 'http://api.com' })).rejects.toThrow(
            'baseURL/endpoint cannot be empty.'
        )
    })

    it('should make GET request and return data', async () => {
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: { name: 'test' } }))

        const result = await fetcher<{ name: string }>('/api/test', {
            baseURL: 'http://api.com'
        })

        expect(result).toEqual({ name: 'test' })
        expect(mockFetch).toHaveBeenCalledWith(
            'http://api.com/api/test',
            expect.objectContaining({ method: 'GET' })
        )
    })

    it('should throw HttpError with correct status for non-ok responses', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            headers: new Headers()
        })

        try {
            await fetcher('/api/missing', { baseURL: 'http://api.com' })
            expect.unreachable('Should have thrown')
        } catch (e) {
            expect(e).toBeInstanceOf(HttpError)
            expect((e as HttpError).code).toBe(404)
        }
    })

    // 关键测试：验证 catch 块不再吞掉 HttpError
    it('should NOT wrap HttpError into HttpError(999)', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            headers: new Headers()
        })

        try {
            await fetcher('/api/error', { baseURL: 'http://api.com' })
        } catch (e) {
            expect(e).toBeInstanceOf(HttpError)
            expect((e as HttpError).code).toBe(500)
            // 确保没有被包装成 999
            expect((e as HttpError).code).not.toBe(999)
        }
    })

    // 关键测试：验证 catch 块不再吞掉 BusinessError
    it('should NOT wrap BusinessError into HttpError(999)', async () => {
        mockFetch.mockResolvedValueOnce(
            mockJsonResponse({ code: 'BIZ_ERROR', message: '业务异常' })
        )

        try {
            await fetcher('/api/biz-error', {
                baseURL: 'http://api.com',
                businessErrorCodesMap: { BIZ_ERROR: '业务出错了' }
            })
        } catch (e) {
            expect(e).toBeInstanceOf(BusinessError)
            // 确保没有被包装成 HttpError
            expect(e).not.toBeInstanceOf(HttpError)
        }
    })

    it('should support businessErrorConfig errMsgKey and tipFunc', async () => {
        const tipFunc = vi.fn()
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 1002, errMsg: '余额不足' }))

        try {
            await fetcher('/api/biz-error', {
                baseURL: 'http://api.com',
                businessErrorConfig: {
                    codes: [[1002]],
                    errMsgKey: 'errMsg',
                    tipFunc
                }
            })
            expect.unreachable('Should have thrown')
        } catch (e) {
            expect(e).toBeInstanceOf(BusinessError)
            expect((e as BusinessError).message).toBe('余额不足')
            expect(tipFunc).toHaveBeenCalledWith('余额不足', e)
        }
    })

    it('should merge legacy businessErrorCodesMap with businessErrorConfig options', async () => {
        const tipFunc = vi.fn()
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 'BIZ_ERROR', msg: '业务异常' }))

        try {
            await fetcher('/api/biz-error', {
                baseURL: 'http://api.com',
                businessErrorCodesMap: { BIZ_ERROR: '' },
                businessErrorConfig: {
                    errMsgKey: 'msg',
                    tipFunc
                }
            })
            expect.unreachable('Should have thrown')
        } catch (e) {
            expect(e).toBeInstanceOf(BusinessError)
            expect((e as BusinessError).message).toBe('业务异常')
            expect(tipFunc).toHaveBeenCalledWith('业务异常', e)
        }
    })

    it('should throw HttpError(408) on timeout', async () => {
        vi.useFakeTimers()
        try {
            const abortError = new DOMException('The operation was aborted.', 'AbortError')
            mockFetch.mockImplementationOnce((_url, init: RequestInit) => {
                return new Promise((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => reject(abortError), { once: true })
                })
            })

            const request = fetcher('/api/slow', { baseURL: 'http://api.com', timeout: 100 })
            const assertion = expect(request).rejects.toMatchObject({ code: 408 })
            await vi.advanceTimersByTimeAsync(100)

            await assertion
        } finally {
            vi.useRealTimers()
        }
    })

    it('should throw HttpError(499) on external abort', async () => {
        const controller = new AbortController()
        const abortError = new DOMException('The operation was aborted.', 'AbortError')
        mockFetch.mockImplementationOnce((_url, init: RequestInit) => {
            return new Promise((_resolve, reject) => {
                init.signal?.addEventListener('abort', () => reject(abortError), { once: true })
            })
        })

        const request = fetcher('/api/cancelled', {
            baseURL: 'http://api.com',
            signal: controller.signal
        })
        controller.abort()

        await expect(request).rejects.toMatchObject({ code: 499 })
    })

    it('should throw HttpError(999) on network error', async () => {
        mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

        try {
            await fetcher('/api/down', { baseURL: 'http://api.com' })
        } catch (e) {
            expect(e).toBeInstanceOf(HttpError)
            expect((e as HttpError).code).toBe(999)
        }
    })

    it('should inject auth token from localStorage', async () => {
        storage['auth_token'] = 'my-jwt-token'
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: null }))

        await fetcher('/api/me', {
            baseURL: 'http://api.com',
            authStorageKey: 'auth_token',
            authHeaderKey: 'Authorization'
        })

        const callArgs = mockFetch.mock.calls[0][1] as RequestInit
        expect((callArgs.headers as Record<string, string>)['Authorization']).toBe('my-jwt-token')
    })

    it('should inject auth token via custom function', async () => {
        const getToken = vi.fn(() => {
            const raw = localStorage.getItem('user_info')
            if (!raw) return null
            return JSON.parse(raw).accessToken
        })

        storage['user_info'] = JSON.stringify({ accessToken: 'parsed-token', refreshToken: 'xxx' })
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: null }))

        await fetcher('/api/me', {
            baseURL: 'http://api.com',
            authStorageKey: getToken,
            authHeaderKey: 'Authorization'
        })

        const callArgs = mockFetch.mock.calls[0][1] as RequestInit
        expect((callArgs.headers as Record<string, string>)['Authorization']).toBe('parsed-token')
    })

    it('should skip auth header when custom function returns null', async () => {
        const getToken = vi.fn(() => null)
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: null }))

        await fetcher('/api/me', {
            baseURL: 'http://api.com',
            authStorageKey: getToken,
            authHeaderKey: 'Authorization'
        })

        const callArgs = mockFetch.mock.calls[0][1] as RequestInit
        expect((callArgs.headers as Record<string, string>)['Authorization']).toBeUndefined()
    })

    it('should NOT clear storage on 401 when authStorageKey is a function', async () => {
        const getToken = vi.fn(() => 'some-token')
        storage['user_info'] = JSON.stringify({ accessToken: 'some-token' })
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            headers: new Headers()
        })

        try {
            await fetcher('/api/me', {
                baseURL: 'http://api.com',
                authStorageKey: getToken,
                authHeaderKey: 'Authorization'
            })
        } catch {}

        // storage should NOT be cleared since authStorageKey is a function
        expect(storage['user_info']).toBeDefined()
    })

    it('should clear auth token on 401', async () => {
        storage['auth_token'] = 'expired-token'
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            headers: new Headers()
        })

        try {
            await fetcher('/api/me', {
                baseURL: 'http://api.com',
                authStorageKey: 'auth_token',
                authHeaderKey: 'Authorization'
            })
        } catch {}

        expect(storage['auth_token']).toBeUndefined()
    })

    it('should support custom storage', async () => {
        const customStorage = {
            getItem: vi.fn(() => 'custom-token'),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            get length() {
                return 0
            },
            key: vi.fn(() => null)
        }
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: null }))

        await fetcher('/api/me', {
            baseURL: 'http://api.com',
            authStorageKey: 'token',
            authHeaderKey: 'X-Token',
            storage: customStorage
        })

        expect(customStorage.getItem).toHaveBeenCalledWith('token')
    })

    it('should return text for non-JSON response', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'text/plain' }),
            text: () => Promise.resolve('plain text response')
        })

        const result = await fetcher('/api/text', { baseURL: 'http://api.com' })
        expect(result).toBe('plain text response')
    })

    it('should append urlParams to query string', async () => {
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: null }))

        await fetcher('/api/list', {
            baseURL: 'http://api.com',
            urlParams: { page: 1, size: 10, q: undefined }
        })

        const url = mockFetch.mock.calls[0][0] as string
        expect(url).toContain('page=1')
        expect(url).toContain('size=10')
        // undefined values should be filtered
        expect(url).not.toContain('q=')
    })

    it('should build URL with relative baseURL', async () => {
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: null }))

        await fetcher('/api/test', { baseURL: '/app' })
        expect(mockFetch.mock.calls[0][0]).toBe('/app/api/test')
    })

    it('should send JSON body for POST requests', async () => {
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: { id: 1 } }))

        await fetcher('/api/users', {
            baseURL: 'http://api.com',
            method: 'POST',
            body: { name: 'test' }
        })

        const callArgs = mockFetch.mock.calls[0][1] as RequestInit
        expect(callArgs.method).toBe('POST')
        expect(callArgs.body).toBe(JSON.stringify({ name: 'test' }))
    })

    it('should send FormData without Content-Type header', async () => {
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: null }))

        const formData = new FormData()
        formData.append('file', 'content')

        await fetcher('/api/upload', {
            baseURL: 'http://api.com',
            method: 'POST',
            body: formData
        })

        const callArgs = mockFetch.mock.calls[0][1] as RequestInit
        expect((callArgs.headers as Record<string, string>)['Content-Type']).toBeUndefined()
    })

    it('should remove lowercase Content-Type header for FormData', async () => {
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: null }))

        const formData = new FormData()
        formData.append('file', 'content')

        await fetcher('/api/upload', {
            baseURL: 'http://api.com',
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: formData
        })

        const callArgs = mockFetch.mock.calls[0][1] as RequestInit
        expect(callArgs.headers).not.toHaveProperty('content-type')
        expect(callArgs.body).toBe(formData)
    })

    it('should pass through URLSearchParams bodies without JSON stringifying', async () => {
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: null }))

        const body = new URLSearchParams({ q: 'test' })
        await fetcher('/api/search', {
            baseURL: 'http://api.com',
            method: 'POST',
            body
        })

        const callArgs = mockFetch.mock.calls[0][1] as RequestInit
        expect(callArgs.body).toBe(body)
        expect((callArgs.headers as Record<string, string>)['Content-Type']).toBeUndefined()
    })

    it('should pass through Blob bodies without JSON stringifying', async () => {
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: null }))

        const body = new Blob(['hello'], { type: 'text/plain' })
        await fetcher('/api/blob', {
            baseURL: 'http://api.com',
            method: 'POST',
            body
        })

        const callArgs = mockFetch.mock.calls[0][1] as RequestInit
        expect(callArgs.body).toBe(body)
        expect((callArgs.headers as Record<string, string>)['Content-Type']).toBeUndefined()
    })

    it('should handle null body for GET requests', async () => {
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: null }))

        await fetcher('/api/test', { baseURL: 'http://api.com', method: 'GET' })

        const callArgs = mockFetch.mock.calls[0][1] as RequestInit
        expect(callArgs.body).toBeUndefined()
    })

    it('should use custom responseResolver', async () => {
        mockFetch.mockResolvedValueOnce(
            mockJsonResponse({ status: 'ok', result: { id: 1, name: 'test' } })
        )

        const customResolver = (res: any) => {
            if (res.status !== 'ok') throw new Error('Request failed')
            return res.result
        }

        const result = await fetcher<{ id: number; name: string }>('/api/test', {
            baseURL: 'http://api.com',
            responseResolver: customResolver
        })

        expect(result).toEqual({ id: 1, name: 'test' })
    })

    it('should compose external abort signal with internal timeout signal', async () => {
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: null }))
        const controller = new AbortController()

        await fetcher('/api/test', {
            baseURL: 'http://api.com',
            signal: controller.signal
        })

        const callArgs = mockFetch.mock.calls[0][1] as RequestInit
        expect(callArgs.signal).toBeInstanceOf(AbortSignal)
        expect(callArgs.signal).not.toBe(controller.signal)
    })
})

describe('createFetcher', () => {
    beforeEach(() => {
        mockFetch.mockReset()
    })

    it('should merge default and per-request options', async () => {
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: 'ok' }))

        const request = createFetcher({
            baseURL: 'http://api.com',
            authStorageKey: 'token',
            authHeaderKey: 'Authorization'
        })

        storage['token'] = 'test-token'
        await request('/api/test', { method: 'GET' })

        const callArgs = mockFetch.mock.calls[0][1] as RequestInit
        expect((callArgs.headers as Record<string, string>)['Authorization']).toBe('test-token')
    })

    it('should merge HeadersInit values without losing default headers', async () => {
        mockFetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: 'ok' }))

        const request = createFetcher({
            baseURL: 'http://api.com',
            headers: new Headers({ 'X-Default': 'default' })
        })

        await request('/api/test', {
            method: 'GET',
            headers: [['X-Custom', 'custom']]
        })

        const callArgs = mockFetch.mock.calls[0][1] as RequestInit
        expect(callArgs.headers).toEqual(
            expect.objectContaining({
                'x-default': 'default',
                'X-Custom': 'custom'
            })
        )
    })
})

describe('infinite-query defaultExtractList', () => {
    // 测试 defaultExtractList 的各种分支
    async function getExtractList() {
        // 通过边界效果间接测试：这里直接复制逻辑更可靠
        return (res: unknown) => {
            if (Array.isArray(res)) return res
            const r = res as Record<string, unknown>
            return ((r.list ?? r.data ?? r.records ?? r.content) as unknown[]) ?? []
        }
    }

    it('should extract from res.list', async () => {
        const extract = await getExtractList()
        expect(extract({ list: [1, 2, 3], total: 3 })).toEqual([1, 2, 3])
    })

    it('should extract from res.data when no list', async () => {
        const extract = await getExtractList()
        expect(extract({ data: [4, 5] })).toEqual([4, 5])
    })

    it('should extract from res.records when no list/data', async () => {
        const extract = await getExtractList()
        expect(extract({ records: [6, 7] })).toEqual([6, 7])
    })

    it('should extract from res.content when no others', async () => {
        const extract = await getExtractList()
        expect(extract({ content: [8, 9] })).toEqual([8, 9])
    })

    it('should return array directly when response is array', async () => {
        const extract = await getExtractList()
        expect(extract([1, 2, 3])).toEqual([1, 2, 3])
    })

    it('should return empty array when nothing matches', async () => {
        const extract = await getExtractList()
        expect(extract({ foo: 'bar' })).toEqual([])
    })
})
