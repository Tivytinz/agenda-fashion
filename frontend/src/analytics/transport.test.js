// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { postTelemetry } from "./transport";

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
it.each(["/analytics/collect", "/eventos-produto"])("%s usa cookie sem reaproveitar Bearer legado", async path => {
  localStorage.setItem("token", "credencial-de-outra-conta");
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
  await postTelemetry(path, { exemplo: true }, { keepalive: true });
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe(path);
  expect(options).toMatchObject({ credentials: "include", keepalive: true, method: "POST" });
  expect(new Headers(options.headers).has("Authorization")).toBe(false);
  expect(JSON.parse(options.body)).toEqual({ exemplo: true });
});
