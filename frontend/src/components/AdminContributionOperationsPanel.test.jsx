// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { apiRequest } from "../api/client";
import { AdminContributionOperationsPanel } from "./AdminContributionOperationsPanel";

vi.mock(
  "../api/client",
  () => ({
    apiRequest: vi.fn()
  })
);

const EMPTY = {
  inicioCobertura:
    "2026-09-23T22:00:00.000Z",
  podeEditar: true,
  fontes: [],
  custos: [],
  operacoes: []
};

beforeEach(() => {
  apiRequest.mockReset();
});

afterEach(cleanup);

describe(
  "AdminContributionOperationsPanel",
  () => {
    it(
      "não transforma ausência de fonte em custo zero",
      async () => {
        apiRequest
          .mockResolvedValue(EMPTY);

        render(
          <AdminContributionOperationsPanel />
        );

        expect(
          await screen.findByText(
            "Nenhuma fonte factual cadastrada."
          )
        ).not.toBeNull();

        expect(
          screen.getByText(
            /Margem, LTV de contribuição e retorno de contribuição permanecem indisponíveis/i
          )
        ).not.toBeNull();

        expect(
          screen.getByText(
            "Cadastrar fonte factual"
          )
        ).not.toBeNull();
      }
    );

    it(
      "mantém escrita oculta para admin sem permissão de superadmin",
      async () => {
        apiRequest
          .mockResolvedValue({
            ...EMPTY,
            podeEditar: false
          });

        render(
          <AdminContributionOperationsPanel />
        );

        expect(
          await screen.findByText(
            /restritos ao superadministrador no backend/i
          )
        ).not.toBeNull();

        expect(
          screen.queryByText(
            "Cadastrar fonte factual"
          )
        ).toBeNull();
      }
    );

    it(
      "cadastra fonte usando motivo explícito e recarrega o painel",
      async () => {
        let leituras = 0;

        apiRequest
          .mockImplementation(
            async (
              path,
              options = {}
            ) => {
              if (
                path ===
                "/admin/financeiro/contribuicao"
              ) {
                leituras += 1;

                return leituras === 1
                  ? EMPTY
                  : {
                      ...EMPTY,
                      fontes: [
                        {
                          id: 1,
                          codigo:
                            "mensageria_variavel",
                          nome:
                            "Mensageria variável",
                          categoria:
                            "comunicacao",
                          ativa: true,
                          obrigatoriaParaMargem:
                            true,
                          lancamentos: 0,
                          custoLiquidoObservado:
                            0
                        }
                      ]
                    };
              }

              if (
                path ===
                  "/admin/financeiro/contribuicao/fontes" &&
                options.method ===
                  "POST"
              ) {
                return {
                  fonte: {
                    id: 1
                  }
                };
              }

              throw new Error(
                "request inesperado"
              );
            }
          );

        render(
          <AdminContributionOperationsPanel />
        );

        const summary =
          await screen.findByText(
            "Cadastrar fonte factual"
          );
        fireEvent.click(summary);

        fireEvent.change(
          screen.getByLabelText(
            "Código imutável"
          ),
          {
            target: {
              value:
                "mensageria_variavel"
            }
          }
        );
        fireEvent.change(
          screen.getByLabelText(
            "Nome"
          ),
          {
            target: {
              value:
                "Mensageria variável"
            }
          }
        );
        fireEvent.change(
          screen.getByLabelText(
            "Categoria"
          ),
          {
            target: {
              value:
                "comunicacao"
            }
          }
        );
        fireEvent.change(
          screen.getByLabelText(
            "Motivo / evidência"
          ),
          {
            target: {
              value:
                "Contrato factual confirmado"
            }
          }
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Cadastrar fonte"
            }
          )
        );

        await waitFor(() => {
          expect(
            apiRequest
          ).toHaveBeenCalledWith(
            "/admin/financeiro/contribuicao/fontes",
            expect.objectContaining({
              method: "POST",
              body:
                expect.objectContaining({
                  codigo:
                    "mensageria_variavel",
                  motivo:
                    "Contrato factual confirmado"
                })
            })
          );
        });

        expect(
          await screen.findByText(
            "Mensageria variável"
          )
        ).not.toBeNull();
      }
    );
  }
);
