// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { AdminAuditPage } from "./AdminAuditPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue({
    acoes: ["campanha_criar", "contribuicao_custo_registrar"],
    eventos: [{
      tentativaId: "a-1", atorUsuarioId: 7, papelAdmin: "superadmin",
      acao: "campanha_criar", alvoTipo: "campanha", alvoId: 42,
      requestId: "request-12345", iniciadoEm: "2026-09-24T12:00:00Z",
      finalizadoEm: null, resultado: "PENDENTE", httpStatus: null
    }],
    paginacao: { pagina: 1, limite: 25, total: 1, totalPaginas: 1 }
  });
});
afterEach(() => cleanup());

describe("AdminAuditPage", () => {
  it("identifica pendência e filtra na API sem expor corpo da operação", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    expect(await screen.findByText("Pendente de investigação")).not.toBeNull();
    expect(screen.getByText("campanha #42")).not.toBeNull();
    expect(screen.getByText("a-1")).not.toBeNull();
    expect(screen.queryByText(/token|senha/i)).toBeNull();
    await user.selectOptions(screen.getByLabelText("Ação"), "campanha_criar");
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining("acao=campanha_criar"),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    ));
    await user.selectOptions(screen.getByLabelText("Resultado"), "PENDENTE");
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining("resultado=PENDENTE"),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    ));
  });

  it("esconde registros do filtro anterior enquanto consulta os novos", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    expect(await screen.findByText("Pendente de investigação")).not.toBeNull();
    apiRequest.mockImplementation(() => new Promise(() => {}));
    await user.selectOptions(screen.getByLabelText("Resultado"), "HTTP_ERRO");
    expect(screen.getByText("Carregando auditoria...")).not.toBeNull();
    expect(screen.queryByText("Pendente de investigação")).toBeNull();
  });

  it("explica permissão negada sem interpretar como lista vazia", async () => {
    apiRequest.mockRejectedValue({ status: 403, message: "Proibido" });
    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    expect(await screen.findByText(/restrita ao superadministrador/i)).not.toBeNull();
    expect(screen.queryByText("Nenhuma ação encontrada")).toBeNull();
  });
});
