// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { serviceCreationReferenceHash } from "../utils/serviceCreationReference";
import { ServiceEditorPage } from "./ServicesPage";
import { BusinessPage } from "./BusinessPage";

const session = vi.hoisted(() => ({ refresh: vi.fn(), adoptArchivedBusiness: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: () => session }));
vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
const BUSINESS = { id: 11, nome: "Studio Aurora", areas: ["Unhas"], publicado: true };
const SERVICE = { id: 71, nome: "Manicure", descricao: "", valor: 50, categoria: "unha", duracao_minutos: 60, ativo: true };
const KEY = "servico-referencia-recuperavel";
let router;
function mount(entry = "/painel/servicos/novo") {
  router = createMemoryRouter([
    { path: "/painel/servicos/novo", element: <ServiceEditorPage /> },
    { path: "/painel/servicos/:id/editar", element: <ServiceEditorPage /> },
    { path: "/painel/negocio", element: <BusinessPage /> },
    { path: "*", element: <h1>Destino</h1> },
  ], { initialEntries: [entry] });
  return render(<RouterProvider router={router} />);
}
function reload(view) {
  const { pathname, search, hash } = router.state.location;
  view.unmount();
  router.dispose();
  return mount(`${pathname}${search}${hash}`);
}
function entryWithReference() {
  return `/painel/servicos/novo${serviceCreationReferenceHash("", { usuarioId: 4, negocioId: 11, key: KEY })}`;
}
function fill(name = "Manicure") {
  fireEvent.change(screen.getByLabelText("Nome do serviço"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "50" } });
  fireEvent.change(screen.getByRole("combobox", { name: /Categoria/ }), { target: { value: "unha" } });
}
function save() { fireEvent.click(screen.getByRole("button", { name: /^Salvar serviço/ })); }
function editingReads(path) {
  if (path === "/servicos") return { servicos: [SERVICE] };
  if (path === "/servicos/71/fotos") return { fotos: [] };
  throw new Error(`Request inesperada: ${path}`);
}
beforeEach(() => {
  apiRequest.mockReset();
  Object.assign(session, { usuario: { id: 4 }, negocio: { id: 11, papel: "dono" }, vinculos: [] });
  session.refresh.mockReset().mockResolvedValue({});
  session.adoptArchivedBusiness.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); router?.dispose(); vi.restoreAllMocks(); });

describe("cadastro recuperável depois de recarregar", () => {
  it.each([true, false])("recupera somente por GET com storage indisponível e onboarding=%s", async (onboarding) => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage indisponível"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage indisponível"); });
    let submittedKey;
    apiRequest.mockImplementation(async (path, options = {}) => {
      if (path === "/servicos" && options.method === "POST") {
        submittedKey = options.headers["Idempotency-Key"];
        throw new Error("Resposta perdida após commit");
      }
      if (path.startsWith("/servicos/tentativa?")) {
        expect(options.headers["Idempotency-Key"]).toBe(submittedKey);
        return { estado: "concluida", servico: SERVICE, publicacao: { publicado: true } };
      }
      return editingReads(path);
    });
    const view = mount(`/painel/servicos/novo${onboarding ? "?onboarding=servico&plano=studio" : ""}`);
    fill(); save();
    await screen.findByText(/Não foi possível confirmar o cadastro/);
    const fragment = decodeURIComponent(router.state.location.hash);
    expect(fragment).toContain(`4/11/${submittedKey}`);
    expect(fragment).not.toMatch(/Manicure|valor|nome|descricao/);
    reload(view);
    await waitFor(() => expect(router.state.location.pathname).toBe(onboarding ? "/painel/horarios" : "/painel/servicos/71/editar"));
    if (onboarding) expect(router.state.location.search).toBe("?plano=studio");
    else expect((await screen.findByLabelText("Nome do serviço")).value).toBe("Manicure");
    expect(router.state.location.hash).toBe("");
    expect(apiRequest.mock.calls.filter(([, options = {}]) => options.method === "POST")).toHaveLength(1);
  });

  it("ausência no GET preserva a chave para um POST que ainda pode chegar", async () => {
    let key;
    const posts = [];
    apiRequest.mockImplementation(async (path, options = {}) => {
      if (path === "/servicos" && options.method === "POST") {
        posts.push(options);
        key ||= options.headers["Idempotency-Key"];
        if (posts.length === 1) throw new Error("Falha antes do envio");
        return { servico: SERVICE, publicacao: { publicado: true } };
      }
      if (path.startsWith("/servicos/tentativa?")) return { estado: "nao_encontrada" };
      return editingReads(path);
    });
    const view = mount(); fill(); save();
    await screen.findByText(/Não foi possível confirmar o cadastro/);
    reload(view);
    await screen.findByText(/Ainda não há cadastro confirmado/);
    fill("Pedicure"); save();
    await screen.findByRole("heading", { name: "Destino" });
    expect(posts).toHaveLength(2);
    expect(posts[1].headers["Idempotency-Key"]).toBe(key);
    expect(posts[1].body).toMatchObject({ nome: "Pedicure", negocio_id: 11 });
  });

  it("POST antigo concluído após GET ausente recupera o canônico ao detectar payload diferente", async () => {
    let reads = 0;
    apiRequest.mockImplementation(async (path, options = {}) => {
      if (path.startsWith("/servicos/tentativa?")) return ++reads === 1
        ? { estado: "nao_encontrada" }
        : { estado: "concluida", servico: SERVICE, publicacao: { publicado: true } };
      if (options.method === "POST") throw Object.assign(new Error("Dados divergentes"), {
        status: 409, data: { codigo: "SERVICO_TENTATIVA_DIVERGENTE" },
      });
      return editingReads(path);
    });
    mount(entryWithReference());
    await screen.findByText(/Ainda não há cadastro confirmado/);
    fill("Novo nome digitado"); save();
    await waitFor(() => expect(router.state.location.pathname).toBe("/painel/servicos/71/editar"));
    expect((await screen.findByLabelText("Nome do serviço")).value).toBe("Manicure");
    expect(reads).toBe(2);
    expect(apiRequest.mock.calls.filter(([, options = {}]) => options.method === "POST")).toHaveLength(1);
    expect(apiRequest.mock.calls.find(([, options = {}]) => options.method === "POST")[1].headers["Idempotency-Key"]).toBe(KEY);
  });

  it("falha da leitura mantém o editor fechado e a nova tentativa executa somente GET", async () => {
    let reads = 0;
    apiRequest.mockImplementation(async (path) => {
      if (path.startsWith("/servicos/tentativa?")) {
        if (++reads === 1) throw Object.assign(new Error("Consulta indisponível"), { status: 503 });
        return { estado: "concluida", servico: SERVICE, publicacao: { publicado: false } };
      }
      return editingReads(path);
    });
    mount(entryWithReference());
    await screen.findByText("Consulta indisponível");
    expect(screen.queryByLabelText("Nome do serviço")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("heading", { name: "Editar serviço" });
    expect(apiRequest.mock.calls.every(([, options = {}]) => !options.method)).toBe(true);
  });

  it("serviço removido apresenta saída ao catálogo sem oferecer recriação", async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error("O serviço desta tentativa foi removido."), { status: 410 }));
    mount(entryWithReference());
    await screen.findByText("O serviço desta tentativa foi removido.");
    expect(screen.getByRole("link", { name: /Voltar aos serviços/ })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Salvar|Verificar|Tentar/ })).toBeNull();
    expect(apiRequest.mock.calls).toHaveLength(1);
  });

  it.each(["conta", "negócio"])("referência de outra %s não recupera nem reutiliza tentativa", async (context) => {
    if (context === "conta") session.usuario = { id: 9 };
    else session.negocio = { id: 22, papel: "dono" };
    apiRequest.mockResolvedValue({ servico: SERVICE, publicacao: { publicado: true } });
    mount(entryWithReference());
    expect(screen.getByLabelText("Nome do serviço").value).toBe("");
    expect(apiRequest).not.toHaveBeenCalled();
    fill(); save();
    await screen.findByRole("heading", { name: "Destino" });
    expect(apiRequest.mock.calls[0][1].headers["Idempotency-Key"]).not.toBe(KEY);
    expect(apiRequest.mock.calls[0][1].body.negocio_id).toBe(context === "negócio" ? 22 : 11);
  });

  it("sair durante recuperação invalida a consulta e não navega quando ela termina", async () => {
    let finish;
    apiRequest.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    mount(entryWithReference());
    await screen.findByText("Carregando serviço...");
    await act(async () => { await router.navigate("/outro-destino"); });
    await act(async () => { finish({ estado: "concluida", servico: SERVICE, publicacao: { publicado: true } }); });
    expect(router.state.location.pathname).toBe("/outro-destino");
    expect(apiRequest.mock.calls[0][1].signal.aborted).toBe(true);
  });
});

describe("encerramento vinculado ao negócio exibido", () => {
  it("resposta perdida permite verificar somente A mesmo se a sessão já aponta para B", async () => {
    const targets = [];
    apiRequest.mockImplementation(async (path, options = {}) => {
      if (path === "/configuracoes") return { negocio: BUSINESS, publicacao: { publicado: true, pode_publicar: true, pendencias: [] } };
      if (path === "/negocio/encerrar") {
        targets.push(options.body.negocio_id);
        if (targets.length === 1) throw new Error("Resposta de A perdida");
        return { mensagem: "Negócio encerrado.", negocio: { id: 11, ativo: false, publicado: false } };
      }
      throw new Error(`Request inesperada: ${path}`);
    });
    mount("/painel/negocio");
    await screen.findByDisplayValue("Studio Aurora");
    fireEvent.click(screen.getByRole("button", { name: "Encerrar negócio", exact: true }));
    await screen.findByText(/Não foi possível confirmar o encerramento/);
    expect(screen.getByLabelText("Nome do negócio").disabled).toBe(true);
    session.negocio = { id: 22, papel: "dono" };
    fireEvent.click(screen.getByRole("button", { name: "Verificar encerramento" }));
    await screen.findByRole("heading", { name: "Destino" });
    expect(targets).toEqual([11, 11]);
    expect(session.adoptArchivedBusiness).toHaveBeenCalledWith({ id: 11, ativo: false, publicado: false });
    expect(window.confirm).toHaveBeenCalledTimes(1);
  });

  it("resposta de outro negócio não é adotada como arquivamento confirmado", async () => {
    apiRequest.mockImplementation(async (path) => path === "/configuracoes"
      ? { negocio: BUSINESS, publicacao: { publicado: true, pode_publicar: true, pendencias: [] } }
      : { negocio: { id: 22, ativo: false } });
    mount("/painel/negocio");
    await screen.findByDisplayValue("Studio Aurora");
    fireEvent.click(screen.getByRole("button", { name: "Encerrar negócio", exact: true }));
    await screen.findByText(/Não foi possível confirmar o encerramento/);
    expect(session.adoptArchivedBusiness).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/painel/negocio");
  });
});
