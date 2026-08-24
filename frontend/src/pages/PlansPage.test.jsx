// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { PlansPage } from "./PlansPage";

let sessionState;

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../auth/SessionContext", () => ({
  useSession: () => sessionState
}));

const PLANS = [
  { id: 1, slug: "gratis", nome: "Grátis", valor: 0 },
  { id: 2, slug: "autonoma", nome: "Autônoma", valor: 49.9 }
];

function renderPage() {
  return render(
    <MemoryRouter>
      <PlansPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue({ planos: PLANS });
});

afterEach(cleanup);

describe("continuidade do plano", () => {
  it("preserva o plano pago no cadastro profissional", async () => {
    sessionState = {
      authenticated: false,
      temNegocio: false,
      negocio: null
    };

    renderPage();

    expect((await screen.findByRole("link", { name: "Escolher plano" }))
      .getAttribute("href")).toBe("/cadastro?tipo=profissional&plano=autonoma");
    expect(screen.getByRole("link", { name: "Começar grátis" })
      .getAttribute("href")).toBe("/cadastro?tipo=profissional");
  });

  it("leva conta sem negócio ao onboarding sem perder o plano", async () => {
    sessionState = {
      authenticated: true,
      temNegocio: false,
      negocio: null
    };

    renderPage();

    expect((await screen.findByRole("link", { name: "Escolher plano" }))
      .getAttribute("href")).toBe("/criar-negocio?plano=autonoma");
  });

  it("não oferece checkout de proprietária para uma profissional", async () => {
    sessionState = {
      authenticated: true,
      temNegocio: true,
      negocio: { papel: "profissional" }
    };

    renderPage();

    expect((await screen.findByRole("link", { name: "Escolher plano" }))
      .getAttribute("href")).toBe("/profissional/agenda");
  });

  it("marca como escolhido o plano pago sem tratá-lo como plano atual", async () => {
    sessionState = {
      authenticated: true,
      temNegocio: true,
      negocio: { papel: "dono" }
    };
    apiRequest.mockImplementation((path) => {
      if (path === "/planos") return Promise.resolve({ planos: PLANS });
      if (path === "/meu-plano") {
        return Promise.resolve({
          plano_id: 1,
          plano_slug: "gratis",
          plano_selecionado_id: 2,
          plano_selecionado_slug: "autonoma",
          assinatura_ativa_id: null
        });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderPage();

    const autonoma = (await screen.findByRole("heading", { name: "Autônoma" })).closest("article");
    const gratis = screen.getByRole("heading", { name: "Grátis" }).closest("article");

    expect(within(gratis).getByText("✓ Plano atual")).not.toBeNull();
    expect(within(autonoma).queryByText("✓ Plano atual")).toBeNull();
    expect(within(autonoma).getByText("Escolhido")).not.toBeNull();
    expect(autonoma.classList.contains("selected-pending")).toBe(true);
    expect(within(autonoma).getByRole("link", { name: "Assinar Autônoma" })
      .getAttribute("href")).toBe("/checkout?plano=autonoma");
  });

  it("marca o plano pago como atual após a assinatura ficar ativa", async () => {
    sessionState = {
      authenticated: true,
      temNegocio: true,
      negocio: { papel: "dono" }
    };
    apiRequest.mockImplementation((path) => {
      if (path === "/planos") return Promise.resolve({ planos: PLANS });
      if (path === "/meu-plano") {
        return Promise.resolve({
          plano_id: 2,
          plano_slug: "autonoma",
          plano_selecionado_id: 2,
          plano_selecionado_slug: "autonoma",
          assinatura_ativa_id: 91
        });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderPage();

    const autonoma = (await screen.findByRole("heading", { name: "Autônoma" })).closest("article");

    expect(within(autonoma).getByText("✓ Plano atual")).not.toBeNull();
    expect(within(autonoma).queryByText("Escolhido")).toBeNull();
    expect(within(autonoma).queryByRole("link", { name: "Assinar Autônoma" })).toBeNull();
  });
});
