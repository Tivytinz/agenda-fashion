// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { migrateLegacySession } from "./client";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); });
const response = (status, data = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

it.each(["cookie-headers", "error-body", "migration-headers", "conflict-body"])(
  "limita a migração inteira com %s pendente, preservando o token", async phase => {
    vi.useFakeTimers();
    localStorage.setItem("token", "legado");
    const pending = new Promise(() => {});
    const fetchMock = vi.fn().mockImplementation((_url, options) => {
      if (phase === "cookie-headers") return pending;
      if (phase === "error-body") return Promise.resolve({ ...response(503), json: () => pending });
      if (options.method !== "POST") return Promise.resolve(response(401));
      if (phase === "migration-headers") return pending;
      return Promise.resolve({ ...response(200), json: () => pending });
    });
    vi.stubGlobal("fetch", fetchMock);
    const outcome = migrateLegacySession({ timeoutMs: 100 }).catch(error => error);
    await vi.advanceTimersByTimeAsync(101);
    expect(await outcome).toMatchObject({ status: 408, data: { codigo: "REQUEST_TIMEOUT" } });
    expect(fetchMock.mock.calls.at(-1)[1].signal.aborted).toBe(true);
    expect(localStorage.getItem("token")).toBe("legado");
    expect(vi.getTimerCount()).toBe(0);
  }
);

it("não reinicia o prazo em consultas encadeadas nem envia nova chamada após abortar", async () => {
  vi.useFakeTimers(); localStorage.setItem("token", "legado");
  const fetchMock = vi.fn(async (_url, options) => {
    await new Promise(resolve => setTimeout(resolve, 60));
    return response(options.method === "POST" ? 409 : 401);
  });
  vi.stubGlobal("fetch", fetchMock);
  const outcome = migrateLegacySession({ timeoutMs: 100 }).catch(error => error);
  await vi.advanceTimersByTimeAsync(101);
  expect(await outcome).toMatchObject({ status: 408 });
  await vi.advanceTimersByTimeAsync(100);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem("token")).toBe("legado");
});

it("não envia requisição com sinal já cancelado", async () => {
  localStorage.setItem("token", "legado");
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  const controller = new AbortController(); controller.abort();
  await expect(migrateLegacySession({ signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(localStorage.getItem("token")).toBe("legado");
});

it("libera o timer após sucesso e deixa a confirmação do storage com o provider", async () => {
  vi.useFakeTimers(); localStorage.setItem("token", "legado");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(204)));
  await expect(migrateLegacySession()).resolves.toMatchObject({ migrated: true });
  await vi.advanceTimersByTimeAsync(20001);
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
  expect(localStorage.getItem("token")).toBe("legado");
});
