// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { RestrictedProfessionalReservationsPage } from "./RestrictedProfessionalReservationsPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
const reservation = { id: 11, negocio: "Studio Aurora", servico: "Manicure", cliente: "Clara", data: "2026-10-12", horario: "10:00", status: "confirmado", pode_marcar_realizado: true, pode_marcar_falta: true };
const response = { agendamentos: [reservation], pagina: 1, tem_proxima: false };
const renderPage = () => render(<MemoryRouter><RestrictedProfessionalReservationsPage /></MemoryRouter>);
beforeEach(() => { apiRequest.mockReset().mockResolvedValue(response); });
afterEach(cleanup);

describe("RN50: reservas existentes", () => {
  it("oferece apenas resultados permitidos e identifica o negócio", async () => {
    renderPage();
    expect(screen.getByRole("status").textContent).toContain("Carregando");
    expect(await screen.findByText("Studio Aurora")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Marcar realizado" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /cancelar|reagendar|iniciar atendimento/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /horários|serviços|equipe/i })).toBeNull();
  });

  it.each(["realizado", "falta"])("confirma %s e impede duplo envio", async (status) => {
    let finish;
    apiRequest.mockImplementation((path) => path.includes("atendimento") ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(response));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: status === "realizado" ? "Marcar realizado" : "Registrar falta" }));
    expect(apiRequest).toHaveBeenCalledTimes(1);
    const confirm = screen.getByRole("button", { name: `Confirmar ${status}` });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(apiRequest).toHaveBeenCalledTimes(2);
    expect(apiRequest).toHaveBeenLastCalledWith("/agendamentos/11/atendimento", expect.objectContaining({ method: "PATCH", body: { status } }));
    expect(screen.getByRole("button", { name: "Atualizar reservas" }).disabled).toBe(true);
    await act(async () => finish({ mensagem: "Resultado salvo.", agendamento: { id: 11, status } }));
    expect(await screen.findByText("Resultado salvo.")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Marcar realizado" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar falta" })).toBeNull();
  });

  it("preserva a confirmação após falha e permite repetir", async () => {
    apiRequest.mockResolvedValueOnce(response)
      .mockRejectedValueOnce(new Error("Falha temporária"))
      .mockResolvedValueOnce({ mensagem: "Salvo", agendamento: { status: "realizado" } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Marcar realizado" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar realizado" }));
    expect(await screen.findByText("Falha temporária")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar realizado" }));
    expect(await screen.findByText("Salvo")).not.toBeNull();
  });

  it("recupera erro de leitura e trata estado vazio", async () => {
    apiRequest.mockRejectedValueOnce(new Error("Rede indisponível"))
      .mockResolvedValueOnce({ ...response, agendamentos: [] });
    renderPage();
    expect(await screen.findByText("Rede indisponível")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhuma reserva disponível")).not.toBeNull();
  });

  it("pagina e não oferece ação antes do momento permitido", async () => {
    apiRequest.mockResolvedValueOnce({ ...response, tem_proxima: true })
      .mockResolvedValueOnce({ ...response, pagina: 2, agendamentos: [{ ...reservation, pode_marcar_falta: false, pode_marcar_realizado: false }] });
    renderPage();
    await screen.findByText("Clara", { exact: false });
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith("/reservas-profissionais-existentes?pagina=2", expect.any(Object)));
    await screen.findByText("Página 2");
    expect(screen.queryByRole("button", { name: "Marcar realizado" })).toBeNull();
  });

  it("cancela a leitura ao sair e ignora sua resposta atrasada", async () => {
    let resolve;
    apiRequest.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const view = renderPage();
    const signal = apiRequest.mock.calls[0][1].signal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(response));
  });

  it("cancela o salvamento ao sair da tela", async () => {
    apiRequest.mockResolvedValueOnce(response).mockImplementationOnce(() => new Promise(() => {}));
    const view = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Marcar realizado" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar realizado" }));
    const signal = apiRequest.mock.calls[1][1].signal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
});
