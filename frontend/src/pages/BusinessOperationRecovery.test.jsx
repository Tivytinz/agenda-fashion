// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { BusinessPage } from "./BusinessPage";

const session = vi.hoisted(() => ({ refresh: vi.fn(), adoptCreatedBusiness: vi.fn() }));
vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: () => session }));

const BUSINESS = {
  id: 11, nome: "Studio Aurora", slug: "studio-aurora", areas: ["Unhas"],
  whatsapp: "11999999999", cidade: "São Paulo", estado: "SP", bairro: "Centro",
  endereco: "Rua das Flores", numero: "10", cep: "01001000",
  localizacao_url: "https://maps.google.com/?q=studio", publicado: true
};
const LIVE = { publicado: true, pode_publicar: true, pendencias: [] };
const HIDDEN = { publicado: false, pode_publicar: true, pendencias: [], oculto_manual: true };
let router;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function reads(path) {
  if (path === "/configuracoes") return Promise.resolve({ negocio: BUSINESS, publicacao: LIVE });
  if (path.startsWith("/cep/")) return Promise.resolve(BUSINESS);
  throw new Error(`Request inesperada: ${path}`);
}

function mount({ create = false, state = null } = {}) {
  const path = create ? "/criar-negocio" : "/painel/negocio";
  router = createMemoryRouter([
    { path, element: <BusinessPage create={create} /> },
    { path: "*", element: <h1>Destino</h1> }
  ], { initialEntries: [{ pathname: path, state }] });
  render(<RouterProvider router={router} />);
}

function selectPhoto() {
  fireEvent.change(screen.getByLabelText("Adicionar foto"), {
    target: { files: [new File(["photo"], "negocio.png", { type: "image/png" })] }
  });
}

async function leave() {
  await act(() => router.navigate("/saida"));
  const discard = screen.queryByRole("button", { name: "Sair sem salvar" });
  if (discard) fireEvent.click(discard);
  await screen.findByRole("heading", { name: "Destino" });
}

async function fillCreation() {
  fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: BUSINESS.nome } });
  fireEvent.click(screen.getByLabelText("Unhas"));
  fireEvent.change(screen.getByLabelText(/WhatsApp/), { target: { value: BUSINESS.whatsapp } });
  fireEvent.change(screen.getByLabelText(/Link do Google Maps/), { target: { value: BUSINESS.localizacao_url } });
  fireEvent.change(screen.getByLabelText(/CEP/), { target: { value: BUSINESS.cep } });
  await waitFor(() => expect(screen.getByLabelText("Endereço").value).toBe(BUSINESS.endereco));
  fireEvent.change(screen.getByLabelText("Número"), { target: { value: BUSINESS.numero } });
}

const writes = () => apiRequest.mock.calls.filter(([, options = {}]) => options.method);

beforeEach(() => {
  apiRequest.mockReset();
  session.refresh.mockReset().mockResolvedValue({});
  session.adoptCreatedBusiness.mockReset().mockReturnValue(true);
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => { cleanup(); router?.dispose(); vi.restoreAllMocks(); });

describe("operações do negócio coordenadas", () => {
  it("bloqueia publicação, foto, encerramento e outro submit até salvar; depois permite ocultar", async () => {
    const save = deferred();
    apiRequest.mockImplementation((path, options = {}) => {
      if (options.method === "PUT") return save.promise;
      if (path === "/configuracoes/publicacao") return Promise.resolve({ publicacao: HIDDEN });
      return reads(path);
    });
    mount(); await screen.findByDisplayValue(BUSINESS.nome);
    fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: "Studio revisado" } });
    const saveButton = screen.getByRole("button", { name: "Salvar alterações" });
    const hide = screen.getByRole("button", { name: "Ocultar da busca" });
    const close = screen.getByRole("button", { name: "Encerrar negócio", exact: true });
    act(() => {
      fireEvent.click(saveButton);
      fireEvent.click(hide);
      selectPhoto();
      fireEvent.click(close);
      fireEvent.submit(saveButton.closest("form"));
    });
    expect(writes()).toHaveLength(1);
    expect(writes()[0][0]).toBe("/configuracoes");
    expect(hide.disabled).toBe(true);
    expect(close.disabled).toBe(true);
    expect(screen.getByLabelText("Adicionar foto").disabled).toBe(true);
    expect(window.confirm).not.toHaveBeenCalled();
    await act(() => save.resolve({ negocio: { ...BUSINESS, nome: "Studio revisado" }, publicacao: LIVE }));
    fireEvent.click(hide);
    await screen.findByRole("heading", { name: "Seu negócio não está aparecendo na busca" });
    expect(screen.getByRole("button", { name: "Mostrar na busca" }).disabled).toBe(false);
  });

  it("uma publicação pendente bloqueia outras ações; falha libera o salvamento do rascunho", async () => {
    const publication = deferred();
    let saved;
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/configuracoes/publicacao") return publication.promise;
      if (options.method === "PUT") { saved = options.body; return Promise.resolve({ negocio: { ...BUSINESS, ...saved }, publicacao: LIVE }); }
      return reads(path);
    });
    mount(); await screen.findByDisplayValue(BUSINESS.nome);
    fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: "Rascunho preservado" } });
    const hide = screen.getByRole("button", { name: "Ocultar da busca" });
    act(() => {
      fireEvent.click(hide);
      fireEvent.submit(screen.getByRole("button", { name: "Salvar alterações" }).closest("form"));
      selectPhoto();
      fireEvent.click(screen.getByRole("button", { name: "Encerrar negócio", exact: true }));
      fireEvent.click(hide);
    });
    expect(writes().map(([path]) => path)).toEqual(["/configuracoes/publicacao"]);
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Salvar alterações" }).disabled).toBe(true);
    await act(() => publication.reject(new Error("Publicação indisponível")));
    expect((await screen.findByRole("alert")).textContent).toContain("Publicação indisponível");
    expect(screen.getByLabelText("Nome do negócio").value).toBe("Rascunho preservado");
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(saved?.nome).toBe("Rascunho preservado"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Salvando..." })).toBeNull());
  });

  it("upload bloqueia as outras mutações e preserva o texto editado enquanto a foto é enviada", async () => {
    const upload = deferred();
    apiRequest.mockImplementation((path) => path === "/configuracoes/foto" ? upload.promise : reads(path));
    mount(); await screen.findByDisplayValue(BUSINESS.nome);
    act(() => {
      selectPhoto();
      fireEvent.click(screen.getByRole("button", { name: "Ocultar da busca" }));
      fireEvent.click(screen.getByRole("button", { name: "Encerrar negócio", exact: true }));
    });
    fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: "Edição durante upload" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvar alterações" }).closest("form"));
    expect(writes().map(([path]) => path)).toEqual(["/configuracoes/foto"]);
    await act(() => upload.resolve({ negocio: { foto_url: "https://img.example/negocio.png" }, publicacao: LIVE }));
    expect(screen.getByLabelText("Nome do negócio").value).toBe("Edição durante upload");
    expect(screen.getByAltText("Foto do negócio Edição durante upload").getAttribute("src")).toBe("https://img.example/negocio.png");
    expect(screen.getByRole("button", { name: "Salvar alterações" }).disabled).toBe(false);
    await act(() => router.navigate("/saida"));
    expect(await screen.findByRole("button", { name: "Continuar editando" })).toBeTruthy();
  });

  it("encerramento bloqueia outras mutações e uma falha preserva as pendências e o rascunho", async () => {
    const closing = deferred();
    apiRequest.mockImplementation((path) => path === "/negocio/encerrar" ? closing.promise : reads(path));
    mount(); await screen.findByDisplayValue(BUSINESS.nome);
    fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: "Rascunho" } });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Encerrar negócio", exact: true }));
      fireEvent.click(screen.getByRole("button", { name: "Ocultar da busca" }));
      selectPhoto();
      fireEvent.submit(screen.getByRole("button", { name: "Salvar alterações" }).closest("form"));
    });
    expect(writes().map(([path]) => path)).toEqual(["/negocio/encerrar"]);
    const error = Object.assign(new Error("Pendências de encerramento"), { data: { pendencias: [{ codigo: "cobranca", mensagem: "Resolva a cobrança" }] } });
    await act(() => closing.reject(error));
    expect(await screen.findByText("Resolva a cobrança")).toBeTruthy();
    expect(screen.getByLabelText("Nome do negócio").value).toBe("Rascunho");
    expect(screen.getByRole("button", { name: "Salvar alterações" }).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Ocultar da busca" }).disabled).toBe(false);
  });
});

describe("continuações encerradas em Meu negócio", () => {
  it("cancela a leitura ao sair e preserva o rascunho do editor reaberto", async () => {
    const oldRead = deferred();
    let readsStarted = 0;
    apiRequest.mockImplementation(() => ++readsStarted === 1 ? oldRead.promise : Promise.resolve({ negocio: BUSINESS, publicacao: LIVE }));
    mount();
    const signal = apiRequest.mock.calls[0][1].signal;
    await leave();
    expect(signal.aborted).toBe(true);
    await act(() => router.navigate("/painel/negocio"));
    await screen.findByDisplayValue(BUSINESS.nome);
    fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: "Novo rascunho" } });
    await act(() => oldRead.resolve({ negocio: { ...BUSINESS, nome: "Dados antigos" }, publicacao: HIDDEN }));
    expect(screen.getByLabelText("Nome do negócio").value).toBe("Novo rascunho");
    expect(screen.getByRole("heading", { name: "Seu negócio está visível para clientes" })).toBeTruthy();
  });

  it.each(["sucesso", "erro"])("ignora %s do perfil em onboarding depois de sair explicitamente", async (outcome) => {
    const save = deferred();
    apiRequest.mockImplementation((path, options = {}) => options.method === "PUT" ? save.promise : reads(path));
    mount({ state: { onboarding: true, onboardingStep: "perfil" } });
    await screen.findByDisplayValue(BUSINESS.nome);
    fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: "Studio revisado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await leave();
    await act(() => outcome === "sucesso" ? save.resolve({ negocio: BUSINESS, publicacao: LIVE }) : save.reject(new Error("Falha antiga")));
    expect(router.state.location.pathname).toBe("/saida");
    expect(session.refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["sucesso", "erro"])("ignora %s da criação depois de sair, sem adotar negócio nem atualizar sessão", async (outcome) => {
    const save = deferred();
    apiRequest.mockImplementation((path, options = {}) => path === "/criar-negocio" && options.method === "POST" ? save.promise : reads(path));
    mount({ create: true }); await fillCreation();
    fireEvent.click(screen.getByRole("button", { name: "Criar negócio", exact: true }));
    expect(writes()).toHaveLength(1);
    await leave();
    await act(() => outcome === "sucesso" ? save.resolve({ negocio: BUSINESS }) : save.reject(new Error("Falha antiga")));
    expect(router.state.location.pathname).toBe("/saida");
    expect(session.adoptCreatedBusiness).not.toHaveBeenCalled();
    expect(session.refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("o salvamento antigo não libera nem altera outro editor com salvamento em andamento", async () => {
    const oldSave = deferred();
    const newSave = deferred();
    let saves = 0;
    apiRequest.mockImplementation((path, options = {}) => options.method === "PUT" ? (++saves === 1 ? oldSave.promise : newSave.promise) : reads(path));
    mount(); await screen.findByDisplayValue(BUSINESS.nome);
    fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: "Edição antiga" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await leave();
    await act(() => router.navigate("/painel/negocio"));
    await screen.findByDisplayValue(BUSINESS.nome);
    fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: "Novo rascunho" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await act(() => oldSave.resolve({ negocio: { ...BUSINESS, nome: "Edição antiga" }, publicacao: HIDDEN }));
    expect(screen.getByLabelText("Nome do negócio").value).toBe("Novo rascunho");
    expect(screen.getByRole("button", { name: "Salvando..." }).disabled).toBe(true);
    expect(session.refresh).not.toHaveBeenCalled();
    await act(() => newSave.resolve({ negocio: { ...BUSINESS, nome: "Novo rascunho" }, publicacao: LIVE }));
    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Nome do negócio").disabled).toBe(false);
  });

  it.each(["foto", "publicação"])("ignora a resposta antiga de %s e não atualiza a sessão do novo editor", async (kind) => {
    const mutation = deferred();
    apiRequest.mockImplementation((path, options = {}) => options.method ? mutation.promise : reads(path));
    mount(); await screen.findByDisplayValue(BUSINESS.nome);
    fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: "Edição antiga" } });
    if (kind === "foto") selectPhoto();
    else fireEvent.click(screen.getByRole("button", { name: "Ocultar da busca" }));
    await leave();
    await act(() => router.navigate("/painel/negocio"));
    await screen.findByDisplayValue(BUSINESS.nome);
    fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: "Novo rascunho" } });
    await act(() => mutation.resolve({ negocio: { foto_url: "https://img.example/antiga.png" }, publicacao: HIDDEN }));
    expect(screen.getByLabelText("Nome do negócio").value).toBe("Novo rascunho");
    expect(screen.getByRole("heading", { name: "Seu negócio está visível para clientes" })).toBeTruthy();
    expect(session.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Salvar alterações" }).disabled).toBe(false);
  });

  it.each(["resposta", "sessão"])("ignora a continuação do encerramento quando sai durante a %s", async (stage) => {
    const closing = deferred();
    const refresh = deferred();
    if (stage === "sessão") session.refresh.mockReturnValue(refresh.promise);
    apiRequest.mockImplementation((path) => path === "/negocio/encerrar" ? closing.promise : reads(path));
    mount(); await screen.findByDisplayValue(BUSINESS.nome);
    fireEvent.click(screen.getByRole("button", { name: "Encerrar negócio", exact: true }));
    if (stage === "sessão") {
      await act(() => closing.resolve({ mensagem: "Negócio encerrado" }));
      expect(session.refresh).toHaveBeenCalledTimes(1);
    }
    await leave();
    await act(() => stage === "resposta" ? closing.resolve({ mensagem: "Negócio encerrado" }) : refresh.resolve({}));
    expect(router.state.location.pathname).toBe("/saida");
    if (stage === "resposta") expect(session.refresh).not.toHaveBeenCalled();
  });
});
