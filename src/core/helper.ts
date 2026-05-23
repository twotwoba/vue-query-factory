/**
 * 处理 API 响应数据
 */

export function processData<T = unknown>(response: ApiResponse<T>): T {
    if (response.code >= 0 && response.code < 300) {
        return response.data as T
    }
    const message = response.message ?? resolveError(response.code)
    throw new FetchError(message, response.code, { response })
}

/**
 * 类型守卫
 */
export function isFetchError(error: unknown): error is FetchError {
    return error instanceof FetchError
}
