/**
 * 去除值为 undefined/null 的字段
 */
type Nullish = null | undefined
type ExcludeNullish<T> = {
    [K in keyof T as T[K] extends Nullish ? never : K]: T[K]
}
export function omitNilOfObj<T extends Record<string, unknown>>(obj: T): ExcludeNullish<T> {
    if (typeof obj !== 'object' || obj == null) return {} as ExcludeNullish<T>
    return Object.fromEntries(
        Object.entries(obj).filter(([_, value]) => value !== null && value !== undefined)
    ) as ExcludeNullish<T>
}
