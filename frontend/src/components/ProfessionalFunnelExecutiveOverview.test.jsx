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
import {
  buildActivationMilestones,
  ProfessionalFunnelExecutiveOverview
} from "./ProfessionalFunnelExecutiveOverview";

afterEach(cleanup);

describe("ProfessionalFunnelExecutiveOverview", () => {
  it("ordena publicação antes da agenda e destaca a menor cobertura", () => {
    const summary = {
      cadastros: 20,
      negociosCriados: 16,
      servicosCriados: 12,
      negociosPublicados: 10,
      agendasConfiguradas: 4,
      taxaNegocio: 80,
      taxaServico: 60,
      taxaPublicacao: 50,
      taxaAgenda: 20
    };

    const etapas = buildActivationMilestones(summary);

    expect(etapas.map((etapa) => etapa.label)).toEqual([
      "Cadastro",
      "Negócio criado",
      "Serviço criado",
      "Negócio publicado",
      "Agenda configurada"
    ]);

    render(
      <ProfessionalFunnelExecutiveOverview summary={summary} />
    );

    expect(
      screen.getByRole("heading", {
        name: "Onde a ativação está parando"
      })
    ).not.toBeNull();
    expect(
      screen.getByText("Menor cobertura: Agenda configurada")
    ).not.toBeNull();
    expect(
      screen.getByText(/4 de 20 profissionais alcançaram este marco/)
    ).not.toBeNull();
    expect(screen.getByText("Menor cobertura")).not.toBeNull();
  });

  it("não inventa gargalo quando não há cadastros", () => {
    render(
      <ProfessionalFunnelExecutiveOverview summary={{}} />
    );

    expect(
      screen.getByText("Sem base para priorizar")
    ).not.toBeNull();
    expect(
      screen.queryByText("Menor cobertura")
    ).toBeNull();
  });

  it("encaminha a análise para pós-agenda quando toda ativação está completa", () => {
    render(
      <ProfessionalFunnelExecutiveOverview
        summary={{
          cadastros: 5,
          negociosCriados: 5,
          servicosCriados: 5,
          negociosPublicados: 5,
          agendasConfiguradas: 5
        }}
      />
    );

    expect(
      screen.getByText("Ativação completa na coorte")
    ).not.toBeNull();
    expect(
      screen.getByText(/divulgação, primeiro agendamento e recorrência/)
    ).not.toBeNull();
  });
});
