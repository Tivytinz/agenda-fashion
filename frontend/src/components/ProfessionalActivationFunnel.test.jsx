// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen
} from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it
} from "vitest";
import { ProfessionalActivationFunnel } from "./ProfessionalActivationFunnel";

afterEach(cleanup);

describe("ProfessionalActivationFunnel", () => {
  it("ordena os marcos conforme a jornada atual e destaca a pior transição comparável", () => {
    const { container } = render(
      <ProfessionalActivationFunnel
        summary={{
          cadastros: 20,
          negociosCriados: 12,
          servicosCriados: 10,
          negociosPublicados: 7,
          agendasConfiguradas: 2
        }}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "Marcos alcançados no período"
      })
    ).not.toBeNull();

    expect(screen.getByText("Prioridade atual")).not.toBeNull();
    expect(screen.getByText("Maior perda")).not.toBeNull();
    expect(
      screen.getByText("conduzir perfis publicados à confirmação da agenda")
    ).not.toBeNull();
    expect(
      screen.getByText("28.57% da etapa anterior")
    ).not.toBeNull();
    expect(
      screen.getByText(/5 profissional\(is\) ficaram pelo caminho/i)
    ).not.toBeNull();

    const etapas = Array.from(
      container.querySelectorAll("[data-stage]")
    ).map((element) => element.getAttribute("data-stage"));

    expect(etapas).toEqual([
      "cadastro",
      "negocio",
      "servico",
      "publicado",
      "agenda"
    ]);

    expect(
      container.querySelector('[data-stage="agenda"]')?.className
    ).toContain("is-bottleneck");
  });

  it("não inventa conversão quando um marco independente supera o anterior", () => {
    const { container } = render(
      <ProfessionalActivationFunnel
        summary={{
          cadastros: 20,
          negociosCriados: 12,
          servicosCriados: 5,
          negociosPublicados: 7,
          agendasConfiguradas: 4
        }}
      />
    );

    expect(screen.getByText("Marco independente")).not.toBeNull();
    expect(
      screen.getByText(/não exibimos uma conversão enganosa/i)
    ).not.toBeNull();
    expect(screen.getByText("Primeiro serviço")).not.toBeNull();

    expect(
      container.querySelector('[data-stage="servico"]')?.className
    ).toContain("is-bottleneck");
    expect(
      container.querySelector('[data-stage="publicado"]')?.className
    ).not.toContain("is-bottleneck");
  });

  it("trata a coorte vazia sem mostrar um falso gargalo ou uma falsa independência", () => {
    render(
      <ProfessionalActivationFunnel
        summary={{
          cadastros: 0,
          negociosCriados: 0,
          servicosCriados: 0,
          negociosPublicados: 0,
          agendasConfiguradas: 0
        }}
      />
    );

    expect(screen.getByText("Aguardando base")).not.toBeNull();
    expect(
      screen.getByText(/ainda não há cadastros profissionais/i)
    ).not.toBeNull();
    expect(screen.getAllByText("Sem base anterior").length).toBeGreaterThan(0);
    expect(screen.queryByText("Maior perda")).toBeNull();
    expect(screen.queryByText("Marco independente")).toBeNull();
  });
});
