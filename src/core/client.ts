import { createFetcher, FetcherOptions } from './fetcher'
import { createQuery } from './query'
import { createMutation } from './mutation'
import { createInfiniteQuery, PageParam } from './infinite-query'
import { HttpMethod } from '../types'

export interface ClientOptions extends Partial<FetcherOptions> {}

/**
 * 创建 API 客户端，选择性固定 baseURL, timeout 等方法
 *
 * @example  const {createQuery, createMutation, createInfiniteQuery} = createClient({baseURL: "http://demo/api", businessErrorCodesMap: {888: "错了错了错了！"}})
 */
export function createClient(options: ClientOptions) {
    const request = createFetcher(options)

    return {
        request,
        createQuery: <TResponse, TRequest>(
            endpoint: string | ((params: TRequest | undefined) => string),
            fetcherOptions?: FetcherOptions
        ) => createQuery<TResponse, TRequest>(endpoint, fetcherOptions, request),

        createMutation: <TResponse = unknown, TBody = unknown>(
            endpoint: string | ((variables: TBody) => string),
            method: Exclude<HttpMethod, 'GET'> = 'POST',
            fetcherOptions?: FetcherOptions
        ) => createMutation<TResponse, TBody>(endpoint, method, fetcherOptions, request),

        createInfiniteQuery: <TResponse, TRequest>(
            endpoint: string | ((params: TRequest | undefined, pageParam: PageParam) => string),
            fetcherOptions?: FetcherOptions
        ) => createInfiniteQuery<TResponse, TRequest>(endpoint, fetcherOptions, request)
    }
}
