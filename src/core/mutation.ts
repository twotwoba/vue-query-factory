import { toValue, unref } from 'vue'
import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/vue-query'
import { ExtractInner, HttpMethod } from '../types'
import { fetcher, FetcherOptions, RequestFn } from './fetcher'
import { ApiError } from './error'

type MutationSuccessCallback<TResponse, TBody, TOnMutateResult> = (
    data: TResponse,
    variables: TBody,
    onMutateResult: TOnMutateResult,
    context: unknown
) => unknown

type MutationErrorCallback<TBody, TOnMutateResult> = (
    error: ApiError,
    variables: TBody,
    onMutateResult: TOnMutateResult | undefined,
    context: unknown
) => unknown

type MutationSettledCallback<TResponse, TBody, TOnMutateResult> = (
    data: TResponse | undefined,
    error: ApiError | null,
    variables: TBody,
    onMutateResult: TOnMutateResult | undefined,
    context: unknown
) => unknown

export type MutationOptions<TResponse, TError, TBody, TOnMutateResult = unknown> = Omit<
    ExtractInner<UseMutationOptions<TResponse, TError, TBody, TOnMutateResult>>,
    'mutationFn'
> & {
    invalidateKeys?: string[]
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
    return <TOnMutateResult = unknown>(
        options?: MutationOptions<TResponse, ApiError, TBody, TOnMutateResult>
    ) => {
        const queryClient = useQueryClient()
        const { invalidateKeys, onSuccess, onError, onSettled, ...mutationOptions } =
            toValue(options) ?? {}

        return useMutation<TResponse, ApiError, TBody, TOnMutateResult>({
            ...mutationOptions,
            mutationFn: (variables: TBody) => {
                const url = typeof endpoint === 'function' ? endpoint(variables) : endpoint
                // 动态端点：目前 variables 中用于构建 URL 路径的字段仍会包含在请求体中
                return request<TResponse>(url, {
                    ...fetcherOptions,
                    method,
                    body: variables
                })
            },
            onSuccess: async (data, variables, onMutateResult, context) => {
                if (invalidateKeys?.length) {
                    await Promise.all(
                        invalidateKeys.map((key) =>
                            queryClient.invalidateQueries({ queryKey: [key] })
                        )
                    )
                }
                const resolvedOnSuccess = unref(onSuccess) as
                    | MutationSuccessCallback<TResponse, TBody, TOnMutateResult>
                    | undefined
                return resolvedOnSuccess?.(data, variables, onMutateResult, context)
            },
            onError: (error, variables, onMutateResult, context) => {
                const resolvedOnError = unref(onError) as
                    | MutationErrorCallback<TBody, TOnMutateResult>
                    | undefined
                return resolvedOnError?.(error, variables, onMutateResult, context)
            },
            onSettled: (data, error, variables, onMutateResult, context) => {
                const resolvedOnSettled = unref(onSettled) as
                    | MutationSettledCallback<TResponse, TBody, TOnMutateResult>
                    | undefined
                return resolvedOnSettled?.(data, error, variables, onMutateResult, context)
            }
        })
    }
}
