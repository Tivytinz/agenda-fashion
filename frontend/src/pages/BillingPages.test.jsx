// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMetaEventContext,
  trackMetaEvent
} from "../analytics/metaAds";
import { apiRequest } from "../api/client";
import { BillingCheckoutPage } from "./BillingPages";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../analytics/metaAds", () => ({
  createMetaEventContext: vi.fn(),
  trackMetaEvent: vi.fn()
}));

const PLAN = { id: 2, slug: "autonoma", nome: "Autônoma", valor: 10 };
const STUDIO = { id: 3, slug: "studio", nome: "Studio", valor: 20 };
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
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("checkout PIX", () => {
  it("descarta respostas antigas após troca de plano na mesma tela", async () => {
    let resolverAntigo;
    let resolverAtual;
    let consultas = 0;
    apiRequest.mockImplementation((path) => {
      if (path === "/meu-plano") return Promise.resolve(null);
      if (path === "/planos") {
        consultas += 1;
        return new Promise((resolve) => {
          if (consultas === 1) resolverAntigo = resolve;
          else resolverAtual = resolve;
        });
      }
      throw new Error(`Consulta inesperada: ${path}`);
    });

    render(
      <MemoryRouter initialEntries={["/checkout?plano=autonoma"]}>
        <Link to="/checkout?plano=studio">Mudar plano</Link>
        <Routes>
          <Route path="/checkout" element={<BillingCheckoutPage />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => fireEvent.click(screen.getByRole("link", { name: "Mudar plano" })));
    await act(async () => resolverAtual({ planos: [PLAN, STUDIO] }));
    expect(screen.getByRole("heading", { name: "Studio" })).not.toBeNull();
    expect(screen.getByText("R$ 20,00")).not.toBeNull();

    await act(async () => resolverAntigo({ planos: [PLAN, STUDIO] }));
    expect(screen.getByRole("heading", { name: "Studio" })).not.toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: "CPF ou CNPJ" }), {
      target: { value: "12345678901" }
    });
    apiRequest.mockResolvedValueOnce({ pagamento: { pix: { payload: "pix_studio" } } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Gerar PIX" }).closest("form"));
    });
    expect(apiRequest.mock.calls.find(([path]) => path === "/checkout")[1].body.plano_id).toBe(3);
  });

  it("recupera PIX criado durante troca de plano sem enviar segundo POST", async () => {
    let concluirPost;
    apiRequest.mockImplementation((path) => {
      if (path === "/planos") return Promise.resolve({ planos: [PLAN, STUDIO] });
      if (path === "/meu-plano") return Promise.resolve(null);
      if (path === "/checkout") return new Promise((resolve) => {
        concluirPost = resolve;
      });
      throw new Error(`Consulta inesperada: ${path}`);
    });

    render(
      <MemoryRouter initialEntries={["/checkout?plano=autonoma"]}>
        <Link to="/checkout?plano=studio">Studio</Link>
        <Link to="/checkout?plano=autonoma">Autônoma</Link>
        <Routes>
          <Route path="/checkout" element={<BillingCheckoutPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole("heading", { name: "Autônoma" });
    fireEvent.change(screen.getByRole("textbox", { name: "CPF ou CNPJ" }), {
      target: { value: "12345678901" }
    });
    fireEvent.submit(screen.getByRole("button", { name: "Gerar PIX" }).closest("form"));
    await waitFor(() => expect(typeof concluirPost).toBe("function"));

    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "Studio" }));
    });
    await screen.findByRole("heading", { name: "Studio" });
    await act(async () => {
      concluirPost({ pagamento: { pix: { payload: "pix_da_autonoma" } } });
    });
    expect(screen.queryByRole("heading", { name: "PIX gerado" })).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "Autônoma" }));
    });
    expect(await screen.findByRole("heading", { name: "PIX gerado" })).not.toBeNull();
    expect(screen.getByDisplayValue("pix_da_autonoma")).not.toBeNull();
    expect(apiRequest.mock.calls.filter(([path]) => path === "/checkout")).toHaveLength(1);
  });

  it("informa que o PIX recorrente não é débito automático", async () => {
    mockInitialization();
    renderCheckout();
    expect(await screen.findByText(/não é debitado automaticamente/)).not.toBeNull();
  });

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
        value: 10,
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
      .mockResolvedValueOnce({
        status: "CONFIRMED",
        ativo: true,
        status_assinatura: "ACTIVE"
      });

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

  it("não anuncia plano ativo enquanto o pagamento confirmado ainda está ativando", async () => {
    mockInitialization();
    apiRequest
      .mockResolvedValueOnce({
        pagamento: { id: "pay_ativando", pix: { payload: "000201PIX" } },
        status: "PENDING"
      })
      .mockResolvedValue({
        status: "CONFIRMED",
        ativo: false,
        status_assinatura: "PENDING"
      });

    renderCheckout();
    await screen.findByRole("heading", { name: "Finalize seu plano" });
    vi.useFakeTimers();
    await generatePix();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(screen.getByText(/Pagamento confirmado. Estamos ativando seu plano/)).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Plano e assinatura" })).toBeNull();
  });

  it("informa quando pagamento confirmado requer atenção operacional", async () => {
    mockInitialization();
    apiRequest
      .mockResolvedValueOnce({
        pagamento: { id: "pay_atencao", pix: { payload: "000201PIX" } },
        status: "PENDING"
      })
      .mockResolvedValueOnce({
        status: "CONFIRMED",
        ativo: false,
        status_assinatura: "PENDING",
        estado_ativacao: "ATIVACAO_REQUER_ATENCAO"
      });

    renderCheckout();
    await screen.findByRole("heading", { name: "Finalize seu plano" });
    vi.useFakeTimers();
    await generatePix();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(screen.getByText(/ativação precisa de atenção/)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Verificar pagamento novamente" })).not.toBeNull();
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
