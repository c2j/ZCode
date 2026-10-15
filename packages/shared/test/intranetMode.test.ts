import { afterEach, describe, expect, it, vi } from "vitest";

async function importFreshIntranetModeModule() {
  vi.resetModules();
  return await import("../src/intranetMode.js");
}

describe("intranet mode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("未注入 define 时构建期默认关闭，运行期缺省跟随构建期默认", async () => {
    const module = await importFreshIntranetModeModule();

    expect(module.ZCODE_INTRANET_MODE_BUILT_IN).toBe(false);
    expect(module.isIntranetMode({})).toBe(false);
    expect(module.isIntranetMode(undefined)).toBe(false);
  });

  it("构建期 define 开启时运行期缺省即开启", async () => {
    vi.stubGlobal("__ZCODE_INTRANET_MODE__", true);

    const module = await importFreshIntranetModeModule();

    expect(module.ZCODE_INTRANET_MODE_BUILT_IN).toBe(true);
    expect(module.isIntranetMode({})).toBe(true);
    expect(module.isIntranetMode()).toBe(true);
  });

  it("运行期显式值优先于构建期默认，可开启也可关闭", async () => {
    vi.stubGlobal("__ZCODE_INTRANET_MODE__", true);

    const module = await importFreshIntranetModeModule();

    for (const value of ["1", "true", "TRUE", "yes", " on "]) {
      expect(module.isIntranetMode({ ZCODE_INTRANET_MODE: value })).toBe(true);
    }
    for (const value of ["0", "false", "NO", "off", " off "]) {
      expect(module.isIntranetMode({ ZCODE_INTRANET_MODE: value })).toBe(false);
    }
    // 非法值不改变构建期默认
    expect(module.isIntranetMode({ ZCODE_INTRANET_MODE: "maybe" })).toBe(true);
  });

  it("默认读取 process.env", async () => {
    vi.stubEnv("ZCODE_INTRANET_MODE", "1");
    const enabled = await importFreshIntranetModeModule();
    expect(enabled.isIntranetMode()).toBe(true);

    vi.unstubAllEnvs();
    vi.stubEnv("ZCODE_INTRANET_MODE", "0");
    const disabled = await importFreshIntranetModeModule();
    expect(disabled.isIntranetMode()).toBe(false);
  });
});
