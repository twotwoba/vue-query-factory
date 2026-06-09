import { computed, MaybeRef, toValue } from 'vue'
import { fetcher, FetcherOptions, RequestFn } from './fetcher'
import { ApiError } from './error'
import { useInfiniteQuery, InfiniteData, UseInfiniteQueryOptions } from '@tanstack/vue-query'
import { ExtractInner } from '../types'
import { getDynamicEndpointKey, hasRequestParams } from './query-key'

export interface PageParam {
    pageNum: number
    pageSize: number
}

type InfiniteQueryInnerOptions<TResponse, TSelected> = Omit<
    ExtractInner<
        UseInfiniteQueryOptions<TResponse, ApiError, TSelected, readonly unknown[], PageParam>
    >,
    'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'
>

export type InfiniteQueryOptions<
    TResponse,
    TRequest,
    TSelected = InfiniteData<TResponse, PageParam>
> = InfiniteQueryInnerOptions<TResponse, TSelected> & {
    params?: MaybeRef<TRequest>
    pageKey?: string
    pageSizeKey?: string
    initialPage?: number
    pageSize?: number
    /**
     * 从响应中提取列表数据，用于自动判断是否还有下一页。
     * 默认尝试 (res).list / .data / .records / .content，
     * 响应体本身就是数组时直接返回。
     * 如果都不匹配则返回 []（即不再加载），此时需手动提供。
     */
    extractList?: (response: TResponse) => unknown[]
}

const DEFAULT_INITIAL_PAGE = 1
const DEFAULT_PAGE_SIZE = 10
const DEFAULT_PAGE_KEY = 'pageNum'
const DEFAULT_PAGE_SIZE_KEY = 'pageSize'

function defaultExtractList<T>(res: T): unknown[] {
    if (Array.isArray(res)) return res
    if (!res || typeof res !== 'object') return []
    const r = res as Record<string, unknown>
    const list = r.list ?? r.data ?? r.records ?? r.content
    return Array.isArray(list) ? list : []
}

/**
 * 创建无限查询 Hook 工厂方法
 * 内置 pageNum/pageSize 分页，自动判断是否还有下一页。
 */
export const createInfiniteQuery = <TResponse, TRequest>(
    endpoint: string | ((params: TRequest | undefined, pageParam: PageParam) => string),
    fetcherOptions?: FetcherOptions,
    request: RequestFn = fetcher
) => {
    const dynamicEndpointKey =
        typeof endpoint === 'function' ? getDynamicEndpointKey(endpoint) : undefined

    return <TSelected = InfiniteData<TResponse, PageParam>>(
        options?: InfiniteQueryOptions<TResponse, TRequest, TSelected>
    ) => {
        const {
            params: _optionParams,
            pageKey = DEFAULT_PAGE_KEY,
            pageSizeKey = DEFAULT_PAGE_SIZE_KEY,
            initialPage = DEFAULT_INITIAL_PAGE,
            pageSize = DEFAULT_PAGE_SIZE,
            extractList = defaultExtractList,
            ...queryOptions
        } = options ?? {}
        const params = computed(() => toValue(options?.params))
        const isDynamic = typeof endpoint === 'function'
        const initialPageParam: PageParam = { pageNum: initialPage, pageSize }

        return useInfiniteQuery<TResponse, ApiError, TSelected, readonly unknown[], PageParam>({
            // queryKey 使用 initialPageParam 构建以保持稳定——无限查询的 key 标识整个查询而非单页
            queryKey: computed(() => {
                const p = params.value
                const pageConfig = { pageKey, pageSizeKey, initialPage, pageSize }
                if (isDynamic) {
                    return hasRequestParams(p)
                        ? [endpoint(p, initialPageParam), p, pageConfig]
                        : [dynamicEndpointKey, 'pending-params', pageConfig]
                }
                return hasRequestParams(p) ? [endpoint, p, pageConfig] : [endpoint, pageConfig]
            }),
            queryFn: ({ pageParam, signal }) => {
                const p = params.value
                if (isDynamic && !hasRequestParams(p)) {
                    return Promise.reject(
                        new Error('Dynamic endpoint requires params before requesting.')
                    )
                }
                const url = isDynamic ? endpoint(p, pageParam) : endpoint
                return request<TResponse>(url, {
                    ...fetcherOptions,
                    method: 'GET',
                    signal,
                    ...(!isDynamic && {
                        urlParams: {
                            ...(p as Record<string, unknown>),
                            [pageKey]: pageParam.pageNum,
                            [pageSizeKey]: pageParam.pageSize
                        }
                    })
                })
            },
            initialPageParam,
            getNextPageParam: (_lastPage, _allPages, lastParam) => {
                const list = extractList(_lastPage)
                return list.length < lastParam.pageSize
                    ? undefined
                    : { pageNum: lastParam.pageNum + 1, pageSize: lastParam.pageSize }
            },
            ...queryOptions
        })
    }
}
