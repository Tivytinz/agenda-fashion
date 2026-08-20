// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { ProfessionalOnboardingChecklist } from "./ProfessionalOnboardingChecklist";

afterEach(cleanup);

function renderChecklist(overrides = {}) {
  return render(
    <MemoryRouter>
      <ProfessionalOnboardingChecklist
        businessSlug="studio-victor"
        loading={false}
        publication={{
          publicado: false,
          pode_publicar: false,
          pendencias: ["descrição", "pelo menos um serviço ativo"]
        }}
        {...overrides}
      />
    </MemoryRouter>
  );
}

describe("onboarding profissional", () => {
  it("leva a profissional para a primeira etapa incompleta", () => {
    renderChecklist();

    expect(screen.getByText("0 de 3")).not.toBeNull();
    expect(screen.getByText("Falta: descrição.")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Completar perfil" })
      .getAttribute("href")).toBe("/painel/negocio");
  });

  it("prioriza o primeiro serviço depois que o perfil está completo", () => {
    renderChecklist({
      publication: {
        publicado: false,
        pode_publicar: false,
        pendencias: ["pelo menos um serviço ativo"]
      }
    });

    expect(screen.getByText("1 de 3")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Cadastrar serviço" })
      .getAttribute("href")).toBe("/painel/servicos/novo");
  });

  it("celebra a ativação e oferece o perfil público", () => {
    renderChecklist({
      publication: {
        publicado: true,
        pode_publicar: true,
        pendencias: []
      }
    });

    expect(screen.getByText("3 de 3")).not.toBeNull();
    expect(screen.getByRole("heading", {
      name: "Seu negócio está pronto para crescer"
    })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Ver meu perfil público" })
      .getAttribute("href")).toBe("/negocio/studio-victor");
  });
});
