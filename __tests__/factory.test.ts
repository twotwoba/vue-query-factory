import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMutation, createQuery, createInfiniteQuery, PageParam } from '../src'

const mocks = vi.hoisted(() => ({
    useQuery: vi.fn(),
    useInfiniteQuery: vi.fn(),
    useMutation: vi.fn(),
    invalidateQueries: vi.fn()
}))

vi.mock('@tanstack/vue-query', () => ({
    useQuery: mocks.useQuery,
    useInfiniteQuery: mocks.useInfiniteQuery,
    useMutation: mocks.useMutation,
    useQueryClient: () => ({
        invalidateQueries: mocks.invalidateQueries
    })
}))

describe('query factories', () => {
    beforeEach(() => {
        mocks.useQuery.mockReset()
        mocks.useInfiniteQuery.mockReset()
        mocks.useMutation.mockReset()
        mocks.invalidateQueries.mockReset()
    })

    it('passes TanStack abort signal to query requests', async () => {
        const request = vi.fn().mockResolvedValue({ id: 1 })
        const useUser = createQuery<{ id: number }, { id: number }>('/users', undefined, request)

        useUser({ params: { id: 1 } })

        const queryOptions = mocks.useQuery.mock.calls[0][0]
        const signal = new AbortController().signal
        await queryOptions.queryFn({ signal })

        expect(request).toHaveBeenCalledWith(
            '/users',
            expect.objectContaining({
                method: 'GET',
                signal,
                urlParams: { id: 1 }
            })
        )
    })

    it('passes through mutation options while preserving invalidation and callbacks', async () => {
        const request = vi.fn().mockResolvedValue({ id: 1 })
        const onSuccess = vi.fn()
        const onMutate = vi.fn()
        const useCreateUser = createMutation<{ id: number }, { name: string }>(
            '/users',
            'POST',
            undefined,
            request
        )

        useCreateUser({
            mutationKey: ['create-user'],
            retry: 2,
            meta: { source: 'test' },
            onMutate,
            invalidateKeys: ['/users'],
            onSuccess
        })

        const mutationOptions = mocks.useMutation.mock.calls[0][0]
        expect(mutationOptions).toEqual(
            expect.objectContaining({
                mutationKey: ['create-user'],
                retry: 2,
                meta: { source: 'test' },
                onMutate
            })
        )

        const data = { id: 1 }
        const variables = { name: 'Alice' }
        const onMutateResult = { previous: 'state' }
        const context = { meta: { source: 'test' } }
        await mutationOptions.onSuccess(data, variables, onMutateResult, context)

        expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/users'] })
        expect(onSuccess).toHaveBeenCalledWith(data, variables, onMutateResult, context)
    })

    it('awaits invalidation before resolving mutation onSuccess', async () => {
        const order: string[] = []
        const request = vi.fn().mockResolvedValue({ id: 1 })
        mocks.invalidateQueries.mockImplementation(async () => {
            order.push('invalidate')
        })
        const onSuccess = vi.fn(async () => {
            order.push('onSuccess')
        })
        const useCreateUser = createMutation<{ id: number }, { name: string }>(
            '/users',
            'POST',
            undefined,
            request
        )

        useCreateUser({ invalidateKeys: ['/users'], onSuccess })

        const mutationOptions = mocks.useMutation.mock.calls[0][0]
        await mutationOptions.onSuccess({ id: 1 }, { name: 'Alice' }, undefined, {})

        expect(order).toEqual(['invalidate', 'onSuccess'])
    })

    it('does not call dynamic query endpoint while params are pending', () => {
        const endpoint = vi.fn((params: { id: number } | undefined) => `/users/${params!.id}`)
        const useUser = createQuery<{ id: number }, { id: number }>(endpoint, undefined, vi.fn())

        expect(() => useUser({ enabled: false })).not.toThrow()

        const queryOptions = mocks.useQuery.mock.calls[0][0]
        expect(queryOptions.queryKey.value).toEqual([
            expect.stringContaining('vue-query-factory:dynamic-endpoint:'),
            'pending-params'
        ])
        expect(endpoint).not.toHaveBeenCalled()
    })

    it('throws a clear error when manually requesting a dynamic query without params', async () => {
        const endpoint = vi.fn((params: { id: number } | undefined) => `/users/${params!.id}`)
        const useUser = createQuery<{ id: number }, { id: number }>(endpoint, undefined, vi.fn())

        useUser({ enabled: false })

        const queryOptions = mocks.useQuery.mock.calls[0][0]
        await expect(
            queryOptions.queryFn({ signal: new AbortController().signal })
        ).rejects.toThrow('Dynamic endpoint requires params before requesting.')
    })

    it('adds infinite query paging config to queryKey', () => {
        const useUsers = createInfiniteQuery<{ list: string[] }, { keyword: string }>(
            '/users',
            undefined,
            vi.fn()
        )

        useUsers({ params: { keyword: 'a' }, pageSize: 20, initialPage: 2 })

        const infiniteOptions = mocks.useInfiniteQuery.mock.calls[0][0]
        expect(infiniteOptions.queryKey.value).toEqual([
            '/users',
            { keyword: 'a' },
            { pageKey: 'pageNum', pageSizeKey: 'pageSize', initialPage: 2, pageSize: 20 }
        ])
    })

    it('passes TanStack abort signal to infinite query requests', async () => {
        const request = vi.fn().mockResolvedValue({ list: [] })
        const useUsers = createInfiniteQuery<{ list: string[] }, { keyword: string }>(
            '/users',
            undefined,
            request
        )

        useUsers({ params: { keyword: 'a' }, pageSize: 20 })

        const infiniteOptions = mocks.useInfiniteQuery.mock.calls[0][0]
        const signal = new AbortController().signal
        const pageParam: PageParam = { pageNum: 1, pageSize: 20 }
        await infiniteOptions.queryFn({ pageParam, signal })

        expect(request).toHaveBeenCalledWith(
            '/users',
            expect.objectContaining({
                method: 'GET',
                signal,
                urlParams: { keyword: 'a', pageNum: 1, pageSize: 20 }
            })
        )
    })

    it('does not call dynamic infinite endpoint while params are pending', () => {
        const endpoint = vi.fn(
            (params: { userId: number } | undefined) => `/users/${params!.userId}/posts`
        )
        const usePosts = createInfiniteQuery<{ list: string[] }, { userId: number }>(
            endpoint,
            undefined,
            vi.fn()
        )

        expect(() => usePosts({ enabled: false })).not.toThrow()

        const infiniteOptions = mocks.useInfiniteQuery.mock.calls[0][0]
        expect(infiniteOptions.queryKey.value).toEqual([
            expect.stringContaining('vue-query-factory:dynamic-endpoint:'),
            'pending-params',
            { pageKey: 'pageNum', pageSizeKey: 'pageSize', initialPage: 1, pageSize: 10 }
        ])
        expect(endpoint).not.toHaveBeenCalled()
    })

    it('does not pass internal infinite query options to TanStack', () => {
        const extractList = vi.fn((response: { list: string[] }) => response.list)
        const useUsers = createInfiniteQuery<{ list: string[] }, { keyword: string }>(
            '/users',
            undefined,
            vi.fn()
        )

        useUsers({
            params: { keyword: 'a' },
            pageSize: 20,
            pageKey: 'current',
            pageSizeKey: 'size',
            initialPage: 2,
            extractList,
            retry: 2
        })

        const infiniteOptions = mocks.useInfiniteQuery.mock.calls[0][0]
        expect(infiniteOptions).toEqual(expect.objectContaining({ retry: 2 }))
        expect(infiniteOptions).not.toHaveProperty('params')
        expect(infiniteOptions).not.toHaveProperty('pageSize')
        expect(infiniteOptions).not.toHaveProperty('pageKey')
        expect(infiniteOptions).not.toHaveProperty('pageSizeKey')
        expect(infiniteOptions).not.toHaveProperty('initialPage')
        expect(infiniteOptions).not.toHaveProperty('extractList')
    })

    it('stops infinite pagination when the default list candidate is not an array', () => {
        const useUsers = createInfiniteQuery<{ data: { items: string[] } }, void>(
            '/users',
            undefined,
            vi.fn()
        )

        useUsers({ pageSize: 20 })

        const infiniteOptions = mocks.useInfiniteQuery.mock.calls[0][0]
        expect(
            infiniteOptions.getNextPageParam({ data: { items: ['a'] } }, [], {
                pageNum: 1,
                pageSize: 20
            })
        ).toBeUndefined()
    })
})
