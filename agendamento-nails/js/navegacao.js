document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const nav =
      document.getElementById(
        "appNav"
      );

    if (!nav) {
      return;
    }

    function pagina(nome) {
      return `/html/${nome}`;
    }

    function lerLocalStorage(
      chave
    ) {
      try {
        return JSON.parse(
          localStorage.getItem(chave) ||
            "null"
        );
      } catch {
        localStorage.removeItem(
          chave
        );

        return null;
      }
    }

    function obterToken() {
      if (
        window.AuthService &&
        typeof window.AuthService
          .getToken === "function"
      ) {
        return window.AuthService
          .getToken();
      }

      return localStorage.getItem(
        "token"
      );
    }

    function limparSessao() {
      if (
        window.AuthService &&
        typeof window.AuthService
          .limparSessao === "function"
      ) {
        window.AuthService
          .limparSessao();

        return;
      }

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

    function salvarContexto(
      contexto
    ) {
      if (contexto?.usuario) {
        localStorage.setItem(
          "usuario",
          JSON.stringify(
            contexto.usuario
          )
        );
      }

      if (contexto?.negocio) {
        if (
          window.AuthService &&
          typeof window.AuthService
            .salvarNegocio ===
            "function"
        ) {
          window.AuthService
            .salvarNegocio(
              contexto.negocio
            );
        } else {
          localStorage.setItem(
            "negocio",
            JSON.stringify(
              contexto.negocio
            )
          );
        }
      } else {
        localStorage.removeItem(
          "negocio"
        );
      }
    }

    function normalizarPapel(
      valor
    ) {
      const papel =
        String(valor ?? "")
          .trim()
          .toLowerCase();

      if (
        papel === "dono" ||
        papel === "profissional"
      ) {
        return papel;
      }

      return null;
    }

    async function requisicaoGet(
      caminho
    ) {
      if (
        window.API &&
        typeof window.API.get ===
          "function"
      ) {
        return window.API.get(
          caminho
        );
      }

      const token =
        obterToken();

      const baseUrl =
        typeof window.API_URL ===
        "string"
          ? window.API_URL
              .trim()
              .replace(/\/$/, "")
          : "";

      const resposta =
        await fetch(
          `${baseUrl}${caminho}`,
          {
            method: "GET",

            headers: {
              Accept:
                "application/json",

              ...(token
                ? {
                    Authorization:
                      `Bearer ${token}`,
                  }
                : {}),
            },
          }
        );

      const dados =
        await resposta
          .json()
          .catch(() => ({}));

      if (!resposta.ok) {
        const erro =
          new Error(
            dados.erro ||
              dados.mensagem ||
              "Erro na requisição."
          );

        erro.status =
          resposta.status;

        throw erro;
      }

      return dados;
    }

    async function carregarContexto() {
      const token =
        obterToken();

      if (!token) {
        limparSessao();

        return {
          usuario: null,
          negocio: null,
          temNegocio: false,
        };
      }

      try {
        let contexto;

        if (
          window.AuthService &&
          typeof window.AuthService
            .carregarMinhaSessao ===
            "function"
        ) {
          contexto =
            await window.AuthService
              .carregarMinhaSessao();
        } else {
          contexto =
            await requisicaoGet(
              "/minha-sessao"
            );

          salvarContexto(
            contexto
          );
        }

        return {
          usuario:
            contexto?.usuario ||
            null,

          negocio:
            contexto?.negocio ||
            null,

          temNegocio:
            Boolean(
              contexto?.negocio?.id
            ),
        };
      } catch (erro) {
        if (
          erro?.status === 401 ||
          erro?.status === 403
        ) {
          limparSessao();

          return {
            usuario: null,
            negocio: null,
            temNegocio: false,
          };
        }

        console.warn(
          "Não foi possível atualizar a navegação:",
          erro
        );

        const usuarioCache =
          lerLocalStorage(
            "usuario"
          );

        const negocioCache =
          lerLocalStorage(
            "negocio"
          );

        return {
          usuario:
            usuarioCache,

          negocio:
            negocioCache,

          temNegocio:
            Boolean(
              negocioCache?.id
            ),
        };
      }
    }

    async function buscarNotificacoesAgenda(
      negocio
    ) {
      const papel =
        normalizarPapel(
          negocio?.papel
        );

      if (
        !negocio?.id ||
        !papel ||
        !obterToken()
      ) {
        return 0;
      }

      try {
        const dados =
          await requisicaoGet(
            "/notificacoes-agenda"
          );

        const total =
          Number(
            dados?.total || 0
          );

        return Number.isFinite(
          total
        )
          ? Math.max(0, total)
          : 0;
      } catch (erro) {
        if (
          erro?.status !== 401 &&
          erro?.status !== 403
        ) {
          console.warn(
            "Não foi possível carregar as notificações da agenda:",
            erro
          );
        }

        return 0;
      }
    }

    function ativarPaginaAtual() {
      const paginaAtual =
        window.location.pathname
          .split("/")
          .pop();

      nav
        .querySelectorAll("a")
        .forEach(
          (link) => {
            const href =
              String(
                link.getAttribute(
                  "href"
                ) || ""
              ).split("?")[0];

            const paginaLink =
              href
                .split("/")
                .pop();

            const ativa =
              paginaLink ===
              paginaAtual;

            link.classList.toggle(
              "ativo",
              ativa
            );

            if (ativa) {
              link.setAttribute(
                "aria-current",
                "page"
              );
            } else {
              link.removeAttribute(
                "aria-current"
              );
            }
          }
        );
    }

    function criarItem({
      href,
      icone,
      texto,
      badge = 0,
    }) {
      const link =
        document.createElement(
          "a"
        );

      link.href = href;
      link.className =
        "nav-item";

      const iconeWrap =
        document.createElement(
          "span"
        );

      iconeWrap.className =
        "nav-icon-wrap";

      const iconeElemento =
        document.createElement(
          "span"
        );

      iconeElemento.textContent =
        icone;

      iconeWrap.appendChild(
        iconeElemento
      );

      if (badge > 0) {
        const badgeElemento =
          document.createElement(
            "b"
          );

        badgeElemento.className =
          "nav-badge";

        badgeElemento.textContent =
          badge > 99
            ? "99+"
            : String(badge);

        badgeElemento.setAttribute(
          "aria-label",
          `${badge} notificações`
        );

        iconeWrap.appendChild(
          badgeElemento
        );
      }

      const textoElemento =
        document.createElement(
          "small"
        );

      textoElemento.textContent =
        texto;

      link.append(
        iconeWrap,
        textoElemento
      );

      return link;
    }

    function renderizar(
      itens
    ) {
      nav.replaceChildren(
        ...itens.map(
          criarItem
        )
      );

      ativarPaginaAtual();
    }

    function obterPerfilHref(
      negocio
    ) {
      if (!negocio?.slug) {
        return pagina(
          "inicio.html"
        );
      }

      return (
        pagina(
          "perfil-negocio.html"
        ) +
        `?slug=${encodeURIComponent(
          negocio.slug
        )}`
      );
    }

    function renderizarVisitante() {
      renderizar([
        {
          href:
            pagina(
              "inicio.html"
            ),
          icone: "🏠",
          texto: "Início",
        },
        {
          href:
            pagina(
              "login-cliente.html"
            ),
          icone: "👤",
          texto: "Entrar",
        },
      ]);
    }

    function renderizarContaComum() {
      renderizar([
        {
          href:
            pagina(
              "inicio.html"
            ),
          icone: "🏠",
          texto: "Início",
        },
        {
          href:
            pagina(
              "meus-agendamentos.html"
            ),
          icone: "📅",
          texto: "Agenda",
        },
        {
          href:
            pagina(
              "favoritos.html"
            ),
          icone: "❤️",
          texto: "Favoritos",
        },
        {
          href:
            pagina(
              "criar-negocio.html"
            ),
          icone: "➕",
          texto: "Negócio",
        },
        {
          href:
            pagina(
              "minha-conta.html"
            ),
          icone: "⚙️",
          texto: "Conta",
        },
      ]);
    }

    function renderizarDono(
      negocio,
      totalAgenda
    ) {
      renderizar([
        {
          href:
            pagina(
              "inicio.html"
            ),
          icone: "🏠",
          texto: "Início",
        },
        {
          href:
            pagina(
              "agenda-geral.html"
            ),
          icone: "📅",
          texto: "Agenda",
          badge:
            totalAgenda,
        },
        {
          href:
            pagina(
              "dashboard-dono.html"
            ),
          icone: "📊",
          texto: "Painel",
        },
        {
          href:
            obterPerfilHref(
              negocio
            ),
          icone: "🏢",
          texto: "Perfil",
        },
        {
          href:
            pagina(
              "minha-conta.html"
            ),
          icone: "⚙️",
          texto: "Conta",
        },
      ]);
    }

    function renderizarProfissional(
      negocio,
      totalAgenda
    ) {
      renderizar([
        {
          href:
            pagina(
              "inicio.html"
            ),
          icone: "🏠",
          texto: "Início",
        },
        {
          href:
            pagina(
              "agenda-profissional.html"
            ),
          icone: "📅",
          texto: "Agenda",
          badge:
            totalAgenda,
        },
        {
          href:
            obterPerfilHref(
              negocio
            ),
          icone: "🏢",
          texto: "Perfil",
        },
        {
          href:
            pagina(
              "minha-conta.html"
            ),
          icone: "⚙️",
          texto: "Conta",
        },
      ]);
    }

    /*
     * Exibe rapidamente o contexto
     * salvo enquanto a sessão é
     * atualizada pelo servidor.
     */
    const usuarioCache =
      lerLocalStorage(
        "usuario"
      );

    const negocioCache =
      lerLocalStorage(
        "negocio"
      );

    if (!obterToken()) {
      renderizarVisitante();
    } else if (
      negocioCache?.papel ===
      "dono"
    ) {
      renderizarDono(
        negocioCache,
        0
      );
    } else if (
      negocioCache?.papel ===
      "profissional"
    ) {
      renderizarProfissional(
        negocioCache,
        0
      );
    } else if (
      usuarioCache?.id
    ) {
      renderizarContaComum();
    } else {
      renderizarVisitante();
    }

    const contexto =
      await carregarContexto();

    if (!contexto.usuario?.id) {
      renderizarVisitante();
      return;
    }

    if (!contexto.negocio?.id) {
      renderizarContaComum();
      return;
    }

    const papel =
      normalizarPapel(
        contexto.negocio.papel
      );

    const totalAgenda =
      await buscarNotificacoesAgenda(
        contexto.negocio
      );

    if (papel === "dono") {
      renderizarDono(
        contexto.negocio,
        totalAgenda
      );

      return;
    }

    if (
      papel === "profissional"
    ) {
      renderizarProfissional(
        contexto.negocio,
        totalAgenda
      );

      return;
    }

    renderizarContaComum();
  }
);