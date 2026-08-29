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
          pendencias: ["pelo menos um serviço ativo"]
        }}
        scheduleConfigured={false}
        {...overrides}
      />
    </MemoryRouter>
  );
}

describe("onboarding profissional", () => {
  it("leva a profissional para a primeira etapa incompleta", () => {
    renderChecklist();

    expect(screen.getByText("1 de 4")).not.toBeNull();
    expect(screen.getByText("Nome, contato e localização estão prontos.")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Cadastrar serviço" })
      .getAttribute("href")).toBe("/painel/servicos/novo");
  });

  it("prioriza o primeiro serviço depois que o perfil está completo", () => {
    renderChecklist({
      publication: {
        publicado: false,
        pode_publicar: false,
        pendencias: ["pelo menos um serviço ativo"]
      }
    });

    expect(screen.getByText("1 de 4")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Cadastrar serviço" })
      .getAttribute("href")).toBe("/painel/servicos/novo");
  });

  it("continua o onboarding depois que o perfil é publicado", () => {
    renderChecklist({
      publication: {
        publicado: true,
        pode_publicar: true,
        pendencias: []
      },
      scheduleConfigured: false
    });

    expect(screen.getByText("3 de 4")).not.toBeNull();
    expect(screen.getByText(/Seu perfil está no ar/)).not.toBeNull();
    expect(screen.getByRole("link", { name: "Configurar horários" })
      .getAttribute("href")).toBe("/painel/horarios");
  });

  it("celebra a ativação só depois que os horários foram configurados", () => {
    renderChecklist({
      publication: {
        publicado: true,
        pode_publicar: true,
        pendencias: []
      },
      scheduleConfigured: true
    });

    expect(screen.getByText("4 de 4")).not.toBeNull();
    expect(screen.getByRole("heading", {
      name: "Seu negócio está pronto para receber clientes"
    })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Ver meu perfil público" })
      .getAttribute("href")).toBe("/negocio/studio-victor");
  });
});
