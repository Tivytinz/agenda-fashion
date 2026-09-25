// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { SessionProvider, useSession } from "./SessionContext";
import { clearSession } from "./session";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function SessionProbe() {
  const session = useSession();
  return (
    <>
      <span>{session.authenticated ? session.usuario?.nome : "Desconectada"}</span>
      <button type="button" onClick={session.logout}>Sair</button>
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
});

describe("sincronização da sessão", () => {
  it("atualiza a interface imediatamente quando a API expira a sessão", async () => {
    renderSession();
    expect(await screen.findByText("Ana")).not.toBeNull();

    clearSession({ notify: true });

    await waitFor(() => expect(screen.getByText("Desconectada")).not.toBeNull());
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
