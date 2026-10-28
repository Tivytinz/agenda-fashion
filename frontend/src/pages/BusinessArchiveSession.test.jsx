// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiRequest, migrateLegacySession } from "../api/client";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { SessionProvider, useSession } from "../auth/SessionContext";
import { BusinessPage } from "./BusinessPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn(), migrateLegacySession: vi.fn() }));
const BUSINESS = {
  id: 11, papel: "dono", nome: "Studio Aurora", slug: "studio-aurora", areas: ["Unhas"],
  whatsapp: "11999999999", cidade: "São Paulo", estado: "SP", bairro: "Centro",
  endereco: "Rua das Flores", numero: "10", cep: "01001000", publicado: true,
};
let router;
function Home() {
  const session = useSession();
  return <><h1>Início</h1><output>{session.authenticated && !session.temNegocio ? "Conta ativa sem negócio operacional" : "Contexto inesperado"}</output></>;
}
beforeEach(() => {
  localStorage.setItem("session_active", "1");
  migrateLegacySession.mockResolvedValue({ attempted: false, migrated: false });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => { cleanup(); router?.dispose(); localStorage.clear(); vi.restoreAllMocks(); vi.clearAllMocks(); });

it("arquivamento com rascunho sai da rota protegida sem depender do refresh e sem reabrir Criar negócio", async () => {
  let reads = 0;
  apiRequest.mockImplementation(async (path) => {
    if (path === "/minha-sessao") {
      if (++reads > 1) throw Object.assign(new Error("Rede indisponível"), { status: 503 });
      return { usuario: { id: 4, nome: "Ana" }, negocio: BUSINESS, vinculos: [BUSINESS], temNegocio: true };
    }
    if (path === "/configuracoes") return { negocio: BUSINESS, publicacao: { publicado: true, pode_publicar: true } };
    if (path === "/negocio/encerrar") return { mensagem: "Negócio encerrado.", negocio: { id: 11, ativo: false, publicado: false } };
    throw new Error(`Request inesperada: ${path}`);
  });
  router = createMemoryRouter([{
    element: <SessionProvider><Outlet /></SessionProvider>,
    children: [
      { path: "/", element: <Home /> },
      { path: "/painel/negocio", element: <ProtectedRoute ownerOnly businessRequired><BusinessPage /></ProtectedRoute> },
      { path: "*", element: <h1>Destino incorreto</h1> },
    ],
  }], { initialEntries: ["/painel/negocio"] });
  render(<RouterProvider router={router} />);
  fireEvent.change(await screen.findByLabelText("Nome do negócio"), { target: { value: "Rascunho ainda não salvo" } });
  fireEvent.click(screen.getByRole("button", { name: "Encerrar negócio", exact: true }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  await screen.findByRole("heading", { name: "Início" });
  await waitFor(() => expect(reads).toBe(2));
  expect(screen.getByText("Conta ativa sem negócio operacional")).not.toBeNull();
  expect(router.state.location.pathname).toBe("/");
  expect(router.state.location.state.message).toBe("Negócio encerrado.");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(apiRequest.mock.calls.filter(([path]) => path === "/negocio/encerrar")).toHaveLength(1);
});
