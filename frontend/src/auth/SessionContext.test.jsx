// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiRequest,
  migrateLegacySession
} from "../api/client";
import { SessionProvider, useSession } from "./SessionContext";
import { clearSession } from "./session";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn(),
  migrateLegacySession: vi.fn()
}));

function SessionProbe() {
  const session = useSession();
  return (
    <>
      <span>{session.authenticated ? session.usuario?.nome : "Desconectada"}</span>
      <span data-testid="session-loading">{session.loading ? "Carregando" : "Pronta"}</span>
      <button type="button" onClick={session.logout}>Sair</button>
      <button type="button" onClick={() => session.refresh({ silent: true }).catch(() => {})}>
        Sincronizar silenciosamente
      </button>
    </>
  );
}

function renderSession() {
  return render(
    <MemoryRouter initialEntries={["/conta"]}>
      <SessionProvider>
        <SessionProbe />
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
      .mockImplementation(
        async () => {
          localStorage.removeItem(
            "token"
          );
          localStorage.setItem(
            "session_active",
            "1"
          );

          return {
            attempted: true,
            migrated: true
          };
        }
      );

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
      "/minha-sessao"
    );

    expect(
      migrateLegacySession
        .mock.invocationCallOrder[0]
    ).toBeLessThan(
      apiRequest
        .mock.invocationCallOrder[0]
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
