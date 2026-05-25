import { computed, MaybeRef, toValue } from 'vue'
import { fetcher, FetcherOptions, RequestFn } from './fetcher'
import { ApiError } from './error'
import { useInfiniteQuery, InfiniteData } from '@tanstack/vue-query'

export interface PageParam {
    pageNum: number
    pageSize: number
}

export interface InfiniteQueryOptions<TResponse, TRequest, TSelected = TResponse> {
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

    enabled?: MaybeRef<boolean>
    staleTime?: MaybeRef<number>
    gcTime?: MaybeRef<number>
    select?: (data: InfiniteData<TResponse, PageParam>) => TSelected
    refetchOnWindowFocus?: MaybeRef<boolean>
}

const DEFAULT_INITIAL_PAGE = 1
const DEFAULT_PAGE_SIZE = 10
const DEFAULT_PAGE_KEY = 'pageNum'
const DEFAULT_PAGE_SIZE_KEY = 'pageSize'

function defaultExtractList<T>(res: T): unknown[] {
    if (Array.isArray(res)) return res
    const r = res as Record<string, unknown>
    return ((r.list ?? r.data ?? r.records ?? r.content) as unknown[]) ?? []
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
    return <TSelected = TResponse>(
        options?: InfiniteQueryOptions<TResponse, TRequest, TSelected>
    ) => {
        const params = computed(() => toValue(options?.params))
        const isDynamic = typeof endpoint === 'function'

        const pageKey = options?.pageKey ?? DEFAULT_PAGE_KEY
        const pageSizeKey = options?.pageSizeKey ?? DEFAULT_PAGE_SIZE_KEY

        const initialPage = options?.initialPage ?? DEFAULT_INITIAL_PAGE
        const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
        const extractList = options?.extractList ?? defaultExtractList
        const initialPageParam: PageParam = { pageNum: initialPage, pageSize }

        return useInfiniteQuery<TResponse, ApiError, TSelected, readonly unknown[], PageParam>({
            // queryKey 使用 initialPageParam 构建以保持稳定——无限查询的 key 标识整个查询而非单页
            queryKey: computed(() => {
                const p = params.value
                const url = isDynamic ? endpoint(p, initialPageParam) : endpoint
                return p ? [url, p] : [url]
            }),
            queryFn: ({ pageParam }) => {
                const p = params.value
                const url = isDynamic ? endpoint(p, pageParam) : endpoint
                return request<TResponse>(url, {
                    ...fetcherOptions,
                    method: 'GET',
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
            ...options
        })
    }
}
