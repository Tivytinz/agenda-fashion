/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"http://localhost/html/dashboard-dono.html"}
 */

jest.setTimeout(20000);

const fs = require("fs");
const path = require("path");

/*
 * O teste resolve o JavaScript a partir da mesma estrutura usada
 * pelo HTML real:
 *
 * agendamento-nails/html/dashboard-dono.html
 * agendamento-nails/js/dashboard-dono.js
 */
const CAMINHO_HTML = path.resolve(
  __dirname,
  "../agendamento-nails/html/dashboard-dono.html"
);

const CAMINHO_SCRIPT = path.resolve(
  path.dirname(CAMINHO_HTML),
  "../js/dashboard-dono.js"
);

let listenersJanela = [];

function montarHtml() {
  document.body.innerHTML = `
    <main
      id="dashboardDonoPage"
      class="dashboard-dono-page"
      aria-busy="true"
    >
      <div id="nomeNegocio">Dashboard do negócio</div>
      <p id="mensagemDashboard" class="mensagem-dashboard"></p>

      <select id="filtroPeriodo">
        <option value="hoje">Hoje</option>
        <option value="7dias" selected>Últimos 7 dias</option>
        <option value="30dias">Últimos 30 dias</option>
        <option value="mes">Mês atual</option>
      </select>

      <button id="btnAtualizarDashboard" type="button">
        Atualizar
      </button>

      <strong id="agendamentosHoje">0</strong>
      <strong id="agendamentosPeriodo">0</strong>
      <strong id="faturamentoHoje">R$ 0,00</strong>
      <strong id="faturamentoPeriodo">R$ 0,00</strong>
      <strong id="clientesNovos">0</strong>
      <strong id="clientesRecorrentes">0</strong>
      <strong id="servicosVendidos">0</strong>
      <strong id="ticketMedio">R$ 0,00</strong>

      <strong id="visitasPerfil">0</strong>
      <strong id="cliquesWhatsapp">0</strong>
      <strong id="cliquesMaps">0</strong>
      <strong id="favoritosRecebidos">0</strong>
      <strong id="taxaConversao">0%</strong>

      <div id="listaResumoDias"></div>
      <div id="rankingProfissionais"></div>
      <div id="rankingServicos"></div>
      <div id="rankingClientes"></div>

      <strong id="planoNome">Carregando...</strong>
      <small id="planoValor">-</small>
      <strong id="planoUso">0 agendamentos</strong>
      <small id="planoRestantes">-</small>
      <strong id="planoPercentual">0%</strong>

      <div
        id="planoProgresso"
        role="progressbar"
        aria-valuenow="0"
      >
        <div id="planoBarra"></div>
      </div>

      <p id="planoMensagem"></p>

      <button
        id="btnUpgradePlano"
        class="hidden"
        type="button"
      >
        Gerenciar assinatura
      </button>
    </main>
  `;
}

function criarRespostaJson(status, corpo) {
  return {
    status,

    ok:
      status >= 200 &&
      status < 300,

    headers: {
      get: jest.fn(
        () =>
          "application/json; charset=utf-8"
      ),
    },

    json:
      jest
        .fn()
        .mockResolvedValue(corpo),
  };
}

function criarPlano(
  alteracoes = {}
) {
  return {
    plano_nome:
      "Profissional",

    valor:
      "49.90",

    capacidade_agendamentos:
      100,

    utilizados:
      80,

    ilimitado:
      false,

    ...alteracoes,
  };
}

function criarDashboard(
  alteracoes = {}
) {
  return {
    periodo:
      "7dias",

    negocio: {
      negocio_id:
        11,

      nome:
        "Studio Fashion",

      slug:
        "studio-fashion",

      papel:
        "dono",
    },

    resumo: {
      agendamentos_hoje:
        3,

      agendamentos_periodo:
        6,

      faturamento_hoje:
        300,

      faturamento_periodo:
        600,

      clientes_novos:
        5,

      clientes_recorrentes:
        2,

      servicos_vendidos:
        6,

      ticket_medio:
        100,
    },

    performance: {
      visitas_perfil:
        24,

      cliques_whatsapp:
        10,

      cliques_maps:
        4,

      favoritos_recebidos:
        8,

      taxa_conversao:
        25,
    },

    resumo_dias: [
      {
        data:
          "14/07",

        agendamentos:
          3,

        faturamento:
          300,
      },

      {
        data:
          "15/07",

        agendamentos:
          3,

        faturamento:
          300,
      },
    ],

    ranking_profissionais: [
      {
        id:
          7,

        nome:
          "Juliana",

        total:
          4,

        faturamento:
          400,
      },
    ],

    ranking_servicos: [
      {
        id:
          5,

        nome:
          "Alongamento em gel",

        total:
          4,

        faturamento:
          480,
      },
    ],

    ranking_clientes: [
      {
        id:
          30,

        nome:
          "Maria",

        total:
          3,

        faturamento:
          360,
      },
    ],

    ...alteracoes,
  };
}

function configurarFetch({
  planoStatus = 200,

  plano =
    criarPlano(),

  planoFallbackStatus =
    200,

  planoFallback =
    plano,

  dashboardStatus =
    200,

  dashboard =
    criarDashboard(),
} = {}) {
  const fetchMock =
    jest.fn(
      async (url) => {
        const endereco =
          String(url);

        if (
          endereco.endsWith(
            "/api/meu-plano"
          )
        ) {
          return criarRespostaJson(
            planoStatus,

            planoStatus === 200
              ? plano
              : {
                  erro:
                    planoStatus ===
                    401
                      ? "Sessão expirada."
                      : "Plano não encontrado",
                }
          );
        }

        if (
          endereco.endsWith(
            "/meu-plano"
          )
        ) {
          return criarRespostaJson(
            planoFallbackStatus,

            planoFallbackStatus ===
            200
              ? planoFallback
              : {
                  erro:
                    "Plano não encontrado",
                }
          );
        }

        if (
          endereco.includes(
            "/dashboard-dono?periodo="
          )
        ) {
          return criarRespostaJson(
            dashboardStatus,

            dashboardStatus ===
            200
              ? dashboard
              : {
                  erro:
                    dashboardStatus ===
                    401
                      ? "Sessão expirada."
                      : dashboardStatus ===
                          403
                        ? "Apenas o dono pode acessar este dashboard."
                        : "Erro ao carregar dashboard.",
                }
          );
        }

        throw new Error(
          `URL não simulada no teste: ${endereco}`
        );
      }
    );

  global.fetch =
    fetchMock;

  window.fetch =
    fetchMock;

  return fetchMock;
}

function definirApiUrl(
  valor =
    "https://api.teste/"
) {
  globalThis.API_URL =
    valor;

  window.API_URL =
    valor;
}

function configurarServicosDeSessao() {
  window.AuthService = {
    getToken:
      jest.fn(
        () =>
          localStorage.getItem(
            "token"
          )
      ),

    limparSessao:
      jest.fn(
        () => {
          localStorage.removeItem(
            "token"
          );

          localStorage.removeItem(
            "usuario"
          );

          localStorage.removeItem(
            "negocio"
          );
        }
      ),

    salvarNegocio:
      jest.fn(
        (negocio) => {
          localStorage.setItem(
            "negocio",
            JSON.stringify(
              negocio
            )
          );
        }
      ),
  };

  window.SessionGuard = {
    exigirDono:
      jest
        .fn()
        .mockResolvedValue({
          usuario: {
            id:
              1,

            nome:
              "Victor",
          },

          negocio: {
            id:
              11,

            negocio_id:
              11,

            nome:
              "Studio Fashion",

            slug:
              "studio-fashion",

            papel:
              "dono",
          },
        }),
  };
}

function resolverInicializador() {
  if (
    !fs.existsSync(
      CAMINHO_HTML
    )
  ) {
    throw new Error(
      `HTML do dashboard não encontrado em: ${CAMINHO_HTML}`
    );
  }

  if (
    !fs.existsSync(
      CAMINHO_SCRIPT
    )
  ) {
    throw new Error(
      `Script do dashboard não encontrado em: ${CAMINHO_SCRIPT}`
    );
  }

  const codigoScript =
    fs.readFileSync(
      CAMINHO_SCRIPT,
      "utf8"
    );

  let inicializador =
    null;

  const adicionarEventoOriginal =
    document
      .addEventListener
      .bind(document);

  const spyDocumento =
    jest
      .spyOn(
        document,
        "addEventListener"
      )
      .mockImplementation(
        (
          tipo,
          callback,
          opcoes
        ) => {
          if (
            tipo ===
            "DOMContentLoaded"
          ) {
            inicializador =
              callback;

            return undefined;
          }

          return adicionarEventoOriginal(
            tipo,
            callback,
            opcoes
          );
        }
      );

  try {
    /*
     * O arquivo é executado como código de navegador,
     * mas API_URL e fetch são entregues explicitamente.
     *
     * Assim, o callback registrado fecha sobre as
     * mesmas variáveis simuladas pelo teste.
     */
    const executarScript =
      new Function(
        "window",
        "document",
        "localStorage",
        "sessionStorage",
        "fetch",
        "API_URL",
        "AbortController",
        "AbortSignal",
        `
          ${codigoScript}

          //# sourceURL=dashboard-dono.js
        `
      );

    executarScript(
      window,
      document,
      localStorage,
      sessionStorage,
      window.fetch,
      window.API_URL,
      globalThis.AbortController,
      globalThis.AbortSignal
    );
  } finally {
    spyDocumento
      .mockRestore();
  }

  if (
    typeof inicializador !==
    "function"
  ) {
    throw new Error(
      "dashboard-dono.js não registrou o evento DOMContentLoaded."
    );
  }

  return inicializador;
}

function iniciarDashboard() {
  const inicializador =
    resolverInicializador();

  const adicionarEventoOriginal =
    window
      .addEventListener
      .bind(window);

  const spyJanela =
    jest
      .spyOn(
        window,
        "addEventListener"
      )
      .mockImplementation(
        (
          tipo,
          callback,
          opcoes
        ) => {
          listenersJanela.push({
            tipo,
            callback,
            opcoes,
          });

          return adicionarEventoOriginal(
            tipo,
            callback,
            opcoes
          );
        }
      );

  try {
    inicializador(
      new window.Event(
        "DOMContentLoaded"
      )
    );
  } finally {
    spyJanela
      .mockRestore();
  }
}

async function esperarAte(
  condicao,
  mensagem =
    "A condição esperada não aconteceu."
) {
  for (
    let tentativa = 0;
    tentativa < 400;
    tentativa += 1
  ) {
    if (
      condicao()
    ) {
      return;
    }

    await new Promise(
      (resolve) => {
        setTimeout(
          resolve,
          5
        );
      }
    );
  }

  throw new Error(
    mensagem
  );
}

function texto(id) {
  return String(
    document
      .getElementById(id)
      ?.textContent ||
      ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function chamadasDashboard() {
  return global
    .fetch
    .mock
    .calls
    .filter(
      ([url]) =>
        String(url)
          .includes(
            "/dashboard-dono?periodo="
          )
    );
}

function limparListenersDaJanela() {
  window.dispatchEvent(
    new window.Event(
      "beforeunload"
    )
  );

  listenersJanela
    .forEach(
      ({
        tipo,
        callback,
        opcoes,
      }) => {
        window.removeEventListener(
          tipo,
          callback,
          opcoes
        );
      }
    );

  listenersJanela = [];
}

describe(
  "dashboard-dono.js",
  () => {
    let consoleErrorSpy;

    beforeAll(
      () => {
        consoleErrorSpy =
          jest
            .spyOn(
              console,
              "error"
            )
            .mockImplementation(
              () => {}
            );
      }
    );

    beforeEach(
      () => {
        montarHtml();

        localStorage.clear();
        sessionStorage.clear();

        listenersJanela = [];

        localStorage.setItem(
          "token",
          "token-do-dono"
        );

        localStorage.setItem(
          "usuario",
          JSON.stringify({
            id:
              1,

            nome:
              "Victor",
          })
        );

        configurarServicosDeSessao();
        definirApiUrl();
        configurarFetch();
      }
    );

    afterEach(
      () => {
        limparListenersDaJanela();

        delete window.AuthService;
        delete window.SessionGuard;

        jest.clearAllMocks();
      }
    );

    afterAll(
      () => {
        consoleErrorSpy
          .mockRestore();

        delete globalThis
          .API_URL;

        delete globalThis
          .fetch;

        try {
          delete window
            .API_URL;

          delete window
            .fetch;
        } catch (_) {
          /*
           * O ambiente pode impedir a remoção
           * de propriedades globais.
           */
        }
      }
    );

    test(
      "carrega plano, indicadores, performance e rankings",
      async () => {
        iniciarDashboard();

        await esperarAte(
          () =>
            texto(
              "nomeNegocio"
            ) ===
              "Studio Fashion" &&
            texto(
              "planoNome"
            ) ===
              "Profissional",

          "O dashboard completo não foi renderizado."
        );

        expect(
          texto(
            "agendamentosHoje"
          )
        ).toBe(
          "3"
        );

        expect(
          texto(
            "agendamentosPeriodo"
          )
        ).toBe(
          "6"
        );

        expect(
          texto(
            "faturamentoHoje"
          )
        ).toContain(
          "300,00"
        );

        expect(
          texto(
            "faturamentoPeriodo"
          )
        ).toContain(
          "600,00"
        );

        expect(
          texto(
            "clientesNovos"
          )
        ).toBe(
          "5"
        );

        expect(
          texto(
            "clientesRecorrentes"
          )
        ).toBe(
          "2"
        );

        expect(
          texto(
            "servicosVendidos"
          )
        ).toBe(
          "6"
        );

        expect(
          texto(
            "ticketMedio"
          )
        ).toContain(
          "100,00"
        );

        expect(
          texto(
            "visitasPerfil"
          )
        ).toBe(
          "24"
        );

        expect(
          texto(
            "cliquesWhatsapp"
          )
        ).toBe(
          "10"
        );

        expect(
          texto(
            "cliquesMaps"
          )
        ).toBe(
          "4"
        );

        expect(
          texto(
            "favoritosRecebidos"
          )
        ).toBe(
          "8"
        );

        expect(
          texto(
            "taxaConversao"
          )
        ).toBe(
          "25%"
        );

        expect(
          document
            .querySelectorAll(
              "#listaResumoDias .ranking-item"
            )
        ).toHaveLength(
          2
        );

        expect(
          texto(
            "rankingProfissionais"
          )
        ).toContain(
          "1. Juliana"
        );

        expect(
          texto(
            "rankingServicos"
          )
        ).toContain(
          "Alongamento em gel"
        );

        expect(
          texto(
            "rankingClientes"
          )
        ).toContain(
          "Maria"
        );

        expect(
          document
            .getElementById(
              "dashboardDonoPage"
            )
            .getAttribute(
              "aria-busy"
            )
        ).toBe(
          "false"
        );

        expect(
          document
            .getElementById(
              "filtroPeriodo"
            )
            .disabled
        ).toBe(
          false
        );

        expect(
          global.fetch
        ).toHaveBeenCalledWith(
          "https://api.teste/dashboard-dono?periodo=7dias",

          expect.objectContaining({
            method:
              "GET",

            cache:
              "no-store",

            headers: {
              Authorization:
                "Bearer token-do-dono",

              Accept:
                "application/json",
            },

            signal:
              expect.any(
                AbortSignal
              ),
          })
        );
      }
    );

    test(
      "salva o negócio como dono após resposta autorizada",
      async () => {
        iniciarDashboard();

        await esperarAte(
          () =>
            localStorage
              .getItem(
                "negocio"
              ) !==
            null
        );

        expect(
          JSON.parse(
            localStorage
              .getItem(
                "negocio"
              )
          )
        ).toMatchObject({
          id:
            11,

          negocio_id:
            11,

          nome:
            "Studio Fashion",

          slug:
            "studio-fashion",

          papel:
            "dono",
        });
      }
    );

    test(
      "restaura o período salvo na sessão",
      async () => {
        sessionStorage
          .setItem(
            "dashboardDonoPeriodo",
            "30dias"
          );

        iniciarDashboard();

        await esperarAte(
          () =>
            chamadasDashboard()
              .length ===
            1
        );

        expect(
          document
            .getElementById(
              "filtroPeriodo"
            )
            .value
        ).toBe(
          "30dias"
        );

        expect(
          chamadasDashboard()[0][0]
        ).toBe(
          "https://api.teste/dashboard-dono?periodo=30dias"
        );
      }
    );

    test(
      "troca o período e faz uma nova requisição",
      async () => {
        iniciarDashboard();

        await esperarAte(
          () =>
            chamadasDashboard()
              .length ===
            1,

          "A primeira consulta do dashboard não terminou."
        );

        const filtro =
          document
            .getElementById(
              "filtroPeriodo"
            );

        filtro.value =
          "mes";

        filtro.dispatchEvent(
          new window.Event(
            "change",
            {
              bubbles:
                true,
            }
          )
        );

        await esperarAte(
          () =>
            chamadasDashboard()
              .length ===
            2
        );

        expect(
          chamadasDashboard()[1][0]
        ).toBe(
          "https://api.teste/dashboard-dono?periodo=mes"
        );

        expect(
          sessionStorage
            .getItem(
              "dashboardDonoPeriodo"
            )
        ).toBe(
          "mes"
        );
      }
    );

    test(
      "botão Atualizar repete a consulta do período atual",
      async () => {
        iniciarDashboard();

        await esperarAte(
          () =>
            chamadasDashboard()
              .length ===
            1,

          "A primeira atualização do dashboard não terminou."
        );

        document
          .getElementById(
            "btnAtualizarDashboard"
          )
          .click();

        await esperarAte(
          () =>
            chamadasDashboard()
              .length ===
            2
        );

        expect(
          chamadasDashboard()[1][0]
        ).toBe(
          "https://api.teste/dashboard-dono?periodo=7dias"
        );
      }
    );

    test(
      "usa a rota alternativa quando /api/meu-plano retorna 404",
      async () => {
        configurarFetch({
          planoStatus:
            404,

          planoFallback:
            criarPlano({
              plano_nome:
                "Premium",
            }),
        });

        iniciarDashboard();

        await esperarAte(
          () =>
            texto(
              "planoNome"
            ) ===
            "Premium"
        );

        const urls =
          global
            .fetch
            .mock
            .calls
            .map(
              ([url]) =>
                String(url)
            );

        expect(
          urls
        ).toContain(
          "https://api.teste/api/meu-plano"
        );

        expect(
          urls
        ).toContain(
          "https://api.teste/meu-plano"
        );
      }
    );

    test(
      "renderiza corretamente um plano ilimitado",
      async () => {
        configurarFetch({
          plano:
            criarPlano({
              plano_nome:
                "Premium",

              capacidade_agendamentos:
                null,

              utilizados:
                240,

              ilimitado:
                true,
            }),
        });

        iniciarDashboard();

        await esperarAte(
          () =>
            texto(
              "planoPercentual"
            ) ===
            "Ilimitado"
        );

        expect(
          texto(
            "planoUso"
          )
        ).toBe(
          "240 agendamentos neste mês"
        );

        expect(
          texto(
            "planoRestantes"
          )
        ).toBe(
          "Capacidade ilimitada"
        );

        expect(
          document
            .getElementById(
              "planoBarra"
            )
            .style
            .width
        ).toBe(
          "100%"
        );

        expect(
          document
            .getElementById(
              "planoProgresso"
            )
            .getAttribute(
              "aria-valuenow"
            )
        ).toBe(
          "100"
        );
      }
    );

    test(
      "mostra estados vazios quando não há dados no período",
      async () => {
        configurarFetch({
          dashboard:
            criarDashboard({
              resumo_dias:
                [],

              ranking_profissionais:
                [],

              ranking_servicos:
                [],

              ranking_clientes:
                [],
            }),
        });

        iniciarDashboard();

        await esperarAte(
          () =>
            texto(
              "listaResumoDias"
            )
              .includes(
                "Nenhum resultado encontrado"
              )
        );

        expect(
          texto(
            "rankingProfissionais"
          )
        ).toBe(
          "Nenhum dado encontrado."
        );

        expect(
          texto(
            "rankingServicos"
          )
        ).toBe(
          "Nenhum dado encontrado."
        );

        expect(
          texto(
            "rankingClientes"
          )
        ).toBe(
          "Nenhum dado encontrado."
        );
      }
    );

    test(
      "exibe erro sem apagar a sessão em falha temporária",
      async () => {
        configurarFetch({
          dashboardStatus:
            500,
        });

        iniciarDashboard();

        await esperarAte(
          () =>
            texto(
              "mensagemDashboard"
            )
              .includes(
                "Erro ao carregar dashboard"
              )
        );

        expect(
          localStorage
            .getItem(
              "token"
            )
        ).toBe(
          "token-do-dono"
        );

        expect(
          texto(
            "rankingProfissionais"
          )
        ).toContain(
          "Não foi possível carregar"
        );
      }
    );

    test(
      "limpa a sessão quando o backend retorna 401",
      async () => {
        localStorage
          .setItem(
            "negocio",
            JSON.stringify({
              id:
                11,

              papel:
                "dono",
            })
          );

        configurarFetch({
          planoStatus:
            401,

          dashboardStatus:
            401,
        });

        iniciarDashboard();

        await esperarAte(
          () =>
            localStorage
              .getItem(
                "token"
              ) ===
            null
        );

        expect(
          localStorage
            .getItem(
              "usuario"
            )
        ).toBeNull();

        expect(
          localStorage
            .getItem(
              "negocio"
            )
        ).toBeNull();
      }
    );

    test(
      "mantém a sessão quando o usuário autenticado recebe 403",
      async () => {
        configurarFetch({
          dashboardStatus:
            403,
        });

        iniciarDashboard();

        await esperarAte(
          () =>
            chamadasDashboard()
              .length ===
              1 &&
            document
              .getElementById(
                "filtroPeriodo"
              )
              .disabled ===
              false
        );

        expect(
          localStorage
            .getItem(
              "token"
            )
        ).toBe(
          "token-do-dono"
        );

        expect(
          localStorage
            .getItem(
              "usuario"
            )
        ).not.toBeNull();
      }
    );

    test(
      "cancela a consulta anterior e mantém a resposta mais recente",
      async () => {
        let primeiraRequisicao;
        let totalDashboard = 0;

        const fetchMock =
          jest.fn(
            (
              url,
              opcoes = {}
            ) => {
              const endereco =
                String(url);

              if (
                endereco.endsWith(
                  "/api/meu-plano"
                )
              ) {
                return Promise.resolve(
                  criarRespostaJson(
                    200,
                    criarPlano()
                  )
                );
              }

              if (
                endereco.includes(
                  "/dashboard-dono?periodo="
                )
              ) {
                totalDashboard += 1;

                if (
                  totalDashboard ===
                  1
                ) {
                  primeiraRequisicao =
                    opcoes;

                  return new Promise(
                    (
                      resolve,
                      reject
                    ) => {
                      opcoes
                        .signal
                        .addEventListener(
                          "abort",
                          () => {
                            const erro =
                              new Error(
                                "Requisição cancelada"
                              );

                            erro.name =
                              "AbortError";

                            reject(
                              erro
                            );
                          }
                        );
                    }
                  );
                }

                return Promise.resolve(
                  criarRespostaJson(
                    200,

                    criarDashboard({
                      resumo: {
                        ...criarDashboard()
                          .resumo,

                        agendamentos_periodo:
                          99,
                      },
                    })
                  )
                );
              }

              throw new Error(
                `URL não simulada: ${endereco}`
              );
            }
          );

        global.fetch =
          fetchMock;

        window.fetch =
          fetchMock;

        iniciarDashboard();

        await esperarAte(
          () =>
            totalDashboard ===
            1
        );

        const filtro =
          document
            .getElementById(
              "filtroPeriodo"
            );

        filtro.value =
          "hoje";

        filtro.dispatchEvent(
          new window.Event(
            "change",
            {
              bubbles:
                true,
            }
          )
        );

        await esperarAte(
          () =>
            texto(
              "agendamentosPeriodo"
            ) ===
            "99"
        );

        expect(
          primeiraRequisicao
        ).toBeTruthy();

        expect(
          primeiraRequisicao
            .signal
            .aborted
        ).toBe(
          true
        );

        expect(
          texto(
            "agendamentosPeriodo"
          )
        ).toBe(
          "99"
        );
      }
    );
  }
);