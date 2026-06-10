import { describe, it, expect, vi } from 'vitest'
import { resolveResponse } from '../src/helper/resolve-response'
import { BusinessError } from '../src/core/error'

describe('resolveResponse', () => {
    it('should return data when code is not in businessErrorCodesMap', () => {
        const result = resolveResponse({ code: 0, data: 'hello' }, {})
        expect(result).toBe('hello')
    })

    it('should throw BusinessError when code matches', () => {
        expect(() =>
            resolveResponse({ code: 1001, message: 'fail' }, { '1001': '自定义错误' })
        ).toThrow(BusinessError)
    })

    it('should use mapped message for business error', () => {
        try {
            resolveResponse({ code: 'ERR001', data: null }, { ERR001: '映射的错误消息' })
        } catch (e) {
            expect(e).toBeInstanceOf(BusinessError)
            expect((e as BusinessError).message).toBe('映射的错误消息')
        }
    })

    it('should fallback to response.message when no mapped message', () => {
        try {
            resolveResponse({ code: 'MISSING', message: '缺少参数' }, { MISSING: '' })
        } catch (e) {
            expect((e as BusinessError).message).toBe('缺少参数')
        }
    })

    it('should support businessErrorConfig codes tuple list', () => {
        try {
            resolveResponse({ code: 1001, message: '接口错误' }, { codes: [[1001, '配置错误']] })
        } catch (e) {
            expect(e).toBeInstanceOf(BusinessError)
            expect((e as BusinessError).message).toBe('配置错误')
        }
    })

    it('should fallback to configured errMsgKey when tuple message is omitted', () => {
        try {
            resolveResponse(
                { code: 1002, errMsg: '接口返回错误' },
                { codes: [[1002]], errMsgKey: 'errMsg' }
            )
        } catch (e) {
            expect(e).toBeInstanceOf(BusinessError)
            expect((e as BusinessError).message).toBe('接口返回错误')
        }
    })

    it('should call tipFunc before throwing BusinessError', () => {
        const tipFunc = vi.fn()

        try {
            resolveResponse(
                { code: 'ERR001', message: '接口错误' },
                { codes: [['ERR001']], tipFunc }
            )
        } catch (e) {
            expect(e).toBeInstanceOf(BusinessError)
            expect(tipFunc).toHaveBeenCalledWith('接口错误', e)
        }
    })

    it('should ignore tipFunc errors and still throw original BusinessError', () => {
        const tipFunc = vi.fn(() => {
            throw new Error('tip failed')
        })

        try {
            resolveResponse(
                { code: 'ERR001', message: '接口错误' },
                { codes: [['ERR001']], tipFunc }
            )
        } catch (e) {
            expect(e).toBeInstanceOf(BusinessError)
            expect((e as BusinessError).message).toBe('接口错误')
        }
    })

    it('should include raw response as info', () => {
        const raw = { code: 'ERR', data: { id: 1 }, message: 'bad' }
        try {
            resolveResponse(raw, { ERR: 'error' })
        } catch (e) {
            expect((e as BusinessError).info).toBe(raw)
        }
    })

    it('should match numeric code against string keys', () => {
        expect(() =>
            resolveResponse({ code: 401, message: 'unauthorized' }, { '401': '未授权' })
        ).toThrow(BusinessError)
    })

    it('should return data as undefined when not present', () => {
        const result = resolveResponse({ code: 0 }, {})
        expect(result).toBeUndefined()
    })

    it('should return complex data', () => {
        const data = { list: [1, 2, 3], total: 3 }
        const result = resolveResponse({ code: 0, data }, {})
        expect(result).toEqual(data)
    })
})
