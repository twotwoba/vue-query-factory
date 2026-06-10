# vue-query-factory

基于 `@tanstack/vue-query` 的二次封装，提供工厂式的 API 来创建 query、mutation、infinite query。

## Install

```sh
pnpm add vue-query-factory
```

## Setup

本库基于 `@tanstack/vue-query`，使用前需在 Vue 应用中注册 `VueQueryPlugin`：

```ts
// main.ts
import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'

const app = createApp(App)
app.use(VueQueryPlugin)
app.mount('#app')
```

> **全局默认配置**：本库封装的 options 主要用于控制 fetcher 传参，不含 `@tanstack/vue-query` 的全局配置项。如需设置 `placeholderData`、`staleTime` 等全局默认值，请通过 `QueryClient` 的 `defaultOptions` 配置：
>
> ```ts
> // example
> import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
>
> const queryClient = new QueryClient({
>     defaultOptions: {
>         queries: {
>             placeholderData: (prev) => prev
>         }
>     }
> })
>
> app.use(VueQueryPlugin, { queryClient })
> ```

## Quick Start

```ts
// src/api/client.ts
import { createClient } from 'vue-query-factory'

export const { createQuery, createMutation, createInfiniteQuery } = createClient({
    baseURL: '/api',
    timeout: 10_000,
    authStorageKey: 'token', // localStorage 中存储 token 的 key
    // 当 storage 中存储的是对象时，可以传入自定义函数提取 token：
    // authStorageKey: () => JSON.parse(localStorage.getItem('user_info')!).accessToken,
    authHeaderKey: 'Access-Token', // 请求头中携带 token 的 header 名称
    businessErrorConfig: {
        codes: [
            ['10001', '用户不存在'],
            ['10002'] // 未配置文案时，使用接口返回的 message
        ],
        errMsgKey: 'message'
    }
})
```

```ts
// src/api/user.ts
import { createQuery, createMutation, createInfiniteQuery } from './client'

// Query
export const useUserList = createQuery<User[], { keyword?: string }>('/users')
export const useUserDetail = createQuery<User, { id: number }>((params) => `/users/${params.id}`)

// Mutation
export const useCreateUser = createMutation<User, CreateUserDTO>('/users', 'POST')
export const useUpdateUser = createMutation<User, UpdateUserDTO>(
    (vars) => `/users/${vars.id}`,
    'PUT'
)
export const useDeleteUser = createMutation<void, { id: number }>(
    (vars) => `/users/${vars.id}`,
    'DELETE'
)

// Infinite Query
export const useUserPage = createInfiniteQuery<
    { list: User[]; total: number },
    { keyword?: string }
>('/users')
```

## API

### createClient

创建 API 客户端，配置全局的 `baseURL`、`timeout`、`authStorageKey`、`authHeaderKey` 等，返回绑定好配置的工厂方法。

```ts
const { createQuery, createMutation, createInfiniteQuery, request } = createClient({
    baseURL: '/api',                 // 必填，接口基础路径
    timeout: 10_000,                 // 请求超时（默认 10s）
    authStorageKey: 'token',         // localStorage 中存储 token 的 key
    authHeaderKey: 'Access-Token',   // 请求头中携带 token 的 header 名称
    businessErrorConfig: { ... },    // 业务错误码配置
    headers: { ... },                // 自定义默认请求头
})
```

> 也可以不使用 `createClient`，直接使用独立的 `createQuery` / `createMutation` / `createInfiniteQuery`，但需要自行传入 `baseURL`。

### createQuery

创建查询 Hook，返回一个 `useQuery` 的封装。

**静态 endpoint** — params 自动作为 URL query 参数：

```ts
const useUsers = createQuery<User[], { keyword?: string }>('/users')

// 使用
const { data, isLoading } = useUsers({
    params: { keyword: 'test' },
    enabled: true,
    staleTime: 5 * 60 * 1000
})
// 请求: GET /api/users?keyword=test
```

**动态 endpoint** — 通过函数构造 URL：

```ts
const useUserDetail = createQuery<User, { id: number }>((params) => `/users/${params!.id}`)

// 使用
const { data } = useUserDetail({
    params: { id: 1 }
})
// 请求: GET /api/users/1
```

**Options**

| 选项                   | 类型                 | 说明                                     |
| ---------------------- | -------------------- | ---------------------------------------- |
| `params`               | `MaybeRef<TRequest>` | 请求参数，静态 endpoint 时拼入 URL query |
| `enabled`              | `MaybeRef<boolean>`  | 是否启用查询                             |
| `staleTime`            | `MaybeRef<number>`   | 数据保鲜时间                             |
| `gcTime`               | `MaybeRef<number>`   | 缓存保留时间                             |
| `select`               | `(data) => T`        | 数据转换                                 |
| `placeholderData`      | `TResponse`          | 占位数据                                 |
| `refetchOnWindowFocus` | `MaybeRef<boolean>`  | 窗口聚焦时重新请求                       |

> 所有 `useQuery` 支持的选项均可用。

### createMutation

创建变更 Hook，返回一个 `useMutation` 的封装。

**静态 endpoint** — body 直接作为请求体：

```ts
const useCreateUser = createMutation<User, CreateUserDTO>('/users', 'POST')

const { mutate } = useCreateUser({
    onSuccess: (data) => {
        console.log('created:', data)
    }
})
mutate({ name: 'Alice', age: 20 })
// 请求: POST /api/users  body: { name: 'Alice', age: 20 }
```

**动态 endpoint** — 路径参数从 variables 中提取：

```ts
const useUpdateUser = createMutation<User, UpdateUserDTO>((vars) => `/users/${vars.id}`, 'PUT')

const { mutate } = useUpdateUser()
mutate({ id: 1, name: 'Bob' })
// 请求: PUT /api/users/1  body: { id: 1, name: 'Bob' }
```

**自动刷新相关 query**：

```ts
const useCreateUser = createMutation<User, CreateUserDTO>('/users', 'POST')

const { mutate } = useCreateUser({
    invalidateKeys: ['/users'] // mutation 成功后自动刷新匹配的 query
})
```

**Options**

| 选项             | 类型                               | 说明                                     |
| ---------------- | ---------------------------------- | ---------------------------------------- |
| `invalidateKeys` | `string[]`                         | mutation 成功后需要刷新的 query key 列表 |
| `onSuccess`      | `(data, variables) => void`        | 成功回调                                 |
| `onError`        | `(error, variables) => void`       | 失败回调                                 |
| `onSettled`      | `(data, error, variables) => void` | 完成回调（无论成功失败）                 |

### createInfiniteQuery

创建无限滚动/分页查询 Hook，内置 `pageNum` / `pageSize` 分页逻辑，自动判断是否有下一页。

```ts
const useUserPage = createInfiniteQuery<{ list: User[]; total: number }, { keyword?: string }>(
    '/users'
)

const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useUserPage({
    params: { keyword: 'test' },
    pageSize: 20
})
// 请求: GET /api/users?keyword=test&pageNum=1&pageSize=20
// 下一页: GET /api/users?keyword=test&pageNum=2&pageSize=20
```

**自定义 URL 参数名**：

```ts
useUserPage({
    pageKey: 'current', // 默认 'pageNum'
    pageSizeKey: 'size' // 默认 'pageSize'
})
// 请求: GET /api/users?current=1&size=20
```

**自定义列表提取** — 默认自动检测 `res.list` / `res.data` / `res.records` / `res.content`：

```ts
// 后端返回 { orderList: Order[], total: number }
const useOrders = createInfiniteQuery<OrderPage, void>('/orders')

useOrders({
    extractList: (res) => res.orderList
})
```

**动态 endpoint**：

```ts
const useUserPosts = createInfiniteQuery<PostPage, { userId: number }>(
    (params, page) => `/users/${params!.userId}/posts`
)

useUserPosts({
    params: { userId: 1 }
})
```

**Options**

| 选项                   | 类型                 | 默认值       | 说明                            |
| ---------------------- | -------------------- | ------------ | ------------------------------- |
| `params`               | `MaybeRef<TRequest>` | -            | 筛选条件                        |
| `pageSize`             | `number`             | `10`         | 每页条数                        |
| `pageKey`              | `string`             | `'pageNum'`  | 页码的 URL 参数名               |
| `pageSizeKey`          | `string`             | `'pageSize'` | 每页条数的 URL 参数名           |
| `initialPage`          | `number`             | `1`          | 起始页码                        |
| `extractList`          | `(res) => unknown[]` | 自动检测     | 从响应中提取列表数据            |
| `enabled`              | `MaybeRef<boolean>`  | -            | 是否启用                        |
| `staleTime`            | `MaybeRef<number>`   | -            | 数据保鲜时间                    |
| `gcTime`               | `MaybeRef<number>`   | -            | 缓存保留时间                    |
| `select`               | `(data) => T`        | -            | 数据转换（接收 `InfiniteData`） |
| `refetchOnWindowFocus` | `MaybeRef<boolean>`  | -            | 窗口聚焦时重新请求              |

> 内置的翻页逻辑：`extractList(lastPage).length < pageSize` 时认为没有更多数据。

## Error Handling

所有错误分为两层：

**HttpError** — HTTP 层错误（网络异常、状态码异常、超时等）：

```ts
import { isHttpError } from 'vue-query-factory'

try {
    await request('/users', { ... })
} catch (e) {
    if (isHttpError(e)) {
        e.code       // 401, 404, 500, 999(未知异常) ...
        e.isUnauthorized()  // 401
        e.isServerError()   // >= 500
        e.info?.url
    }
}
```

**BusinessError** — 业务层错误（后端返回的 code 命中 `businessErrorConfig.codes`）：

```ts
import { isBusinessError } from 'vue-query-factory'

if (isBusinessError(e)) {
    e.code // '10001'
    e.message // '用户不存在'
    e.info // 原始响应对象
}
```

业务错误推荐使用 `businessErrorConfig` 配置：

```ts
import { ElMessage } from 'element-plus'

createClient({
    baseURL: '/api',
    businessErrorConfig: {
        codes: [
            [10001, '用户不存在'], // 使用前端自定义文案
            [10002] // 使用接口返回的错误文案
        ],
        errMsgKey: 'errMsg', // 默认是 'message'，可按后端字段改为 msg / errMsg 等
        tipFunc: (message) => ElMessage.error(message)
    }
})
```

默认 `resolveResponse` 命中业务错误码时，会按以下顺序决定 `BusinessError.message`：

1. `businessErrorConfig.codes` 中配置的文案
2. 响应体里的 `response[businessErrorConfig.errMsgKey ?? 'message']`
3. `操作失败，(code)`

`tipFunc` 只负责页面提示，不会吞掉错误；请求仍会 `throw BusinessError`。这是与 Promise、`async/await` 和 TanStack Query 最兼容的方式：直接 `request()` 时用 `try/catch`，在 `createQuery` / `createMutation` 中用 `error` 状态或 `onError` 处理。`tipFunc` 适合做全局 toast，例如 Element Plus 的 `ElMessage.error`。

## Fetcher Options

`createClient` 和各工厂方法支持的请求配置：

| 选项                    | 类型                             | 默认值                                   | 说明                                                     |
| ----------------------- | -------------------------------- | ---------------------------------------- | -------------------------------------------------------- |
| `baseURL`               | `string`                         | -                                        | 接口基础路径（必填）                                     |
| `timeout`               | `number`                         | `10000`                                  | 请求超时（ms）                                           |
| `authStorageKey`        | `string \| () => string \| null` | -                                        | localStorage 中存储 token 的 key，或自定义函数获取 token |
| `authHeaderKey`         | `string`                         | -                                        | 请求头中携带 token 的 header 名称                        |
| `businessErrorConfig`   | `BusinessErrorConfig`            | `{}`                                     | 业务错误码、错误文案字段和提示函数配置                   |
| `businessErrorCodesMap` | `Record<string, string>`         | `{}`                                     | 旧版业务错误码映射，建议改用 `businessErrorConfig.codes` |
| `headers`               | `HeadersInit`                    | `{ 'Content-Type': 'application/json' }` | 自定义请求头                                             |
| `urlParams`             | `Record<string, unknown>`        | -                                        | URL query 参数（null/undefined 会被过滤）                |
| `method`                | `HttpMethod`                     | `'GET'`                                  | 请求方法                                                 |
| `body`                  | `BodyInit`                       | -                                        | 请求体（支持 FormData）                                  |

`BusinessErrorConfig`：

| 选项        | 类型                                                 | 默认值      | 说明                             |
| ----------- | ---------------------------------------------------- | ----------- | -------------------------------- |
| `codes`     | `Array<[string \| number, string?]>`                 | `[]`        | 业务错误码列表，第二项可选       |
| `errMsgKey` | `string`                                             | `'message'` | 从响应体读取错误文案的字段名     |
| `tipFunc`   | `(message: string, error: BusinessError) => unknown` | -           | 命中业务错误时执行的页面提示函数 |

## License

MIT
