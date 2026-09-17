// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { ProfessionalsPage } from "./ProfessionalsPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: vi.fn() }));

beforeEach(() => {
  apiRequest.mockReset();
  useSession.mockReturnValue({ usuario: { id: 1 } });
});

afterEach(cleanup);

describe("equipe por convite", () => {
  it("envia convite sem comunicar vínculo imediato", async () => {
    apiRequest
      .mockResolvedValueOnce({
        profissionais: [{ id: 1, nome: "Dona", papel: "dono", foto_url: null }]
      })
      .mockResolvedValueOnce({
        mensagem: "Convite enviado. O vínculo será criado somente após o aceite do profissional.",
        convite: {
          id: 20,
          status: "pendente",
          profissional: { id: 9, nome: "Ana", foto_url: null }
        }
      });

    render(<ProfessionalsPage />);
    await screen.findByRole("heading", { name: "Profissionais" });

    fireEvent.change(
      screen.getByLabelText(/E-mail ou WhatsApp da profissional/i),
      { target: { value: "ana@example.com" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/profissionais/convites", {
        method: "POST",
        body: { emailOuWhatsapp: "ana@example.com" }
      });
    });

    expect(await screen.findByText("Aguardando aceite")).not.toBeNull();
    expect(screen.getByText(/O vínculo ainda não foi criado/i)).not.toBeNull();
    expect(
      apiRequest.mock.calls.filter(([path]) => path === "/profissionais")
    ).toHaveLength(1);
  });
});
