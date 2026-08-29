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
import { ProfessionalPostAgendaFunnel } from "./ProfessionalPostAgendaFunnel";

afterEach(cleanup);

describe("ProfessionalPostAgendaFunnel", () => {
  it("mostra a progressão estrita entre agenda, divulgação, visita, início e primeiro agendamento", () => {
    render(
      <ProfessionalPostAgendaFunnel
        summary={{
          agendasConfiguradas: 8,
          perfisDivulgados: 6,
          visitasPosDivulgacao: 4,
          agendamentosIniciadosPosDivulgacao: 3,
          primeirosAgendamentosJornada: 2,
          taxaDivulgacaoPosAgenda: 75,
          taxaVisitaPosDivulgacao: 66.67,
          taxaInicioPosVisita: 75,
          taxaConclusaoPosInicio: 66.67
        }}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "Da divulgação ao agendamento"
      })
    ).not.toBeNull();
    expect(
      screen.getByRole("row", {
        name: "Agendas configuradas 8 100% 100%"
      })
    ).not.toBeNull();
    expect(
      screen.getByRole("row", {
        name: "Perfil divulgado 6 75% 75%"
      })
    ).not.toBeNull();
    expect(
      screen.getByRole("row", {
        name: "Visita após divulgação 4 50% 66.67%"
      })
    ).not.toBeNull();
    expect(
      screen.getByRole("row", {
        name: "Agendamento iniciado 3 37.5% 75%"
      })
    ).not.toBeNull();
    expect(
      screen.getByRole("row", {
        name: "Primeiro agendamento da jornada 2 25% 66.67%"
      })
    ).not.toBeNull();
    expect(
      screen.getByText(/jornada completa já aparece na coorte/i)
    ).not.toBeNull();
    expect(
      screen.getByText(/ordem temporal, não prova que a visita veio do link/i)
    ).not.toBeNull();
  });

  it("aponta divulgação como primeiro gargalo quando a agenda está pronta e não houve compartilhamento", () => {
    render(
      <ProfessionalPostAgendaFunnel
        summary={{
          agendasConfiguradas: 5,
          perfisDivulgados: 0
        }}
      />
    );

    expect(
      screen.getByText(/primeiro gargalo está na divulgação/i)
    ).not.toBeNull();
    expect(
      screen.getByRole("row", {
        name: "Perfil divulgado 0 0% 0%"
      })
    ).not.toBeNull();
  });
});
