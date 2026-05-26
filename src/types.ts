import { ComputedRef, Ref } from 'vue'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export type ExtractInner<T> = T extends (...args: any[]) => infer R
    ? ExtractInner<R>
    : T extends Ref<infer V>
      ? ExtractInner<V>
      : T extends ComputedRef<infer V>
        ? ExtractInner<V>
        : T
