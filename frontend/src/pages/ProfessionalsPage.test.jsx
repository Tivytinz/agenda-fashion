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

  it("CA-EQP-06: proprietária configura serviços atendidos pela profissional", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/profissionais") {
        return Promise.resolve({
          profissionais: [
            { id: 1, nome: "Dona", papel: "dono", foto_url: null },
            { id: 9, nome: "Ana", papel: "profissional", foto_url: null }
          ]
        });
      }

      if (
        path === "/profissionais/9/servicos" &&
        !options.method
      ) {
        return Promise.resolve({
          profissional_id: 9,
          servicos: [
            { id: 11, nome: "Manicure", ativo: true, habilitado: true },
            { id: 12, nome: "Pedicure", ativo: true, habilitado: false }
          ]
        });
      }

      if (
        path === "/profissionais/9/servicos" &&
        options.method === "PUT"
      ) {
        return Promise.resolve({
          mensagem: "Serviços da profissional atualizados."
        });
      }

      return Promise.reject(
        new Error(`Requisição inesperada: ${path}`)
      );
    });

    render(<ProfessionalsPage />);

    const buttons = await screen.findAllByRole(
      "button",
      { name: "Configurar serviços" }
    );

    fireEvent.click(buttons[1]);

    const pedicure = await screen.findByRole(
      "checkbox",
      { name: /Pedicure/i }
    );

    expect(pedicure.checked).toBe(false);
    fireEvent.click(pedicure);
    expect(pedicure.checked).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: "Salvar serviços" })
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/profissionais/9/servicos",
        {
          method: "PUT",
          body: {
            servico_ids: [11, 12]
          }
        }
      );
    });

    expect(
      await screen.findByText("Serviços da profissional atualizados.")
    ).not.toBeNull();
  });
  });
});
