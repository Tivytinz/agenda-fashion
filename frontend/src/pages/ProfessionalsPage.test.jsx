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

  if (typeof HTMLDialogElement !== "undefined") {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };

    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
    };
  }
});

afterEach(cleanup);

describe("equipe por convite", () => {
  it("CA-EQP-06: proprietária configura serviços habilitados da profissional", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/profissionais" && !options.method) {
        return Promise.resolve({
          profissionais: [
            { id: 1, nome: "Dona", papel: "dono", foto_url: null },
            { id: 9, nome: "Ana", papel: "profissional", foto_url: null }
          ]
        });
      }

      if (path === "/profissionais/9/servicos" && !options.method) {
        return Promise.resolve({
          profissional: { id: 9, nome: "Ana" },
          servicos: [
            { id: 11, nome: "Manicure", ativo: true, habilitada: true },
            { id: 12, nome: "Pedicure", ativo: true, habilitada: false }
          ]
        });
      }

      if (
        path === "/profissionais/9/servicos" &&
        options.method === "PUT"
      ) {
        return Promise.resolve({
          mensagem: "Serviços da profissional atualizados.",
          profissional: { id: 9, nome: "Ana" },
          servicos: [
            { id: 11, nome: "Manicure", ativo: true, habilitada: true },
            { id: 12, nome: "Pedicure", ativo: true, habilitada: true }
          ]
        });
      }

      return Promise.reject(new Error(`Requisição inesperada: ${path}`));
    });

    render(<ProfessionalsPage />);

    await screen.findByRole("heading", { name: "Profissionais" });

    const configureButtons = screen.getAllByRole("button", {
      name: "Configurar serviços"
    });
    fireEvent.click(configureButtons[1]);

    expect(
      await screen.findByRole("heading", {
        name: "Serviços de Ana"
      })
    ).not.toBeNull();

    const pedicure = screen.getByLabelText(/Pedicure/i);
    expect(pedicure.checked).toBe(false);

    fireEvent.click(pedicure);

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
