// @vitest-environment jsdom
import { StrictMode, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { SetupFlowProvider, useSetupFocus } from "./SetupFlowContext";
import { SetupFlowFrame } from "./SetupFlowFrame";
import { OwnerShell } from "./OwnerShell";

vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({ negocio: { papel: "dono", nome: "Studio Aurora", slug: "studio-aurora" } })
}));

afterEach(cleanup);

function Draft() {
  const [name, setName] = useState("");
  return <SetupFlowFrame step={3}><main>
    <h1>Novo serviço</h1>
    <label>Nome<input onChange={(e) => setName(e.target.value)} value={name} /></label>
  </main></SetupFlowFrame>;
}

it("preserva o formulário ao focar o cadastro e restaura a navegação ao sair", () => {
  render(<StrictMode><MemoryRouter initialEntries={["/novo"]}>
    <SetupFlowProvider>
      <Routes>
        <Route element={<OwnerShell links={[["/", "Visão geral", "home"]]} />}>
          <Route path="/novo" element={<Draft />} />
          <Route path="/" element={<h1>Painel</h1>} />
        </Route>
      </Routes>
    </SetupFlowProvider>
  </MemoryRouter></StrictMode>);

  expect(screen.queryByRole("navigation", { name: "Área de trabalho" })).toBeNull();
  expect(screen.queryByLabelText("Abrir minha conta")).toBeNull();
  expect(screen.getAllByLabelText("Etapa 3 de 4: Serviço")).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Manicure" } });
  expect(screen.getByLabelText("Nome").value).toBe("Manicure");
  fireEvent.click(screen.getByRole("link", { name: "Sair", exact: true }));
  expect(screen.getByRole("heading", { name: "Painel" })).not.toBeNull();
  expect(screen.getByLabelText("Abrir minha conta")).not.toBeNull();
  expect(screen.queryByLabelText("Etapa 3 de 4: Serviço")).toBeNull();
});

function LoadingShell() {
  const focused = useSetupFocus();
  return <>{!focused && <nav aria-label="Navegação geral" />}<main>Carregando cadastro...</main></>;
}

it("oferece links Voltar e Sair distintos na segunda etapa quando configurados", () => {
  render(<MemoryRouter initialEntries={["/criar-negocio"]}>
    <SetupFlowFrame backTo="/conta" exitTo="/" step={2}>
      <main>Cadastro do negócio</main>
    </SetupFlowFrame>
  </MemoryRouter>);
  expect(screen.getByRole("link", { name: "Voltar" }).getAttribute("href")).toBe("/conta");
  expect(screen.getByRole("link", { name: "Sair" }).getAttribute("href")).toBe("/");
});

it.each([
  ["/cadastro?tipo=profissional", false],
  ["/cadastro", true]
])("preserva o contexto correto durante o carregamento de %s", (path, hasNavigation) => {
  render(<MemoryRouter initialEntries={[path]}><SetupFlowProvider><LoadingShell /></SetupFlowProvider></MemoryRouter>);
  expect(Boolean(screen.queryByRole("navigation", { name: "Navegação geral" }))).toBe(hasNavigation);
  expect(screen.getByText("Carregando cadastro...")).not.toBeNull();
});
