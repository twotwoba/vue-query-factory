import { computed, MaybeRef, toValue } from 'vue'
import { fetcher, FetcherOptions } from './fetcher'
import { ApiError } from './error'
import { useQuery, UseQueryOptions } from '@tanstack/vue-query'

export type QueryOptions<TResponse, TRequest, TSelected = TResponse> = Omit<
    UseQueryOptions<TResponse, ApiError, TSelected>,
    'queryKey' | 'queryFn'
> & {
    params?: MaybeRef<TRequest> // 与 axios 类似，param 传参，最终拼接到 url 上
}

type RequestFn = <T = unknown>(endpoint: string, options: FetcherOptions) => Promise<T>

/**
 * 创建查询 Hook 工厂方法
 */
export const createQuery = <TResponse, TRequest>(
    endpoint: string | ((params: TRequest | undefined) => string),
    fetcherOptions?: FetcherOptions,
    request: RequestFn = fetcher
) => {
    return <TSelected = TResponse>(options?: QueryOptions<TResponse, TRequest, TSelected>) => {
        const params = computed(() => toValue(options?.params))
        const isDynamic = typeof endpoint === 'function'

        return useQuery<TResponse, ApiError, TSelected>({
            queryKey: computed(() => {
                const p = params.value
                const path = isDynamic ? endpoint(p) : endpoint
                return isDynamic ? [path] : p ? [path, p] : [path]
            }),
            queryFn: () => {
                const p = params.value
                const path = isDynamic ? endpoint(p) : endpoint
                return request<TResponse>(path, {
                    ...fetcherOptions,
                    method: 'GET',
                    ...(!isDynamic && { urlParams: p as Record<string, unknown> })
                })
            },
            ...toValue(options)
        })
    }
}
