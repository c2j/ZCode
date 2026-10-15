# Linux 分发与自动更新契约

> 状态（2026-10-15 修订）：Linux 只分发 AppImage。deb / rpm / pacman 构建目标已下线
> （`packages/desktop/electron-builder.config.js` 的 `linux.target` 只保留 `AppImage`），
> 本文原先的 pacman 打包章节随之移除。下方“客户端自动更新契约”仍是当前运行时事实。

## 目标

Linux x64/arm64 只构建 AppImage 安装包，复用现有 Electron Builder 应用内容；AppImage 同时是 Linux 自动更新主产物。

## 边界

- 只出 AppImage；不再生成 `.deb` / `.rpm` / `.pkg.tar.zst`。
- 不改变应用运行时、协议、Agent、远程控制或自动更新协议。
- AppImage 作为 `latest.yml` 的 primary update artifact 与唯一分发格式。

## 构建与发布链路

```text
Linux x64/arm64 CI
        |
        v
electron-builder (linux.target = ["AppImage"])
        |
        v
artifact collect -> upload -> release
        |
        +--> latest.yml primary path = AppImage
```

## 客户端自动更新契约（2026-09-16 修订）

ZCT-2100231841920471040：3.12.1 在 Ubuntu deb 安装形态下载 3.12.2 时，旧过滤器删除 deb，只留下 AppImage；DebUpdater 找不到文件，读取 `fileInfo.info` 抛错。旧约定“Linux 仅 AppImage 支持自动更新”错误，现予以替换。

- macOS、Windows、Linux 各安装形态均沿用 electron-updater 的下载、校验和安装流程；Linux 的清单过滤不按格式统一删除。
- 当前 updater 实例是安装类型的唯一真源；ManifestUpdateProvider 只为 Linux 更新器选择同类型产物，不另读 package-type、不维护第二份平台状态。AppImageUpdater 对应 `.AppImage`，DebUpdater 对应 `.deb`，RpmUpdater 对应 `.rpm`，PacmanUpdater 对应 `.pkg.tar.zst`（兼容 `.pacman`）。这些运行时分支保留用于识别历史安装；由于新发布只提供 AppImage，deb/rpm/pacman 安装将匹配不到同类型产物，按下面的“缺少包 = 明确失败”处理。
- 清单缺少当前安装类型时，在解析边界明确失败，禁止 updater 的 fallback 误选其他格式。缺少包是发布不完整，不等于该安装方式不支持更新。
- URL 按 pathname 判定后缀，支持绝对/相对地址、查询参数及大小写；保留真实下载 URL 与校验值。
- PacmanUpdater 仍按旧 `.pacman` 后缀生成缓存路径，`.pkg.tar.zst` 的 `info.url` 使用实际文件名，避免把完整 URL 拼入缓存路径；网络下载 URL 不变。
- macOS/Windows 保持原清单解析语义，下载器负责选 zip/exe；不改变更新通道、下载时序、权限、安装命令、UI 或手机远控链路。

```text
服务端完整清单 → 当前 updater 实例决定安装类型 → 同类型文件 → 下载/校验 → 原平台安装器
                                             └─ 缺少同类型包：明确失败，不跨格式回退
```

验收：测试须在任意开发机运行 Linux 安装类型矩阵，覆盖混合清单、单类型清单、缺失类型、绝对/相对 URL、query、校验值与 Pacman 缓存路径；macOS/Windows 原解析行为回归。现场日志与失败测试先于修复，禁止只断言过滤器本身。真实提权安装仍需对应系统的发行包 smoke 验证。

## 风险与验收

- 产物收集、共享目录清理、OSS glob、发布校验只需识别 `.AppImage`。
- 不得把源码、source map、密钥或 CI 凭据加入包；沿用现有 app.asar 裁剪策略。
- 需要验证 AppImage 包在目标发行版的启动、`zcode://` 协议注册与 `latest.yml` 更新路径。
