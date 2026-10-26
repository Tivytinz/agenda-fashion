// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { BusinessPage } from "./BusinessPage";
import { ServiceEditorPage } from "./ServicesPage";
import { ScheduleSettingsPage } from "./ScheduleSettingsPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../analytics/track", () => ({ track: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({
    usuario: { id: 4, whatsapp: "11999999999" },
    negocio: { id: 11, papel: "dono" },
    refresh: vi.fn().mockResolvedValue({}),
    adoptCreatedBusiness: vi.fn().mockReturnValue(true)
  })
}));

const BUSINESS = {
  id: 11, slug: "studio-aurora", nome: "Studio Aurora", areas: ["Unhas"],
  whatsapp: "11999999999", cidade: "São Paulo", estado: "SP", bairro: "Centro",
  endereco: "Rua das Flores", numero: "10", cep: "01001000", publicado: true
};
const CONFIG = {
  duracao_padrao: 60, intervalo_minutos: 0, antecedencia_agendamento: 0,
  antecedencia_cancelamento: 2, origem_horarios: "personalizado",
  configurado_em: "2026-09-10T05:00:00.000Z"
};
const WEEK = Array.from({ length: 7 }, (_, dia_semana) => ({
  dia_semana, trabalha: dia_semana > 0, hora_inicio: "08:00", hora_fim: "18:00",
  intervalo_inicio: null, intervalo_fim: null
}));
let router;

function renderPage(path, element) {
  router = createMemoryRouter([
    { path: path.replace("/12/editar", "/:id/editar"), element },
    { path: "*", element: <h1>Destino</h1> }
  ], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
  apiRequest.mockReset();
  apiRequest.mockImplementation((path, options = {}) => {
    if (path === "/configuracoes") return Promise.resolve({
      negocio: { ...BUSINESS, ...options.body },
      publicacao: { publicado: true, pode_publicar: true, pendencias: [] },
      mensagem: "Alterações salvas."
    });
    if (path === "/servicos") return Promise.resolve([
      { id: 12, nome: "Manicure", categoria: "unha", valor: 50, duracao_minutos: 60, ativo: true }
    ]);
    if (path === "/servicos/12/fotos") return Promise.resolve([]);
    if (path === "/servicos/12") return Promise.resolve({ servico: { id: 12 } });
    if (path === "/agenda-configuracao") return Promise.resolve({
      configuracao: CONFIG, horarios: WEEK, mensagem: "Horários salvos."
    });
    return Promise.resolve({});
  });
});
afterEach(() => {
  cleanup();
  router?.dispose();
});

describe("rascunhos do fluxo da dona", () => {
  it.each([
    ["criação do negócio", "/criar-negocio", <BusinessPage create />, "Nome do negócio", "Studio novo"],
    ["edição do negócio", "/painel/negocio", <BusinessPage />, "Nome do negócio", "Studio atualizado"],
    ["novo serviço", "/painel/servicos/novo", <ServiceEditorPage />, "Nome do serviço", "Novo serviço"],
    ["edição de serviço", "/painel/servicos/12/editar", <ServiceEditorPage />, "Nome do serviço", "Manicure completa"],
    ["horários", "/painel/horarios", <ScheduleSettingsPage />, "Início do atendimento de Segunda", "09:00"]
  ])("protege %s ao trocar de página", async (_name, path, element, label, value) => {
    renderPage(path, element);
    const field = await screen.findByLabelText(label);
    fireEvent.change(field, { target: { value } });
    await act(() => router.navigate("/saida"));
    await screen.findByRole("dialog", { name: "Sair sem salvar?" });
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.getByLabelText(label).value).toBe(value);
    await act(() => router.navigate("/saida"));
    fireEvent.click(await screen.findByRole("button", { name: "Sair sem salvar" }));
    await screen.findByRole("heading", { name: "Destino" });
  });

  it("não cria rascunho ao preencher automaticamente o WhatsApp da conta", async () => {
    renderPage("/criar-negocio", <BusinessPage create />);
    expect((await screen.findByLabelText(/WhatsApp/)).value).toContain("99999");
    await act(() => router.navigate("/saida"));
    await screen.findByRole("heading", { name: "Destino" });
  });

  it.each([
    ["negócio", "/painel/negocio", <BusinessPage />, "Nome do negócio", "Studio atualizado", "Salvar alterações", "Alterações salvas."],
    ["horários", "/painel/horarios", <ScheduleSettingsPage />, "Início do atendimento de Segunda", "09:00", "Salvar horários", "Horários salvos."]
  ])("libera a saída de %s após a confirmação do salvamento", async (_name, path, element, label, value, button, message) => {
    renderPage(path, element);
    fireEvent.change(await screen.findByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: button }));
    await screen.findByText(message);
    await act(() => router.navigate("/saida"));
    await screen.findByRole("heading", { name: "Destino" });
  });

  it("não bloqueia a navegação de sucesso ao salvar um serviço", async () => {
    renderPage("/painel/servicos/12/editar", <ServiceEditorPage />);
    fireEvent.change(await screen.findByLabelText("Nome do serviço"), {
      target: { value: "Manicure completa" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar serviço" }));
    await screen.findByRole("heading", { name: "Destino" });
    expect(router.state.location.pathname).toBe("/painel/servicos");
  });

  it("protege durante o salvamento e retoma a saída quando a API confirma", async () => {
    const defaultRequests = apiRequest.getMockImplementation();
    let resolveSave;
    apiRequest.mockImplementation((path, options = {}) => options.method === "PUT"
      ? new Promise((resolve) => { resolveSave = resolve; })
      : defaultRequests(path, options));
    renderPage("/painel/negocio", <BusinessPage />);
    fireEvent.change(await screen.findByLabelText("Nome do negócio"), {
      target: { value: "Studio atualizado" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);
    await act(() => router.navigate("/saida"));
    await screen.findByRole("dialog");
    await act(() => resolveSave({ negocio: { ...BUSINESS, nome: "Studio atualizado" } }));
    await screen.findByRole("heading", { name: "Destino" });
  });

  it("mantém a edição protegida quando o salvamento falha", async () => {
    const defaultRequests = apiRequest.getMockImplementation();
    apiRequest.mockImplementation((path, options = {}) => options.method === "PUT"
      ? Promise.reject(new Error("Falha no salvamento"))
      : defaultRequests(path, options));
    renderPage("/painel/negocio", <BusinessPage />);
    fireEvent.change(await screen.findByLabelText("Nome do negócio"), {
      target: { value: "Studio atualizado" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await screen.findByRole("alert");
    await act(() => router.navigate("/saida"));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.getByLabelText("Nome do negócio").value).toBe("Studio atualizado");
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);
  });
});
