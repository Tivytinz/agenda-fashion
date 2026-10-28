// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { ServiceEditorPage, ServicesPage } from "./ServicesPage";
import { BusinessPage } from "./BusinessPage";
import { AccountPage } from "./AccountPage";

const session = vi.hoisted(() => ({
  refresh: vi.fn(), logout: vi.fn(), adoptArchivedBusiness: vi.fn(),
  temNegocio: true, negocio: { id: 11, papel: "dono" },
  usuario: { id: 4 },
}));
vi.mock("../auth/SessionContext", () => ({ useSession: () => session }));
vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
const BUSINESS = {
  id: 11, nome: "Studio Aurora", slug: "studio-aurora", areas: ["Unhas"],
  whatsapp: "11999999999", cidade: "São Paulo", estado: "SP", bairro: "Centro",
  endereco: "Rua das Flores", numero: "10", cep: "01001000", publicado: true,
};
const USER = { id: 4, nome: "Dona do Studio", email: "dona@example.test", whatsapp: "11999999999" };
let router;
function mount(path, element) {
  router = createMemoryRouter([
    { path: path.split("?")[0], element },
    { path: "*", element: <h1>Destino</h1> },
  ], { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}
function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}
function fillService() {
  fireEvent.change(screen.getByRole("textbox", { name: "Nome do serviço" }), { target: { value: "Manicure" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Valor" }), { target: { value: "50" } });
  fireEvent.change(screen.getByRole("combobox", { name: /Categoria/ }), { target: { value: "unha" } });
}
beforeEach(() => {
  apiRequest.mockReset();
  session.refresh.mockReset().mockResolvedValue({});
  session.adoptArchivedBusiness.mockReset();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => { cleanup(); router?.dispose(); vi.restoreAllMocks(); });

describe("cadastro de serviço com resultado incerto", () => {
  it.each([true, false])("recupera a mesma tentativa quando o primeiro POST foi persistido=%s", async (applied) => {
    const records = new Map();
    let requests = 0;
    apiRequest.mockImplementation(async (path, options = {}) => {
      if (path !== "/servicos" || options.method !== "POST") throw new Error(`Request inesperada: ${path}`);
      requests += 1;
      const key = options.headers["Idempotency-Key"];
      if (requests === 1 && !applied) throw new Error("Falha antes do envio");
      if (!records.has(key)) records.set(key, { id: 71, ...options.body });
      if (requests === 1) throw new Error("Resposta perdida após persistência");
      return { servico: records.get(key), publicacao: { publicado: true } };
    });
    mount("/painel/servicos/novo?onboarding=servico", <ServiceEditorPage />);
    fillService();
    fireEvent.click(screen.getByRole("button", { name: /^Salvar serviço/ }));
    await screen.findByText(/Não foi possível confirmar o cadastro/);
    expect(screen.getByLabelText("Nome do serviço").disabled).toBe(true);
    expect(screen.getByLabelText("Valor").disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Verificar cadastro" }));
    await screen.findByRole("heading", { name: "Destino" });
    expect(router.state.location.pathname).toBe("/painel/horarios");
    expect(records.size).toBe(1);
    const calls = apiRequest.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][1]).toEqual(calls[1][1]);
  });

  it("conflito definitivo permite corrigir os dados e iniciar outra tentativa", async () => {
    apiRequest.mockRejectedValueOnce(Object.assign(new Error("Já existe um serviço ativo com este nome."), { status: 409 }))
      .mockResolvedValueOnce({ servico: { id: 72 }, publicacao: { publicado: true } });
    mount("/painel/servicos/novo?onboarding=servico", <ServiceEditorPage />);
    fillService();
    fireEvent.click(screen.getByRole("button", { name: /^Salvar serviço/ }));
    await screen.findByText(/Já existe um serviço ativo/);
    const name = screen.getByLabelText("Nome do serviço");
    expect(name.disabled).toBe(false);
    fireEvent.change(name, { target: { value: "Pedicure" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar serviço/ }));
    await screen.findByRole("heading", { name: "Destino" });
    expect(apiRequest.mock.calls[0][1].headers["Idempotency-Key"])
      .not.toBe(apiRequest.mock.calls[1][1].headers["Idempotency-Key"]);
    expect(apiRequest.mock.calls[1][1].body.nome).toBe("Pedicure");
  });
});

describe("catálogo após remoção incerta", () => {
  it.each([true, false])("exige apenas GET para recuperar a remoção aplicada=%s, inclusive após falha da leitura", async (applied) => {
    const service = { id: 8, nome: "Manicure", valor: 50, duracao_minutos: 30, ativo: true };
    let removed = false;
    let reads = 0;
    apiRequest.mockImplementation(async (path, options = {}) => {
      if (path === "/servicos") {
        if (++reads === 2) throw new Error("Leitura temporariamente indisponível");
        return { servicos: removed ? [] : [service] };
      }
      if (path === "/minha-assinatura") return { uso: { limite_servicos: 5 } };
      if (path === "/servicos/8" && options.method === "DELETE") {
        removed = applied;
        throw new Error("Resposta de remoção perdida");
      }
      throw new Error(`Request inesperada: ${path}`);
    });
    mount("/painel/servicos", <ServicesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Remover" }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, remover" }));
    await screen.findByText(/Não foi possível confirmar a remoção/);
    expect(screen.getByRole("button", { name: "Remover" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar serviços" }));
    await screen.findByText("Leitura temporariamente indisponível");
    expect(screen.getByRole("button", { name: "Remover" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar serviços" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Atualizar serviços" })).toBeNull());
    if (applied) expect(screen.queryByRole("heading", { name: "Manicure" })).toBeNull();
    else expect(screen.getByRole("button", { name: "Remover" }).disabled).toBe(false);
    expect(apiRequest.mock.calls.filter(([, options = {}]) => options.method === "DELETE")).toHaveLength(1);
  });
});

describe("encerramento confirmado", () => {
  it.each(["falha", "pendente"])("conclui o arquivamento mesmo com a sessão %s", async (status) => {
    session.refresh.mockImplementation(() => status === "falha"
      ? Promise.reject(new Error("Sessão indisponível")) : new Promise(() => {}));
    apiRequest.mockImplementation(async (path) => {
      if (path === "/configuracoes") return { negocio: BUSINESS, publicacao: { publicado: true, pode_publicar: true, pendencias: [] } };
      if (path.startsWith("/cep/")) return BUSINESS;
      if (path === "/negocio/encerrar") return { mensagem: "Negócio encerrado.", negocio: { id: 11, ativo: false, publicado: false } };
      throw new Error(`Request inesperada: ${path}`);
    });
    mount("/painel/negocio", <BusinessPage />);
    await screen.findByDisplayValue(BUSINESS.nome);
    fireEvent.click(screen.getByRole("button", { name: "Encerrar negócio", exact: true }));
    await screen.findByRole("heading", { name: "Destino" });
    expect(router.state.location.pathname).toBe("/");
    expect(router.state.location.state.message).toBe("Negócio encerrado.");
    expect(session.adoptArchivedBusiness).toHaveBeenCalledWith({ id: 11, ativo: false, publicado: false });
    expect(session.refresh).toHaveBeenCalledWith({ silent: true });
    expect(apiRequest.mock.calls.filter(([path]) => path === "/negocio/encerrar")).toHaveLength(1);
  });
});

describe("proteção da edição da conta", () => {
  it("bloqueia campos e outras gravações durante o PUT e permite editar depois, mesmo se a sessão falhar", async () => {
    const pending = deferred();
    let sent;
    session.refresh.mockRejectedValue(new Error("Sessão indisponível"));
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/conta" && options.method === "PUT") { sent = options.body; return pending.promise; }
      if (path === "/conta") return Promise.resolve({ usuario: USER });
      throw new Error(`Request inesperada: ${path}`);
    });
    mount("/conta", <AccountPage />);
    const name = await screen.findByLabelText("Nome");
    fireEvent.change(name, { target: { value: "Nome enviado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    expect(name.disabled).toBe(true);
    expect(screen.getByLabelText("WhatsApp").disabled).toBe(true);
    expect(screen.getByLabelText("Senha atual").disabled).toBe(true);
    expect(screen.getByLabelText(/Receber mensagens dos meus agendamentos/).disabled).toBe(true);
    fireEvent.submit(screen.getByRole("button", { name: "Alterar senha" }).closest("form"));
    expect(apiRequest.mock.calls.filter(([, options = {}]) => options.method)).toHaveLength(1);
    await act(() => pending.resolve({ mensagem: "Perfil atualizado.", usuario: { ...USER, ...sent } }));
    await waitFor(() => expect(name.disabled).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(name, { target: { value: "Próxima edição" } });
    expect(screen.getByRole("button", { name: "Salvar perfil" }).disabled).toBe(false);
  });

  it("ignora resposta de salvamento depois da saída e não inicia refresh da sessão", async () => {
    const pending = deferred();
    apiRequest.mockImplementation((path, options = {}) => options.method
      ? pending.promise : Promise.resolve({ usuario: USER }));
    mount("/conta", <AccountPage />);
    fireEvent.change(await screen.findByLabelText("Nome"), { target: { value: "Nome enviado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    await act(() => router.navigate("/saida"));
    await act(() => pending.resolve({ usuario: USER }));
    expect(session.refresh).not.toHaveBeenCalled();
  });
});
