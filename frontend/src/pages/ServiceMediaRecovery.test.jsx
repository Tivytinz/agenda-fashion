// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { ServiceEditorPage } from "./ServicesPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({ refresh: vi.fn().mockResolvedValue({}) })
}));

const photo = (id) => ({ id, foto_url: `https://img.example/${id}.png`, foto_public_id: `photo-${id}` });
const PHOTOS = [photo(31), photo(32), photo(33)];
const SERVICE = { ...photo(31), id: 12, nome: "Manicure", categoria: "unha", valor: 50, duracao_minutos: 60, ativo: true };
const OTHER_SERVICE = { ...SERVICE, ...photo(41), id: 34, nome: "Pedicure" };
let router;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function read(path) {
  if (path === "/servicos") return Promise.resolve({ servicos: [SERVICE, OTHER_SERVICE] });
  if (path === "/servicos/12/fotos") return Promise.resolve(PHOTOS);
  if (path === "/servicos/34/fotos") return Promise.resolve([photo(41)]);
  throw new Error(`Request inesperada: ${path}`);
}

async function mount() {
  router = createMemoryRouter([
    { path: "/painel/servicos/:id/editar", element: <ServiceEditorPage /> },
    { path: "*", element: <h1>Destino</h1> }
  ], { initialEntries: ["/painel/servicos/12/editar"] });
  render(<RouterProvider router={router} />);
  await screen.findByText("Capa atual");
}

beforeEach(() => {
  apiRequest.mockReset();
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pending-cover");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  router?.dispose();
  vi.restoreAllMocks();
});

describe("arquivos pendentes e ações de mídia coordenadas", () => {
  it("acumula lotes e envia cada arquivo uma vez mesmo quando ele é selecionado novamente", async () => {
    const sent = [];
    apiRequest.mockImplementation((path, options = {}) => {
      if (options.method === "PUT") return Promise.resolve({ servico: SERVICE });
      if (options.method === "POST") {
        sent.push(options.body.get("foto").name);
        return Promise.resolve({ foto: photo(40 + sent.length) });
      }
      return read(path);
    });
    await mount();
    const user = userEvent.setup();
    const input = screen.getByLabelText("Adicionar fotos à galeria");
    const first = new File(["a"], "primeira.png", { type: "image/png", lastModified: 1000 });
    const second = new File(["b"], "segunda.png", { type: "image/png", lastModified: 2000 });
    await user.upload(input, first);
    await user.upload(input, second);
    await user.upload(input, new File(["a"], "primeira.png", { type: "image/png", lastModified: 1000 }));
    expect(screen.getByText("2 fotos selecionadas.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Salvar serviço" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/painel/servicos"));
    expect(sent).toEqual(["primeira.png", "segunda.png"]);
  });

  it("mantém a capa pendente durante a escolha e uma falha permite enviar o mesmo arquivo", async () => {
    const choosing = deferred();
    let uploaded;
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/servicos/12/capa") return choosing.promise;
      if (options.method === "PUT") return Promise.resolve({ servico: SERVICE });
      if (path === "/servicos/12/foto") {
        uploaded = options.body.get("foto").name;
        return Promise.resolve({ servico: { ...SERVICE, ...photo(50), id: 12 } });
      }
      return read(path);
    });
    await mount();
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("Trocar capa"), new File(["pending"], "pendente.png", { type: "image/png" }));
    await user.click(screen.getAllByRole("button", { name: "Usar como capa" })[0]);
    expect(screen.getByAltText("Prévia da nova capa")).toBeTruthy();
    expect(screen.getByLabelText("Trocar imagem escolhida").disabled).toBe(true);
    expect(screen.getByLabelText("Adicionar fotos à galeria").disabled).toBe(true);
    await act(() => choosing.reject(new Error("Capa indisponível")));
    expect((await screen.findByRole("alert")).textContent).toContain("Capa indisponível");
    expect(screen.getByAltText("Prévia da nova capa")).toBeTruthy();
    await act(() => router.navigate("/saida"));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar editando" }));
    await user.click(screen.getByRole("button", { name: "Salvar serviço" }));
    await waitFor(() => expect(uploaded).toBe("pendente.png"));
    expect(router.state.location.pathname).toBe("/painel/servicos");
  });

  it("só troca a capa depois da confirmação e preserva edições de texto feitas durante a escolha", async () => {
    const choosing = deferred();
    apiRequest.mockImplementation(path => path === "/servicos/12/capa" ? choosing.promise : read(path));
    await mount();
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("Trocar capa"), new File(["pending"], "pendente.png", { type: "image/png" }));
    await user.click(screen.getAllByRole("button", { name: "Usar como capa" })[0]);
    expect(screen.getByAltText("Prévia da nova capa")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Nome do serviço"), { target: { value: "Manicure revisada" } });
    await act(() => choosing.resolve({ servico: { ...SERVICE, ...photo(32), id: 12 } }));
    expect(screen.queryByAltText("Prévia da nova capa")).toBeNull();
    expect(screen.getByAltText("Capa atual do serviço Manicure revisada").getAttribute("src")).toBe(photo(32).foto_url);
    expect(screen.getByLabelText("Nome do serviço").value).toBe("Manicure revisada");
    await act(() => router.navigate("/saida"));
    expect(await screen.findByRole("button", { name: "Continuar editando" })).toBeTruthy();
  });

  it("bloqueia outra remoção, escolha e salvamento até remover a capa, depois permite escolher a nova", async () => {
    const deletion = deferred();
    apiRequest.mockImplementation((path, options = {}) => {
      if (options.method === "DELETE") return deletion.promise;
      if (path === "/servicos/12/capa") return Promise.resolve({ servico: { ...SERVICE, ...photo(33), id: 12 } });
      return read(path);
    });
    await mount();
    const removes = screen.getAllByRole("button", { name: "Remover foto da galeria" });
    const choices = screen.getAllByRole("button", { name: "Usar como capa" });
    act(() => {
      fireEvent.click(removes[0]);
      fireEvent.click(removes[1]);
      fireEvent.click(choices[1]);
      fireEvent.submit(screen.getByRole("button", { name: "Salvar serviço" }).closest("form"));
    });
    expect(apiRequest.mock.calls.filter(([, options = {}]) => options.method)).toEqual([
      ["/servicos/fotos/31", { method: "DELETE" }]
    ]);
    expect(removes.every(button => button.disabled)).toBe(true);
    expect(choices.every(button => button.disabled)).toBe(true);
    await act(() => deletion.resolve({ capa_removida: true }));
    fireEvent.click(screen.getAllByRole("button", { name: "Usar como capa" })[1]);
    await waitFor(() => expect(screen.getByAltText("Capa atual do serviço Manicure").getAttribute("src")).toBe(photo(33).foto_url));
    expect(screen.getAllByRole("button", { name: "Remover foto da galeria" })).toHaveLength(2);
  });

  it("bloqueia remover fotos ou escolher outra capa enquanto a escolha atual está pendente", async () => {
    const choosing = deferred();
    apiRequest.mockImplementation(path => path === "/servicos/12/capa" ? choosing.promise : read(path));
    await mount();
    const choices = screen.getAllByRole("button", { name: "Usar como capa" });
    act(() => {
      fireEvent.click(choices[0]);
      fireEvent.click(choices[1]);
      fireEvent.click(screen.getAllByRole("button", { name: "Remover foto da galeria" })[0]);
    });
    expect(apiRequest.mock.calls.filter(([, options = {}]) => options.method)).toEqual([
      ["/servicos/12/capa", { method: "PUT", body: { foto_id: 32 } }]
    ]);
    expect(screen.getByAltText("Capa atual do serviço Manicure").getAttribute("src")).toBe(photo(31).foto_url);
    await act(() => choosing.resolve({ servico: { ...SERVICE, ...photo(32), id: 12 } }));
    expect(screen.getByAltText("Capa atual do serviço Manicure").getAttribute("src")).toBe(photo(32).foto_url);
    await act(() => router.navigate("/saida"));
    expect(router.state.location.pathname).toBe("/saida");
  });
});

describe("respostas de operações encerradas no editor", () => {
  it.each(["sucesso", "erro"])("ignora %s do salvamento depois de sair da tela", async (outcome) => {
    const save = deferred();
    apiRequest.mockImplementation((path, options = {}) => options.method === "PUT" ? save.promise : read(path));
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Salvar serviço" }));
    await act(() => router.navigate("/saida"));
    await screen.findByRole("heading", { name: "Destino" });
    await act(() => outcome === "sucesso" ? save.resolve({ servico: SERVICE }) : save.reject(new Error("Falha antiga")));
    expect(router.state.location.pathname).toBe("/saida");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a resposta antiga não libera o salvamento em andamento de outro serviço", async () => {
    const oldSave = deferred();
    const newSave = deferred();
    apiRequest.mockImplementation((path, options = {}) => {
      if (options.method === "PUT") return path === "/servicos/12" ? oldSave.promise : newSave.promise;
      return read(path);
    });
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Salvar serviço" }));
    await act(() => router.navigate("/painel/servicos/34/editar"));
    const name = await screen.findByDisplayValue("Pedicure");
    fireEvent.click(screen.getByRole("button", { name: "Salvar serviço" }));
    await act(() => oldSave.resolve({ servico: SERVICE }));
    expect(router.state.location.pathname).toBe("/painel/servicos/34/editar");
    expect(name.disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Salvando..." }).disabled).toBe(true);
    await act(() => newSave.resolve({ servico: OTHER_SERVICE }));
    expect(router.state.location.pathname).toBe("/painel/servicos");
    expect(apiRequest.mock.calls.filter(([, options = {}]) => options.method === "PUT").map(([path]) => path)).toEqual(["/servicos/12", "/servicos/34"]);
  });

  it("depois de sair durante um upload, não envia os arquivos restantes nem redireciona", async () => {
    const upload = deferred();
    const sent = [];
    apiRequest.mockImplementation((path, options = {}) => {
      if (options.method === "PUT") return Promise.resolve({ servico: SERVICE });
      if (options.method === "POST") {
        sent.push(options.body.get("foto").name);
        return upload.promise;
      }
      return read(path);
    });
    await mount();
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("Adicionar fotos à galeria"), [
      new File(["a"], "primeira.png", { type: "image/png" }),
      new File(["b"], "segunda.png", { type: "image/png" })
    ]);
    await user.click(screen.getByRole("button", { name: "Salvar serviço" }));
    await waitFor(() => expect(sent).toEqual(["primeira.png"]));
    await act(() => router.navigate("/saida"));
    fireEvent.click(await screen.findByRole("button", { name: "Sair sem salvar" }));
    await act(() => upload.resolve({ foto: photo(50) }));
    expect(sent).toEqual(["primeira.png"]);
    expect(router.state.location.pathname).toBe("/saida");
  });

  it.each(["capa", "remoção"])("ignora a resposta de %s ao abrir outro serviço", async (kind) => {
    const oldMutation = deferred();
    apiRequest.mockImplementation((path, options = {}) => options.method ? oldMutation.promise : read(path));
    await mount();
    fireEvent.click(kind === "capa"
      ? screen.getAllByRole("button", { name: "Usar como capa" })[0]
      : screen.getAllByRole("button", { name: "Remover foto da galeria" })[0]);
    await act(() => router.navigate("/painel/servicos/34/editar"));
    await screen.findByDisplayValue("Pedicure");
    await act(() => oldMutation.resolve({ servico: { ...SERVICE, ...photo(32), id: 12 }, capa_removida: true }));
    expect(screen.getByAltText("Capa atual do serviço Pedicure").getAttribute("src")).toBe(photo(41).foto_url);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Salvar serviço" }).disabled).toBe(false);
  });
});
