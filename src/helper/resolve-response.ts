import { BusinessError } from '../core/error'

/**
 * 请求成功，数据处理
 */
interface HttpResponse<T = unknown> {
    code: string | number
    data?: T
    message?: string
}

/** 解包业务响应，如果在业务错误码中则抛出 BusinessError */
export function resolveResponse<T = unknown>(
    response: HttpResponse<T>,
    businessCodesMap: Record<string, string> = {}
): T {
    const codeKey = String(response.code)
    if (codeKey in businessCodesMap) {
        const message =
            businessCodesMap[codeKey] || response.message || `操作失败，(${response.code})`
        throw new BusinessError(response.code, message, response)
    }
    return response.data as T
}
