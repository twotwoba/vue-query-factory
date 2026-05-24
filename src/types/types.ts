import { ComputedRef, Ref } from 'vue'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export type MayBeRef<T> = T | Ref<T> | ComputedRef<T>
