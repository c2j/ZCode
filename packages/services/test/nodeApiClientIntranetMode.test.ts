import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@zcode/shared";
import { createNodeApiClient } from "../src/providers/api/nodeApiClient.js";

describe("nodeApiClient intranet mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("内网模式下在出口短路，不发出任何请求", async () => {
    vi.stubEnv("ZCODE_INTRANET_MODE", "1");
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const client = createNodeApiClient({ fetchImpl });

    await expect(client.request("https://zcode.z.ai/api/v1/client/configs")).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("未开启内网模式时照常发出请求", async () => {
    vi.stubEnv("ZCODE_INTRANET_MODE", "0");
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const client = createNodeApiClient({ fetchImpl });

    await client.request("https://zcode.z.ai/api/v1/client/configs");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
