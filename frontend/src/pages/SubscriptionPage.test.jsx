// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { SubscriptionPage } from "./SubscriptionPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function renderPage(initialEntry = "/painel/assinatura") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
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
  it("confirma visualmente o pagamento recebido do checkout", async () => {
    apiRequest.mockResolvedValueOnce({
      plano: { id: 2, slug: "autonoma", nome: "Autônoma", valor: 49.9 },
      assinatura: { status: "ACTIVE", ativo: true, forma_pagamento: "pix" },
      uso: {},
      pagamentos: []
    });

    renderPage({
      pathname: "/painel/assinatura",
      state: { payment: "confirmed" }
    });

    expect(
      await screen.findByText("Pagamento confirmado. Estamos concluindo a ativação do seu plano.")
    ).not.toBeNull();
  });

  it("mantém o plano atual e sinaliza upgrade pendente sem gerar outra cobrança", async () => {
    apiRequest.mockResolvedValueOnce({
      plano: { id: 1, slug: "inicial", nome: "Grátis", valor: 0 },
      assinatura: null,
      upgrade_pendente: {
        plano: { id: 2, slug: "autonoma", nome: "Autônoma", valor: 49.9 },
        assinatura: {
          id: 22,
          status: "PENDING",
          ativo: false,
          forma_pagamento: "pix"
        },
        pagamento: {
          id: 30,
          status: "PENDING",
          pix_copia_cola: "000201PIX-PENDENTE",
          pix_qrcode: "imagem-base64"
        }
      },
      uso: {
        plano_id: 1,
        plano_nome: "Grátis",
        plano_slug: "inicial",
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
    expect(screen.getByText("Plano atual")).not.toBeNull();
    expect(screen.getByText("Plano gratuito")).not.toBeNull();
    expect(screen.getByText("PIX do plano Autônoma aguardando pagamento.")).not.toBeNull();
    expect(screen.getByText(/Seu plano atual continua valendo/)).not.toBeNull();
    expect(screen.getByRole("img", { name: "QR Code do PIX pendente" })).not.toBeNull();
    expect(screen.getByRole("textbox", { name: "Código PIX pendente" }).value)
      .toBe("000201PIX-PENDENTE");

    const effectivePlan = screen.getByText(/Plano em uso:/).closest("p");
    expect(within(effectivePlan).getByText("Grátis")).not.toBeNull();
    expect(screen.getByText("2 de 10 agendamentos · 8 disponíveis")).not.toBeNull();
    expect(screen.getByText("3 / 2")).not.toBeNull();

    const alerts = screen.getAllByRole("status");
    expect(alerts.some((alert) =>
      alert.textContent.includes("O plano Autônoma será aplicado somente após a confirmação do pagamento.")
    )).toBe(true);
    expect(screen.queryByRole("link", { name: "Assinar Autônoma" })).toBeNull();
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
    expect(screen.getByText("Acompanhe o que já foi usado e o que ainda está disponível.")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar renovação" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Ver planos" })).not.toBeNull();
  });

  it("preserva assinatura ativa quando existe upgrade pendente", async () => {
    apiRequest.mockResolvedValueOnce({
      plano: { id: 2, slug: "autonoma", nome: "Autônoma", valor: 49.9 },
      assinatura: {
        id: 10,
        status: "ACTIVE",
        ativo: true,
        forma_pagamento: "pix",
        data_proxima_cobranca: "2026-10-17"
      },
      upgrade_pendente: {
        plano: { id: 3, slug: "studio", nome: "Studio", valor: 99.9 },
        assinatura: {
          id: 11,
          status: "PENDING",
          ativo: false,
          forma_pagamento: "pix"
        }
      },
      uso: {
        plano_id: 2,
        plano_nome: "Autônoma",
        plano_slug: "autonoma"
      },
      pagamentos: []
    });

    renderPage();

    expect(await screen.findByText("Assinatura ativa")).not.toBeNull();
    expect(screen.getByText("PIX do plano Studio aguardando pagamento.")).not.toBeNull();
    const effectivePlan = screen.getByText(/Plano em uso:/).closest("p");
    expect(within(effectivePlan).getByText("Autônoma")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar renovação" })).not.toBeNull();
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

  it("CA-PLN-04: mostra falha de pagamento e explica recuperação sem perda de dados", async () => {
    apiRequest.mockResolvedValueOnce({
      plano: { id: 1, slug: "inicial", nome: "Grátis", valor: 0 },
      assinatura: null,
      estado_assinatura: {
        codigo: "FALHA_DE_PAGAMENTO",
        status_provedor: "OVERDUE",
        assinatura_id: 20,
        plano_id: 4
      },
      uso: {
        plano_nome: "Grátis",
        plano_slug: "inicial"
      },
      pagamentos: []
    });

    renderPage();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Falha de pagamento")).not.toBeNull();
    expect(alert.textContent).toContain("plano Grátis");
    expect(alert.textContent).toContain("sem apagar os dados do negócio");
  });

  it("CA-PLN-05: mostra checkout expirado sem anunciar benefício pago", async () => {
    apiRequest.mockResolvedValueOnce({
      plano: { id: 1, slug: "inicial", nome: "Grátis", valor: 0 },
      assinatura: null,
      estado_assinatura: {
        codigo: "CHECKOUT_EXPIRADO",
        status_provedor: "EXPIRED",
        assinatura_id: 21,
        plano_id: 3
      },
      uso: {
        plano_nome: "Grátis",
        plano_slug: "inicial"
      },
      pagamentos: []
    });

    renderPage();

    expect(await screen.findByText("Checkout expirado")).not.toBeNull();
    expect(
      screen.getByText(/nenhum benefício pago foi liberado/i)
    ).not.toBeNull();
    expect(
      screen.getByRole("link", { name: "Escolher um plano" })
    ).not.toBeNull();
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
