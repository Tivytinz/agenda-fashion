// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { serviceCreationReferenceHash } from "../utils/serviceCreationReference";
import { AuthPage } from "./AuthPage";
import { BusinessPage } from "./BusinessPage";
import { ServiceEditorPage } from "./ServicesPage";

const session = vi.hoisted(() => ({ refresh: vi.fn(), login: vi.fn() }));
vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: () => session }));
vi.mock("../components/GoogleLoginButton", () => ({ GoogleLoginButton: () => null }));
const KEY = "servico-retorno-autenticado-0001";
const BUSINESS = { id: 11, nome: "Studio antigo", slug: "studio-antigo", areas: ["Unhas"],
  whatsapp: "11999999999", cidade: "São Paulo", estado: "SP", bairro: "Centro", endereco: "Rua antiga", numero: "10", cep: "01001000" };
const NEW_BUSINESS = { ...BUSINESS, id: 22, nome: "Studio novo", slug: "studio-novo", endereco: "Rua nova" };
const SERVICE = { id: 12, nome: "Manicure", categoria: "unha", valor: 50, duracao_minutos: 60, ativo: true };
const PHOTO = { id: 71, foto_url: "https://images.example.test/confirmed.jpg", foto_public_id: "confirmed" };
const PUBLICATION = { publicado: true, pode_publicar: true, pendencias: [] };
let router;
function mount(entry) {
  router = createMemoryRouter([
    { path: "/painel/servicos/novo", element: <ProtectedRoute ownerOnly businessRequired><ServiceEditorPage /></ProtectedRoute> },
    { path: "/painel/servicos/:id/editar", element: <ServiceEditorPage /> },
    { path: "/painel/negocio", element: <BusinessPage /> },
    { path: "/entrar", element: <AuthPage /> },
    { path: "*", element: <h1>Destino</h1> },
  ], { initialEntries: [entry] });
  return render(<RouterProvider router={router} />);
}
beforeEach(() => {
  apiRequest.mockReset();
  Object.assign(session, { loading: false, authenticated: true, usuario: { id: 4 }, negocio: { id: 11, papel: "dono" }, temNegocio: true, vinculos: [] });
  session.refresh.mockReset().mockResolvedValue({}); session.login.mockReset();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); router?.dispose(); vi.restoreAllMocks(); });

it.each([4, 9])("login da conta %s preserva a referência e revalida seu escopo antes de recuperar", async accountId => {
  session.authenticated = false; session.usuario = session.negocio = null; session.temNegocio = false;
  session.login.mockImplementation(async () => {
    Object.assign(session, { authenticated: true, usuario: { id: accountId }, negocio: { id: accountId === 4 ? 11 : 22, papel: "dono" }, temNegocio: true });
    return session;
  });
  apiRequest.mockResolvedValue({ estado: "concluida", servico: SERVICE, publicacao: PUBLICATION });
  const hash = serviceCreationReferenceHash("", { usuarioId: 4, negocioId: 11, key: KEY });
  mount(`/painel/servicos/novo?onboarding=servico&plano=studio${hash}`);
  await screen.findByRole("heading", { name: "Entre no Agenda Fashion" });
  expect(router.state.location.state.from).toContain(hash);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "dona@example.test" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-de-teste" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar", exact: true }));
  if (accountId === 4) {
    await screen.findByRole("heading", { name: "Destino" });
    expect(router.state.location.pathname).toBe("/painel/horarios");
    expect(router.state.location.search).toBe("?plano=studio");
    expect(apiRequest.mock.calls[0][1].headers["Idempotency-Key"]).toBe(KEY);
  } else {
    await screen.findByRole("heading", { name: "Novo serviço" });
    expect(screen.getByLabelText("Nome do serviço").value).toBe("");
    expect(apiRequest).not.toHaveBeenCalled();
  }
});

it("resposta para outro negócio protege o rascunho e exige somente GET antes de outra escrita", async () => {
  let reads = 0; let writes = 0;
  apiRequest.mockImplementation(async (path, options = {}) => {
    if (path !== "/configuracoes") throw new Error(`Request inesperada: ${path}`);
    if (options.method === "PUT") {
      writes++;
      expect(options.headers["X-AF-Negocio"]).toBe(writes === 1 ? "11" : "22");
      return { negocio: { ...NEW_BUSINESS, nome: options.body.nome }, publicacao: PUBLICATION };
    }
    if (++reads === 2) throw new Error("Leitura indisponível");
    return { negocio: reads === 1 ? BUSINESS : NEW_BUSINESS, publicacao: PUBLICATION };
  });
  mount("/painel/negocio");
  fireEvent.change(await screen.findByLabelText("Nome do negócio"), { target: { value: "Rascunho do negócio antigo" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
  await screen.findByText(/O contexto do negócio mudou/);
  expect(screen.getByLabelText("Nome do negócio").value).toBe("Rascunho do negócio antigo");
  expect(screen.getByLabelText("Nome do negócio").disabled).toBe(true);
  expect(session.refresh).not.toHaveBeenCalled();
  fireEvent.submit(screen.getByLabelText("Nome do negócio").closest("form"));
  expect(writes).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Atualizar Meu negócio" }));
  await screen.findByText("Leitura indisponível");
  expect(screen.getByLabelText("Nome do negócio").disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Atualizar Meu negócio" }));
  await screen.findByDisplayValue("Studio novo");
  expect(screen.getByLabelText("Endereço").value).toBe("Rua nova");
  expect(writes).toBe(1);
  fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: "Alteração consciente no novo negócio" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
  await waitFor(() => expect(writes).toBe(2));
});

async function losePhotoResponse(lookup) {
  let key;
  const calls = [];
  apiRequest.mockImplementation(async (path, options = {}) => {
    calls.push({ path, ...options });
    if (path === "/servicos") return { servicos: [SERVICE] };
    if (path === "/servicos/12" && options.method === "PUT") return { servico: SERVICE };
    if (path === "/servicos/12/fotos/tentativa") {
      expect(options.headers["Idempotency-Key"]).toBe(key);
      return lookup();
    }
    if (path === "/servicos/12/fotos" && options.method === "POST") {
      key = options.headers["Idempotency-Key"];
      throw new Error("Resposta perdida depois de salvar a foto");
    }
    if (path === "/servicos/12/fotos") return { fotos: [] };
    throw new Error(`Request inesperada: ${path}`);
  });
  mount("/painel/servicos/12/editar");
  await screen.findByRole("heading", { name: "Editar serviço" });
  await waitFor(() => expect(screen.queryByText("Carregando fotos...")).toBeNull());
  fireEvent.change(screen.getByLabelText("Adicionar fotos à galeria"), { target: { files: [new File(["photo"], "manicure.jpg", { type: "image/jpeg" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar serviço" }));
  await screen.findByRole("button", { name: "Verificar fotos" });
  return calls;
}

it("a verificação recupera a foto confirmada sem repetir PUT nem upload", async () => {
  const calls = await losePhotoResponse(() => ({ estado: "concluida", foto: PHOTO }));
  expect(screen.getByLabelText("Nome do serviço").disabled).toBe(true);
  const previous = calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Verificar fotos" }));
  await screen.findByText(/Fotos conferidas/);
  expect(calls.slice(previous).map(call => call.path)).toEqual(["/servicos/12/fotos/tentativa"]);
  expect(screen.queryByText("1 foto selecionada.")).toBeNull();
  expect(screen.getByAltText("Foto da galeria de Manicure").getAttribute("src")).toBe(PHOTO.foto_url);
});

it("falha na consulta continua protegendo o envio e a nova tentativa faz somente GET", async () => {
  let reads = 0;
  const calls = await losePhotoResponse(() => {
    if (++reads === 1) throw Object.assign(new Error("Consulta indisponível"), { status: 503 });
    return { estado: "concluida", foto: PHOTO };
  });
  const previous = calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Verificar fotos" }));
  await screen.findByText(/Consulta indisponível/);
  expect(screen.getByLabelText("Adicionar fotos à galeria").disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Verificar fotos" }));
  await screen.findByText(/Fotos conferidas/);
  expect(calls.slice(previous).every(call => !call.method)).toBe(true);
});

it("foto removida durante a incerteza sai da seleção sem recriação", async () => {
  const calls = await losePhotoResponse(() => { throw Object.assign(new Error("Foto removida"), { status: 410 }); });
  fireEvent.click(screen.getByRole("button", { name: "Verificar fotos" }));
  await screen.findByText(/A foto foi removida e não será reenviada/);
  expect(screen.queryByText("1 foto selecionada.")).toBeNull();
  expect(calls.filter(call => call.method === "POST")).toHaveLength(1);
});

it("sair durante a verificação invalida a resposta de fotos", async () => {
  let finish;
  const calls = await losePhotoResponse(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: "Verificar fotos" }));
  await act(() => router.navigate("/saida"));
  fireEvent.click(await screen.findByRole("button", { name: "Sair sem salvar" }));
  await screen.findByRole("heading", { name: "Destino" });
  expect(calls.find(call => call.path.endsWith("/fotos/tentativa")).signal.aborted).toBe(true);
  await act(async () => { finish({ estado: "concluida", foto: PHOTO }); });
  expect(router.state.location.pathname).toBe("/saida");
  expect(calls.filter(call => call.method === "POST")).toHaveLength(1);
});
