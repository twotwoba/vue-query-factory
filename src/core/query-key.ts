let dynamicEndpointId = 0
const dynamicEndpointKeys = new WeakMap<object, string>()

export function getDynamicEndpointKey(endpoint: object): string {
    const cached = dynamicEndpointKeys.get(endpoint)
    if (cached) return cached

    const key = `vue-query-factory:dynamic-endpoint:${++dynamicEndpointId}`
    dynamicEndpointKeys.set(endpoint, key)
    return key
}

export function hasRequestParams<T>(params: T | null | undefined): params is T {
    return params !== null && params !== undefined
}
