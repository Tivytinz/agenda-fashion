// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { SessionProvider, useSession } from "./SessionContext";
import { clearSession } from "./session";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function SessionProbe() {
  const session = useSession();
  return <span>{session.authenticated ? session.usuario?.nome : "Desconectada"}</span>;
}

beforeEach(() => {
  localStorage.setItem("token", "token-valido");
  localStorage.setItem("usuario", JSON.stringify({ id: 1, nome: "Ana" }));
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
    render(<SessionProvider><SessionProbe /></SessionProvider>);
    expect(await screen.findByText("Ana")).not.toBeNull();

    clearSession({ notify: true });

    await waitFor(() => expect(screen.getByText("Desconectada")).not.toBeNull());
  });
});
