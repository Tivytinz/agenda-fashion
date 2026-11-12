// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiRequest,
  migrateLegacySession
} from "../api/client";
import { SessionProvider, useSession } from "./SessionContext";
import {
  clearSession,
  ANALYTICS_IDENTITY_BOUNDARY_EVENT,
  ANALYTICS_VIEW_READY_EVENT,
  AUTH_REVISION_STORAGE_KEY
} from "./session";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn(),
  migrateLegacySession: vi.fn()
}));

function SessionProbe({ onAuthError = () => {} }) {
  const session = useSession();
  return (
    <>
      <span>{session.authenticated ? session.usuario?.nome : "Desconectada"}</span>
      <span data-testid="session-loading">{session.loading ? "Carregando" : "Pronta"}</span>
      <span data-testid="business-links">{session.vinculos.map((link) => link.id).join(",")}</span>
      <span data-testid="business-principal">{session.negocioPrincipal?.id || "nenhum"}</span>
      <span data-testid="has-business">{String(session.temNegocio)}</span>
      <button type="button" onClick={() => session.adoptArchivedBusiness({ id: 9 })}>Adotar arquivamento</button>
      <button type="button" onClick={session.logout}>Sair</button>
      <button type="button" onClick={() => session.refresh().catch(() => {})}>
        Sincronizar
      </button>
      <button type="button" onClick={() => session.refresh({ silent: true }).catch(() => {})}>
        Sincronizar silenciosamente
      </button>
      <button
        type="button"
        onClick={() => session.login({ email: "bruna@example.com", senha: "senha" }).catch(onAuthError)}
      >
        Entrar como Bruna
      </button>
      <button type="button" onClick={() => session.register({ email: "bruna@example.com", senha: "senha" }).catch(() => {})}>
        Cadastrar Bruna
      </button>
      <button type="button" onClick={() => session.loginWithGoogle("credencial-teste").catch(() => {})}>
        Entrar com Google
      </button>
    </>
  );
}

function renderSession({ onAuthError } = {}) {
  return render(
    <MemoryRouter initialEntries={["/conta"]}>
      <SessionProvider>
        <SessionProbe onAuthError={onAuthError} />
      </SessionProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.setItem("session_active", "1");
  localStorage.setItem("usuario", JSON.stringify({
    id: 1,
    nome: "Ana",
    email: "ana@example.com"
  }));
  localStorage.setItem("negocio", JSON.stringify({
    id: 9,
    nome: "Studio Ana"
  }));
  migrateLegacySession
    .mockResolvedValue({
      attempted: false,
      migrated: false
    });

  apiRequest.mockResolvedValue({
    usuario: { id: 1, nome: "Ana" },
    negocio: null,
    temNegocio: false
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  apiRequest.mockReset();
  migrateLegacySession
    .mockReset();
});

describe("sincronização da sessão", () => {
  it("troca de identidade confirmada por refresh emite nova fronteira analítica", async () => {
    const boundaries = vi.fn();
    window.addEventListener(ANALYTICS_IDENTITY_BOUNDARY_EVENT, boundaries);
    try {
      renderSession();
      await screen.findByText("Ana");
      apiRequest.mockResolvedValue({
        usuario: { id: 2, nome: "Bruna" }, negocio: null, vinculos: []
      });
      fireEvent.click(screen.getByRole("button", { name: "Sincronizar" }));
      await screen.findByText("Bruna");
      expect(boundaries).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(ANALYTICS_IDENTITY_BOUNDARY_EVENT, boundaries);
    }
  });

  it("logout confirma readiness somente depois da resposta HTTP", async () => {
    renderSession();
    await screen.findByText("Ana");
    let finishLogout;
    const ready = vi.fn();
    window.addEventListener(ANALYTICS_VIEW_READY_EVENT, ready);
    try {
      apiRequest.mockImplementation((path) => path === "/logout"
        ? new Promise((resolve) => { finishLogout = resolve; })
        : Promise.resolve({}));
      fireEvent.click(screen.getByRole("button", { name: "Sair" }));
      await waitFor(() => expect(finishLogout).toBeTypeOf("function"));
      expect(ready).not.toHaveBeenCalled();
      await act(async () => finishLogout({}));
      expect(ready).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(ANALYTICS_VIEW_READY_EVENT, ready);
    }
  });

  it("logout com erro de rede permanece suspenso até login validado", async () => {
    renderSession();
    await screen.findByText("Ana");
    let current = { usuario: { id: 1, nome: "Ana" }, negocio: null, vinculos: [] };
    apiRequest.mockImplementation((path) => {
      if (path === "/logout") return Promise.reject(new Error("Rede indisponível"));
      if (path === "/login") {
        current = { usuario: { id: 2, nome: "Bruna" }, negocio: null, vinculos: [] };
      }
      return Promise.resolve(current);
    });
    const ready = vi.fn();
    window.addEventListener(ANALYTICS_VIEW_READY_EVENT, ready);
    try {
      fireEvent.click(screen.getByRole("button", { name: "Sair" }));
      await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path === "/logout")).toBe(true));
      await act(async () => {});
      expect(ready).toHaveBeenCalledTimes(0);
      fireEvent.click(screen.getByRole("button", { name: "Entrar como Bruna" }));
      await screen.findByText("Bruna");
      expect(ready).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(ANALYTICS_VIEW_READY_EVENT, ready);
    }
  });

  it("troca de conta em outra aba oculta a anterior até /minha-sessao confirmar", async () => {
    renderSession();
    await screen.findByText("Ana");
    let finishRefresh;
    apiRequest.mockImplementation((path) => path === "/minha-sessao"
      ? new Promise((resolve) => { finishRefresh = resolve; })
      : Promise.resolve({}));
    const ready = vi.fn();
    window.addEventListener(ANALYTICS_VIEW_READY_EVENT, ready);
    try {
      fireEvent(window, new StorageEvent("storage", {
        key: AUTH_REVISION_STORAGE_KEY, newValue: "outra-aba"
      }));
      expect(screen.queryByText("Ana")).toBeNull();
      expect(ready).not.toHaveBeenCalled();
      await waitFor(() => expect(finishRefresh).toBeTypeOf("function"));
      await act(async () => finishRefresh({
        usuario: { id: 2, nome: "Bruna" }, negocio: null, vinculos: []
      }));
      await screen.findByText("Bruna");
      expect(ready).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(ANALYTICS_VIEW_READY_EVENT, ready);
    }
  });

  it("falha na revalidação entre abas não reexibe identidade anterior", async () => {
    renderSession();
    await screen.findByText("Ana");
    apiRequest.mockRejectedValueOnce(new Error("Falha transitória"));
    fireEvent(window, new StorageEvent("storage", {
      key: AUTH_REVISION_STORAGE_KEY, newValue: "outra-aba"
    }));
    await waitFor(() => expect(screen.getByTestId("session-loading").textContent).toBe("Pronta"));
    expect(screen.queryByText("Ana")).toBeNull();
    expect(screen.getByText("Desconectada")).not.toBeNull();
  });

  it("login existente vindo da visita anônima abre nova fronteira de analytics", async () => {
    localStorage.removeItem("session_active");
    renderSession();
    await screen.findByText("Desconectada");
    apiRequest.mockResolvedValue({
      usuario: { id: 2, nome: "Bruna" }, negocio: null, vinculos: []
    });
    const boundary = vi.fn();
    window.addEventListener(ANALYTICS_IDENTITY_BOUNDARY_EVENT, boundary);
    try {
      fireEvent.click(screen.getByRole("button", { name: "Entrar como Bruna" }));
      await screen.findByText("Bruna");
      expect(boundary).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(ANALYTICS_IDENTITY_BOUNDARY_EVENT, boundary);
    }
  });

  it("troca de vínculo comercial não altera a identidade da sessão de analytics", async () => {
    const boundaries = vi.fn();
    window.addEventListener(ANALYTICS_IDENTITY_BOUNDARY_EVENT, boundaries);
    try {
      apiRequest.mockResolvedValue({
        usuario: { id: 1, nome: "Ana" },
        vinculos: [{ id: 9, papel: "dono" }],
        negocio: { id: 9, papel: "dono" },
        temNegocio: true
      });
      renderSession();
      await screen.findByText("Ana");
      fireEvent.click(screen.getByRole("button", { name: "Adotar arquivamento" }));
      expect(boundaries).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(ANALYTICS_IDENTITY_BOUNDARY_EVENT, boundaries);
    }
  });

  it("falha de autenticação ultrapassada não substitui o resultado da intenção nova", async () => {
    const onAuthError = vi.fn();
    renderSession({ onAuthError });
    await screen.findByText("Ana");
    let rejectOld;
    let current;
    apiRequest.mockImplementation(path => {
      if (path === "/login") return new Promise((_resolve, reject) => { rejectOld = reject; });
      if (path === "/cadastro") current = { usuario: { id: 3, nome: "Conta nova" }, vinculos: [] };
      return Promise.resolve(current);
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar como Bruna" }));
    await waitFor(() => expect(rejectOld).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar Bruna" }));
    await act(async () => rejectOld(Object.assign(new Error("Erro antigo"), { status: 401 })));
    await screen.findByText("Conta nova");
    expect(onAuthError).toHaveBeenCalledWith(expect.objectContaining({ name: "AbortError" }));
  });

  it.each([
    ["Entrar como Bruna", "/login"],
    ["Cadastrar Bruna", "/cadastro"],
    ["Entrar com Google", "/auth/google"]
  ])("Sair durante %s aguarda a escrita e não restaura a conta", async (action, path) => {
    renderSession();
    await screen.findByText("Ana");
    let finishAuthentication;
    apiRequest.mockImplementation(requestPath => requestPath === path
      ? new Promise(resolve => { finishAuthentication = resolve; }) : Promise.resolve({}));
    fireEvent.click(screen.getByRole("button", { name: action }));
    await waitFor(() => expect(finishAuthentication).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(screen.getByText("Desconectada")).not.toBeNull();
    expect(apiRequest.mock.calls.filter(([p]) => p === "/logout")).toHaveLength(0);
    await act(async () => finishAuthentication({ usuario: { id: 2, nome: "Bruna" } }));
    await waitFor(() => expect(apiRequest.mock.calls.filter(([p]) => p === "/logout")).toHaveLength(1));
    expect(screen.queryByText("Bruna")).toBeNull();
    expect(localStorage.getItem("session_active")).toBeNull();
  });

  it("ordena autenticações concorrentes e aplica apenas a intenção mais recente", async () => {
    renderSession();
    await screen.findByText("Ana");
    let finishOld;
    let current;
    apiRequest.mockImplementation(path => {
      if (path === "/login") return new Promise(resolve => { finishOld = resolve; });
      if (path === "/cadastro") current = { usuario: { id: 3, nome: "Conta mais recente" }, vinculos: [] };
      return Promise.resolve(current);
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar como Bruna" }));
    await waitFor(() => expect(finishOld).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar Bruna" }));
    expect(apiRequest.mock.calls.filter(([p]) => p === "/cadastro")).toHaveLength(0);
    await act(async () => finishOld({ usuario: { id: 2, nome: "Conta antiga" } }));
    await screen.findByText("Conta mais recente");
    expect(screen.queryByText("Conta antiga")).toBeNull();
  });

  it("Sair novamente cancela uma autenticação ainda enfileirada", async () => {
    renderSession();
    await screen.findByText("Ana");
    let finishLogout;
    apiRequest.mockImplementationOnce(() => new Promise(resolve => { finishLogout = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(finishLogout).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "Entrar como Bruna" }));
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await act(async () => finishLogout({}));
    expect(apiRequest.mock.calls.filter(([p]) => p === "/login")).toHaveLength(0);
    expect(screen.getByText("Desconectada")).not.toBeNull();
  });

  it.each([
    ["Entrar como Bruna", "/login", false],
    ["Cadastrar Bruna", "/cadastro", false],
    ["Entrar com Google", "/auth/google", false],
    ["Entrar como Bruna", "/login", true],
    ["Cadastrar Bruna", "/cadastro", true],
    ["Entrar com Google", "/auth/google", true]
  ])("%s espera o logout pendente (%s, falha=%s)", async (action, path, failLogout) => {
    let finishLogout;
    let failPendingLogout;
    let current = { usuario: { id: 1, nome: "Ana" }, negocio: null, vinculos: [] };
    apiRequest.mockImplementation((requestPath) => {
      if (requestPath === "/logout") return new Promise((resolve, reject) => {
        finishLogout = resolve;
        failPendingLogout = reject;
      });
      if (requestPath === path) current = { usuario: { id: 2, nome: "Bruna" }, negocio: null, vinculos: [] };
      return Promise.resolve(current);
    });
    renderSession();
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(screen.getByText("Desconectada")).not.toBeNull();
    expect(localStorage.getItem("session_active")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: action }));
    await act(async () => {});
    expect(apiRequest.mock.calls.filter(([p]) => p === path)).toHaveLength(0);
    await act(async () => {
      if (failLogout) failPendingLogout(Object.assign(new Error("Tempo limite"), { status: 408 }));
      else finishLogout({});
    });
    await screen.findByText("Bruna");
    expect(apiRequest.mock.calls.filter(([p]) => p === path)).toHaveLength(1);
    expect(localStorage.getItem("session_active")).toBe("1");
  });

  it("repete a saída local sem enviar dois logouts concorrentes", async () => {
    renderSession();
    await screen.findByText("Ana");
    let finishLogout;
    apiRequest.mockImplementationOnce(() => new Promise(resolve => { finishLogout = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(finishLogout).toBeTypeOf("function"));
    expect(apiRequest.mock.calls.filter(([path]) => path === "/logout")).toHaveLength(1);
    expect(screen.getByText("Desconectada")).not.toBeNull();
    await act(async () => finishLogout({}));
  });

  it("arquivamento confirmado retira só o negócio encerrado e preserva a conta e outro vínculo", async () => {
    const owner = { id: 9, papel: "dono" };
    const professional = { id: 22, papel: "profissional" };
    apiRequest.mockResolvedValue({ usuario: { id: 1, nome: "Ana" }, negocio: owner, vinculos: [owner, professional], temNegocio: true });
    renderSession();
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: "Adotar arquivamento" }));
    expect(screen.getByTestId("business-links").textContent).toBe("22");
    expect(screen.getByTestId("business-principal").textContent).toBe("22");
    expect(screen.getByTestId("has-business").textContent).toBe("true");
    expect(screen.getByText("Ana")).not.toBeNull();
  });

  it("não restaura negócio arquivado por uma leitura anterior atrasada", async () => {
    const owner = { id: 9, papel: "dono" };
    const original = { usuario: { id: 1, nome: "Ana" }, negocio: owner, vinculos: [owner], temNegocio: true };
    apiRequest.mockResolvedValueOnce(original);
    renderSession();
    await screen.findByText("Ana");
    let resolve;
    apiRequest.mockImplementationOnce(() => new Promise((yes) => { resolve = yes; }));
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar silenciosamente" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
    const pendingSignal = apiRequest.mock.calls[1][1].signal;
    fireEvent.click(screen.getByRole("button", { name: "Adotar arquivamento" }));
    expect(pendingSignal.aborted).toBe(true);
    await act(() => resolve(original));
    expect(screen.getByTestId("business-links").textContent).toBe("");
    expect(screen.getByTestId("has-business").textContent).toBe("false");
    expect(screen.getByText("Ana")).not.toBeNull();
    expect(localStorage.getItem("session_active")).toBe("1");
  });

  it("arquivamento não reabre uma sessão encerrada", async () => {
    renderSession();
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await screen.findByText("Desconectada");
    fireEvent.click(screen.getByRole("button", { name: "Adotar arquivamento" }));
    expect(screen.getByText("Desconectada")).not.toBeNull();
    expect(screen.getByTestId("has-business").textContent).toBe("false");
  });
  it("atualiza a interface imediatamente quando a API expira a sessão", async () => {
    renderSession();

    expect(localStorage.getItem("usuario")).toBeNull();
    expect(localStorage.getItem("negocio")).toBeNull();
    expect(await screen.findByText("Ana")).not.toBeNull();

    clearSession({ notify: true });

    await waitFor(() => expect(screen.getByText("Desconectada")).not.toBeNull());
  });

  it("migra Bearer legado antes de consultar a sessão canônica", async () => {
    localStorage.removeItem(
      "session_active"
    );
    localStorage.setItem(
      "token",
      "jwt-legado"
    );

    migrateLegacySession
      .mockResolvedValue({
        attempted: true,
        migrated: true
      });

    renderSession();

    expect(
      await screen.findByText(
        "Ana"
      )
    ).not.toBeNull();

    expect(
      migrateLegacySession
    ).toHaveBeenCalledTimes(1);

    expect(
      apiRequest
    ).toHaveBeenCalledWith(
      "/minha-sessao",
      expect.objectContaining({
        clearSessionOnUnauthorized: false,
        signal: expect.any(AbortSignal)
      })
    );

    expect(
      migrateLegacySession
        .mock.invocationCallOrder[0]
    ).toBeLessThan(
      apiRequest
        .mock.invocationCallOrder[0]
    );
    expect(
      migrateLegacySession
    ).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal)
    });
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("session_active")).toBe("1");
  });

  it("cancela migração legada pendente antes de autenticar outra conta", async () => {
    localStorage.removeItem("session_active");
    localStorage.setItem("token", "jwt-legado");

    let migrationSignal;
    migrateLegacySession
      .mockImplementationOnce(({ signal }) => new Promise((_resolve, reject) => {
        migrationSignal = signal;
        signal.addEventListener("abort", () => {
          reject(new DOMException("Abortada", "AbortError"));
        });
      }))
      .mockResolvedValueOnce({
        attempted: false,
        migrated: false
      });

    apiRequest.mockImplementation((path) => {
      if (path === "/login") {
        return Promise.resolve({
          usuario: { id: 2, nome: "Bruna" }
        });
      }

      if (path === "/minha-sessao") {
        return Promise.resolve({
          usuario: { id: 2, nome: "Bruna" },
          negocio: { id: 12, nome: "Studio Bruna", papel: "dono" },
          temNegocio: true
        });
      }

      return Promise.resolve({});
    });

    renderSession();
    await waitFor(() => expect(migrateLegacySession).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Entrar como Bruna" }));

    expect(await screen.findByText("Bruna")).not.toBeNull();
    expect(migrationSignal.aborted).toBe(true);
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("session_active")).toBe("1");
  });

  it("cancela migração legada pendente antes do logout", async () => {
    localStorage.removeItem("session_active");
    localStorage.setItem("token", "jwt-legado");

    let migrationSignal;
    migrateLegacySession
      .mockImplementationOnce(({ signal }) => new Promise((_resolve, reject) => {
        migrationSignal = signal;
        signal.addEventListener("abort", () => {
          reject(new DOMException("Abortada", "AbortError"));
        });
      }));

    apiRequest.mockImplementation((path) => {
      if (path === "/logout") {
        return Promise.resolve({});
      }

      return Promise.resolve({
        usuario: { id: 1, nome: "Ana" },
        negocio: null,
        temNegocio: false
      });
    });

    renderSession();
    await waitFor(() => expect(migrateLegacySession).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(screen.getByText("Desconectada")).not.toBeNull();
    expect(migrationSignal.aborted).toBe(true);
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("session_active")).toBeNull();
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/logout", {
      method: "POST"
    }));
  });

  it("limpa a sessão somente quando a migração inválida ainda pertence à geração atual", async () => {
    localStorage.removeItem("session_active");
    localStorage.setItem("token", "jwt-expirado");
    migrateLegacySession.mockResolvedValueOnce({
      attempted: true,
      migrated: false,
      invalid: true
    });

    renderSession();

    await waitFor(() => expect(screen.getByText("Desconectada")).not.toBeNull());
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("session_active")).toBeNull();
    expect(apiRequest).not.toHaveBeenCalledWith(
      "/minha-sessao",
      expect.anything()
    );
  });

  it("mantém a sessão utilizável enquanto uma sincronização silenciosa está pendente", async () => {
    renderSession();
    expect(await screen.findByText("Ana")).not.toBeNull();
    expect(screen.getByTestId("session-loading").textContent).toBe("Pronta");

    let finishRefresh;
    apiRequest.mockImplementationOnce(() => new Promise((resolve) => {
      finishRefresh = resolve;
    }));

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar silenciosamente" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Ana")).not.toBeNull();
    expect(screen.getByTestId("session-loading").textContent).toBe("Pronta");

    finishRefresh({
      usuario: { id: 1, nome: "Ana Atualizada" },
      negocio: {
        id: 9,
        nome: "Studio Ana",
        papel: "dono",
        publicado: true
      },
      temNegocio: true
    });

    expect(await screen.findByText("Ana Atualizada")).not.toBeNull();
    expect(screen.getByTestId("session-loading").textContent).toBe("Pronta");
  });

  it("preserva a sessão atual quando uma sincronização silenciosa falha por rede", async () => {
    renderSession();
    expect(await screen.findByText("Ana")).not.toBeNull();

    apiRequest.mockRejectedValueOnce(new Error("Rede indisponível"));
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar silenciosamente" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Ana")).not.toBeNull();
    expect(screen.getByTestId("session-loading").textContent).toBe("Pronta");
    expect(localStorage.getItem("session_active")).toBe("1");
  });

  it("encerra a sessão se a sincronização silenciosa receber 401", async () => {
    renderSession();
    expect(await screen.findByText("Ana")).not.toBeNull();

    const unauthorized = new Error("Sessão expirada");
    unauthorized.status = 401;
    apiRequest.mockRejectedValueOnce(unauthorized);

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar silenciosamente" }));

    await waitFor(() => expect(screen.getByText("Desconectada")).not.toBeNull());
    expect(localStorage.getItem("session_active")).toBeNull();
  });

  it("não restaura a sessão quando um refresh antigo termina depois do logout", async () => {
    renderSession();
    expect(await screen.findByText("Ana")).not.toBeNull();

    let finishOldRefresh;
    let oldSyncSignal;
    apiRequest.mockImplementationOnce((_path, options = {}) => new Promise((resolve) => {
      oldSyncSignal = options.signal;
      finishOldRefresh = resolve;
    }));

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar silenciosamente" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(screen.getByText("Desconectada")).not.toBeNull();
    expect(oldSyncSignal.aborted).toBe(true);

    finishOldRefresh({
      usuario: { id: 1, nome: "Ana Obsoleta" },
      negocio: { id: 9, nome: "Studio Ana", papel: "dono" },
      temNegocio: true
    });

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/logout", {
      method: "POST"
    }));
    expect(screen.getByText("Desconectada")).not.toBeNull();
    expect(screen.queryByText("Ana Obsoleta")).toBeNull();
    expect(localStorage.getItem("session_active")).toBeNull();
  });

  it("não deixa refresh da conta anterior sobrescrever um novo login", async () => {
    let finishOldRefresh;
    let oldSyncSignal;
    let sessionReads = 0;

    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/minha-sessao") {
        sessionReads += 1;
        if (sessionReads === 1) {
          return Promise.resolve({
            usuario: { id: 1, nome: "Ana" },
            negocio: null,
            temNegocio: false
          });
        }
        if (sessionReads === 2) {
          oldSyncSignal = options.signal;
          return new Promise((resolve) => {
            finishOldRefresh = resolve;
          });
        }
        return Promise.resolve({
          usuario: { id: 2, nome: "Bruna" },
          negocio: { id: 12, nome: "Studio Bruna", papel: "dono" },
          temNegocio: true
        });
      }

      if (path === "/login" && options.method === "POST") {
        return Promise.resolve({
          usuario: { id: 2, nome: "Bruna" }
        });
      }

      return Promise.resolve({});
    });

    renderSession();
    expect(await screen.findByText("Ana")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar silenciosamente" }));
    await waitFor(() => expect(sessionReads).toBe(2));

    fireEvent.click(screen.getByRole("button", { name: "Entrar como Bruna" }));
    expect(await screen.findByText("Bruna")).not.toBeNull();
    expect(oldSyncSignal.aborted).toBe(true);

    finishOldRefresh({
      usuario: { id: 1, nome: "Ana Obsoleta" },
      negocio: { id: 9, nome: "Studio Ana", papel: "dono" },
      temNegocio: true
    });

    await waitFor(() => expect(sessionReads).toBe(3));
    expect(screen.getByText("Bruna")).not.toBeNull();
    expect(screen.queryByText("Ana Obsoleta")).toBeNull();
  });

  it("ignora 401 atrasado da conta anterior depois de um novo login", async () => {
    let rejectOldRefresh;
    let sessionReads = 0;

    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/minha-sessao") {
        sessionReads += 1;
        if (sessionReads === 1) {
          return Promise.resolve({
            usuario: { id: 1, nome: "Ana" },
            negocio: null,
            temNegocio: false
          });
        }
        if (sessionReads === 2) {
          return new Promise((_resolve, reject) => {
            rejectOldRefresh = reject;
          });
        }
        return Promise.resolve({
          usuario: { id: 2, nome: "Bruna" },
          negocio: { id: 12, nome: "Studio Bruna", papel: "dono" },
          temNegocio: true
        });
      }

      if (path === "/login" && options.method === "POST") {
        return Promise.resolve({
          usuario: { id: 2, nome: "Bruna" }
        });
      }

      return Promise.resolve({});
    });

    renderSession();
    expect(await screen.findByText("Ana")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar silenciosamente" }));
    await waitFor(() => expect(sessionReads).toBe(2));

    fireEvent.click(screen.getByRole("button", { name: "Entrar como Bruna" }));
    expect(await screen.findByText("Bruna")).not.toBeNull();

    const unauthorized = new Error("Sessão antiga expirada");
    unauthorized.status = 401;
    rejectOldRefresh(unauthorized);

    await waitFor(() => expect(sessionReads).toBe(3));
    expect(screen.getByText("Bruna")).not.toBeNull();
    expect(localStorage.getItem("session_active")).toBe("1");
  });

  it("ignora 401 de refresh antigo assim que um refresh mais novo já começou", async () => {
    renderSession();
    expect(await screen.findByText("Ana")).not.toBeNull();

    let rejectOlder;
    let finishNewer;
    apiRequest
      .mockImplementationOnce(() => new Promise((_resolve, reject) => {
        rejectOlder = reject;
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        finishNewer = resolve;
      }));

    const syncButton = screen.getByRole("button", { name: "Sincronizar silenciosamente" });
    fireEvent.click(syncButton);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
    fireEvent.click(syncButton);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(3));

    const unauthorized = new Error("Refresh antigo expirou");
    unauthorized.status = 401;
    rejectOlder(unauthorized);

    await waitFor(() => {
      expect(screen.getByText("Ana")).not.toBeNull();
      expect(localStorage.getItem("session_active")).toBe("1");
    });

    finishNewer({
      usuario: { id: 1, nome: "Ana Nova" },
      negocio: null,
      temNegocio: false
    });

    expect(await screen.findByText("Ana Nova")).not.toBeNull();
    expect(localStorage.getItem("session_active")).toBe("1");
  });

  it("não aplica sucesso antigo depois que um refresh mais novo já começou", async () => {
    renderSession();
    expect(await screen.findByText("Ana")).not.toBeNull();

    let finishOlder;
    let finishNewer;
    apiRequest
      .mockImplementationOnce(() => new Promise((resolve) => {
        finishOlder = resolve;
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        finishNewer = resolve;
      }));

    const syncButton = screen.getByRole("button", { name: "Sincronizar silenciosamente" });
    fireEvent.click(syncButton);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
    fireEvent.click(syncButton);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(3));

    await act(async () => {
      finishOlder({
        usuario: { id: 1, nome: "Ana Antiga" },
        negocio: null,
        temNegocio: false
      });
    });

    expect(screen.queryByText("Ana Antiga")).toBeNull();
    expect(screen.getByText("Ana")).not.toBeNull();

    finishNewer({
      usuario: { id: 1, nome: "Ana Nova" },
      negocio: null,
      temNegocio: false
    });

    expect(await screen.findByText("Ana Nova")).not.toBeNull();
  });

  it("libera loading se refresh silencioso mais novo falhar após tornar outro refresh obsoleto", async () => {
    renderSession();
    expect(await screen.findByText("Ana")).not.toBeNull();

    let finishOlder;
    apiRequest
      .mockImplementationOnce(() => new Promise((resolve) => {
        finishOlder = resolve;
      }))
      .mockRejectedValueOnce(new Error("Rede indisponível"));

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar" }));
    expect(screen.getByTestId("session-loading").textContent).toBe("Carregando");
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar silenciosamente" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledTimes(3);
      expect(screen.getByTestId("session-loading").textContent).toBe("Pronta");
    });

    await act(async () => {
      finishOlder({
        usuario: { id: 1, nome: "Ana Antiga" },
        negocio: null,
        temNegocio: false
      });
    });

    expect(screen.queryByText("Ana Antiga")).toBeNull();
    expect(screen.getByText("Ana")).not.toBeNull();
  });

  it("descarta resposta mais antiga quando refreshes da mesma sessão terminam fora de ordem", async () => {
    renderSession();
    expect(await screen.findByText("Ana")).not.toBeNull();

    let finishOlder;
    let finishNewer;
    apiRequest
      .mockImplementationOnce(() => new Promise((resolve) => {
        finishOlder = resolve;
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        finishNewer = resolve;
      }));

    const syncButton = screen.getByRole("button", { name: "Sincronizar silenciosamente" });
    fireEvent.click(syncButton);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
    fireEvent.click(syncButton);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(3));

    finishNewer({
      usuario: { id: 1, nome: "Ana Nova" },
      negocio: null,
      temNegocio: false
    });
    expect(await screen.findByText("Ana Nova")).not.toBeNull();

    finishOlder({
      usuario: { id: 1, nome: "Ana Antiga" },
      negocio: null,
      temNegocio: false
    });

    await waitFor(() => expect(screen.getByText("Ana Nova")).not.toBeNull());
    expect(screen.queryByText("Ana Antiga")).toBeNull();
  });

  it("limpa a sessão local e encerra o cookie no servidor", async () => {
    renderSession();
    expect(await screen.findByText("Ana")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(screen.getByText("Desconectada")).not.toBeNull();
    expect(localStorage.getItem("session_active")).toBeNull();
    expect(localStorage.getItem("usuario")).toBeNull();
    expect(localStorage.getItem("negocio")).toBeNull();
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/logout", {
      method: "POST"
    }));
  });
});
