import { describe, it, expect } from 'vitest'
import { resolveError, HTTP_ERROR_MESSAGES } from '../src/helper/resolve-error'

describe('resolveError', () => {
    it('should return mapped message for known status', () => {
        expect(resolveError(404)).toBe('请求资源或接口不存在')
        expect(resolveError(500)).toBe('服务器发生异常')
        expect(resolveError(999)).toBe('未知异常，请联系运维或客服')
    })

    it('should return custom message when provided', () => {
        expect(resolveError(404, 'Custom')).toBe('Custom')
    })

    it('should return fallback for unknown status', () => {
        expect(resolveError(418)).toContain('418')
    })

    it('HTTP_ERROR_MESSAGES should cover common codes', () => {
        expect(HTTP_ERROR_MESSAGES[400]).toBeDefined()
        expect(HTTP_ERROR_MESSAGES[401]).toBeDefined()
        expect(HTTP_ERROR_MESSAGES[403]).toBeDefined()
        expect(HTTP_ERROR_MESSAGES[404]).toBeDefined()
        expect(HTTP_ERROR_MESSAGES[405]).toBeDefined()
        expect(HTTP_ERROR_MESSAGES[408]).toBeDefined()
        expect(HTTP_ERROR_MESSAGES[429]).toBeDefined()
        expect(HTTP_ERROR_MESSAGES[500]).toBeDefined()
        expect(HTTP_ERROR_MESSAGES[502]).toBeDefined()
        expect(HTTP_ERROR_MESSAGES[503]).toBeDefined()
        expect(HTTP_ERROR_MESSAGES[504]).toBeDefined()
        expect(HTTP_ERROR_MESSAGES[999]).toBeDefined()
    })
})
