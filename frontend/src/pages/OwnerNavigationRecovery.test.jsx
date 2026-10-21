// @vitest-environment jsdom
import { lazy, Suspense } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { ServiceEditorPage } from "./ServicesPage";
import { ScheduleSettingsPage } from "./ScheduleSettingsPage";
const session = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: () => session }));
vi.mock("../analytics/track", () => ({ track: vi.fn() }));
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let router;
let plansDestination;
function mount(entry, editor) {
  const destination = deferred();
  plansDestination = destination;
  const LazyPlans = lazy(() => destination.promise);
  function Shell() {
    return <Suspense fallback={<h1>Carregando destino</h1>}><Routes>
      <Route path={entry.split("?")[0].replace("/12/editar", "/:id/editar")} element={editor} />
      <Route path="/planos" element={<LazyPlans />} />
      <Route path="*" element={<h1>Outra rota</h1>} />
    </Routes></Suspense>;
  }
  router = createMemoryRouter([{ path: "*", element: <Shell /> }], { initialEntries: [entry] });
  render(<RouterProvider router={router} />);
}
async function discard() {
  await act(() => router.navigate("/planos"));
  fireEvent.click(await screen.findByRole("button", { name: "Sair sem salvar", exact: true }));
  expect(router.state.location.pathname).toBe("/planos");
}
beforeEach(() => {
  apiRequest.mockReset();
  session.refresh.mockReset().mockResolvedValue({});
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); router?.dispose(); vi.restoreAllMocks(); });

async function finishDestination() {
  await act(async () => plansDestination.resolve({ default: () => <h1>Planos prontos</h1> }));
  await screen.findByRole("heading", { name: "Planos prontos" });
  expect(router.state.location.pathname).toBe("/planos");
  expect(screen.queryByRole("alert")).toBeNull();
}

it.each(["sucesso", "erro"])("descarta %s da criação de serviço antes de o destino carregar", async outcome => {
  const mutation = deferred();
  apiRequest.mockImplementation(() => mutation.promise);
  mount("/painel/servicos/novo?onboarding=servico", <ServiceEditorPage />);
  fireEvent.change(screen.getByLabelText("Nome do serviço"), { target: { value: "Manicure" } });
  fireEvent.change(screen.getByLabelText(/Categoria/), { target: { value: "unha" } });
  fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "50" } });
  fireEvent.submit(screen.getByRole("button", { name: /Salvar serviço/ }).closest("form"));
  await discard();
  expect(screen.getByRole("heading", { name: "Novo serviço", hidden: true })).toBeTruthy();
  await act(async () => outcome === "sucesso"
    ? mutation.resolve({ servico: { id: 58 }, publicacao: { publicado: true } })
    : mutation.reject(new Error("Falha antiga do serviço")));
  expect(session.refresh).not.toHaveBeenCalled();
  expect(router.state.location.pathname).toBe("/planos");
  await finishDestination();
});

it("não inicia o envio das fotos restantes após a saída confirmada", async () => {
  const upload = deferred();
  let uploads = 0;
  const service = { id: 12, nome: "Manicure", categoria: "unha", valor: 50, duracao_minutos: 60, ativo: true };
  apiRequest.mockImplementation((path, options = {}) => {
    if (path === "/servicos/12/fotos" && options.method === "POST") {
      uploads += 1;
      return uploads === 1 ? upload.promise : Promise.resolve({ foto: { id: 2 } });
    }
    if (path.endsWith("/fotos")) return Promise.resolve([]);
    return Promise.resolve(options.method === "PUT" ? { servico: service } : { servicos: [service] });
  });
  mount("/painel/servicos/12/editar", <ServiceEditorPage />);
  await screen.findByDisplayValue("Manicure");
  fireEvent.change(screen.getByLabelText("Adicionar fotos à galeria"), { target: { files: [
    new File(["a"], "a.jpg", { type: "image/jpeg" }),
    new File(["b"], "b.jpg", { type: "image/jpeg" })
  ] } });
  fireEvent.submit(screen.getByRole("button", { name: /Salvar serviço/ }).closest("form"));
  await waitFor(() => expect(uploads).toBe(1));
  await discard();
  expect(screen.getByRole("heading", { name: "Editar serviço", hidden: true })).toBeTruthy();
  await act(async () => upload.resolve({ foto: { id: 1 } }));
  expect(uploads).toBe(1);
  expect(router.state.location.pathname).toBe("/planos");
  await finishDestination();
});

it.each(["sucesso", "erro"])("descarta %s de horários sem consultar ativação ou retomar navegação", async outcome => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const mutation = deferred();
  const config = { duracao_padrao: 60, intervalo_minutos: 0, antecedencia_agendamento: 0, antecedencia_cancelamento: 2, origem_horarios: "padrao_af" };
  apiRequest.mockImplementation((path, options = {}) => {
    if (options.method === "PUT") return mutation.promise;
    if (path === "/dashboard-dono/ativacao") return Promise.resolve({
      negocio: { id: 11, nome: "Studio", slug: "studio" },
      ativacao: { possui_disponibilidade_agendavel: true },
      proxima_acao_ativacao: { estado: "CONQUISTAR_PRIMEIRO_AGENDAMENTO" }
    });
    return Promise.resolve({ configuracao: config, horarios: [{ dia_semana: 1, trabalha: true, hora_inicio: "08:00", hora_fim: "18:00" }] });
  });
  mount("/painel/horarios", <ScheduleSettingsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Ajustar horários" }));
  fireEvent.change(screen.getByLabelText("Início do atendimento de Segunda"), { target: { value: "09:00" } });
  fireEvent.submit(screen.getByRole("button", { name: /^Salvar horários/ }).closest("form"));
  await discard();
  expect(screen.getByRole("heading", { name: "Horários de atendimento", hidden: true })).toBeTruthy();
  await act(async () => outcome === "sucesso"
    ? mutation.resolve({ configuracao: { ...config, origem_horarios: "personalizado" } })
    : mutation.reject(new Error("Falha antiga de horários")));
  expect(apiRequest.mock.calls.some(([path]) => path === "/dashboard-dono/ativacao")).toBe(false);
  expect(consoleError).not.toHaveBeenCalled();
  expect(router.state.location.pathname).toBe("/planos");
  await finishDestination();
  consoleError.mockRestore();
});


describe.each(["Continuar editando", "Escape"])("operação preservada por %s", choice => {
  async function keepEditing() {
    await act(() => router.navigate("/planos"));
    const dialog = await screen.findByRole("dialog", { name: "Sair sem salvar?" });
    if (choice === "Escape") fireEvent(dialog, new Event("cancel", { cancelable: true }));
    else fireEvent.click(screen.getByRole("button", { name: choice }));
  }

  it("conclui o primeiro serviço e segue para horários", async () => {
    const mutation = deferred();
    apiRequest.mockImplementation(() => mutation.promise);
    mount("/painel/servicos/novo?onboarding=servico", <ServiceEditorPage />);
    fireEvent.change(screen.getByLabelText("Nome do serviço"), { target: { value: "Manicure" } });
    fireEvent.change(screen.getByLabelText(/Categoria/), { target: { value: "unha" } });
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "50" } });
    fireEvent.submit(screen.getByRole("button", { name: /Salvar serviço/ }).closest("form"));
    await keepEditing();
    expect(router.state.location.pathname).toBe("/painel/servicos/novo");
    await act(async () => mutation.resolve({ servico: { id: 58 }, publicacao: { publicado: true } }));
    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe("/painel/horarios");
  });

  it("conclui horários e libera a próxima navegação após salvar", async () => {
    const mutation = deferred();
    const config = { duracao_padrao: 60, antecedencia_cancelamento: 2, origem_horarios: "personalizado" };
    apiRequest.mockImplementation((_path, options = {}) => options.method === "PUT" ? mutation.promise : Promise.resolve({
      configuracao: config, horarios: [{ dia_semana: 1, trabalha: true, hora_inicio: "08:00", hora_fim: "18:00" }]
    }));
    mount("/painel/horarios", <ScheduleSettingsPage />);
    const start = await screen.findByLabelText("Início do atendimento de Segunda");
    fireEvent.change(start, { target: { value: "09:00" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvar horários" }).closest("form"));
    await keepEditing();
    expect(router.state.location.pathname).toBe("/painel/horarios");
    await act(async () => mutation.resolve({ configuracao: config, mensagem: "Horários preservados" }));
    expect(start.value).toBe("09:00");
    expect(screen.getByText("Horários preservados")).toBeTruthy();
    await act(() => router.navigate("/planos"));
    await finishDestination();
  });
});


describe("saída sem rascunho com operação pendente", () => {
  async function leaveClean() {
    await act(() => router.navigate("/planos"));
    expect(router.state.location.pathname).toBe("/planos");
    expect(screen.queryByRole("dialog")).toBeNull();
  }

  const SERVICE = { id: 12, nome: "Manicure", categoria: "unha", valor: 50, duracao_minutos: 60, ativo: true };
  const CONFIG = { duracao_padrao: 60, intervalo_minutos: 0, antecedencia_agendamento: 0, antecedencia_cancelamento: 2, origem_horarios: "padrao_af" };
  const WEEK = [{ dia_semana: 1, trabalha: true, hora_inicio: "08:00", hora_fim: "18:00" }];

  it.each(["sucesso", "erro"])("ignora %s de salvar serviço sem editar os campos", async outcome => {
    const mutation = deferred();
    apiRequest.mockImplementation((path, options = {}) => {
      if (options.method === "PUT") return mutation.promise;
      return Promise.resolve(path.endsWith("/fotos") ? [] : { servicos: [SERVICE] });
    });
    mount("/painel/servicos/12/editar", <ServiceEditorPage />);
    await screen.findByDisplayValue("Manicure");
    fireEvent.submit(screen.getByRole("button", { name: "Salvar serviço" }).closest("form"));
    expect(apiRequest.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(1);
    await leaveClean();
    expect(screen.getByRole("heading", { name: "Editar serviço", hidden: true })).toBeTruthy();
    await act(async () => outcome === "sucesso"
      ? mutation.resolve({ servico: SERVICE }) : mutation.reject(new Error("Falha antiga sem rascunho")));
    expect(router.state.location.pathname).toBe("/planos");
    await finishDestination();
  });

  it.each(["sucesso", "erro"])("ignora %s da confirmação rápida de horários ao sair sem editar", async outcome => {
    const mutation = deferred();
    apiRequest.mockImplementation((_path, options = {}) => options.method === "PUT"
      ? mutation.promise : Promise.resolve({ configuracao: CONFIG, horarios: WEEK }));
    mount("/painel/horarios", <ScheduleSettingsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar horários" }));
    expect(apiRequest.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(1);
    await leaveClean();
    expect(screen.getByRole("heading", { name: "Horários de atendimento", hidden: true })).toBeTruthy();
    await act(async () => outcome === "sucesso"
      ? mutation.resolve({ configuracao: { ...CONFIG, origem_horarios: "personalizado" } })
      : mutation.reject(new Error("Falha antiga de confirmação")));
    expect(apiRequest.mock.calls.some(([path]) => path === "/dashboard-dono/ativacao")).toBe(false);
    expect(router.state.location.pathname).toBe("/planos");
    await finishDestination();
  });

  it("cancela a próxima etapa quando a saída ocorre depois do PUT e durante a leitura de ativação", async () => {
    const activation = deferred();
    let activationSignal;
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/dashboard-dono/ativacao") {
        activationSignal = options.signal;
        return activation.promise;
      }
      return Promise.resolve({ configuracao: { ...CONFIG, origem_horarios: options.method === "PUT" ? "personalizado" : "padrao_af" }, horarios: WEEK });
    });
    mount("/painel/horarios", <ScheduleSettingsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar horários" }));
    await waitFor(() => expect(activationSignal).toBeTruthy());
    await leaveClean();
    expect(activationSignal.aborted).toBe(true);
    await act(async () => activation.resolve({
      negocio: { id: 11, nome: "Studio", slug: "studio" },
      ativacao: { possui_disponibilidade_agendavel: true },
      proxima_acao_ativacao: { estado: "CONQUISTAR_PRIMEIRO_AGENDAMENTO" }
    }));
    expect(router.state.location.pathname).toBe("/planos");
    await finishDestination();
  });

  it("respeita o destino já solicitado quando o primeiro serviço termina de salvar", async () => {
    const mutation = deferred();
    apiRequest.mockImplementation(() => mutation.promise);
    mount("/painel/servicos/novo?onboarding=servico", <ServiceEditorPage />);
    fireEvent.change(screen.getByLabelText("Nome do serviço"), { target: { value: "Manicure" } });
    fireEvent.change(screen.getByLabelText(/Categoria/), { target: { value: "unha" } });
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "50" } });
    fireEvent.submit(screen.getByRole("button", { name: /Salvar serviço/ }).closest("form"));
    await act(() => router.navigate("/planos"));
    await screen.findByRole("dialog");
    await act(async () => mutation.resolve({ servico: SERVICE, publicacao: { publicado: true } }));
    expect(router.state.location.pathname).toBe("/planos");
    expect(session.refresh).not.toHaveBeenCalled();
    await finishDestination();
  });
});
