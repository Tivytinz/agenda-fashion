// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { ScheduleSettingsPage } from "./ScheduleSettingsPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../analytics/track", () => ({ track: vi.fn() }));

const CONFIG = {
  duracao_padrao: 60, intervalo_minutos: 0, antecedencia_agendamento: 0,
  antecedencia_cancelamento: 2, origem_horarios: "personalizado",
  configurado_em: "2026-10-10T00:00:00.000Z"
};
const WEEK = [{
  dia_semana: 1, trabalha: true, hora_inicio: "08:00", hora_fim: "18:00",
  intervalo_inicio: null, intervalo_fim: null
}];

function activation(available = true) {
  return {
    negocio: { id: 11, nome: "Studio Aurora", slug: "studio-aurora" },
    ativacao: { possui_disponibilidade_agendavel: available },
    proxima_acao_ativacao: { estado: "CONQUISTAR_PRIMEIRO_AGENDAMENTO" }
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((success, failure) => { resolve = success; reject = failure; });
  return { promise, resolve, reject };
}

async function settle(request, outcome) {
  await act(async () => {
    if (outcome instanceof Error) request.reject(outcome);
    else request.resolve(outcome);
    await request.promise.catch(() => {});
  });
}

let router;

function renderPage() {
  router = createMemoryRouter([
    { path: "/painel/horarios", element: <ScheduleSettingsPage /> },
    { path: "*", element: <h1>Destino</h1> }
  ], { initialEntries: ["/painel/horarios?plano=autonoma&onboarding=divulgacao"] });
  render(<RouterProvider router={router} />);
}

function mockRequests(initial, save = null) {
  const reads = [];
  apiRequest.mockImplementation((path, options = {}) => {
    if (path === "/agenda-configuracao" && !options.method) {
      return Promise.resolve({ configuracao: CONFIG, horarios: WEEK });
    }
    if (path === "/agenda-configuracao" && options.method === "PUT") {
      return save?.promise ?? Promise.resolve({ configuracao: CONFIG, mensagem: "Horários salvos." });
    }
    if (path === "/dashboard-dono/ativacao") {
      reads.push(options);
      // O transporte ignora o cancelamento para provar que respostas antigas
      // também são descartadas antes de atualizar a interface.
      return reads.length === 1 ? initial.promise : Promise.resolve(activation());
    }
    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
  return reads;
}

beforeEach(() => {
  apiRequest.mockReset();
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
});

afterEach(() => {
  cleanup();
  router?.dispose();
});

describe("recuperação das leituras de ativação em horários", () => {
  it.each(["restauração", "salvamento"])("oferece a equipe em vez de pedir dias ativos na %s", async (etapa) => {
    const initial = deferred();
    const response = activation(false);
    response.proxima_acao_ativacao = {
      estado: "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
      mensagem: "Nenhuma profissional ativa está habilitada para realizar os serviços.",
      acao: { tipo: "NAVEGAR", destino: "/painel/profissionais" }
    };
    mockRequests(initial);
    if (etapa === "salvamento") {
      apiRequest.mockImplementation((path, options = {}) => {
        if (path === "/agenda-configuracao") return Promise.resolve({ configuracao: CONFIG, horarios: WEEK });
        if (path === "/dashboard-dono/ativacao") return options.signal && apiRequest.mock.calls.filter(([p]) => p === path).length === 1 ? initial.promise : Promise.resolve(response);
        return Promise.reject(new Error(`Rota inesperada: ${path}`));
      });
    }
    renderPage();
    await screen.findByLabelText("Início do atendimento de Segunda");
    await settle(initial, response);
    if (etapa === "salvamento") {
      fireEvent.change(screen.getByLabelText("Início do atendimento de Segunda"), { target: { value: "09:00" } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar horários", exact: true }));
      await waitFor(() => expect(apiRequest.mock.calls.some(([, o]) => o?.method === "PUT")).toBe(true));
    }
    const link = await screen.findByRole("link", { name: "Gerenciar serviços da equipe" });
    expect(screen.queryByText(/Ative pelo menos um dia/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Compartilhar perfil" })).toBeNull();
    fireEvent.click(link);
    await waitFor(() => expect(router.state.location.pathname).toBe("/painel/profissionais"));
  });

  it("mantém o rascunho acessível e permite continuar editando e salvar após uma resposta atrasada", async () => {
    const initial = deferred();
    const reads = mockRequests(initial);
    renderPage();
    const start = await screen.findByLabelText("Início do atendimento de Segunda");
    await waitFor(() => expect(reads).toHaveLength(1));
    fireEvent.change(start, { target: { value: "09:00" } });
    await settle(initial, activation());

    expect(screen.getByLabelText("Início do atendimento de Segunda").value).toBe("09:00");
    expect(screen.queryByRole("heading", { name: "Agora divulgue seu perfil" })).toBeNull();
    await act(() => router.navigate("/painel/servicos"));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar editando" }));
    expect(screen.getByLabelText("Início do atendimento de Segunda").value).toBe("09:00");
    expect(reads[0].signal.aborted).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Salvar horários", exact: true }));
    await screen.findByRole("button", { name: "Copiar link", exact: true });
    const save = apiRequest.mock.calls.find(([, options]) => options?.method === "PUT");
    expect(save[1].body.horarios[0].horaInicio).toBe("09:00");
    expect(router.state.location.search).toContain("plano=autonoma");
    expect(reads).toHaveLength(2);
  });

  it("ignora um erro antigo enquanto a dona edita e mantém a saída protegida", async () => {
    const initial = deferred();
    mockRequests(initial);
    renderPage();
    fireEvent.change(await screen.findByLabelText("Início do atendimento de Segunda"), {
      target: { value: "09:00" }
    });
    await settle(initial, new Error("Ativação indisponível"));

    expect(router.state.location.pathname).toBe("/painel/horarios");
    expect(screen.getByLabelText("Início do atendimento de Segunda").value).toBe("09:00");
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(() => router.navigate("/painel"));
    await screen.findByRole("dialog", { name: "Sair sem salvar?" });
  });

  it.each([
    ["sem disponibilidade", activation(false)],
    ["ativação concluída", { ...activation(), proxima_acao_ativacao: { estado: "ATIVADO" } }],
    ["falha de leitura", new Error("Ativação indisponível")]
  ])("preserva o link confirmado após salvar diante de uma resposta antiga: %s", async (_label, outcome) => {
    const initial = deferred();
    const reads = mockRequests(initial);
    renderPage();
    fireEvent.change(await screen.findByLabelText("Início do atendimento de Segunda"), {
      target: { value: "09:00" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar horários", exact: true }));
    await screen.findByRole("button", { name: "Copiar link", exact: true });
    await settle(initial, outcome);

    expect(screen.getByRole("button", { name: "Copiar link", exact: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Compartilhar perfil", exact: true })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ver perfil público/ }).getAttribute("href"))
      .toBe("/negocio/studio-aurora");
    expect(screen.queryByText(/não conseguimos carregar seu perfil/i)).toBeNull();
    expect(router.state.location.pathname).toBe("/painel/horarios");
    expect(reads).toHaveLength(2);
    expect(reads[0].signal.aborted).toBe(true);
  });

  it("aguarda o PUT antes de abrir a divulgação mesmo quando a leitura inicial termina durante o salvamento", async () => {
    const initial = deferred();
    const save = deferred();
    const reads = mockRequests(initial, save);
    renderPage();
    await screen.findByLabelText("Início do atendimento de Segunda");
    fireEvent.click(screen.getByRole("button", { name: "Salvar horários", exact: true }));
    await settle(initial, activation());

    expect(screen.getByLabelText("Início do atendimento de Segunda").disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Compartilhar perfil" })).toBeNull();
    expect(reads).toHaveLength(1);
    await settle(save, { configuracao: CONFIG, mensagem: "Horários salvos." });
    await screen.findByRole("button", { name: "Compartilhar perfil", exact: true });
    expect(reads).toHaveLength(2);
  });

  it("revalida a missão ao desfazer o rascunho sem exigir um salvamento", async () => {
    const initial = deferred();
    const reads = mockRequests(initial);
    renderPage();
    const start = await screen.findByLabelText("Início do atendimento de Segunda");
    fireEvent.change(start, { target: { value: "09:00" } });
    await settle(initial, activation(false));
    fireEvent.change(start, { target: { value: "08:00" } });

    await screen.findByRole("button", { name: "Compartilhar perfil", exact: true });
    expect(reads).toHaveLength(2);
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
  });

  it("revalida a disponibilidade ao reabrir o marcador de divulgação", async () => {
    const initial = deferred();
    const reads = mockRequests(initial);
    renderPage();
    await screen.findByLabelText("Início do atendimento de Segunda");
    await settle(initial, activation(false));
    expect(reads).toHaveLength(1);
    await act(() => router.navigate("/painel/horarios"));
    await act(() => router.navigate("/painel/horarios?onboarding=divulgacao"));

    await screen.findByRole("button", { name: "Compartilhar perfil", exact: true });
    expect(reads).toHaveLength(2);
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
  });
});
