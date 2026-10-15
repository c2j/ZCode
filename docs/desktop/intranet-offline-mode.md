# 桌面内网/离线模式

## 背景

内网部署的构建不应主动访问 ZCode 官方后端与遥测。仅把 endpoint 指向内网网关
（`ZCODE_BASE_URL` / 设置里的 `zcodeEndpointOrigin`）只能改道，请求仍会被构造并发出；
合规或审计要求“日志里不出现任何到官方域名的解析与连接尝试”时，需要在调用出口短路。

本模式即该出口开关：**开启后请求根本不会被构造/发出**，而不是发出后失败。

## 开关与优先级

**默认开启（缺省即不访问互联网）**；只有显式写入关闭值才放行外连。

| 来源 | 取值 | 作用 |
| --- | --- | --- |
| 运行期环境变量 `ZCODE_INTRANET_MODE` | `1`/`true`/`yes`/`on` | 开启 |
| | `0`/`false`/`no`/`off` | 关闭，放行外连 |
| | 缺省 | 跟随构建期默认 |
| 构建期 define `__ZCODE_INTRANET_MODE__` | — | 桌面构建**默认开启**；未注入 define 的 bundle（CLI、测试等）默认关闭 |

- 运行期显式值优先于构建期默认：可在内网构建上临时 `ZCODE_INTRANET_MODE=0` 放行联调，也可在普通构建上 `=1` 强制离线。
- 构建期来源沿用 [build-time-optional-capabilities.md](./build-time-optional-capabilities.md)
  的解析入口（`scripts/build-time-config.mjs`）：环境变量 > 私有默认配置 > 缺省；本项**缺省为开启**，
  仅当显式写入关闭值（`0`/`false`/`no`/`off`）时才关闭。
- 解析实现见 `packages/shared/src/intranetMode.ts` 的 `isIntranetMode(env?)`；`env` 默认读
  `process.env`，测试可显式传入。
- 桌面 dev/e2e 也走同一构建入口，因此默认离线；需要联调后端时用 `ZCODE_INTRANET_MODE=0 pnpm dev:desktop`。

## 语义

开启后**不发起**：

- Host（`packages/services`）：`NodeApiClient` 的全部 ZCode 后端业务请求——营销触达、
  client-scenes、coding-plan、内置资源下载、用量/引导、官方账号套餐与余额查询等。
- Desktop Main：`/api/v1/client/configs` 拉取（desktop-context-prompt、renderer-action-trace、
  社区/反馈远端配置）、启动强制升级检查、ARMS RUM 初始化。
- Services：telemetry 事件上报。

开启后**仍可正常发起**（不在本模式管辖内）：

- 模型推理请求：走各自 provider 客户端，通常是用户自己的内网模型。**这是本模式与
  “全局断网”的关键区别**，不能误伤。
- 用户显式配置的第三方机器人 / Webhook——只有用户主动配置才会触发。
- 渲染进程的静态资源（如 CDN 图片）与用户主动打开的嵌入浏览器。

需要对整机强制性断网时，仍应叠加防火墙与内网 DNS：本模式只保证“应用不主动外连”，
不替代网络层管控。

### 为什么按 Funel 短路，而不是全局改写 fetch

Host 是独立 Node 进程，`globalThis.fetch` 同时承载业务后端与模型推理；全局挂断会误伤内网
模型。`NodeApiClient` 只服务 ZCode 后端业务 API，是限定范围的正确出口。Main 侧同理只在
`net.request` 的两个业务参数出口短路。

## 所有者与数据流

```
构建进程 env / config/private/build-defaults.json
        │  scripts/build-time-config.mjs（唯一解析入口）
        ▼
desktop tsup（main、host、preload）与 vite（renderer）的 define
        │  __ZCODE_INTRANET_MODE__
        ▼
packages/shared/src/intranetMode.ts  isIntranetMode(env?)  ←── 运行期 process.env 兜底
        │
        ├─ Host   : NodeApiClient.request()          → 抛 ApiError，不发请求
        ├─ Main   : client/configs fetcher           → 抛错，灰度回退默认快照
        ├─ Main   : resolveDesktopForceUpdateRequirement() → 直接返回 null
        ├─ Main   : appARMSBootstrap enable          → false，不上报
        └─ Services: telemetryCore.sendReport()      → 直接返回
```

事件顺序（以 Host 一次业务调用为例）：

```
业务服务 ──request()──► NodeApiClient
                          │ isIntranetMode() ?
                          ├─ 是：立即抛 ApiError（无 DNS、无连接、无 header 组装）
                          └─ 否：解析 endpoint → 注入 dispatcher → fetch
```

## 验收

1. 默认构建（不设置任何开关）即为内网模式：启动日志不出现到 `zcode.z.ai` / `cdn-zcode.z.ai`
   的解析与连接尝试，且模型推理（指向内网模型）正常。
2. 显式关闭：`ZCODE_INTRANET_MODE=0` 构建或运行时启动，放行官方后端与遥测，行为与改造前一致。
3. 渲染层灰度（context-prompt / renderer-action-trace）在开启时回退默认 `enabled:false`，
   不发起 `/api/v1/client/configs`。
4. 未注入构建期 define 的环境（单测、CLI）缺省不进入内网模式，测试与既有链路不受影响。
5. `pnpm typecheck`、`pnpm lint` 与相关单测通过。

## fork 维护提示

本能力是 fork 对上游的增量，为降低后续与上游合并的冲突：

- 逻辑集中在新增的 `packages/shared/src/intranetMode.ts`；上游文件只加**函数首行**级别的
  短路，避免改动既有行、禁止顺带格式化。
- 拦截点固定在少数出口（`NodeApiClient.request`、`client/configs` fetcher、
  `resolveDesktopForceUpdateRequirement`、ARMS `enable`、`sendReport`），新增出口时在此登记。
