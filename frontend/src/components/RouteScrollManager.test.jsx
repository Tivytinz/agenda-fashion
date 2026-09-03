// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteScrollManager } from "./RouteScrollManager";

function Harness() {
  return (
    <>
      <RouteScrollManager />
      <Link to="/destino">Próxima página</Link>
      <Link to="/perfil#agendar">Ir para agendamento</Link>
      <div id="agendar">Agendamento</div>
    </>
  );
}

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn()
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete HTMLElement.prototype.scrollIntoView;
  vi.restoreAllMocks();
});

describe("rolagem entre rotas", () => {
  it("volta ao topo quando o caminho muda", () => {
    render(
      <MemoryRouter initialEntries={["/origem"]}>
        <Harness />
      </MemoryRouter>
    );
    window.scrollTo.mockClear();

    fireEvent.click(screen.getByRole("link", { name: "Próxima página" }));

    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0 });
  });

  it("leva a pessoa ao destino indicado pelo hash", () => {
    render(
      <MemoryRouter initialEntries={["/perfil"]}>
        <Harness />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("link", { name: "Ir para agendamento" }));

    expect(document.getElementById("agendar").scrollIntoView)
      .toHaveBeenCalledWith({ block: "start" });
  });
});
