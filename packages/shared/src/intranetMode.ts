/**
 * 内网/离线模式（fork 能力）：开启后应用不主动发起 ZCode 官方后端与遥测请求。
 *
 * 与「把 endpoint 指向内网网关」不同，本模式是在调用出口直接短路，请求根本不会被构造/发出，
 * 因此日志里不会再出现到官方域名的解析与连接尝试。规则见 docs/desktop/intranet-offline-mode.md。
 *
 * 默认开启（缺省即不访问互联网）；只有显式写入关闭值才放行外连。
 * 覆盖范围：Host 的 NodeApiClient 业务请求、Desktop Main 的 /api/v1/client/configs 拉取与
 * 强制升级检查与 ARMS 初始化、Services 的 telemetry 上报。
 * 不覆盖：模型推理（可能是用户自己的内网模型）、用户显式配置的第三方机器人/Webhook、
 * 渲染进程静态资源。这些不是「官方后端轮询」，全局断网需叠加防火墙。
 *
 * 开关来源（显式值优先）：
 * 1. 运行期环境变量 ZCODE_INTRANET_MODE：`1/true/yes/on` 开启，`0/false/no/off` 关闭；
 * 2. 缺省时跟随构建期 define __ZCODE_INTRANET_MODE__（桌面构建默认开启）；
 *    未注入 define 的 bundle（CLI、测试等）视为关闭。
 */
declare const __ZCODE_INTRANET_MODE__: boolean;

export const ZCODE_INTRANET_MODE_ENV = "ZCODE_INTRANET_MODE" as const;

const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const DISABLED_VALUES = new Set(["0", "false", "no", "off"]);

/** 构建期固化的内网模式；未注入 define 的 bundle（CLI、测试等）为 false。 */
export const ZCODE_INTRANET_MODE_BUILT_IN: boolean =
  typeof __ZCODE_INTRANET_MODE__ !== "undefined" && __ZCODE_INTRANET_MODE__ === true;

/** 解析是否处于内网模式；env 默认读取 process.env，测试可显式传入。 */
export function isIntranetMode(
  env: Record<string, string | undefined> | undefined = typeof process !== "undefined"
    ? process.env
    : undefined,
): boolean {
  const value = env?.[ZCODE_INTRANET_MODE_ENV]?.trim().toLowerCase();
  if (value) {
    if (ENABLED_VALUES.has(value)) {
      return true;
    }
    if (DISABLED_VALUES.has(value)) {
      return false;
    }
  }
  // 未显式配置时跟随构建期默认（桌面构建默认开启）。
  return ZCODE_INTRANET_MODE_BUILT_IN;
}
