import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMutation } from '../src/core/mutation'
import { createQuery } from '../src/core/query'
import { createInfiniteQuery, PageParam } from '../src/core/infinite-query'

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
        await mutationOptions.onSuccess(data, variables)

        expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/users'] })
        expect(onSuccess).toHaveBeenCalledWith(data, variables)
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
