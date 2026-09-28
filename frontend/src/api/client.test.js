// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiRequest,
  migrateLegacySession
} from "./client";
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

  it("não envia Bearer legado automaticamente nas chamadas normais", async () => {
    localStorage.setItem(
      "token",
      "jwt-legado"
    );

    const fetchMock =
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json:
          vi.fn().mockResolvedValue({
            ok: true
          })
      });
    vi.stubGlobal(
      "fetch",
      fetchMock
    );

    await apiRequest(
      "/minha-sessao"
    );

    const options =
      fetchMock.mock.calls[0][1];

    expect(
      new Headers(
        options.headers
      ).has("Authorization")
    ).toBe(false);
  });

  it("valida a migração do Bearer legado sem alterar o storage antes do contexto", async () => {
    localStorage.setItem(
      "token",
      "jwt-legado"
    );

    const fetchMock =
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json:
          vi.fn()
      });
    vi.stubGlobal(
      "fetch",
      fetchMock
    );

    const resultado =
      await migrateLegacySession();

    expect(resultado)
      .toMatchObject({
        attempted: true,
        migrated: true
      });

    expect(fetchMock)
      .toHaveBeenCalledWith(
        "/auth/migrar-sessao-legada",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          headers:
            expect.objectContaining({
              Authorization:
                "Bearer jwt-legado"
            })
        })
      );

    expect(
      localStorage.getItem(
        "token"
      )
    ).toBe("jwt-legado");

    expect(
      localStorage.getItem(
        "session_active"
      )
    ).toBeNull();
  });

  it("preserva cookie válido quando só o Bearer legado ficou obsoleto", async () => {
    localStorage.setItem(
      "token",
      "jwt-legado-expirado"
    );

    const fetchMock =
      vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json:
            vi.fn().mockResolvedValue({
              erro:
                "Token expirado."
            })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json:
            vi.fn().mockResolvedValue({
              usuario: {
                id: 1
              }
            })
        });

    vi.stubGlobal(
      "fetch",
      fetchMock
    );

    const resultado =
      await migrateLegacySession();

    expect(resultado)
      .toMatchObject({
        attempted: true,
        migrated: false,
        alreadyCookie: true
      });

    expect(
      localStorage.getItem(
        "token"
      )
    ).toBe("jwt-legado-expirado");

    expect(
      localStorage.getItem(
        "session_active"
      )
    ).toBeNull();
  });

  it("não limpa o storage até o contexto confirmar que a migração é inválida", async () => {
    localStorage.setItem(
      "token",
      "expirado"
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json:
          vi.fn().mockResolvedValue({
            erro:
              "Token expirado."
          })
      })
    );

    const resultado =
      await migrateLegacySession();

    expect(resultado)
      .toMatchObject({
        attempted: true,
        migrated: false,
        invalid: true
      });

    expect(
      localStorage.getItem(
        "token"
      )
    ).toBe("expirado");
  });

  it("permite cancelar a migração legada antes que uma transição nova assuma a sessão", async () => {
    localStorage.setItem("token", "jwt-legado");

    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        reject(new DOMException("Abortada", "AbortError"));
      });
    })));

    const controller = new AbortController();
    const request = migrateLegacySession({
      signal: controller.signal
    });

    controller.abort();

    await expect(request).rejects.toMatchObject({
      name: "AbortError"
    });
    expect(localStorage.getItem("token")).toBe("jwt-legado");
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

  it("permite que o contexto de sessão trate 401 sem limpar uma sessão mais nova", async () => {
    localStorage.setItem("session_active", "1");
    const listener = vi.fn();
    window.addEventListener(SESSION_CLEARED_EVENT, listener, { once: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ erro: "Sessão expirada." })
    }));

    await expect(apiRequest("/minha-sessao", {
      clearSessionOnUnauthorized: false
    })).rejects.toMatchObject({ status: 401 });

    expect(localStorage.getItem("session_active")).toBe("1");
    expect(listener).not.toHaveBeenCalled();
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
