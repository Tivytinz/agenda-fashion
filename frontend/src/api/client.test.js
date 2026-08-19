// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./client";
import { SESSION_CLEARED_EVENT } from "../auth/session";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("cliente da API", () => {
  it("envia cookies HttpOnly em todas as chamadas", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true })
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/minha-sessao");

    expect(fetchMock).toHaveBeenCalledWith(
      "/minha-sessao",
      expect.objectContaining({
        credentials: "include"
      })
    );
  });

  it("limpa e comunica a expiração da sessão ao receber 401", async () => {
    localStorage.setItem("token", "expirado");
    localStorage.setItem("usuario", JSON.stringify({ id: 1 }));
    const listener = vi.fn();
    window.addEventListener(SESSION_CLEARED_EVENT, listener, { once: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ erro: "Sessão expirada." })
    }));

    await expect(apiRequest("/conta")).rejects.toMatchObject({ status: 401 });

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("usuario")).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
  });

  it("interrompe requisições presas e explica o tempo limite", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        reject(new DOMException("Abortada", "AbortError"));
      });
    })));

    const request = apiRequest("/demorada", { timeoutMs: 50 });
    const expectation = expect(request).rejects.toMatchObject({
      status: 408,
      message: expect.stringContaining("demorou demais")
    });

    await vi.advanceTimersByTimeAsync(50);
    await expectation;
  });
});
