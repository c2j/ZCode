import { describe, expect, it } from "vitest";
import desktopBuilderConfig from "../electron-builder.config.js";

// Linux 打包目标契约：只分发 AppImage。
// latest.yml / electron-updater 在 Linux 上固定以 AppImage 作为更新产物，
// scripts/upload-oss.sh 也按 AppImage 解析更新元数据，因此 AppImage 是唯一保留的目标；
// deb/rpm/pacman 已下线，对应的构建配置不得再回到产物矩阵。
describe("electron-builder Linux 打包目标", () => {
  it("prerelease 也生成统一的 latest.yml", () => {
    expect(desktopBuilderConfig.detectUpdateChannel).toBe(false);
  });

  it("Linux 只产出 AppImage", () => {
    expect(desktopBuilderConfig.linux?.target).toEqual(["AppImage"]);
  });

  it("不再保留 deb/rpm/pacman 的构建配置", () => {
    expect(desktopBuilderConfig.deb).toBeUndefined();
    expect(desktopBuilderConfig.rpm).toBeUndefined();
    expect(desktopBuilderConfig.pacman).toBeUndefined();
  });
});
