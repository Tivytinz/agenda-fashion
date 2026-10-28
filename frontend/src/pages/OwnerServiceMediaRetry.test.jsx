// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { serviceCreationReferenceHash } from "../utils/serviceCreationReference";
import { ServiceEditorPage } from "./ServicesPage";
const session = vi.hoisted(() => ({ usuario: { id: 4 }, negocio: { id: 11, papel: "dono" }, refresh: vi.fn() }));
vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: () => session }));
const SERVICE = { id: 12, nome: "Manicure", descricao: "Já confirmado", categoria: "unha", valor: 50, duracao_minutos: 60, ativo: true };
const PHOTO = { id: 71, foto_url: "https://images.example.test/71.jpg", foto_public_id: "photo-71" };
const KEY = "servico-restauracao-query-0001";
let router;
function mount(entry = "/painel/servicos/12/editar") {
  router = createMemoryRouter([
    { path: "/painel/servicos/novo", element: <ServiceEditorPage /> },
    { path: "/painel/servicos/:id/editar", element: <ServiceEditorPage /> },
    { path: "*", element: <h1>Destino</h1> },
  ], { initialEntries: [entry] });
  render(<RouterProvider router={router} />);
}
beforeEach(() => {
  apiRequest.mockReset(); session.refresh.mockReset().mockResolvedValue({});
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pending-cover");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => { cleanup(); router?.dispose(); vi.restoreAllMocks(); });
function selectGallery() {
  fireEvent.change(screen.getByLabelText("Adicionar fotos à galeria"), {
    target: { files: [new File(["image"], "foto.jpg", { type: "image/jpeg" })] },
  });
}
function save() { fireEvent.click(screen.getByRole("button", { name: "Salvar serviço" })); }
async function ready() {
  await screen.findByRole("heading", { name: "Editar serviço" });
  await waitFor(() => expect(screen.queryByText("Carregando fotos...")).toBeNull());
}
async function galleryFailure({ create = false, confirmed = false } = {}) {
  let server = { ...SERVICE }; let uploads = 0; const calls = [];
  apiRequest.mockImplementation(async (path, options = {}) => {
    calls.push({ path, ...options });
    if (path === "/servicos" && !options.method) return { servicos: [{ ...server }] };
    if (path === "/servicos/12/fotos/tentativa") return confirmed ? { estado: "concluida", foto: PHOTO } : { estado: "nao_encontrada" };
    if ((path === "/servicos/12" && options.method === "PUT") || (path === "/servicos" && options.method === "POST")) {
      server = { ...server, ...options.body }; return { servico: { ...server } };
    }
    if (path === "/servicos/12/fotos" && options.method === "POST") {
      if (++uploads === 1) throw Object.assign(new Error("Envio não concluído"), { status: 503 });
      return { foto: PHOTO };
    }
    if (path === "/servicos/12/fotos") return { fotos: [] };
    throw new Error(`Request inesperada: ${path}`);
  });
  mount(create ? "/painel/servicos/novo" : undefined);
  if (!create) await ready();
  fireEvent.change(screen.getByLabelText("Nome do serviço"), { target: { value: "Manicure revisada" } });
  if (create) {
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "50" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Categoria/ }), { target: { value: "unha" } });
  }
  selectGallery(); save();
  await screen.findByRole("button", { name: "Verificar fotos" });
  server.ativo = false; // Pausa confirmada em outra aba, depois dos dados salvos.
  fireEvent.click(screen.getByRole("button", { name: "Verificar fotos" }));
  await screen.findByText(/Fotos conferidas/);
  return { calls, server, getServer: () => server };
}

it.each([false, true])("retry de fotos após criação=%s preserva a pausa de outra aba sem repetir os dados", async create => {
  const { calls, server } = await galleryFailure({ create });
  const coreWrites = calls.filter(call => call.method === "PUT" || call.path === "/servicos" && call.method === "POST");
  expect(coreWrites).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "50.00" } });
  fireEvent.change(screen.getByLabelText("Nome do serviço"), { target: { value: " Manicure revisada " } });
  const before = calls.length;
  save(); await screen.findByRole("heading", { name: "Destino" });
  expect(calls.slice(before).map(call => [call.path, call.method])).toEqual([["/servicos/12/fotos", "POST"]]);
  expect(server.ativo).toBe(false);
  const uploads = calls.filter(call => call.path === "/servicos/12/fotos" && call.method === "POST");
  expect(uploads[1].headers["Idempotency-Key"]).toBe(uploads[0].headers["Idempotency-Key"]);
});

it("edição real depois da conferência continua salvando os novos dados antes da foto", async () => {
  const { calls } = await galleryFailure();
  fireEvent.change(screen.getByLabelText("Nome do serviço"), { target: { value: "Pedicure" } });
  fireEvent.change(screen.getByLabelText(/^Descrição/), { target: { value: "Descrição revisada" } });
  fireEvent.change(screen.getByRole("combobox", { name: /Categoria/ }), { target: { value: "outro" } });
  fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "65" } });
  fireEvent.change(screen.getByLabelText("Duração em minutos"), { target: { value: "45" } });
  fireEvent.click(screen.getByLabelText(/Serviço disponível/));
  const before = calls.length;
  save(); await screen.findByRole("heading", { name: "Destino" });
  expect(calls.slice(before).map(call => call.method)).toEqual(["PUT", "POST"]);
  expect(calls[before].body).toEqual({ nome: "Pedicure", descricao: "Descrição revisada", categoria: "outro", valor: 65, duracao_minutos: 45, ativo: false });
});

it.each(["capa", "galeria"])("selecionar somente %s em serviço existente envia apenas a mídia", async type => {
  apiRequest.mockImplementation(async (path, options = {}) => {
    if (options.method === "POST") return type === "capa" ? { servico: { ...SERVICE, ...PHOTO } } : { foto: PHOTO };
    if (path === "/servicos") return { servicos: [SERVICE] };
    if (path.endsWith("/fotos")) return { fotos: [] };
    throw new Error(`Request inesperada: ${path}`);
  });
  mount(); await ready();
  if (type === "galeria") selectGallery();
  else fireEvent.change(screen.getByLabelText("Escolher capa"), { target: { files: [new File(["cover"], "capa.jpg", { type: "image/jpeg" })] } });
  save(); await screen.findByRole("heading", { name: "Destino" });
  const writes = apiRequest.mock.calls.filter(([, options = {}]) => options.method);
  expect(writes).toHaveLength(1);
  expect(writes[0][0]).toBe(type === "capa" ? "/servicos/12/foto" : "/servicos/12/fotos");
});

it("capa incerta exige leitura, protege o lote e só permite outro envio após conferência explícita", async () => {
  let sent = false; let readFails = true; const calls = [];
  apiRequest.mockImplementation(async (path, options = {}) => {
    calls.push({ path, ...options });
    if (path === "/servicos/12/foto") {
      sent = true;
      throw Object.assign(new Error("Confirmação da capa perdida"), { status: 503 });
    }
    if (sent && readFails) throw new Error("Leitura indisponível");
    if (path === "/servicos") return { servicos: [{ ...SERVICE, ...(sent ? PHOTO : {}), id: SERVICE.id }] };
    if (path.endsWith("/fotos")) return { fotos: [] };
    throw new Error(`Request inesperada: ${path}`);
  });
  mount(); await ready();
  fireEvent.change(screen.getByLabelText("Escolher capa"), { target: { files: [new File(["cover"], "capa.jpg", { type: "image/jpeg" })] } });
  selectGallery(); save();
  await screen.findByRole("button", { name: "Verificar fotos" });
  expect(screen.getByLabelText("Nome do serviço").disabled).toBe(true);
  const before = calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Verificar fotos" }));
  await screen.findByText(/Leitura indisponível/);
  expect(screen.getByLabelText("Nome do serviço").disabled).toBe(true);
  readFails = false;
  fireEvent.click(screen.getByRole("button", { name: "Verificar fotos" }));
  await screen.findByText(/Capa atual conferida/);
  expect(screen.getByLabelText("Nome do serviço").disabled).toBe(false);
  expect(screen.getByAltText("Prévia da nova capa")).toBeTruthy();
  expect(screen.getByAltText("Foto da galeria de Manicure").getAttribute("src")).toBe(PHOTO.foto_url);
  expect(calls.slice(before).every(call => !call.method)).toBe(true);
  expect(calls.filter(call => call.method)).toHaveLength(1);
  expect(screen.getByText("1 foto selecionada.")).toBeTruthy();
});

it.each([true, false])("mudar query cancela restauração antiga e recupera com a intenção atual, publicado=%s", async published => {
  let finish; let signal; let reads = 0;
  apiRequest.mockImplementation(async (_path, options) => {
    expect(options.headers["Idempotency-Key"]).toBe(KEY);
    if (++reads === 1) { signal = options.signal; return new Promise(resolve => { finish = resolve; }); }
    return { estado: "concluida", servico: SERVICE, publicacao: { publicado: published } };
  });
  const hash = serviceCreationReferenceHash("", { usuarioId: 4, negocioId: 11, key: KEY });
  mount(`/painel/servicos/novo?onboarding=servico&plano=studio${hash}`);
  await screen.findByText("Carregando serviço...");
  await act(() => router.navigate(`/painel/servicos/novo?onboarding=servico&plano=autonoma${hash}`));
  const retry = await screen.findByRole("button", { name: "Tentar novamente" });
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ estado: "concluida", servico: SERVICE, publicacao: { publicado: true } }));
  expect(router.state.location.pathname).toBe("/painel/servicos/novo");
  expect(session.refresh).not.toHaveBeenCalled();
  fireEvent.click(retry);
  await screen.findByRole("heading", { name: "Destino" });
  expect(router.state.location.pathname).toBe(published ? "/painel/horarios" : "/painel/negocio");
  expect(router.state.location.search).toBe("?plano=autonoma");
  expect(reads).toBe(2);
  expect(apiRequest.mock.calls.every(([, options]) => !options.method)).toBe(true);
});

it.each([false, true])("salvar após recuperar todas as fotos não regrava o serviço, criação=%s", async create => {
  const { calls, getServer } = await galleryFailure({ create, confirmed: true });
  expect(screen.queryByText("1 foto selecionada.")).toBeNull();
  const before = calls.length;
  save();
  await screen.findByRole("heading", { name: "Destino" });
  expect(calls.slice(before)).toEqual([]);
  expect(getServer().ativo).toBe(false);
});
