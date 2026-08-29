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
  ProfessionalRecurrenceStabilityTable,
} from "./ProfessionalRecurrenceStabilityTable";

afterEach(cleanup);

describe(
  "ProfessionalRecurrenceStabilityTable",
  () => {
    it(
      "mostra faixa e variacao recente sem classificar tendencia",
      () => {
        render(
          <ProfessionalRecurrenceStabilityTable
            diagnosticos={[
              {
                janelaDias: 7,
                coortesComBase: 2,
                elegiveisTotal: 7,
                faixaTaxaSegundo: {
                  minimo: 50,
                  maximo: 66.67,
                  amplitudePp: 16.67,
                },
                faixaTaxaTerceiro: {
                  minimo: 25,
                  maximo: 33.33,
                  amplitudePp: 8.33,
                },
                variacaoRecenteSegundoPp: 16.67,
                variacaoRecenteTerceiroPp: -8.33,
                semanaMaisRecenteComBase:
                  "2026-08-18",
                semanaAnteriorComBase:
                  "2026-08-11",
              },
              {
                janelaDias: 30,
                coortesComBase: 0,
                elegiveisTotal: 0,
                faixaTaxaSegundo: {
                  minimo: null,
                  maximo: null,
                  amplitudePp: null,
                },
                faixaTaxaTerceiro: {
                  minimo: null,
                  maximo: null,
                  amplitudePp: null,
                },
                variacaoRecenteSegundoPp: null,
                variacaoRecenteTerceiroPp: null,
                semanaMaisRecenteComBase: null,
                semanaAnteriorComBase: null,
              },
            ]}
          />
        );

        expect(
          screen.getByRole("row", {
            name: "D7 2 7 50% a 66,67% (16,67 pp) +16,67 pp 25% a 33,33% (8,33 pp) -8,33 pp 18/08/2026 vs 11/08/2026"
          })
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: "D30 0 0 Sem base Sem comparação Sem base Sem comparação Sem base madura"
          })
        ).not.toBeNull();
        expect(
          screen.getByText(
            /não são classificados automaticamente como tendência, melhora ou piora/i
          )
        ).not.toBeNull();
      }
    );

    it(
      "trata lista vazia sem inventar comparacao",
      () => {
        render(
          <ProfessionalRecurrenceStabilityTable
            diagnosticos={[]}
          />
        );

        expect(
          screen.getByText(
            /ainda não há comparação entre coortes maduras/i
          )
        ).not.toBeNull();
      }
    );
  }
);
