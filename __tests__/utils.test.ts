import { describe, it, expect } from 'vitest'
import { omitNilOfObj } from '../src/helper/utils'

describe('omitNilOfObj', () => {
    it('should remove null and undefined values', () => {
        expect(omitNilOfObj({ a: 1, b: null, c: undefined, d: 'hello' })).toEqual({
            a: 1,
            d: 'hello'
        })
    })

    it('should return empty object for all nil values', () => {
        expect(omitNilOfObj({ a: null, b: undefined })).toEqual({})
    })

    it('should preserve falsy non-nil values', () => {
        expect(omitNilOfObj({ a: 0, b: '', c: false })).toEqual({ a: 0, b: '', c: false })
    })

    it('should handle empty object', () => {
        expect(omitNilOfObj({})).toEqual({})
    })

    it('should return empty for null/undefined input', () => {
        expect(omitNilOfObj(null as any)).toEqual({})
        expect(omitNilOfObj(undefined as any)).toEqual({})
    })
})
