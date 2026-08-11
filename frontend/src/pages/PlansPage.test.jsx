// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { PlansPage } from "./BillingPages";

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
});
