import { resolveError } from '../helper/resolve-error'

/**
 * HTTP 层错误（网络异常、状态码异常、超时等）
 */
export class HttpError extends Error {
    code: number
    info?: { url?: string; method?: string }

    constructor(code: number, info?: { url?: string; method?: string }, message?: string) {
        super(message ?? resolveError(code))
        this.name = 'HttpError'
        this.code = code
        this.info = info
        Object.setPrototypeOf(this, HttpError.prototype)
    }

    is(code: number): boolean {
        return this.code === code
    }

    isUnauthorized(): boolean {
        return this.code === 401
    }

    isServerError(): boolean {
        return this.code >= 500
    }
}

/**
 * 业务层错误（后端返回 code 不在成功范围内）
 */
export class BusinessError extends Error {
    code: string | number
    info?: unknown

    constructor(code: string | number, message: string, info?: unknown) {
        super(message)
        this.name = 'BusinessError'
        this.code = code
        this.info = info
        Object.setPrototypeOf(this, BusinessError.prototype)
    }
}

export type ApiError = HttpError | BusinessError

export function isHttpError(error: unknown): error is HttpError {
    return error instanceof HttpError
}
export function isBusinessError(error: unknown): error is BusinessError {
    return error instanceof BusinessError
}
