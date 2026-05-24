import { computed, MaybeRef, toValue } from 'vue'
import { fetcher, FetcherOptions } from './fetcher'
import { ApiError } from './error'
import { useQuery } from '@tanstack/vue-query'

// useQuery 的 options
interface QueryOptions<TResponse, TRequest, TSelected = TResponse> {
    params?: MaybeRef<TRequest>
    enabled?: MaybeRef<boolean>
    staleTime?: MaybeRef<number>
    gcTime?: MaybeRef<number>
    select?: (data: TResponse) => TSelected
    placeholderData?: TResponse | ((previousValue: TResponse | undefined) => TResponse)
    refetchInterval?: MaybeRef<number | false>
    refetchOnWindowFocus?: MaybeRef<boolean>
}

/**
 * 创建查询 Hook 工厂方法
 */
export const createQuery = <TResponse, TRequest>(
    endpoint: string | ((params: TRequest | undefined) => string),
    fetcherOptions?: FetcherOptions
) => {
    return <TSelected = TResponse>(options?: QueryOptions<TResponse, TRequest, TSelected>) => {
        const params = computed(() => toValue(options?.params))
        const enabled = computed(() => toValue(options?.enabled) !== false)
        const isDynamic = typeof endpoint === 'function'

        return useQuery<TResponse, ApiError, TSelected>({
            queryKey: computed(() => {
                const p = params.value
                const url = isDynamic ? endpoint(p) : endpoint
                return isDynamic ? [url] : p ? [url, p] : [url]
            }),
            queryFn: () => {
                const p = params.value
                const url = isDynamic ? endpoint(p) : endpoint
                return fetcher<TResponse>(url, {
                    ...fetcherOptions,
                    method: 'GET',
                    ...(!isDynamic && { urlParams: p as Record<string, unknown> })
                })
            },
            enabled,
            staleTime: options?.staleTime,
            gcTime: options?.gcTime,
            select: options?.select as ((data: TResponse) => TSelected) | undefined,
            placeholderData: options?.placeholderData as any,
            refetchInterval: options?.refetchInterval,
            refetchOnWindowFocus: options?.refetchOnWindowFocus
        })
    }
}
