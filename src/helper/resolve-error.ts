/**
 * HTTP 状态码对应的错误消息映射
 */
export const HTTP_ERROR_MESSAGES: Record<number, string> = {
    400: '请求参数错误',
    401: '未授权，请先登录',
    403: '请求被拒绝',
    404: '请求资源或接口不存在',
    405: '请求方法不允许',
    408: '请求超时，请稍后重试',
    429: '请求过于频繁，请稍后再试',
    499: '请求已取消',
    500: '服务器发生异常',
    502: '网关错误',
    503: '服务暂时不可用',
    504: '网关超时',

    999: '未知异常，请联系运维或客服'
}

/**
 * http层请求失败，处理错误 message
 */
export function resolveError(status: number, customMessage?: string): string {
    return customMessage ?? HTTP_ERROR_MESSAGES[status] ?? `【${status}】: 未知异常!`
}
