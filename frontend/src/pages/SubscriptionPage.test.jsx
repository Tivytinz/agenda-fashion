// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { SubscriptionPage } from "./SubscriptionPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/painel/assinatura"]}>
      <SubscriptionPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

afterEach(() => {
  cleanup();
});

describe("plano e assinatura", () => {
  it("mostra plano pago selecionado e os limites gratuitos enquanto não há assinatura", async () => {
    apiRequest.mockResolvedValueOnce({
      plano: { id: 2, slug: "autonoma", nome: "Autônoma", valor: 49.9 },
      assinatura: null,
      uso: {
        utilizados: 2,
        limite: 10,
        percentual: 20,
        profissionais_utilizados: 1,
        limite_profissionais: 1,
        servicos_utilizados: 3,
        limite_servicos: 2
      },
      pagamentos: []
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "Plano e assinatura" })).not.toBeNull();
    expect(screen.getByText("Plano selecionado")).not.toBeNull();
    expect(screen.getByText("Sem assinatura ativa")).not.toBeNull();
    expect(screen.queryByText("Forma de pagamento")).toBeNull();
    expect(screen.queryByText("Próxima cobrança")).toBeNull();

    const subscribe = screen.getByRole("link", { name: "Assinar Autônoma" });
    expect(subscribe.getAttribute("href")).toBe("/checkout?plano=autonoma");
    expect(screen.getByRole("link", { name: "Escolher plano" }).getAttribute("href"))
      .toBe("/planos");

    expect(screen.getByText("Seus limites atuais")).not.toBeNull();
    expect(screen.getByText("Grátis")).not.toBeNull();
    expect(screen.getByText("Enquanto a assinatura não estiver ativa, valem os limites gratuitos.")).not.toBeNull();
    expect(screen.getByText("2 de 10 agendamentos · 8 disponíveis")).not.toBeNull();
    expect(screen.getByText("1 / 1")).not.toBeNull();
    expect(screen.getByText("Limite atingido")).not.toBeNull();
    expect(screen.getByText("3 / 2")).not.toBeNull();
    expect(screen.getByText("1 acima do limite")).not.toBeNull();
    expect(screen.getByText("Você possui 3 serviços. O plano em uso permite 2. Assine um plano maior para adicionar novos serviços.")).not.toBeNull();
    expect(screen.getByText("Nenhum pagamento registrado ainda.")).not.toBeNull();
  });

  it("mostra cobrança e cancelamento apenas para assinatura ativa", async () => {
    apiRequest.mockResolvedValueOnce({
      plano: { id: 2, slug: "autonoma", nome: "Autônoma", valor: 49.9 },
      assinatura: {
        status: "ACTIVE",
        ativo: true,
        forma_pagamento: "pix",
        data_proxima_cobranca: "2026-09-23"
      },
      uso: {},
      pagamentos: []
    });

    renderPage();

    expect(await screen.findByText("Assinatura ativa")).not.toBeNull();
    expect(screen.getByText("Plano atual")).not.toBeNull();
    expect(screen.getByText("Autônoma", { selector: "strong" })).not.toBeNull();
    expect(screen.getByText("Forma de pagamento")).not.toBeNull();
    expect(screen.getByText("PIX")).not.toBeNull();
    expect(screen.getByText("Próxima cobrança")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar renovação" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Ver planos" })).not.toBeNull();
  });

  it("diferencia assinatura pendente de assinatura ativa e mantém limites gratuitos", async () => {
    apiRequest.mockResolvedValueOnce({
      plano: { id: 2, slug: "autonoma", nome: "Autônoma", valor: 49.9 },
      assinatura: {
        status: "PENDING",
        ativo: false,
        forma_pagamento: "pix"
      },
      uso: {},
      pagamentos: []
    });

    renderPage();

    expect(await screen.findByText("Pagamento pendente")).not.toBeNull();
    expect(screen.getByText("Plano selecionado")).not.toBeNull();
    expect(screen.getByText("Enquanto a assinatura não estiver ativa, valem os limites gratuitos.")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Cancelar renovação" })).toBeNull();
  });

  it("traduz status dos pagamentos para linguagem clara", async () => {
    apiRequest.mockResolvedValueOnce({
      plano: { id: 2, slug: "autonoma", nome: "Autônoma", valor: 49.9 },
      assinatura: { status: "ACTIVE", ativo: true, forma_pagamento: "pix" },
      uso: {},
      pagamentos: [
        {
          id: 7,
          data_pagamento: "2026-08-23",
          valor: 49.9,
          forma_pagamento: "pix",
          status: "CONFIRMED"
        }
      ]
    });

    renderPage();

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Pago")).not.toBeNull();
    expect(within(table).getByText("PIX")).not.toBeNull();
  });

  it("mantém erro de cancelamento dentro do diálogo", async () => {
    apiRequest
      .mockResolvedValueOnce({
        plano: { id: 2, slug: "autonoma", nome: "Autônoma", valor: 49.9 },
        assinatura: { status: "ACTIVE", ativo: true, forma_pagamento: "pix" },
        uso: {},
        pagamentos: []
      })
      .mockRejectedValueOnce(new Error("Não foi possível cancelar agora"));

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar renovação" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sim, cancelar" }));
    });

    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getByRole("alert").textContent)
      .toContain("Não foi possível cancelar agora");
  });
});
