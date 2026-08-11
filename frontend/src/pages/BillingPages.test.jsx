// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMetaEventContext,
  trackMetaEvent
} from "../analytics/metaAds";
import { apiRequest } from "../api/client";
import { BillingCheckoutPage, SubscriptionPage } from "./BillingPages";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../analytics/metaAds", () => ({
  createMetaEventContext: vi.fn(),
  trackMetaEvent: vi.fn()
}));

const PLAN = { id: 2, slug: "autonoma", nome: "Autônoma", valor: 49.9 };
const META_CONTEXT = {
  consentimento: true,
  event_id: "af:professional-checkout:12345678",
  fbp: "fb.1.123.456",
  source_url: "http://localhost/checkout"
};

function renderCheckout() {
  return render(
    <MemoryRouter initialEntries={["/checkout?plano=autonoma"]}>
      <Routes>
        <Route path="/checkout" element={<BillingCheckoutPage />} />
        <Route path="/painel/assinatura" element={<h1>Plano e assinatura</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

function mockInitialization() {
  apiRequest
    .mockResolvedValueOnce({ planos: [PLAN] })
    .mockResolvedValueOnce(null);
}

async function generatePix() {
  fireEvent.change(screen.getByRole("textbox", { name: "CPF ou CNPJ" }), {
    target: { value: "12345678901" }
  });
  await act(async () => {
    fireEvent.submit(screen.getByRole("button", { name: "Gerar PIX" }).closest("form"));
  });
  expect(screen.getByRole("heading", { name: "PIX gerado" })).not.toBeNull();
}

beforeEach(() => {
  apiRequest.mockReset();
  createMetaEventContext.mockReset();
  trackMetaEvent.mockReset();
  createMetaEventContext.mockReturnValue({
    ...META_CONTEXT
  });
  trackMetaEvent.mockResolvedValue(true);
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("checkout PIX", () => {
  it("reutiliza idempotência e event_id ao repetir uma tentativa que falhou", async () => {
    mockInitialization();
    apiRequest
      .mockRejectedValueOnce(new Error("Conexão interrompida"))
      .mockResolvedValueOnce({
        pagamento: { pix: { payload: "000201PIX" } },
        status: "PENDING"
      });

    renderCheckout();
    await screen.findByRole("heading", { name: "Finalize seu plano" });
    fireEvent.change(screen.getByRole("textbox", { name: "CPF ou CNPJ" }), {
      target: { value: "123.456.789-01" }
    });

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Gerar PIX" }).closest("form"));
    });
    expect(await screen.findByRole("alert")).not.toBeNull();

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Gerar PIX" }).closest("form"));
    });

    const checkoutCalls = apiRequest.mock.calls.filter(([path]) => path === "/checkout");
    expect(checkoutCalls).toHaveLength(2);
    expect(checkoutCalls[0][1].headers["Idempotency-Key"])
      .toBe(checkoutCalls[1][1].headers["Idempotency-Key"]);
    expect(checkoutCalls[0][1].body.meta.event_id)
      .toBe(checkoutCalls[1][1].body.meta.event_id);
    expect(checkoutCalls[1][1].body.cpf_cnpj).toBe("12345678901");
    expect(createMetaEventContext).toHaveBeenCalledTimes(1);
    expect(trackMetaEvent).toHaveBeenCalledWith(
      "InitiateCheckout",
      {
        currency: "BRL",
        value: 49.9,
        content_name: "Autônoma"
      },
      META_CONTEXT.event_id
    );
  });

  it("explica a falha de consulta e permite verificar novamente", async () => {
    mockInitialization();
    apiRequest
      .mockResolvedValueOnce({
        pagamento: { id: "pay_123", pix: { payload: "000201PIX" } },
        status: "PENDING"
      })
      .mockRejectedValueOnce(new Error("Falha de rede"))
      .mockResolvedValueOnce({ status: "CONFIRMED" });

    renderCheckout();
    await screen.findByRole("heading", { name: "Finalize seu plano" });
    vi.useFakeTimers();
    await generatePix();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(screen.getByText(/Seu PIX continua válido/)).not.toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Verificar pagamento novamente" }));
    });

    expect(screen.getByRole("heading", { name: "Plano e assinatura" })).not.toBeNull();
  });

  it("informa quando a confirmação automática esgota as tentativas", async () => {
    mockInitialization();
    apiRequest
      .mockResolvedValueOnce({
        pagamento: { id: "pay_456", pix: { payload: "000201PIX" } },
        status: "PENDING"
      })
      .mockResolvedValue({ status: "PENDING" });

    renderCheckout();
    await screen.findByRole("heading", { name: "Finalize seu plano" });
    vi.useFakeTimers();
    await generatePix();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(screen.getByText(/Ainda não recebemos a confirmação/)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Verificar pagamento novamente" })).not.toBeNull();
  });

  it("confirma que o código PIX foi copiado", async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    mockInitialization();
    apiRequest.mockResolvedValueOnce({
      pagamento: { pix: { payload: "000201PIX" } },
      status: "PENDING"
    });

    renderCheckout();
    await screen.findByRole("heading", { name: "Finalize seu plano" });
    await generatePix();
    fireEvent.click(screen.getByRole("button", { name: "Copiar código PIX" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("000201PIX"));
    expect(await screen.findByText("Código PIX copiado.")).not.toBeNull();
  });
});

describe("assinatura", () => {
  it("confirma visualmente o pagamento recebido do checkout", async () => {
    apiRequest.mockResolvedValueOnce({
      plano: { nome: "Autônoma", valor: 49.9 },
      assinatura: { status: "ACTIVE", forma_pagamento: "PIX" },
      uso: {},
      pagamentos: []
    });

    render(
      <MemoryRouter initialEntries={[{
        pathname: "/painel/assinatura",
        state: { payment: "confirmed" }
      }]}>
        <Routes>
          <Route path="/painel/assinatura" element={<SubscriptionPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Pagamento confirmado. Seu plano foi atualizado.")).not.toBeNull();
  });

  it("mostra a falha de cancelamento dentro do diálogo", async () => {
    apiRequest
      .mockResolvedValueOnce({
        plano: { nome: "Autônoma", valor: 49.9 },
        assinatura: { status: "ACTIVE", forma_pagamento: "PIX" },
        uso: {},
        pagamentos: []
      })
      .mockRejectedValueOnce(new Error("Não foi possível cancelar agora"));

    render(
      <MemoryRouter initialEntries={["/painel/assinatura"]}>
        <Routes>
          <Route path="/painel/assinatura" element={<SubscriptionPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Cancelar renovação" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sim, cancelar" }));
    });

    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog.querySelector('[role="alert"]').textContent)
      .toContain("Não foi possível cancelar agora");
  });
});
