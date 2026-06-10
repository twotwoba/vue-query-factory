import { BusinessError } from '../core/error'

export type BusinessErrorCode = string | number
export type BusinessErrorCodeConfig = readonly [BusinessErrorCode, string?]
export type BusinessErrorCodesMap = Record<string, string>
export type BusinessErrorTipFunc = (message: string, error: BusinessError) => unknown

export interface BusinessErrorConfig {
    /** 业务错误码配置。未提供自定义文案时，使用响应里的错误信息字段。 */
    codes?: readonly BusinessErrorCodeConfig[]
    /** 响应中的错误信息字段名，默认 message。 */
    errMsgKey?: string
    /** 命中业务错误时的提示函数，例如 Element Plus 的 ElMessage.error。 */
    tipFunc?: BusinessErrorTipFunc
}

export type BusinessErrorConfigInput = BusinessErrorConfig | BusinessErrorCodesMap

/**
 * 请求成功，数据处理
 */
export interface HttpResponse<T = unknown> {
    code: string | number
    data?: T
    [key: string]: unknown
}

const DEFAULT_ERR_MSG_KEY = 'message'

interface NormalizedBusinessErrorConfig {
    codesMap: Record<string, string | undefined>
    errMsgKey: string
    tipFunc?: BusinessErrorTipFunc
}

/** 解包业务响应，如果在业务错误码中则抛出 BusinessError */
export function resolveResponse<T = unknown>(
    response: HttpResponse<T>,
    businessErrorConfig: BusinessErrorConfigInput = {}
): T {
    const config = normalizeBusinessErrorConfig(businessErrorConfig)
    const codeKey = String(response.code)
    if (codeKey in config.codesMap) {
        const message =
            config.codesMap[codeKey] ||
            getResponseMessage(response, config.errMsgKey) ||
            `操作失败，(${response.code})`
        const error = new BusinessError(response.code, message, response)
        callTipFunc(config.tipFunc, message, error)
        throw error
    }
    return response.data as T
}

function normalizeBusinessErrorConfig(
    businessErrorConfig: BusinessErrorConfigInput
): NormalizedBusinessErrorConfig {
    if (isBusinessErrorConfig(businessErrorConfig)) {
        const codesMap: Record<string, string | undefined> = {}
        for (const [code, message] of businessErrorConfig.codes ?? []) {
            codesMap[String(code)] = message
        }
        return {
            codesMap,
            errMsgKey: businessErrorConfig.errMsgKey || DEFAULT_ERR_MSG_KEY,
            tipFunc: businessErrorConfig.tipFunc
        }
    }

    return {
        codesMap: businessErrorConfig,
        errMsgKey: DEFAULT_ERR_MSG_KEY
    }
}

function isBusinessErrorConfig(
    businessErrorConfig: BusinessErrorConfigInput
): businessErrorConfig is BusinessErrorConfig {
    return (
        Array.isArray((businessErrorConfig as BusinessErrorConfig).codes) ||
        typeof (businessErrorConfig as BusinessErrorConfig).tipFunc === 'function'
    )
}

function getResponseMessage(response: HttpResponse, errMsgKey: string): string | undefined {
    const message = response[errMsgKey]
    if (typeof message === 'string') return message
    if (message == null) return undefined
    return String(message)
}

function callTipFunc(
    tipFunc: BusinessErrorTipFunc | undefined,
    message: string,
    error: BusinessError
) {
    try {
        const result = tipFunc?.(message, error)
        if (result && typeof (result as Promise<unknown>).catch === 'function') {
            void (result as Promise<unknown>).catch(() => undefined)
        }
    } catch {
        // 提示函数异常不应覆盖原始业务错误。
    }
}
