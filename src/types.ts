import { ComputedRef, Ref } from 'vue'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export type ExtractInner<T> = T extends (...args: any[]) => infer R
    ? ExtractInner<R>
    : T extends Ref<infer V>
      ? ExtractInner<V>
      : T extends ComputedRef<infer V>
        ? ExtractInner<V>
        : T

/**
 * 提取常量对象的联合类型
 */
export type EnumKeys<T> = keyof T
export type EnumValues<T> = T[keyof T]

/**
 * 字段必填/可选控制
 */
export type MakeRequired<T, K extends keyof T> = Partial<Omit<T, K>> & Required<Pick<T, K>>
export type MakeOptional<T, K extends keyof T> = Required<Omit<T, K>> & Partial<Pick<T, K>>
