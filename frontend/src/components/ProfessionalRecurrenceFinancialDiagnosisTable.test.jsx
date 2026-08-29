// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  ProfessionalRecurrenceFinancialDiagnosisTable,
} from "./ProfessionalRecurrenceFinancialDiagnosisTable";

afterEach(cleanup);

describe(
  "ProfessionalRecurrenceFinancialDiagnosisTable",
  () => {
    it(
      "mostra leitura parcial, bloqueio principal e evidência necessária sem recomendar orçamento",
      () => {
        render(
          <ProfessionalRecurrenceFinancialDiagnosisTable
            diagnostico={{
              campanhas: [
                {
                  chave: "campanha:10",
                  campanhaOficialId: "10",
                  campanha:
                    "google_ads_profissionais",
                  estado: {
                    codigo: "leitura_parcial",
                    rotulo: "Leitura parcial",
                  },
                  janelasDisponiveis: [7],
                  janelasBloqueadas: [14, 30],
                  bloqueioPrincipal: {
                    codigo:
                      "aguardando_gasto_maduro",
                    rotulo:
                      "Aguardando gasto maduro",
                    janelas: [14, 30],
                    evidenciaFaltante:
                      "Aguardar dias de gasto completarem a maturidade exigida pela janela analisada.",
                  },
                },
              ],
              resumo: {
                campanhas: 1,
                comLeituraCompleta: 0,
                comLeituraParcial: 1,
                bloqueadas: 0,
                bloqueios: [
                  {
                    codigo:
                      "aguardando_gasto_maduro",
                    categoria: "maturidade",
                    rotulo:
                      "Aguardando gasto maduro",
                    campanhas: 1,
                    ocorrenciasJanelas: 2,
                    evidenciaFaltante:
                      "Aguardar dias de gasto completarem a maturidade exigida pela janela analisada.",
                  },
                ],
              },
            }}
          />
        );

        expect(
          screen.getByRole("row", {
            name: /google_ads_profissionais Leitura parcial D7 D14, D30 Aguardando gasto maduro D14, D30/i,
          })
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: /Aguardando gasto maduro Maturidade 1 2/i,
          })
        ).not.toBeNull();
        expect(
          screen.getByText(
            /não ranqueia campanhas e não recomenda escalar, manter ou pausar orçamento/i
          )
        ).not.toBeNull();
      }
    );

    it(
      "mostra campanha integralmente disponível sem inventar bloqueio",
      () => {
        render(
          <ProfessionalRecurrenceFinancialDiagnosisTable
            diagnostico={{
              campanhas: [
                {
                  chave: "campanha:20",
                  campanha: "meta_profissionais",
                  estado: {
                    codigo:
                      "todas_janelas_disponiveis",
                    rotulo:
                      "Todas as janelas disponíveis",
                  },
                  janelasDisponiveis: [
                    7,
                    14,
                    30,
                  ],
                  janelasBloqueadas: [],
                  bloqueioPrincipal: null,
                },
              ],
              resumo: {
                campanhas: 1,
                comLeituraCompleta: 1,
                comLeituraParcial: 0,
                bloqueadas: 0,
                bloqueios: [],
              },
            }}
          />
        );

        expect(
          screen.getByRole("row", {
            name: /meta_profissionais Todas as janelas disponíveis D7, D14, D30 Nenhuma Nenhum bloqueio técnico Nenhuma/i,
          })
        ).not.toBeNull();
        expect(
          screen.getByText(
            /nenhum bloqueio técnico consolidado/i
          )
        ).not.toBeNull();
      }
    );

    it(
      "trata estado vazio sem criar diagnóstico artificial",
      () => {
        render(
          <ProfessionalRecurrenceFinancialDiagnosisTable />
        );

        expect(
          screen.getByText(
            /ainda não há campanhas com janelas de prontidão financeira/i
          )
        ).not.toBeNull();
      }
    );
  }
);
