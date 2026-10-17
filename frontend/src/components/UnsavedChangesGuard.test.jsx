// @vitest-environment jsdom

import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, Link, RouterProvider, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnsavedChangesGuard } from "./UnsavedChangesGuard";

let router;

function Draft({ onDiscard }) {
  const [dirty, setDirty] = useState(false);
  const navigate = useNavigate();
  return <>
    <UnsavedChangesGuard when={dirty} onDiscard={onDiscard} />
    <h1>Rascunho</h1>
    <button onClick={() => setDirty(true)}>Editar</button>
    <button onClick={() => setDirty(false)}>Salvar</button>
    <button onClick={() => navigate(-1)}>Voltar</button>
    <Link to="/destino">Abrir destino</Link>
  </>;
}

function renderDraft(initialEntries = ["/rascunho"], onDiscard) {
  router = createMemoryRouter([
    { path: "/rascunho", element: <Draft onDiscard={onDiscard} /> },
    { path: "/destino", element: <h1>Destino</h1> }
  ], { initialEntries });
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
});
afterEach(() => {
  cleanup();
  router?.dispose();
});

describe("proteção de alterações não salvas", () => {
  it("invalida antes de liberar a saída explícita, preservando Continuar e Escape", async () => {
    const onDiscard = vi.fn(() => expect(router.state.location.pathname).toBe("/rascunho"));
    renderDraft(["/rascunho"], onDiscard);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("link", { name: "Abrir destino" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(onDiscard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Abrir destino" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onDiscard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Abrir destino" }));
    fireEvent.click(screen.getByRole("button", { name: "Sair sem salvar" }));
    await screen.findByRole("heading", { name: "Destino" });
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("a conclusão do salvamento libera navegação sem sinalizar descarte", async () => {
    const onDiscard = vi.fn();
    renderDraft(["/rascunho"], onDiscard);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("link", { name: "Abrir destino" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await screen.findByRole("heading", { name: "Destino" });
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("permite sair de um formulário sem alterações", async () => {
    renderDraft();
    fireEvent.click(screen.getByRole("link", { name: "Abrir destino" }));
    await screen.findByRole("heading", { name: "Destino" });
  });

  it("permite continuar editando e descartar somente por escolha explícita", async () => {
    renderDraft();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("link", { name: "Abrir destino" }));
    await screen.findByRole("dialog", { name: "Sair sem salvar?" });
    expect(router.state.location.pathname).toBe("/rascunho");
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Abrir destino" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Sair sem salvar" }));
    await screen.findByRole("heading", { name: "Destino" });
  });

  it("intercepta voltar no histórico e permite retomar essa navegação", async () => {
    renderDraft(["/destino", "/rascunho"]);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(router.state.location.pathname).toBe("/rascunho");
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Sair sem salvar" }));
    await screen.findByRole("heading", { name: "Destino" });
  });

  it("mantém unload protegido até salvar e depois permite navegar", async () => {
    renderDraft();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const beforeSave = new Event("beforeunload", { cancelable: true });
    expect(window.dispatchEvent(beforeSave)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);
    fireEvent.click(screen.getByRole("link", { name: "Abrir destino" }));
    await screen.findByRole("heading", { name: "Destino" });
  });

  it("não bloqueia state ou hash, mas protege mudança de query", async () => {
    renderDraft();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    await act(() => router.navigate("/rascunho#detalhes", { state: { message: "Aviso" } }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(() => router.navigate("/rascunho?profissional=2"));
    await screen.findByRole("dialog");
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(router.state.location.search).toBe("");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
