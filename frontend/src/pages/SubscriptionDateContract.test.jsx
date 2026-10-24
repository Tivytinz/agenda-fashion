// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import dateContract from "../../../tests/fixtures/assinatura-conta-datas.json";
import { apiRequest } from "../api/client";
import { SubscriptionPage } from "./SubscriptionPage";
import { formatDate } from "../utils/format";
vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

beforeEach(() => apiRequest.mockReset());
afterEach(cleanup);
const mount = () => render(<MemoryRouter><SubscriptionPage /></MemoryRouter>);
const payload = () => ({
  plano: { id: 2, slug: "autonoma", nome: "Autônoma", valor: 10 },
  assinatura: { ...dateContract.assinatura, id: 20, status: "ACTIVE", ativo: true, forma_pagamento: "pix" },
  pagamentos: dateContract.pagamentos.map((payment, index) => ({
    ...payment, id: index + 1, status: "RECEIVED", valor: 10, forma_pagamento: "pix",
  })),
  uso: {},
});

it("renderiza o contrato de datas validado pelo GET real de controller/SQL/JSON", async () => {
  // owner-fifth-fixes.integration.test.js verifica esta mesma fixture contra
  // a resposta HTTP real. A UI consome os dias recebidos sem cortar ISO.
  apiRequest.mockResolvedValue(payload());
  mount();
  expect(await screen.findByRole("button", { name: "Cancelar renovação" })).toBeTruthy();
  expect(screen.getByText(formatDate("2099-12-01"))).toBeTruthy();
  expect(screen.getByText(formatDate("2099-11-01"))).toBeTruthy();
  expect(screen.getByText("Data não informada")).toBeTruthy();
});

it.each([null, "2026-02-31", "inválida", "2099-12-01T06:00:00.000Z"])(
  "data ausente ou incompatível %s preserva acesso à tela e suas ações", async (date) => {
    const dto = payload();
    dto.assinatura.data_proxima_cobranca = date;
    dto.pagamentos = [{ id: 1, status: "RECEIVED", valor: 10, data_pagamento: date }];
    apiRequest.mockResolvedValue(dto);
    mount();
    expect(await screen.findByRole("button", { name: "Cancelar renovação" })).toBeTruthy();
    expect(screen.getAllByText("Data não informada").length).toBeGreaterThan(0);
  }
);

it("renovação cancelada mostra o fim pago mesmo com programação externa anterior", async () => {
  const dto = payload();
  dto.assinatura = { ...dto.assinatura, status: "CANCELED", data_proxima_cobranca: "2026-10-23", acesso_pago_ate: "2026-11-23" };
  dto.pagamentos = [];
  apiRequest.mockResolvedValue(dto);
  mount();
  expect(await screen.findByText("Acesso até")).toBeTruthy();
  expect(screen.getByText(formatDate("2026-11-23"))).toBeTruthy();
  expect(screen.queryByText(formatDate("2026-10-23"))).toBeNull();
});

it("assinatura ativa apresenta programação externa separada do período pago", async () => {
  const dto = payload();
  dto.assinatura = { ...dto.assinatura, data_proxima_cobranca: "2026-12-23", acesso_pago_ate: "2026-11-23" };
  dto.pagamentos = [];
  apiRequest.mockResolvedValue(dto);
  mount();
  expect(await screen.findByText("Próxima cobrança")).toBeTruthy();
  expect(screen.getByText(formatDate("2026-12-23"))).toBeTruthy();
});
