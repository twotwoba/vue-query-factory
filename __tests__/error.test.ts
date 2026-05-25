import { describe, it, expect } from 'vitest'
import { HttpError, BusinessError, isHttpError, isBusinessError } from '../src/core/error'

describe('HttpError', () => {
    it('should set code and info', () => {
        const err = new HttpError(404, { url: '/api/test', method: 'GET' })
        expect(err.code).toBe(404)
        expect(err.info).toEqual({ url: '/api/test', method: 'GET' })
        expect(err.message).toBe('请求资源或接口不存在')
        expect(err.name).toBe('HttpError')
    })

    it('should accept custom message', () => {
        const err = new HttpError(500, { url: '/api/test' }, 'Custom error')
        expect(err.message).toBe('Custom error')
    })

    it('is() should match code', () => {
        const err = new HttpError(404)
        expect(err.is(404)).toBe(true)
        expect(err.is(500)).toBe(false)
    })

    it('isUnauthorized() should detect 401', () => {
        expect(new HttpError(401).isUnauthorized()).toBe(true)
        expect(new HttpError(403).isUnauthorized()).toBe(false)
    })

    it('isServerError() should detect 5xx', () => {
        expect(new HttpError(500).isServerError()).toBe(true)
        expect(new HttpError(503).isServerError()).toBe(true)
        expect(new HttpError(499).isServerError()).toBe(false)
    })

    it('should be instanceof Error', () => {
        expect(new HttpError(400)).toBeInstanceOf(Error)
    })

    it('should resolve default message for unknown status', () => {
        const err = new HttpError(418)
        expect(err.message).toContain('418')
    })
})

describe('BusinessError', () => {
    it('should set code, message and info', () => {
        const info = { code: 'ERR001', data: null }
        const err = new BusinessError('ERR001', 'Something went wrong', info)
        expect(err.code).toBe('ERR001')
        expect(err.message).toBe('Something went wrong')
        expect(err.info).toBe(info)
        expect(err.name).toBe('BusinessError')
    })

    it('should accept numeric code', () => {
        const err = new BusinessError(1001, 'Custom error')
        expect(err.code).toBe(1001)
    })

    it('should be instanceof Error', () => {
        expect(new BusinessError('E1', 'msg')).toBeInstanceOf(Error)
    })
})

describe('Type guards', () => {
    it('isHttpError should narrow type', () => {
        expect(isHttpError(new HttpError(400))).toBe(true)
        expect(isHttpError(new BusinessError('E', 'msg'))).toBe(false)
        expect(isHttpError(new Error())).toBe(false)
    })

    it('isBusinessError should narrow type', () => {
        expect(isBusinessError(new BusinessError('E', 'msg'))).toBe(true)
        expect(isBusinessError(new HttpError(400))).toBe(false)
        expect(isBusinessError(new Error())).toBe(false)
    })
})
