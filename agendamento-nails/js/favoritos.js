document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const elementos = {
      lista:
        document.getElementById(
          "listaFavoritos"
        ) ||
        document.querySelector(
          ".lista-favoritos"
        ),

      mensagem:
        document.getElementById(
          "mensagemFavoritos"
        ) ||
        document.querySelector(
          ".mensagem-favoritos"
        ),
    };

    if (!elementos.lista) {
      console.error(
        "A lista de favoritos não foi encontrada."
      );

      return;
    }

    if (
      !window.SessionGuard ||
      typeof window.SessionGuard
        .exigirConta !== "function"
    ) {
      console.error(
        "SessionGuard não foi carregado."
      );

      window.location.replace(
        "/html/login-cliente.html"
      );

      return;
    }

    if (
      !window.API ||
      typeof window.API.get !==
        "function" ||
      typeof window.API.delete !==
        "function"
    ) {
      mostrarMensagem(
        "O serviço da API não foi carregado."
      );

      return;
    }

    const estado = {
      contexto: null,
      favoritos: [],
      carregando: false,
      removendoId: null,
    };

    function criarElemento(
      tag,
      {
        classe = "",
        texto,
      } = {}
    ) {
      const elemento =
        document.createElement(
          tag
        );

      if (classe) {
        elemento.className =
          classe;
      }

      if (
        texto !== undefined
      ) {
        elemento.textContent =
          String(texto);
      }

      return elemento;
    }

    function normalizarId(
      valor
    ) {
      const id =
        Number(valor);

      return (
        Number.isInteger(id) &&
        id > 0
      )
        ? id
        : null;
    }

    function normalizarTexto(
      valor,
      fallback = ""
    ) {
      const texto =
        String(valor ?? "")
          .trim();

      return (
        texto ||
        fallback
      );
    }

    function obterImagemValida(
      valor
    ) {
      const imagem =
        normalizarTexto(valor);

      if (!imagem) {
        return null;
      }

      try {
        const url =
          new URL(
            imagem,
            window.location.origin
          );

        if (
          ![
            "http:",
            "https:",
          ].includes(
            url.protocol
          )
        ) {
          return null;
        }

        return url.href;
      } catch {
        return null;
      }
    }

    function esconderMensagem() {
      if (
        !elementos.mensagem
      ) {
        return;
      }

      elementos.mensagem
        .textContent = "";

      elementos.mensagem
        .classList.add(
          "hidden"
        );

      elementos.mensagem
        .classList.remove(
          "erro",
          "sucesso"
        );

      elementos.mensagem
        .removeAttribute(
          "data-tipo"
        );
    }

    function mostrarMensagem(
      texto,
      tipo = "erro"
    ) {
      if (
        !elementos.mensagem
      ) {
        console[
          tipo === "erro"
            ? "error"
            : "log"
        ](texto);

        return;
      }

      elementos.mensagem
        .textContent =
          String(texto || "");

      elementos.mensagem
        .classList.remove(
          "hidden",
          "erro",
          "sucesso"
        );

      elementos.mensagem
        .classList.add(
          tipo
        );

      elementos.mensagem
        .dataset.tipo =
          tipo;
    }

    function mostrarEstado(
      texto,
      {
        icone = "❤️",
        mostrarBotao = false,
      } = {}
    ) {
      elementos.lista
        .replaceChildren();

      const container =
        criarElemento(
          "div",
          {
            classe:
              "estado-vazio estado-favoritos",
          }
        );

      const emoji =
        criarElemento(
          "span",
          {
            classe:
              "estado-favoritos-icone",

            texto:
              icone,
          }
        );

      emoji.setAttribute(
        "aria-hidden",
        "true"
      );

      const mensagem =
        criarElemento(
          "p",
          {
            texto,
          }
        );

      container.append(
        emoji,
        mensagem
      );

      if (mostrarBotao) {
        const link =
          criarElemento(
            "a",
            {
              classe:
                "af-btn-primary btn-explorar",

              texto:
                "Explorar negócios",
            }
          );

        link.href =
          "/html/inicio.html";

        container.appendChild(
          link
        );
      }

      elementos.lista
        .appendChild(
          container
        );
    }

    function redirecionarLogin() {
      window.AuthService
        ?.limparSessao?.();

      window.location.replace(
        "/html/login-cliente.html"
      );
    }

    function tratarErro(
      erro,
      mensagemPadrao
    ) {
      console.error(
        mensagemPadrao,
        erro
      );

      if (
        erro?.status === 401 ||
        erro?.status === 403
      ) {
        redirecionarLogin();

        return true;
      }

      mostrarMensagem(
        erro?.message ||
          mensagemPadrao
      );

      return false;
    }

    function definirBotoesBloqueados(
      bloqueado
    ) {
      elementos.lista
        .querySelectorAll(
          "button"
        )
        .forEach(
          (botao) => {
            botao.disabled =
              bloqueado;
          }
        );
    }

    function criarImagemNegocio(
      favorito
    ) {
      const container =
        criarElemento(
          "div",
          {
            classe:
              "favorito-imagem",
          }
        );

      const imagemUrl =
        obterImagemValida(
          favorito.foto_url
        );

      if (!imagemUrl) {
        const placeholder =
          criarElemento(
            "span",
            {
              classe:
                "favorito-placeholder",

              texto:
                "🏢",
            }
          );

        placeholder.setAttribute(
          "aria-hidden",
          "true"
        );

        container.appendChild(
          placeholder
        );

        return container;
      }

      const imagem =
        document.createElement(
          "img"
        );

      imagem.src =
        imagemUrl;

      imagem.alt =
        `Foto de ${normalizarTexto(
          favorito.nome,
          "negócio"
        )}`;

      imagem.loading =
        "lazy";

      imagem.addEventListener(
        "error",
        () => {
          container
            .replaceChildren();

          const placeholder =
            criarElemento(
              "span",
              {
                classe:
                  "favorito-placeholder",

                texto:
                  "🏢",
              }
            );

          placeholder.setAttribute(
            "aria-hidden",
            "true"
          );

          container.appendChild(
            placeholder
          );
        },
        {
          once: true,
        }
      );

      container.appendChild(
        imagem
      );

      return container;
    }

    function criarInformacoesNegocio(
      favorito
    ) {
      const container =
        criarElemento(
          "div",
          {
            classe:
              "favorito-info",
          }
        );

      const nome =
        criarElemento(
          "h2",
          {
            texto:
              normalizarTexto(
                favorito.nome,
                "Negócio"
              ),
          }
        );

      const metadados =
        criarElemento(
          "div",
          {
            classe:
              "favorito-metadados",
          }
        );

      const setor =
        normalizarTexto(
          favorito.setor
        );

      const cidade =
        normalizarTexto(
          favorito.cidade
        );

      if (setor) {
        const setorElemento =
          criarElemento(
            "span",
            {
              texto:
                `💅 ${setor}`,
            }
          );

        metadados.appendChild(
          setorElemento
        );
      }

      if (cidade) {
        const cidadeElemento =
          criarElemento(
            "span",
            {
              texto:
                `📍 ${cidade}`,
            }
          );

        metadados.appendChild(
          cidadeElemento
        );
      }

      const descricao =
        criarElemento(
          "p",
          {
            classe:
              "favorito-descricao",

            texto:
              normalizarTexto(
                favorito.descricao,
                "Conheça os serviços e horários disponíveis."
              ),
          }
        );

      container.appendChild(
        nome
      );

      if (
        metadados
          .childElementCount > 0
      ) {
        container.appendChild(
          metadados
        );
      }

      container.appendChild(
        descricao
      );

      return container;
    }

    async function removerFavorito(
      favorito
    ) {
      const negocioId =
        normalizarId(
          favorito.id
        );

      if (
        !negocioId ||
        estado.removendoId
      ) {
        return;
      }

      const confirmou =
        window.confirm(
          `Remover ${normalizarTexto(
            favorito.nome,
            "este negócio"
          )} dos favoritos?`
        );

      if (!confirmou) {
        return;
      }

      esconderMensagem();

      estado.removendoId =
        negocioId;

      definirBotoesBloqueados(
        true
      );

      try {
        const resultado =
          await window.API.delete(
            `/favoritos/${negocioId}`
          );

        estado.favoritos =
          estado.favoritos.filter(
            (item) =>
              normalizarId(
                item.id
              ) !==
              negocioId
          );

        renderizar();

        mostrarMensagem(
          resultado?.mensagem ||
            "Negócio removido dos favoritos.",
          "sucesso"
        );
      } catch (erro) {
        tratarErro(
          erro,
          "Não foi possível remover o favorito."
        );
      } finally {
        estado.removendoId =
          null;

        definirBotoesBloqueados(
          false
        );
      }
    }

    function criarAcoesNegocio(
      favorito
    ) {
      const container =
        criarElemento(
          "div",
          {
            classe:
              "favorito-acoes",
          }
        );

      const slug =
        normalizarTexto(
          favorito.slug
        );

      const abrirPerfil =
        criarElemento(
          "a",
          {
            classe:
              "af-btn-primary btn-ver-perfil",

            texto:
              "Ver perfil",
          }
        );

      abrirPerfil.href =
        slug
          ? (
              "/html/perfil-negocio.html" +
              `?slug=${encodeURIComponent(
                slug
              )}`
            )
          : "/html/inicio.html";

      const remover =
        criarElemento(
          "button",
          {
            classe:
              "btn-remover-favorito",

            texto:
              "Remover",
          }
        );

      remover.type =
        "button";

      remover.setAttribute(
        "aria-label",
        `Remover ${normalizarTexto(
          favorito.nome,
          "negócio"
        )} dos favoritos`
      );

      remover.addEventListener(
        "click",
        () =>
          removerFavorito(
            favorito
          )
      );

      container.append(
        abrirPerfil,
        remover
      );

      return container;
    }

    function criarCard(
      favorito
    ) {
      const card =
        criarElemento(
          "article",
          {
            classe:
              "af-card card-favorito",
          }
        );

      card.dataset.negocioId =
        String(
          favorito.id
        );

      const imagem =
        criarImagemNegocio(
          favorito
        );

      const conteudo =
        criarElemento(
          "div",
          {
            classe:
              "favorito-conteudo",
          }
        );

      const informacoes =
        criarInformacoesNegocio(
          favorito
        );

      const acoes =
        criarAcoesNegocio(
          favorito
        );

      conteudo.append(
        informacoes,
        acoes
      );

      card.append(
        imagem,
        conteudo
      );

      return card;
    }

    function renderizar() {
      elementos.lista
        .replaceChildren();

      if (
        estado.favoritos.length ===
        0
      ) {
        mostrarEstado(
          "Você ainda não adicionou nenhum negócio aos favoritos.",
          {
            icone:
              "♡",

            mostrarBotao:
              true,
          }
        );

        return;
      }

      const fragmento =
        document.createDocumentFragment();

      estado.favoritos
        .forEach(
          (favorito) => {
            if (
              !normalizarId(
                favorito.id
              )
            ) {
              return;
            }

            fragmento.appendChild(
              criarCard(
                favorito
              )
            );
          }
        );

      if (
        fragmento
          .childNodes
          .length === 0
      ) {
        mostrarEstado(
          "Nenhum favorito válido foi encontrado.",
          {
            icone:
              "♡",

            mostrarBotao:
              true,
          }
        );

        return;
      }

      elementos.lista
        .appendChild(
          fragmento
        );
    }

    async function carregarFavoritos() {
      if (
        estado.carregando
      ) {
        return;
      }

      estado.carregando =
        true;

      esconderMensagem();

      elementos.lista
        .setAttribute(
          "aria-busy",
          "true"
        );

      mostrarEstado(
        "Carregando seus favoritos...",
        {
          icone:
            "⏳",
        }
      );

      try {
        const resultado =
          await window.API.get(
            "/favoritos"
          );

        estado.favoritos =
          Array.isArray(
            resultado
          )
            ? resultado
            : Array.isArray(
                resultado?.favoritos
              )
              ? resultado.favoritos
              : [];

        renderizar();
      } catch (erro) {
        const redirecionou =
          tratarErro(
            erro,
            "Não foi possível carregar seus favoritos."
          );

        if (!redirecionou) {
          mostrarEstado(
            "Não foi possível carregar seus favoritos.",
            {
              icone:
                "⚠️",
            }
          );
        }
      } finally {
        estado.carregando =
          false;

        elementos.lista
          .setAttribute(
            "aria-busy",
            "false"
          );
      }
    }

    try {
      estado.contexto =
        await window.SessionGuard
          .exigirConta({
            destinoLogin:
              "/html/login-cliente.html",
          });

      if (
        !estado.contexto
      ) {
        return;
      }

      await carregarFavoritos();
    } catch (erro) {
      const redirecionou =
        tratarErro(
          erro,
          "Não foi possível validar sua sessão."
        );

      if (!redirecionou) {
        mostrarEstado(
          "Não foi possível abrir seus favoritos.",
          {
            icone:
              "⚠️",
          }
        );
      }
    }
  }
);