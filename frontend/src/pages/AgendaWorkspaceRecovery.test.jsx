// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { AgendaWorkspacePage } from "./AgendaWorkspacePage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

function agenda(date = "2026-10-21", status = "livre") {
  return {
    fuso_horario: "America/Sao_Paulo",
    agenda: [{ data: date, profissionais: [{ id: 7, nome: "Ana", horarios: [
      { hora: "09:00", status },
      { hora: "10:00", status: "livre" },
      { hora: "11:00", status: "confirmado", agendamento_id: 42,
        cliente: "Maria", pode_marcar_realizado: true, pode_cancelar: true },
    ] }] }],
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => { apiRequest.mockReset(); });
afterEach(cleanup);

it("mantém a profissional ativa da reserva mesmo com o serviço desativado, sem liberar transferências inelegíveis", async () => {
  const payload = agenda();
  payload.agenda[0].profissionais = [
    { id: 7, nome: "Ana", ativo: true, servico_ids: [], horarios: [{
      hora: "11:00", status: "confirmado", agendamento_id: 42, profissional_id: 7,
      servico_id: 9, servico: "Serviço antigo", pode_reagendar: true,
    }] },
    { id: 8, nome: "Bia", ativo: true, servico_ids: [], horarios: [] },
    { id: 9, nome: "Cris", ativo: false, servico_ids: [9], horarios: [] },
  ];
  apiRequest.mockImplementation((_path, options) => Promise.resolve(
    options?.method === "PATCH" ? { mensagem: "Reagendado." } : payload
  ));
  render(<AgendaWorkspacePage owner />);
  fireEvent.click(await screen.findByRole("button", { name: "Reagendar" }));
  const target = screen.getByLabelText("Profissional responsável");
  expect(Array.from(target.options).map((option) => option.textContent)).toEqual(["Ana"]);
  expect(target.value).toBe("7");
  const confirm = screen.getByRole("button", { name: "Confirmar reagendamento" });
  expect(confirm.disabled).toBe(false);
  fireEvent.change(screen.getByLabelText("Nova data"), { target: { value: "2026-11-02" } });
  fireEvent.click(confirm);
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/agendamentos/42/reagendar-operacional", {
    method: "PATCH", body: { data: "2026-11-02", horario: "11:00", profissional_id: 7 },
  }));
});

it("apresenta ocupação intermediária sem ação de bloquear nem ações duplicadas da reserva", async () => {
  const payload = agenda();
  payload.agenda[0].profissionais[0].horarios = [
    { hora: "09:30", status: "confirmado", agendamento_id: 42, pode_reagendar: true },
    { hora: "10:00", status: "ocupado" },
    { hora: "11:00", status: "livre" },
  ];
  apiRequest.mockResolvedValue(payload);
  render(<AgendaWorkspacePage owner />);
  expect(await screen.findByText("Ocupado")).not.toBeNull();
  expect(screen.queryByRole("button", { name: /10:00/ })).toBeNull();
  expect(screen.getAllByRole("button", { name: "Reagendar" })).toHaveLength(1);
  expect(screen.getByRole("button", { name: /11:00 Livre/ }).disabled).toBe(false);
});

describe("recuperação e período da agenda da dona", () => {
  it("navega por semanas, escolhe ontem e conclui a reserva mantendo o período na atualização", async () => {
    apiRequest.mockImplementation((path, options) => {
      if (options?.method === "PATCH") return Promise.resolve({ mensagem: "Atendimento concluído." });
      const date = new URL(path, "https://teste.local").searchParams.get("data_inicio") || "2026-10-21";
      return Promise.resolve(agenda(date));
    });
    render(<AgendaWorkspacePage owner />);
    const dateInput = await screen.findByLabelText("Data inicial");
    expect(dateInput.value).toBe("2026-10-21");
    fireEvent.click(screen.getByRole("button", { name: "Semana anterior" }));
    await waitFor(() => expect(dateInput.value).toBe("2026-10-14"));
    expect(apiRequest).toHaveBeenLastCalledWith("/agenda-geral?data_inicio=2026-10-14", expect.objectContaining({
      headers: { "X-AF-Contexto": "dono" }, signal: expect.any(AbortSignal),
    }));
    fireEvent.click(screen.getByRole("button", { name: "Próxima semana" }));
    await waitFor(() => expect(dateInput.value).toBe("2026-10-21"));
    fireEvent.change(dateInput, { target: { value: "2026-11-02" } });
    await screen.findByRole("region", { name: "Horários de 2026-11-02" });
    fireEvent.change(dateInput, { target: { value: "2026-10-20" } });
    await screen.findByRole("region", { name: "Horários de 2026-10-20" });
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith("/agenda-geral?data_inicio=2026-10-20", expect.any(Object)));
    expect(apiRequest).toHaveBeenCalledWith("/agendamentos/42/atendimento", { method: "PATCH", body: { status: "realizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Hoje", exact: true }));
    await waitFor(() => expect(dateInput.value).toBe("2026-10-21"));
    expect(apiRequest).toHaveBeenLastCalledWith("/agenda-geral", expect.any(Object));
  });

  it.each(["sucesso", "erro"])("descarta %s de uma leitura antiga após trocar a semana", async (outcome) => {
    const oldRead = deferred();
    apiRequest.mockResolvedValueOnce(agenda()).mockReturnValueOnce(oldRead.promise).mockResolvedValueOnce(agenda("2026-11-02"));
    render(<AgendaWorkspacePage owner />);
    const dateInput = await screen.findByLabelText("Data inicial");
    fireEvent.change(dateInput, { target: { value: "2026-10-20" } });
    const oldSignal = apiRequest.mock.calls[1][1].signal;
    expect(screen.getByRole("button", { name: /09:00 Livre/ }).disabled).toBe(true);
    fireEvent.change(dateInput, { target: { value: "2026-11-02" } });
    await screen.findByRole("region", { name: "Horários de 2026-11-02" });
    expect(oldSignal.aborted).toBe(true);
    await act(async () => {
      if (outcome === "erro") oldRead.reject(new Error("Erro antigo"));
      else oldRead.resolve(agenda("2026-10-20", "bloqueado"));
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("region", { name: "Horários de 2026-11-02" })).not.toBeNull();
    expect(screen.getByRole("button", { name: /09:00 Livre/ }).disabled).toBe(false);
  });

  it("recupera somente a leitura após POST confirmado e GET falho, sem inverter o bloqueio", async () => {
    apiRequest.mockResolvedValueOnce(agenda())
      .mockResolvedValueOnce({ mensagem: "Horário bloqueado." })
      .mockRejectedValueOnce(new Error("Leitura indisponível"))
      .mockResolvedValueOnce(agenda("2026-10-21", "bloqueado"))
      .mockResolvedValueOnce({ mensagem: "Horário liberado." })
      .mockResolvedValueOnce(agenda());
    render(<AgendaWorkspacePage owner />);
    fireEvent.click(await screen.findByRole("button", { name: /09:00 Livre/ }));
    await screen.findByText(/Alteração salva/);
    const staleSlot = screen.getByRole("button", { name: /09:00 Livre/ });
    expect(staleSlot.disabled).toBe(true);
    fireEvent.click(staleSlot);
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(apiRequest).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar agenda" }));
    const blockedSlot = await screen.findByRole("button", { name: /09:00 Bloqueado/ });
    expect(apiRequest.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
    expect(apiRequest.mock.calls[1][1].body).toEqual({ data: "2026-10-21", hora: "09:00", profissional_id: 7, bloqueado: true });
    fireEvent.click(blockedSlot);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(6));
    expect(apiRequest.mock.calls[4][1].body.bloqueado).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("impede escritas e mudanças de período enquanto outro horário está sendo salvo", async () => {
    const write = deferred();
    apiRequest.mockResolvedValueOnce(agenda()).mockReturnValueOnce(write.promise).mockResolvedValueOnce(agenda("2026-10-21", "bloqueado"));
    render(<AgendaWorkspacePage owner />);
    fireEvent.click(await screen.findByRole("button", { name: /09:00 Livre/ }));
    expect(screen.getByRole("button", { name: /10:00 Livre/ }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Concluir" }).disabled).toBe(true);
    expect(screen.getByLabelText("Data inicial").disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Próxima semana" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /10:00 Livre/ }));
    expect(apiRequest).toHaveBeenCalledTimes(2);
    await act(async () => { write.resolve({ mensagem: "Horário bloqueado." }); });
    expect(screen.getByRole("button", { name: /10:00 Livre/ }).disabled).toBe(false);
  });

  it("exige leitura canônica após resposta de escrita incerta", async () => {
    apiRequest.mockResolvedValueOnce(agenda()).mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(agenda("2026-10-21", "bloqueado"));
    render(<AgendaWorkspacePage owner />);
    fireEvent.click(await screen.findByRole("button", { name: /09:00 Livre/ }));
    await screen.findByText(/Não foi possível confirmar a alteração/);
    expect(screen.getByRole("button", { name: /09:00 Livre/ }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar agenda" }));
    await screen.findByRole("button", { name: /09:00 Bloqueado/ });
    expect(apiRequest).toHaveBeenCalledTimes(3);
  });

  it("mantém o motivo e permite corrigir uma rejeição de validação no cancelamento", async () => {
    apiRequest.mockResolvedValueOnce(agenda()).mockRejectedValueOnce(Object.assign(new Error("Motivo inválido."), { status: 400 }));
    render(<AgendaWorkspacePage owner />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar agendamento" }));
    fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), { target: { value: "outro" } });
    fireEvent.change(screen.getByLabelText("Descreva o motivo"), { target: { value: "Interrupção da operação" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    await screen.findByText("Motivo inválido.");
    expect(screen.getByRole("dialog").contains(screen.getByRole("alert"))).toBe(true);
    expect(screen.getByLabelText("Descreva o motivo").value).toBe("Interrupção da operação");
    expect(screen.getByRole("button", { name: "Confirmar cancelamento" }).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Atualizar agenda" })).toBeNull();
  });

  it("expõe a recuperação fora do diálogo quando o resultado do cancelamento é incerto", async () => {
    apiRequest.mockResolvedValueOnce(agenda()).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<AgendaWorkspacePage owner />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar agendamento" }));
    fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), { target: { value: "profissional_indisponivel" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    await screen.findByText(/Não foi possível confirmar a alteração/);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Atualizar agenda" }).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Cancelar agendamento" }).disabled).toBe(true);
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it("não inicia nova leitura quando uma escrita termina depois de sair da agenda", async () => {
    const write = deferred();
    apiRequest.mockResolvedValueOnce(agenda()).mockReturnValueOnce(write.promise);
    const { unmount } = render(<AgendaWorkspacePage owner />);
    fireEvent.click(await screen.findByRole("button", { name: /09:00 Livre/ }));
    unmount();
    await act(async () => { write.resolve({ mensagem: "Horário bloqueado." }); });
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it("gerencia a reserva da inativa e oferece somente uma profissional ativa habilitada ao reagendar", async () => {
    const payload = agenda();
    payload.agenda[0].profissionais = [
      { id: 7, nome: "Ana", ativo: false, servico_ids: [9], horarios: [{
        hora: "11:00", status: "confirmado", agendamento_id: 42, profissional_id: 7,
        servico_id: 9, cliente: "Maria", pode_cancelar: true, pode_reagendar: true,
      }] },
      { id: 8, nome: "Bia", servico_ids: [9], horarios: [] },
    ];
    apiRequest.mockImplementation((_path, options) => Promise.resolve(options?.method === "PATCH" ? { mensagem: "Reagendado." } : payload));
    render(<AgendaWorkspacePage owner />);
    expect(await screen.findByText(/Profissional inativa\. Você pode gerenciar/)).not.toBeNull();
    expect(screen.getByRole("option", { name: "Ana (inativa)" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reagendar" }));
    const target = screen.getByLabelText("Profissional responsável");
    expect(Array.from(target.options).map((item) => item.textContent)).toEqual(["Bia"]);
    expect(target.value).toBe("8");
    fireEvent.change(screen.getByLabelText("Nova data"), { target: { value: "2026-11-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reagendamento" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/agendamentos/42/reagendar-operacional", {
      method: "PATCH", body: { data: "2026-11-02", horario: "11:00", profissional_id: 8 },
    }));
  });
});

it("identifica continuação e preserva a data e hora originais ao abrir o reagendamento", async () => {
  const payload = agenda("2026-10-22");
  payload.agenda[0].profissionais[0].horarios = [{
    hora: "00:00", status: "confirmado", agendamento_id: 42, profissional_id: 7,
    continuacao: true, data_agendamento: "2026-10-21", hora_agendamento: "23:30",
    cliente: "Maria", pode_reagendar: true,
  }];
  apiRequest.mockResolvedValue(payload);
  render(<AgendaWorkspacePage owner />);
  expect(await screen.findByText(/Continua desde .* às 23:30/)).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reagendar" }));
  expect(screen.getByLabelText("Nova data").value).toBe("2026-10-21");
  expect(screen.getByLabelText("Novo horário").value).toBe("23:30");
});
