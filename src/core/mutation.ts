import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/vue-query'
import { ExtractInner, HttpMethod } from '../types'
import { fetcher, FetcherOptions, RequestFn } from './fetcher'
import { ApiError } from './error'

export type MutationOptions<TResponse, TError, TBody> = Omit<
    ExtractInner<UseMutationOptions<TResponse, TError, TBody>>,
    'mutationFn' | 'onSuccess' | 'onError' | 'onSettled'
> & {
    invalidateKeys?: string[]
    onSuccess?: (data: TResponse, variables: TBody) => void
    onError?: (error: TError, variables: TBody) => void
    onSettled?: (data: TResponse | undefined, error: TError | null, variables: TBody) => void
}

/**
 * 创建变更 Hook 工厂方法
 *
 * @example
 * 静态 endpoint — body 直接作为请求体
 * export const useCreateUser = createMutation<User, CreateUserDTO>('/api/user', 'POST')
 *
 * 动态 endpoint — 路径参数从变量中提取
 * export const useUpdateUser = createMutation<User, UpdateUserDTO>(
 *   (vars) => `/api/user/${vars.id}`, 'PUT'
 * )
 */
export const createMutation = <TResponse = unknown, TBody = unknown>(
    endpoint: string | ((variables: TBody) => string),
    method: Exclude<HttpMethod, 'GET'> = 'POST',
    fetcherOptions?: FetcherOptions,
    request: RequestFn = fetcher
) => {
    return (options?: MutationOptions<TResponse, ApiError, TBody>) => {
        const queryClient = useQueryClient()

        return useMutation<TResponse, ApiError, TBody>({
            mutationFn: (variables: TBody) => {
                const url = typeof endpoint === 'function' ? endpoint(variables) : endpoint
                // 动态端点：目前 variables 中用于构建 URL 路径的字段仍会包含在请求体中
                return request<TResponse>(url, {
                    ...fetcherOptions,
                    method,
                    body: variables as BodyInit
                })
            },
            onSuccess: async (data, variables) => {
                if (options?.invalidateKeys?.length) {
                    await Promise.all(
                        options.invalidateKeys.map((key) =>
                            queryClient.invalidateQueries({ queryKey: [key] })
                        )
                    )
                }
                options?.onSuccess?.(data, variables)
            },
            onError: (error, variables) => {
                options?.onError?.(error, variables)
            },
            onSettled: (data, error, variables) => {
                options?.onSettled?.(data, error, variables)
            }
        })
    }
}
