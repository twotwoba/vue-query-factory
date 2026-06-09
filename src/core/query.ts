import { computed, MaybeRef, toValue } from 'vue'
import { fetcher, FetcherOptions, RequestFn } from './fetcher'
import { ApiError } from './error'
import { useQuery, UseQueryOptions } from '@tanstack/vue-query'
import { ExtractInner } from '../types'
import { getDynamicEndpointKey, hasRequestParams } from './query-key'

export type QueryOptions<TResponse, TRequest, TSelected = TResponse> = Omit<
    ExtractInner<UseQueryOptions<TResponse, ApiError, TSelected>>,
    'queryKey' | 'queryFn'
> & {
    params?: MaybeRef<TRequest> // 与 axios 类似，param 传参，最终拼接到 url 上
}

/**
 * 创建查询 Hook 工厂方法
 */
export const createQuery = <TResponse, TRequest>(
    endpoint: string | ((params: TRequest | undefined) => string),
    fetcherOptions?: FetcherOptions,
    request: RequestFn = fetcher
) => {
    const dynamicEndpointKey =
        typeof endpoint === 'function' ? getDynamicEndpointKey(endpoint) : undefined

    return <TSelected = TResponse>(options?: QueryOptions<TResponse, TRequest, TSelected>) => {
        const params = computed(() => toValue(options?.params))
        const isDynamic = typeof endpoint === 'function'

        return useQuery<TResponse, ApiError, TSelected>({
            queryKey: computed(() => {
                const p = params.value
                if (isDynamic) {
                    return hasRequestParams(p)
                        ? [endpoint(p), p]
                        : [dynamicEndpointKey, 'pending-params']
                }
                return hasRequestParams(p) ? [endpoint, p] : [endpoint]
            }),
            queryFn: ({ signal }) => {
                const p = params.value
                if (isDynamic && !hasRequestParams(p)) {
                    return Promise.reject(
                        new Error('Dynamic endpoint requires params before requesting.')
                    )
                }
                const path = isDynamic ? endpoint(p) : endpoint
                return request<TResponse>(path, {
                    ...fetcherOptions,
                    method: 'GET',
                    signal,
                    ...(!isDynamic && { urlParams: p as Record<string, unknown> })
                })
            },
            ...toValue(options)
        })
    }
}
