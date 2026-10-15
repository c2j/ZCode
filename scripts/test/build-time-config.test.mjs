import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { createBuildTimeConfigDefines, resolveBuildTimeConfig } from "../build-time-config.mjs";

const dir = await mkdtemp(join(tmpdir(), "zcode-build-time-config-"));
after(() => rm(dir, { recursive: true, force: true }));

async function writeDefaults(name, content) {
  const path = join(dir, name);
  await writeFile(path, typeof content === "string" ? content : JSON.stringify(content));
  return path;
}

test("没有私有默认配置也没有环境变量时上报/更新关闭，无互联网默认开启", async () => {
  const config = await resolveBuildTimeConfig({}, { defaultsPath: join(dir, "missing.json") });
  assert.deepEqual(config, {
    armsRumEndpoint: "",
    telemetryReportEndpoint: "",
    autoUpdateEnabled: false,
    intranetMode: true,
  });
});

test("私有默认配置启用上报与自动更新，无互联网仍默认开启", async () => {
  const defaultsPath = await writeDefaults("defaults.json", {
    ZCODE_ARMS_RUM_ENDPOINT: " https://rum.example.com/x ",
    ZCODE_TELEMETRY_REPORT_ENDPOINT: "https://report.example.com/event",
    ZCODE_AUTO_UPDATE: "1",
  });
  assert.deepEqual(await resolveBuildTimeConfig({}, { defaultsPath }), {
    armsRumEndpoint: "https://rum.example.com/x",
    telemetryReportEndpoint: "https://report.example.com/event",
    autoUpdateEnabled: true,
    intranetMode: true,
  });
});

test("环境变量优先于私有默认配置，显式空字符串关闭单项能力", async () => {
  const defaultsPath = await writeDefaults("override.json", {
    ZCODE_ARMS_RUM_ENDPOINT: "https://rum.example.com/x",
    ZCODE_TELEMETRY_REPORT_ENDPOINT: "https://report.example.com/event",
    ZCODE_AUTO_UPDATE: "true",
  });
  const config = await resolveBuildTimeConfig(
    {
      ZCODE_ARMS_RUM_ENDPOINT: "",
      ZCODE_TELEMETRY_REPORT_ENDPOINT: "https://other.example.com/event",
      ZCODE_AUTO_UPDATE: "0",
    },
    { defaultsPath },
  );
  assert.deepEqual(config, {
    armsRumEndpoint: "",
    telemetryReportEndpoint: "https://other.example.com/event",
    autoUpdateEnabled: false,
    intranetMode: true,
  });
});

test("无互联网默认开启，仅显式关闭值放行外连", async () => {
  const missing = { defaultsPath: join(dir, "missing.json") };
  assert.equal((await resolveBuildTimeConfig({}, missing)).intranetMode, true);
  assert.equal(
    (await resolveBuildTimeConfig({ ZCODE_INTRANET_MODE: "1" }, missing)).intranetMode,
    true,
  );
  assert.equal(
    (await resolveBuildTimeConfig({ ZCODE_INTRANET_MODE: "0" }, missing)).intranetMode,
    false,
  );
  assert.equal(
    (await resolveBuildTimeConfig({ ZCODE_INTRANET_MODE: "off" }, missing)).intranetMode,
    false,
  );

  const enabledDefaults = await writeDefaults("intranet-on.json", {
    ZCODE_INTRANET_MODE: "yes",
  });
  assert.equal(
    (await resolveBuildTimeConfig({}, { defaultsPath: enabledDefaults })).intranetMode,
    true,
  );
  const disabledDefaults = await writeDefaults("intranet-off.json", { ZCODE_INTRANET_MODE: "0" });
  assert.equal(
    (await resolveBuildTimeConfig({}, { defaultsPath: disabledDefaults })).intranetMode,
    false,
  );
  // 环境变量显式关闭优先于私有默认配置的开启值
  assert.equal(
    (
      await resolveBuildTimeConfig(
        { ZCODE_INTRANET_MODE: "off" },
        { defaultsPath: enabledDefaults },
      )
    ).intranetMode,
    false,
  );
});

test("私有默认配置格式错误时直接报错，不静默关闭", async () => {
  const defaultsPath = await writeDefaults("broken.json", "[1]");
  await assert.rejects(resolveBuildTimeConfig({}, { defaultsPath }), /必须是 JSON 对象/);
});

test("define 以 JSON 字面量注入", () => {
  assert.deepEqual(
    createBuildTimeConfigDefines({
      armsRumEndpoint: "https://rum.example.com/x",
      telemetryReportEndpoint: "",
      autoUpdateEnabled: true,
      intranetMode: true,
    }),
    {
      __ZCODE_ARMS_RUM_ENDPOINT__: '"https://rum.example.com/x"',
      __ZCODE_TELEMETRY_REPORT_ENDPOINT__: '""',
      __ZCODE_AUTO_UPDATE_ENABLED__: "true",
      __ZCODE_INTRANET_MODE__: "true",
    },
  );
});
