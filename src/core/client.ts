import { createFetcher, FetcherOptions } from './fetcher'
import { createQuery } from './query'

export interface ClientOptions extends Partial<FetcherOptions> {}

/**
 * 创建 API 客户端，选择性固定 baseURL, timeout 等方法
 *
 * @example  const {useQuery} = createClient({baseURL: "http://demo/api", businessErrorCodesMap: {888: "错了错了错了！"}})
 */
export function createClient(options: ClientOptions) {
    const request = createFetcher(options)

    return {
        request,
        createQuery: <TResponse, TRequest>(
            endpoint: string | ((params: TRequest | undefined) => string),
            fetcherOptions?: Omit<FetcherOptions, keyof typeof options>
        ) => createQuery<TResponse, TRequest>(endpoint, fetcherOptions, request)

        // 后续扩展
        // createMutation,
        // createInfiniteQuery,
    }
}
