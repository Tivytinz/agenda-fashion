/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"http://localhost/html/inicio.html"}
 */

jest.setTimeout(10000);

function criarRespostaJson(
  status,
  corpo
) {
  return {
    status,

    ok:
      status >= 200 &&
      status < 300,

    json:
      jest
        .fn()
        .mockResolvedValue(
          corpo
        ),
  };
}

function definirSessao({
  usuario,
  negocio = null,
  token = "token-de-teste",
}) {
  localStorage.setItem(
    "token",
    token
  );

  localStorage.setItem(
    "usuario",
    JSON.stringify(
      usuario
    )
  );

  if (negocio) {
    localStorage.setItem(
      "negocio",
      JSON.stringify(
        negocio
      )
    );
  } else {
    localStorage.removeItem(
      "negocio"
    );
  }
}

function definirPagina(
  pagina
) {
  window.history.replaceState(
    {},
    "",
    `/html/${pagina}`
  );
}

function definirApiUrl(
  valor =
    "https://api.teste"
) {
  window.API_URL =
    valor;

  global.API_URL =
    valor;
}

function obterTextosMenu() {
  return Array.from(
    document.querySelectorAll(
      "#appNav .nav-item small"
    )
  ).map(
    (elemento) =>
      elemento.textContent
  );
}

function obterLinkPorTexto(
  texto
) {
  return Array.from(
    document.querySelectorAll(
      "#appNav .nav-item"
    )
  ).find(
    (link) =>
      link.querySelector(
        "small"
      )?.textContent ===
      texto
  );
}

function iniciarNavegacao() {
  document.dispatchEvent(
    new window.Event(
      "DOMContentLoaded",
      {
        bubbles:
          true,
      }
    )
  );
}

async function esperarAte(
  condicao,
  mensagem =
    "A condição esperada não aconteceu."
) {
  for (
    let tentativa = 0;
    tentativa < 200;
    tentativa += 1
  ) {
    if (condicao()) {
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

function esperarMenu(
  textos
) {
  return esperarAte(
    () =>
      JSON.stringify(
        obterTextosMenu()
      ) ===
      JSON.stringify(
        textos
      ),

    `O menu esperado não foi renderizado: ${textos.join(
      ", "
    )}`
  );
}

describe(
  "navegacao.js",
  () => {
    let consoleWarnSpy;

    beforeAll(
      () => {
        consoleWarnSpy =
          jest
            .spyOn(
              console,
              "warn"
            )
            .mockImplementation(
              () => {}
            );

        require(
          "../agendamento-nails/js/navegacao.js"
        );
      }
    );

    beforeEach(
      () => {
        document.body.innerHTML = `
          <main>
            <h1>Página de teste</h1>
          </main>

          <nav
            id="appNav"
            class="app-bottom-nav"
          ></nav>
        `;

        localStorage.clear();
        sessionStorage.clear();

        definirPagina(
          "inicio.html"
        );

        delete window.API;
        delete window.AuthService;
        delete window.API_URL;

        delete global.API_URL;

        global.fetch =
          jest.fn();

        window.fetch =
          global.fetch;
      }
    );

    afterEach(
      () => {
        delete window.API;
        delete window.AuthService;
        delete window.API_URL;
        delete window.fetch;

        delete global.API_URL;
        delete global.fetch;

        jest.clearAllMocks();
      }
    );

    afterAll(
      () => {
        consoleWarnSpy
          .mockRestore();
      }
    );

    test(
      "mostra Início e Entrar para visitante",
      async () => {
        iniciarNavegacao();

        await esperarMenu([
          "Início",
          "Entrar",
        ]);

        expect(
          global.fetch
        ).not.toHaveBeenCalled();

        const inicio =
          obterLinkPorTexto(
            "Início"
          );

        expect(
          inicio
            .classList
            .contains(
              "ativo"
            )
        ).toBe(
          true
        );

        expect(
          inicio.getAttribute(
            "aria-current"
          )
        ).toBe(
          "page"
        );
      }
    );

    test(
      "mostra o menu correto para usuário sem negócio",
      async () => {
        definirSessao({
          usuario: {
            id:
              20,

            nome:
              "Maria",
          },
        });

        definirPagina(
          "meus-agendamentos.html"
        );

        definirApiUrl();

        global.fetch
          .mockResolvedValueOnce(
            criarRespostaJson(
              200,
              {
                usuario: {
                  id:
                    20,

                  nome:
                    "Maria",
                },

                negocio:
                  null,

                temNegocio:
                  false,
              }
            )
          );

        iniciarNavegacao();

        await esperarAte(
          () =>
            global.fetch
              .mock.calls
              .length ===
              1 &&
            obterTextosMenu()
              .includes(
                "Negócio"
              )
        );

        expect(
          obterTextosMenu()
        ).toEqual([
          "Início",
          "Agenda",
          "Favoritos",
          "Negócio",
          "Conta",
        ]);

        const agenda =
          obterLinkPorTexto(
            "Agenda"
          );

        expect(
          agenda
            .classList
            .contains(
              "ativo"
            )
        ).toBe(
          true
        );

        expect(
          agenda.getAttribute(
            "aria-current"
          )
        ).toBe(
          "page"
        );

        expect(
          agenda.getAttribute(
            "href"
          )
        ).toBe(
          "/html/meus-agendamentos.html"
        );

        expect(
          obterLinkPorTexto(
            "Negócio"
          ).getAttribute(
            "href"
          )
        ).toBe(
          "/html/criar-negocio.html"
        );
      }
    );

    test(
      "mostra Início, Agenda, Perfil e Conta para profissional",
      async () => {
        const usuario = {
          id:
            7,

          nome:
            "Juliana",
        };

        const negocio = {
          id:
            11,

          nome:
            "Studio Fashion",

          slug:
            "studio-fashion",

          papel:
            "profissional",
        };

        definirSessao({
          usuario,
          negocio,
        });

        definirPagina(
          "agenda-profissional.html"
        );

        definirApiUrl();

        global.fetch
          .mockResolvedValueOnce(
            criarRespostaJson(
              200,
              {
                usuario,
                negocio,
                temNegocio:
                  true,
              }
            )
          )
          .mockResolvedValueOnce(
            criarRespostaJson(
              200,
              {
                total:
                  120,
              }
            )
          );

        iniciarNavegacao();

        await esperarAte(
          () =>
            global.fetch
              .mock.calls
              .length ===
              2 &&
            document
              .querySelector(
                ".nav-badge"
              )
              ?.textContent ===
              "99+",

          "O menu profissional ou o badge não foi atualizado."
        );

        expect(
          obterTextosMenu()
        ).toEqual([
          "Início",
          "Agenda",
          "Perfil",
          "Conta",
        ]);

        const agenda =
          obterLinkPorTexto(
            "Agenda"
          );

        expect(
          agenda.getAttribute(
            "href"
          )
        ).toBe(
          "/html/agenda-profissional.html"
        );

        expect(
          agenda
            .classList
            .contains(
              "ativo"
            )
        ).toBe(
          true
        );

        const perfil =
          obterLinkPorTexto(
            "Perfil"
          );

        expect(
          perfil.getAttribute(
            "href"
          )
        ).toBe(
          "/html/perfil-negocio.html?slug=studio-fashion"
        );

        expect(
          document
            .querySelector(
              ".nav-badge"
            )
            .textContent
        ).toBe(
          "99+"
        );

        expect(
          global.fetch
            .mock.calls[0][0]
        ).toBe(
          "https://api.teste/minha-sessao"
        );

        expect(
          global.fetch
            .mock.calls[1][0]
        ).toBe(
          "https://api.teste/notificacoes-agenda"
        );
      }
    );

    test(
      "usa o papel do negócio para identificar o dono",
      async () => {
        const usuario = {
          id:
            1,

          nome:
            "Victor",
        };

        const negocio = {
          id:
            11,

          nome:
            "Studio Fashion",

          slug:
            "studio-fashion",

          papel:
            "dono",
        };

        definirSessao({
          usuario,
          negocio,
        });

        definirPagina(
          "agenda-geral.html"
        );

        definirApiUrl();

        global.fetch
          .mockResolvedValueOnce(
            criarRespostaJson(
              200,
              {
                usuario,
                negocio,
                temNegocio:
                  true,
              }
            )
          )
          .mockResolvedValueOnce(
            criarRespostaJson(
              200,
              {
                total:
                  3,
              }
            )
          );

        iniciarNavegacao();

        await esperarAte(
          () =>
            global.fetch
              .mock.calls
              .length ===
              2 &&
            obterTextosMenu()
              .includes(
                "Painel"
              )
        );

        expect(
          obterTextosMenu()
        ).toEqual([
          "Início",
          "Agenda",
          "Painel",
          "Perfil",
          "Conta",
        ]);

        const linkAgenda =
          obterLinkPorTexto(
            "Agenda"
          );

        expect(
          linkAgenda.getAttribute(
            "href"
          )
        ).toBe(
          "/html/agenda-geral.html"
        );

        expect(
          linkAgenda
            .classList
            .contains(
              "ativo"
            )
        ).toBe(
          true
        );

        expect(
          obterLinkPorTexto(
            "Painel"
          ).getAttribute(
            "href"
          )
        ).toBe(
          "/html/dashboard-dono.html"
        );

        expect(
          obterLinkPorTexto(
            "Perfil"
          ).getAttribute(
            "href"
          )
        ).toBe(
          "/html/perfil-negocio.html?slug=studio-fashion"
        );

        expect(
          document
            .querySelector(
              ".nav-badge"
            )
            .textContent
        ).toBe(
          "3"
        );
      }
    );

    test(
      "mostra opção de criar negócio quando o usuário ainda não possui negócio",
      async () => {
        const usuario = {
          id:
            8,

          nome:
            "Ana",
        };

        definirSessao({
          usuario,
        });

        definirApiUrl();

        global.fetch
          .mockResolvedValueOnce(
            criarRespostaJson(
              200,
              {
                usuario,

                negocio:
                  null,

                temNegocio:
                  false,
              }
            )
          );

        iniciarNavegacao();

        await esperarAte(
          () =>
            global.fetch
              .mock.calls
              .length ===
              1 &&
            obterTextosMenu()
              .includes(
                "Negócio"
              )
        );

        expect(
          obterTextosMenu()
        ).toEqual([
          "Início",
          "Agenda",
          "Favoritos",
          "Negócio",
          "Conta",
        ]);

        const criarNegocio =
          obterLinkPorTexto(
            "Negócio"
          );

        expect(
          criarNegocio.getAttribute(
            "href"
          )
        ).toBe(
          "/html/criar-negocio.html"
        );

        expect(
          localStorage.getItem(
            "negocio"
          )
        ).toBeNull();
      }
    );

    test(
      "mantém o negócio salvo quando ocorre erro de conexão",
      async () => {
        const usuario = {
          id:
            7,

          nome:
            "Juliana",
        };

        const negocioSalvo = {
          id:
            11,

          nome:
            "Studio Fashion",

          slug:
            "studio-fashion",

          papel:
            "profissional",
        };

        definirSessao({
          usuario,

          negocio:
            negocioSalvo,
        });

        definirApiUrl();

        global.fetch
          .mockRejectedValueOnce(
            new Error(
              "Sem conexão"
            )
          )
          .mockResolvedValueOnce(
            criarRespostaJson(
              200,
              {
                total:
                  0,
              }
            )
          );

        iniciarNavegacao();

        await esperarAte(
          () =>
            global.fetch
              .mock.calls
              .length ===
            2
        );

        expect(
          JSON.parse(
            localStorage.getItem(
              "negocio"
            )
          )
        ).toEqual(
          negocioSalvo
        );

        expect(
          obterTextosMenu()
        ).toEqual([
          "Início",
          "Agenda",
          "Perfil",
          "Conta",
        ]);

        expect(
          consoleWarnSpy
        ).toHaveBeenCalledWith(
          "Não foi possível atualizar a navegação:",

          expect.any(
            Error
          )
        );
      }
    );

    test(
      "limpa a sessão quando o backend retorna 401",
      async () => {
        definirSessao({
          usuario: {
            id:
              7,

            nome:
              "Juliana",
          },

          negocio: {
            id:
              11,

            slug:
              "studio-fashion",

            papel:
              "profissional",
          },
        });

        definirApiUrl();

        global.fetch
          .mockResolvedValueOnce(
            criarRespostaJson(
              401,
              {
                erro:
                  "Token inválido",
              }
            )
          );

        iniciarNavegacao();

        await esperarAte(
          () =>
            localStorage.getItem(
              "token"
            ) ===
            null
        );

        expect(
          localStorage.getItem(
            "usuario"
          )
        ).toBeNull();

        expect(
          localStorage.getItem(
            "negocio"
          )
        ).toBeNull();

        expect(
          obterTextosMenu()
        ).toEqual([
          "Início",
          "Entrar",
        ]);
      }
    );
  }
);