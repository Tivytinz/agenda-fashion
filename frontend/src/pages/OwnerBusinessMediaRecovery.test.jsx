// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { businessCreationReferenceHash } from "../utils/businessCreationReference";
import { BusinessPage } from "./BusinessPage";
import { ServiceEditorPage } from "./ServicesPage";
const session = vi.hoisted(() => ({ usuario: { id: 4 }, negocio: { id: 11, papel: "dono" }, refresh: vi.fn(), adoptCreatedBusiness: vi.fn() }));
vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: () => session }));
const BUSINESS = { id: 11, nome: "Studio recuperado", slug: "studio-recuperado", areas: ["Unhas"], whatsapp: "11999999999",
  cidade: "São Paulo", estado: "SP", bairro: "Centro", endereco: "Rua local", numero: "20", cep: "01001000" };
const PHOTO1 = { id: 31, foto_url: "https://images.example.test/31.jpg", foto_public_id: "photo-31" };
const PHOTO2 = { id: 32, foto_url: "https://images.example.test/32.jpg", foto_public_id: "photo-32" };
const SERVICE = { nome: "Manicure", categoria: "unha", valor: 50, duracao_minutos: 60, ativo: true, ...PHOTO1, id: 12 };
const KEY = "negocio-recuperavel-tentativa-0001";
let router;
function mount(entry = "/criar-negocio?plano=studio") {
  router = createMemoryRouter([
    { path: "/criar-negocio", element: <BusinessPage create /> },
    { path: "/painel/servicos/:id/editar", element: <ServiceEditorPage /> },
    { path: "*", element: <h1>Destino</h1> },
  ], { initialEntries: [entry] });
  return render(<RouterProvider router={router} />);
}
beforeEach(() => {
  apiRequest.mockReset(); session.usuario = { id: 4 }; session.refresh.mockReset().mockResolvedValue({});
  session.adoptCreatedBusiness.mockReset().mockReturnValue(true);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pending-cover");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => { cleanup(); router?.dispose(); vi.restoreAllMocks(); });
async function fillBusiness() {
  fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: "Studio novo" } });
  fireEvent.click(screen.getByLabelText("Unhas"));
  fireEvent.change(screen.getByLabelText(/WhatsApp/), { target: { value: "11999999999" } });
  fireEvent.change(screen.getByLabelText(/Link do Google Maps/), { target: { value: "https://maps.google.com/" } });
  fireEvent.change(screen.getByLabelText(/CEP/), { target: { value: "01001000" } });
  await waitFor(() => expect(screen.getByLabelText("Endereço").value).toBe("Rua local"));
  fireEvent.change(screen.getByLabelText("Número"), { target: { value: "20" } });
}
async function lostCreation(lookup) {
  const calls = []; let key;
  apiRequest.mockImplementation(async (path, options = {}) => {
    calls.push({ path, ...options });
    if (path === "/cep/01001000") return BUSINESS;
    if (path === "/criar-negocio") { key = options.headers["Idempotency-Key"]; throw new Error("Retorno perdido após criar"); }
    if (path === "/criar-negocio/tentativa") { expect(options.headers["Idempotency-Key"]).toBe(key); return lookup(); }
    throw new Error(`Request inesperada: ${path}`);
  });
  mount(); await fillBusiness();
  fireEvent.click(screen.getByRole("button", { name: "Criar negócio" }));
  await screen.findByRole("button", { name: "Verificar negócio" });
  return calls;
}
it("criação incerta recupera por GET e segue ao primeiro serviço com o plano preservado", async () => {
  const calls = await lostCreation(() => ({ estado: "concluida", negocio: BUSINESS }));
  expect(screen.getByLabelText("Nome do negócio").disabled).toBe(true);
  expect(router.state.location.hash).toContain("cadastro-negocio");
  expect(router.state.location.hash).not.toContain("Studio");
  const before = calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Verificar negócio" }));
  await screen.findByRole("heading", { name: "Destino" });
  expect(router.state.location.pathname).toBe("/painel/servicos/novo");
  expect(router.state.location.search).toBe("?onboarding=servico&plano=studio");
  expect(calls.slice(before).map(call => call.path)).toEqual(["/criar-negocio/tentativa"]);
  expect(session.adoptCreatedBusiness).toHaveBeenCalledWith(BUSINESS);
});
it("falha de consulta mantém o rascunho protegido e o retry só consulta", async () => {
  let reads = 0;
  const calls = await lostCreation(() => {
    if (++reads === 1) throw new Error("Consulta indisponível");
    return { estado: "concluida", negocio: BUSINESS };
  });
  const before = calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Verificar negócio" }));
  await screen.findByText("Consulta indisponível");
  expect(screen.getByLabelText("Nome do negócio").value).toBe("Studio novo");
  expect(screen.getByLabelText("Nome do negócio").disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Verificar negócio" }));
  await screen.findByRole("heading", { name: "Destino" });
  expect(calls.slice(before).every(call => !call.method)).toBe(true);
});
it("ausência confirmada permite corrigir dados conservando a chave contra um POST tardio", async () => {
  const calls = await lostCreation(() => ({ estado: "nao_encontrada" }));
  const key = calls.find(call => call.path === "/criar-negocio").headers["Idempotency-Key"];
  fireEvent.click(screen.getByRole("button", { name: "Verificar negócio" }));
  await screen.findByText(/Ainda não há negócio confirmado/);
  expect(screen.getByLabelText("Nome do negócio").disabled).toBe(false);
  fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: "Nome corrigido" } });
  fireEvent.click(screen.getByRole("button", { name: "Criar negócio" }));
  await screen.findByRole("button", { name: "Verificar negócio" });
  const writes = calls.filter(call => call.path === "/criar-negocio");
  expect(writes).toHaveLength(2); expect(writes[1].headers["Idempotency-Key"]).toBe(key);
  expect(writes[1].body.nome).toBe("Nome corrigido");
});
it.each([4, 9])("reload na conta %s revalida o escopo da referência", async account => {
  session.usuario = { id: account };
  apiRequest.mockResolvedValue({ estado: "concluida", negocio: BUSINESS });
  mount(`/criar-negocio?plano=studio${businessCreationReferenceHash("", { usuarioId: 4, key: KEY })}`);
  if (account === 4) {
    await screen.findByRole("heading", { name: "Destino" });
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest.mock.calls[0][1].headers["Idempotency-Key"]).toBe(KEY);
  } else {
    await screen.findByRole("heading", { name: "Crie seu negócio" });
    expect(apiRequest).not.toHaveBeenCalled(); expect(session.adoptCreatedBusiness).not.toHaveBeenCalled();
  }
});
it("tentativa encerrada não adota outro negócio nem libera novo POST", async () => {
  const calls = await lostCreation(() => { throw Object.assign(new Error("Negócio arquivado"), { status: 410 }); });
  fireEvent.click(screen.getByRole("button", { name: "Verificar negócio" }));
  await screen.findByRole("link", { name: "Voltar ao início" });
  expect(screen.getByRole("button", { name: "Verificar negócio" }).disabled).toBe(true);
  expect(session.adoptCreatedBusiness).not.toHaveBeenCalled();
  expect(calls.filter(call => call.method === "POST")).toHaveLength(1);
});
it("saída durante a recuperação cancela a consulta e não adota resposta atrasada", async () => {
  let finish;
  const calls = await lostCreation(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: "Verificar negócio" }));
  await act(() => router.navigate("/saida"));
  fireEvent.click(await screen.findByRole("button", { name: "Sair sem salvar" }));
  await screen.findByRole("heading", { name: "Destino" });
  expect(calls.find(call => call.path.endsWith("/tentativa")).signal.aborted).toBe(true);
  await act(async () => finish({ estado: "concluida", negocio: BUSINESS }));
  expect(session.adoptCreatedBusiness).not.toHaveBeenCalled(); expect(router.state.location.pathname).toBe("/saida");
});

it("mudar a query durante a restauração cancela a leitura e permite verificar com o novo plano", async () => {
  let finish; let signal; let calls = 0;
  apiRequest.mockImplementation(async (_path, options) => {
    if (++calls === 1) { signal = options.signal; return new Promise(resolve => { finish = resolve; }); }
    return { estado: "concluida", negocio: BUSINESS };
  });
  const hash = businessCreationReferenceHash("", { usuarioId: 4, key: KEY });
  mount(`/criar-negocio?plano=studio${hash}`);
  await screen.findByText("Carregando negócio...");
  await act(() => router.navigate(`/criar-negocio?plano=autonoma${hash}`));
  const verify = await screen.findByRole("button", { name: "Verificar negócio" });
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ estado: "concluida", negocio: BUSINESS }));
  expect(session.adoptCreatedBusiness).not.toHaveBeenCalled();
  fireEvent.click(verify);
  await screen.findByRole("heading", { name: "Destino" });
  expect(router.state.location.search).toBe("?onboarding=servico&plano=autonoma");
});

async function lostMedia(type, read, status) {
  const calls = []; let uncertain = false;
  apiRequest.mockImplementation(async (path, options = {}) => {
    calls.push({ path, ...options });
    if (options.method) { uncertain = true; throw Object.assign(new Error("Retorno de mídia perdido"), { status }); }
    if (uncertain) return read(path);
    if (path === "/servicos") return { servicos: [SERVICE] };
    if (path === "/servicos/12/fotos") return { fotos: [PHOTO1, PHOTO2] };
    throw new Error(`Request inesperada: ${path}`);
  });
  mount("/painel/servicos/12/editar");
  await screen.findByText("Capa atual");
  await waitFor(() => expect(screen.queryByText("Carregando fotos...")).toBeNull());
  fireEvent.change(screen.getByLabelText("Nome do serviço"), { target: { value: "Rascunho preservado" } });
  if (type === "choose") {
    fireEvent.change(screen.getByLabelText("Trocar capa"), { target: { files: [new File(["pending"], "pending.jpg", { type: "image/jpeg" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Usar como capa" }));
  } else fireEvent.click(screen.getAllByRole("button", { name: "Remover foto da galeria" })[0]);
  await screen.findByRole("button", { name: "Verificar fotos" });
  return calls;
}
function removedState(path) {
  if (path === "/servicos") return { servicos: [{ ...SERVICE, foto_url: null, foto_public_id: null }] };
  if (path === "/servicos/12/fotos") return { fotos: [PHOTO2] };
  throw new Error(`Request inesperada: ${path}`);
}
it.each([undefined, 404])("remoção com status %s exige GET de serviço e galeria, preservando o rascunho", async status => {
  const calls = await lostMedia("remove", removedState, status);
  expect(screen.getByLabelText("Nome do serviço").disabled).toBe(true);
  expect(screen.getAllByRole("button", { name: "Remover foto da galeria" }).every(button => button.disabled)).toBe(true);
  const before = calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Verificar fotos" }));
  await screen.findByText("Fotos conferidas. Você pode continuar editando.");
  expect(calls.slice(before).map(call => call.path)).toEqual(["/servicos", "/servicos/12/fotos"]);
  expect(calls.slice(before).every(call => !call.method)).toBe(true);
  expect(screen.getByLabelText("Nome do serviço").value).toBe("Rascunho preservado");
  expect(screen.queryByText("Capa atual")).toBeNull();
  expect(screen.getAllByRole("button", { name: "Remover foto da galeria" })).toHaveLength(1);
});
it("escolha incerta adota capa canônica e só descarta arquivo pendente quando a escolha foi confirmada", async () => {
  const calls = await lostMedia("choose", path => path === "/servicos"
    ? { servicos: [{ ...SERVICE, foto_url: PHOTO2.foto_url, foto_public_id: PHOTO2.foto_public_id }] }
    : { fotos: [PHOTO1, PHOTO2] });
  const before = calls.length;
  expect(screen.getByAltText("Prévia da nova capa")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Verificar fotos" }));
  await screen.findByText("Fotos conferidas. Você pode continuar editando.");
  expect(screen.queryByAltText("Prévia da nova capa")).toBeNull();
  expect(screen.getByAltText("Capa atual do serviço Rascunho preservado").getAttribute("src")).toBe(PHOTO2.foto_url);
  expect(calls.slice(before).every(call => !call.method)).toBe(true);
});
it("falha de leitura mantém as ações protegidas e cada nova tentativa continua só GET", async () => {
  let fail = true;
  const calls = await lostMedia("remove", path => {
    if (fail) throw new Error("Leitura indisponível");
    return removedState(path);
  });
  const before = calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Verificar fotos" }));
  await screen.findByText(/Leitura indisponível/);
  expect(screen.getByLabelText("Nome do serviço").disabled).toBe(true);
  fail = false; fireEvent.click(screen.getByRole("button", { name: "Verificar fotos" }));
  await screen.findByText("Fotos conferidas. Você pode continuar editando.");
  expect(calls.slice(before).every(call => !call.method)).toBe(true);
});
it("resposta incompleta da galeria não é tratada como ausência de fotos", async () => {
  await lostMedia("remove", path => path === "/servicos" ? { servicos: [SERVICE] } : {});
  fireEvent.click(screen.getByRole("button", { name: "Verificar fotos" }));
  await screen.findByText(/Não foi possível confirmar as fotos atuais/);
  expect(screen.getByLabelText("Nome do serviço").disabled).toBe(true);
  expect(screen.getAllByRole("button", { name: "Remover foto da galeria" })).toHaveLength(2);
});
it("saída cancela a conferência de mídia e descarta respostas antigas", async () => {
  const finish = [];
  const calls = await lostMedia("remove", path => new Promise(resolve => { finish.push(() => resolve(removedState(path))); }));
  const before = calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Verificar fotos" }));
  await act(() => router.navigate("/saida"));
  fireEvent.click(await screen.findByRole("button", { name: "Sair sem salvar" }));
  await screen.findByRole("heading", { name: "Destino" });
  expect(calls.slice(before).every(call => call.signal.aborted)).toBe(true);
  await act(async () => finish.forEach(resolve => resolve()));
  expect(router.state.location.pathname).toBe("/saida");
  expect(calls.filter(call => call.method)).toHaveLength(1);
});
