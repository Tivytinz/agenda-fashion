// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { AdminAuditPage } from "./AdminAuditPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
const attemptId = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue({
    acoes: ["campanha_criar", "contribuicao_custo_registrar"],
    eventos: [{
      tentativaId: attemptId, atorUsuarioId: 7, papelAdmin: "superadmin",
      acao: "campanha_criar", alvoTipo: "campanha", alvoId: 42,
      requestId: "request-12345", iniciadoEm: "2026-09-24T12:00:00Z",
      finalizadoEm: null, resultado: "PENDENTE", httpStatus: null, vencida: false
    }],
    paginacao: { pagina: 1, limite: 25, total: 1, totalPaginas: 1 }
  });
});
afterEach(() => cleanup());

describe("AdminAuditPage", () => {
  it("identifica pendência e filtra na API sem expor corpo da operação", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    expect(await screen.findByText("Pendente recente: aguardar")).not.toBeNull();
    expect(screen.getByText("campanha #42")).not.toBeNull();
    expect(screen.getByText(attemptId)).not.toBeNull();
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
    expect(await screen.findByText("Pendente recente: aguardar")).not.toBeNull();
    apiRequest.mockImplementation(() => new Promise(() => {}));
    await user.selectOptions(screen.getByLabelText("Resultado"), "HTTP_ERRO");
    expect(screen.getByText("Carregando auditoria...")).not.toBeNull();
    expect(screen.queryByText("Pendente recente: aguardar")).toBeNull();
  });

  it("revisa pendência vencida e mantém a incerteza do status HTTP", async () => {
    const user = userEvent.setup();
    let reads = 0;
    apiRequest.mockImplementation((path, options) => {
      if (options?.method === "POST") return Promise.resolve({ revisao: {} });
      reads += 1;
      return Promise.resolve({
        acoes: ["campanha_criar"],
        eventos: [{
          tentativaId: attemptId, atorUsuarioId: 7, papelAdmin: "admin",
          acao: "campanha_criar", alvoTipo: "campanha",
          iniciadoEm: "2026-09-24T12:00:00Z", finalizadoEm: null,
          resultado: reads === 1 ? "PENDENTE" : "REVISADA",
          vencida: reads === 1,
          revisao: reads === 1 ? null : {
            revisorUsuarioId: 8, avaliacao: "INDETERMINADO",
            evidenciaTipo: "LOG_APLICACAO", evidenciaReferenciaHash: "hash",
            revisadoEm: "2026-09-24T12:20:00Z"
          }
        }],
        paginacao: { total: 1, totalPaginas: 1 }
      });
    });
    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    expect(await screen.findByText("Pendente vencida: investigar")).not.toBeNull();
    await user.type(screen.getByLabelText("ID da evidência"), "request-12345");
    await user.click(screen.getByRole("button", { name: "Registrar revisão" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      `/admin/auditoria/${attemptId}/revisao`,
      expect.objectContaining({ method: "POST", body: expect.objectContaining({
        avaliacao: "INDETERMINADO", evidenciaReferencia: "request-12345"
      }) })
    ));
    expect(await screen.findByText("Revisada: status HTTP desconhecido")).not.toBeNull();
    expect(screen.getByText(/Revisão humana por #8/)).not.toBeNull();
  });

  it("explica permissão negada sem interpretar como lista vazia", async () => {
    apiRequest.mockRejectedValue({ status: 403, message: "Proibido" });
    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    expect(await screen.findByText(/restrita ao superadministrador/i)).not.toBeNull();
    expect(screen.queryByText("Nenhuma ação encontrada")).toBeNull();
  });
});
