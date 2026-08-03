// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { BillingCheckoutPage, SubscriptionPage } from "./BillingPages";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

const PLAN = { id: 2, slug: "autonoma", nome: "Autônoma", valor: 49.9 };

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
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("checkout PIX", () => {
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
    expect(screen.getByText("Código PIX copiado.")).not.toBeNull();
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
});
