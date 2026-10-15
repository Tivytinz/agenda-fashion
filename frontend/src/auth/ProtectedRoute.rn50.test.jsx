// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

let session;
vi.mock("./SessionContext", () => ({ useSession: () => session }));
afterEach(cleanup);

it.each([false, true])("RN50: link antigo da agenda abre reservas restritas com outro contexto ativo=%s", (owner) => {
  session = { loading: false, authenticated: true, temNegocio: owner, negocio: owner ? { papel: "dono" } : null, temReservasProfissionaisRestritas: true };
  render(<MemoryRouter initialEntries={["/profissional/agenda"]}><Routes>
    <Route path="/profissional/agenda" element={<ProtectedRoute businessRequired><h1>Agenda completa</h1></ProtectedRoute>} />
    <Route path="/reservas-existentes" element={<h1>Reservas restritas</h1>} />
    <Route path="/criar-negocio" element={<h1>Criar negócio</h1>} />
    <Route path="/painel" element={<h1>Painel</h1>} />
  </Routes></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Reservas restritas" })).not.toBeNull();
  expect(screen.queryByRole("heading", { name: "Agenda completa" })).toBeNull();
});
