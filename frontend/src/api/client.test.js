// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiRequest,
  migrateLegacySession
} from "./client";
import { SESSION_CLEARED_EVENT, saveSession, invalidateSessionRequests } from "../auth/session";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("cliente da API", () => {
  it.each([
    ["conexão interrompida", new TypeError("Failed to fetch")],
    ["JSON inválido", new SyntaxError("Unexpected end of JSON input")]
  ])("não confirma sucesso quando o corpo falha: %s", async (_case, error) => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200, json: async () => { throw error; }
    })));
    await expect(apiRequest("/agenda-configuracao", { method: "PUT", body: {} }))
      .rejects.toMatchObject({ status: 502, data: { codigo: "INVALID_RESPONSE", statusOriginal: 200 } });
  });

  it.each([[204, "POST"], [205, "POST"], [200, "HEAD"]])(
    "aceita resposta sem corpo quando o contrato permite: %s %s",
    async (status, method) => {
      const json = vi.fn(() => { throw new SyntaxError("Corpo vazio"); });
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status, json })));
      await expect(apiRequest("/sem-corpo", { method })).resolves.toEqual({});
      expect(json).not.toHaveBeenCalled();
    }
  );

  it("preserva erro HTTP e expiração da sessão mesmo sem JSON utilizável", async () => {
    saveSession({ usuario: { id: 1 } });
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false, status: 401, json: async () => { throw new SyntaxError("HTML do proxy"); }
    })));
    await expect(apiRequest("/conta")).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem("session_active")).toBeNull();
  });

  it("preserva o status HTTP quando o JSON de erro é null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, json: async () => null })));
    await expect(apiRequest("/restrito")).rejects.toMatchObject({ status: 403 });
  });

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
      vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json:
            vi.fn().mockResolvedValue({
              erro:
                "Sessão não encontrada."
            })
        })
        .mockResolvedValueOnce({
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

  it("preserva cookie válido sem enviar o Bearer legado de outra identidade", async () => {
    localStorage.setItem(
      "token",
      "jwt-legado-conta-a"
    );

    const fetchMock =
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json:
          vi.fn().mockResolvedValue({
            usuario: {
              id: 2
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

    expect(fetchMock)
      .toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0])
      .toBe("/minha-sessao");
    expect(
      new Headers(
        fetchMock.mock.calls[0][1].headers
      ).has("Authorization")
    ).toBe(false);

    expect(
      localStorage.getItem(
        "token"
      )
    ).toBe("jwt-legado-conta-a");

    expect(
      localStorage.getItem(
        "session_active"
      )
    ).toBeNull();
  });

  it("migra o Bearer válido depois que um cookie inválido é rejeitado", async () => {
    localStorage.setItem(
      "token",
      "jwt-legado-valido"
    );

    const fetchMock =
      vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json:
            vi.fn().mockResolvedValue({
              erro:
                "Sessão inválida."
            })
        })
        .mockResolvedValueOnce({
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

    expect(fetchMock.mock.calls[0][0])
      .toBe("/minha-sessao");
    expect(fetchMock.mock.calls[1][0])
      .toBe("/auth/migrar-sessao-legada");
  });

  it("preserva cookie criado concorrentemente durante a migração", async () => {
    localStorage.setItem(
      "token",
      "jwt-legado-conta-a"
    );

    const fetchMock =
      vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json:
            vi.fn().mockResolvedValue({
              erro:
                "Sessão não encontrada."
            })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          json:
            vi.fn().mockResolvedValue({
              codigo:
                "COOKIE_SESSAO_PRESENTE"
            })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json:
            vi.fn().mockResolvedValue({
              usuario: {
                id: 2
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

    expect(fetchMock)
      .toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0])
      .toBe("/minha-sessao");
  });

  it("aceita resposta compatível quando o backend preserva um cookie concorrente", async () => {
    localStorage.setItem(
      "token",
      "jwt-legado-conta-a"
    );

    const fetchMock =
      vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json:
            vi.fn().mockResolvedValue({
              erro:
                "Sessão não encontrada."
            })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json:
            vi.fn().mockResolvedValue({
              codigo:
                "COOKIE_SESSAO_PRESENTE",
              migrado: false
            })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json:
            vi.fn().mockResolvedValue({
              usuario: {
                id: 2
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

    expect(fetchMock)
      .toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0])
      .toBe("/auth/migrar-sessao-legada");
    expect(fetchMock.mock.calls[2][0])
      .toBe("/minha-sessao");
  });

  it("não limpa o storage até o contexto confirmar que a migração é inválida", async () => {
    localStorage.setItem(
      "token",
      "expirado"
    );

    const fetchMock =
      vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json:
            vi.fn().mockResolvedValue({
              erro:
                "Sessão não encontrada."
            })
        })
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
          ok: false,
          status: 401,
          json:
            vi.fn().mockResolvedValue({
              erro:
                "Sessão não encontrada."
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

  it("propaga cancelamento externo para a requisição canônica de sessão", async () => {
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        reject(new DOMException("Abortada", "AbortError"));
      });
    })));

    const controller = new AbortController();
    const request = apiRequest("/minha-sessao", {
      clearSessionOnUnauthorized: false,
      signal: controller.signal
    });

    controller.abort();

    await expect(request).rejects.toMatchObject({
      name: "AbortError"
    });
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
  it("mantém o timeout até terminar a leitura do corpo", async () => {
    vi.useFakeTimers();
    let finishBody;
    let signal;
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      signal = options.signal;
      return { ok: true, status: 200, json: () => new Promise(resolve => { finishBody = resolve; }) };
    }));
    const request = apiRequest("/corpo-lento", { timeoutMs: 50 });
    const assertion = expect(request).rejects.toMatchObject({ status: 408, data: { codigo: "REQUEST_TIMEOUT" } });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(signal.aborted).toBe(true);
    finishBody({ ok: true });
  });

  it("cancela durante o corpo sem executar efeitos de um 401 tardio", async () => {
    saveSession({ usuario: { id: 1 } });
    let finishBody;
    let startBody;
    const started = new Promise(resolve => { startBody = resolve; });
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false, status: 401,
      json: () => { startBody(); return new Promise(resolve => { finishBody = resolve; }); }
    })));
    const controller = new AbortController();
    const request = apiRequest("/cancelar-corpo", { signal: controller.signal });
    const assertion = expect(request).rejects.toMatchObject({ name: "AbortError" });
    await started;
    controller.abort();
    await assertion;
    finishBody({ erro: "Sessão anterior" });
    await Promise.resolve();
    await Promise.resolve();
    expect(localStorage.getItem("session_active")).toBe("1");
  });

  it.each(["novo login", "transição iniciada"])("ignora limpeza por 401 anterior a %s", async transition => {
    saveSession({ usuario: { id: 1 } });
    let finishRequest;
    vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { finishRequest = resolve; })));
    const listener = vi.fn();
    window.addEventListener(SESSION_CLEARED_EVENT, listener);
    try {
      const request = apiRequest("/resposta-antiga");
      if (transition === "novo login") saveSession({ usuario: { id: 2 } });
      else invalidateSessionRequests();
      finishRequest({ ok: false, status: 401, json: async () => ({ erro: "Sessão anterior" }) });
      await expect(request).rejects.toMatchObject({ status: 401 });
      expect(localStorage.getItem("session_active")).toBe("1");
      expect(listener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(SESSION_CLEARED_EVENT, listener);
    }
  });

  it("propaga AbortError do corpo em vez de retornar sucesso vazio", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => { throw new DOMException("Corpo cancelado", "AbortError"); }
    })));
    await expect(apiRequest("/corpo-abortado")).rejects.toMatchObject({ name: "AbortError" });
  });
});
