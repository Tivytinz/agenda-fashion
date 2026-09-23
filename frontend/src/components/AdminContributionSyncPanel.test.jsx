// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen
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
import { AdminContributionSyncPanel } from "./AdminContributionSyncPanel";

vi.mock(
  "../api/client",
  () => ({
    apiRequest: vi.fn()
  })
);

beforeEach(() => {
  apiRequest.mockReset();
});

afterEach(cleanup);

describe(
  "AdminContributionSyncPanel",
  () => {
    it(
      "expõe estado vazio sem inventar adaptador factual",
      async () => {
        apiRequest
          .mockImplementation(
            async (path) => {
              if (
                path ===
                "/admin/financeiro/contribuicao/sync"
              ) {
                return {
                  agendamento: {
                    habilitado: false,
                    intervaloMinutos: 15
                  },
                  adaptadores: [],
                  integracoes: [],
                  execucoes: []
                };
              }

              if (
                path ===
                "/admin/financeiro/contribuicao"
              ) {
                return {
                  podeEditar: true,
                  fontes: []
                };
              }

              throw new Error(
                "request inesperado"
              );
            }
          );

        render(
          <AdminContributionSyncPanel />
        );

        expect(
          await screen.findByText(
            "Nenhum adaptador factual disponível nesta versão."
          )
        ).not.toBeNull();

        expect(
          screen.getByText(
            /custos não são inferidos de WhatsApp, e-mail, infraestrutura ou impostos/i
          )
        ).not.toBeNull();

        expect(
          screen.getByText(
            /Agendamento global: desativado/i
          )
        ).not.toBeNull();
      }
    );

    it(
      "mostra integração existente e saúde da última execução",
      async () => {
        apiRequest
          .mockImplementation(
            async (path) => {
              if (
                path ===
                "/admin/financeiro/contribuicao/sync"
              ) {
                return {
                  agendamento: {
                    habilitado: true,
                    intervaloMinutos: 15
                  },
                  adaptadores: [
                    {
                      codigo:
                        "provider_test",
                      nome:
                        "Provider Test",
                      disponivel: true
                    }
                  ],
                  integracoes: [
                    {
                      id: 3,
                      fonteId: 9,
                      fonteCodigo:
                        "mensageria_variavel",
                      fonteNome:
                        "Mensageria variável",
                      adaptador:
                        "provider_test",
                      adaptadorDisponivel:
                        true,
                      ativa: true,
                      intervaloMinutos:
                        60,
                      ultimoSucessoEm:
                        "2026-09-23T22:00:00.000Z",
                      ultimoErroDetalhe:
                        null
                    }
                  ],
                  execucoes: [
                    {
                      id: 44,
                      integracaoId: 3,
                      fonteNome:
                        "Mensageria variável",
                      fonteCodigo:
                        "mensageria_variavel",
                      status: "SUCESSO",
                      itensImportados: 2,
                      itensReplay: 1,
                      coberturaStatus:
                        "COMPLETA",
                      coberturaAte:
                        "2026-09-23",
                      finalizadoEm:
                        "2026-09-23T22:00:00.000Z"
                    }
                  ]
                };
              }

              return {
                podeEditar: false,
                fontes: [
                  {
                    id: 9,
                    nome:
                      "Mensageria variável",
                    ativa: true
                  }
                ]
              };
            }
          );

        render(
          <AdminContributionSyncPanel />
        );

        expect(
          await screen.findAllByText(
            "Mensageria variável"
          )
        ).toHaveLength(2);

        expect(
          screen.getByText(
            "provider_test"
          )
        ).not.toBeNull();

        expect(
          screen.getByText(
            "2 novos · 1 replay"
          )
        ).not.toBeNull();
      }
    );
  }
);
