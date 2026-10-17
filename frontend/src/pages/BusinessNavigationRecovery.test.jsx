// @vitest-environment jsdom
import { lazy, Suspense } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, Routes, Route } from "react-router-dom";
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
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((success, failure) => { resolve = success; reject = failure; });
  return { promise, resolve, reject };
}
let router;
function mount(mutation, destination) {
  const LazyDestination = lazy(() => destination.promise);
  apiRequest.mockImplementation(path => path === "/criar-negocio" ? mutation.promise : Promise.resolve(BUSINESS));
  // Match App's shared Suspense boundary: a slow destination retains the old page.
  function Shell() {
    return <Suspense fallback={<h1>Carregando destino</h1>}><Routes>
      <Route path="/criar-negocio" element={<BusinessPage create />} />
      <Route path="/planos" element={<LazyDestination />} />
      <Route path="*" element={<h1>Primeiro serviço</h1>} />
    </Routes></Suspense>;
  }
  router = createMemoryRouter([{ path: "*", element: <Shell /> }], { initialEntries: ["/criar-negocio"] });
  render(<RouterProvider router={router} />);
}
async function submitCreation() {
  fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: BUSINESS.nome } });
  fireEvent.click(screen.getByLabelText("Unhas"));
  fireEvent.change(screen.getByLabelText(/WhatsApp/), { target: { value: BUSINESS.whatsapp } });
  fireEvent.change(screen.getByLabelText(/Link do Google Maps/), { target: { value: BUSINESS.localizacao_url } });
  fireEvent.change(screen.getByLabelText(/CEP/), { target: { value: BUSINESS.cep } });
  await waitFor(() => expect(screen.getByLabelText("Endereço").value).toBe(BUSINESS.endereco));
  fireEvent.change(screen.getByLabelText("Número"), { target: { value: BUSINESS.numero } });
  fireEvent.click(screen.getByRole("button", { name: "Criar negócio", exact: true }));
  expect(apiRequest.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
}

beforeEach(() => {
  apiRequest.mockReset();
  session.refresh.mockReset().mockResolvedValue({});
  session.adoptCreatedBusiness.mockReset().mockReturnValue(true);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); router?.dispose(); });

describe("saída da criação durante carregamento da próxima página", () => {
  it.each(["sucesso", "erro"])("ignora %s depois da confirmação de saída, antes do unmount", async outcome => {
    const mutation = deferred();
    const destination = deferred();
    mount(mutation, destination);
    await submitCreation();
    await act(() => router.navigate("/planos"));
    fireEvent.click(await screen.findByRole("button", { name: "Sair sem salvar", exact: true }));
    expect(router.state.location.pathname).toBe("/planos");
    expect(screen.getByRole("heading", { name: "Crie seu negócio", hidden: true })).not.toBeNull();
    await act(async () => outcome === "sucesso"
      ? mutation.resolve({ negocio: BUSINESS }) : mutation.reject(new Error("Falha antiga")));
    expect(session.adoptCreatedBusiness).not.toHaveBeenCalled();
    expect(session.refresh).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/planos");
    await act(async () => destination.resolve({ default: () => <h1>Planos prontos</h1> }));
    await screen.findByRole("heading", { name: "Planos prontos" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Primeiro serviço" })).toBeNull();
  });

  it.each(["Continuar editando", "Escape"])("preserva a operação ao escolher %s", async choice => {
    const mutation = deferred();
    mount(mutation, deferred());
    await submitCreation();
    await act(() => router.navigate("/planos"));
    const dialog = await screen.findByRole("dialog", { name: "Sair sem salvar?" });
    if (choice === "Escape") fireEvent(dialog, new Event("cancel", { cancelable: true }));
    else fireEvent.click(screen.getByRole("button", { name: choice }));
    expect(router.state.location.pathname).toBe("/criar-negocio");
    await act(async () => mutation.resolve({ negocio: BUSINESS }));
    expect(session.adoptCreatedBusiness).toHaveBeenCalledWith(BUSINESS);
    expect(session.refresh).toHaveBeenCalledTimes(1);
    await screen.findByRole("heading", { name: "Primeiro serviço" });
  });
});
