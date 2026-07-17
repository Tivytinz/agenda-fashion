document.addEventListener(
  "DOMContentLoaded",
  () => {
    const elementos = {
      buscaNegocio:
        document.getElementById(
          "buscaNegocio"
        ),

      btnBuscarNegocio:
        document.getElementById(
          "btnBuscarNegocio"
        ),

      btnCriarNegocio:
        document.getElementById(
          "btnCriarNegocio"
        ),

      mensagem:
        document.getElementById(
          "mensagemEscolhaNegocio"
        ),

      listaNegocios:
        document.getElementById(
          "listaNegocios"
        ),

      linkVoltarLogin:
        document.getElementById(
          "linkVoltarLogin"
        ),
    };

    const elementosObrigatorios = [
      elementos.buscaNegocio,
      elementos.btnBuscarNegocio,
      elementos.btnCriarNegocio,
      elementos.mensagem,
      elementos.listaNegocios,
    ];

    if (
      elementosObrigatorios.some(
        (elemento) => !elemento
      )
    ) {
      console.error(
        "Elementos obrigatórios da página de escolha de negócio não foram encontrados."
      );

      return;
    }

    const estado = {
      buscando:
        false,

      entrandoNegocioId:
        null,

      redirecionando:
        false,

      temporizadorMensagem:
        null,
    };

    const textoBotaoBuscar =
      elementos.btnBuscarNegocio
        .textContent
        .trim() ||
      "Buscar negócio";

    const textoBotaoCriar =
      elementos.btnCriarNegocio
        .textContent
        .trim() ||
      "Criar negócio";

    /*
     * =====================================================
     * SERVIÇOS
     * =====================================================
     */

    if (
      !window.API ||
      typeof window.API.get !==
        "function" ||
      typeof window.API.post !==
        "function"
    ) {
      mostrarMensagem(
        "O serviço da API não foi carregado."
      );

      return;
    }

    function obterToken() {
      if (
        window.AuthService &&
        typeof window.AuthService
          .getToken ===
          "function"
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
          .limparSessao ===
          "function"
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

      sessionStorage.removeItem(
        "negocio"
      );
    }

    function redirecionarLogin() {
      if (
        estado.redirecionando
      ) {
        return;
      }

      estado.redirecionando =
        true;

      limparSessao();

      window.location.replace(
        "/html/login-profissional.html"
      );
    }

    if (!obterToken()) {
      redirecionarLogin();

      return;
    }

    /*
     * =====================================================
     * UTILITÁRIOS
     * =====================================================
     */

    function normalizarTexto(
      valor
    ) {
      return String(
        valor ?? ""
      )
        .trim()
        .replace(/\s+/g, " ");
    }

    function normalizarNegocioId(
      negocio
    ) {
      const negocioId =
        Number(
          negocio?.negocio_id ??
          negocio?.id
        );

      if (
        !Number.isInteger(
          negocioId
        ) ||
        negocioId <= 0
      ) {
        return null;
      }

      return negocioId;
    }

    function mostrarMensagem(
      texto,
      tipo = "erro",
      esconderDepois = false
    ) {
      window.clearTimeout(
        estado.temporizadorMensagem
      );

      elementos.mensagem
        .textContent =
          normalizarTexto(texto);

      elementos.mensagem
        .classList.remove(
          "hidden",
          "erro",
          "sucesso",
          "aviso"
        );

      elementos.mensagem
        .classList.add(tipo);

      elementos.mensagem
        .dataset.tipo =
          tipo;

      elementos.mensagem
        .style.color =
          tipo === "sucesso"
            ? "#2f9e63"
            : tipo === "aviso"
              ? "#b76a12"
              : "#e63946";

      if (
        esconderDepois
      ) {
        estado.temporizadorMensagem =
          window.setTimeout(
            esconderMensagem,
            3500
          );
      }
    }

    function esconderMensagem() {
      window.clearTimeout(
        estado.temporizadorMensagem
      );

      elementos.mensagem
        .textContent = "";

      elementos.mensagem
        .classList.add(
          "hidden"
        );

      elementos.mensagem
        .classList.remove(
          "erro",
          "sucesso",
          "aviso"
        );

      elementos.mensagem
        .removeAttribute(
          "data-tipo"
        );

      elementos.mensagem
        .style.removeProperty(
          "color"
        );
    }

    function limparErroCampo(
      campo
    ) {
      campo?.classList.remove(
        "input-error",
        "shake"
      );

      campo?.removeAttribute(
        "aria-invalid"
      );
    }

    function marcarErroCampo(
      campo
    ) {
      if (!campo) {
        return;
      }

      campo.classList.remove(
        "shake"
      );

      void campo.offsetWidth;

      campo.classList.add(
        "input-error",
        "shake"
      );

      campo.setAttribute(
        "aria-invalid",
        "true"
      );

      campo.focus();
    }

    function definirBuscando(
      ativo
    ) {
      estado.buscando =
        ativo;

      elementos.buscaNegocio
        .disabled =
          ativo;

      elementos.btnBuscarNegocio
        .disabled =
          ativo;

      elementos.btnCriarNegocio
        .disabled =
          ativo;

      elementos.btnBuscarNegocio
        .classList.toggle(
          "btn-disabled",
          ativo
        );

      elementos.btnBuscarNegocio
        .textContent =
          ativo
            ? "Buscando..."
            : textoBotaoBuscar;

      elementos.btnCriarNegocio
        .textContent =
          textoBotaoCriar;
    }

    function criarElemento(
      tag,
      classe,
      texto
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
        texto !== undefined &&
        texto !== null
      ) {
        elemento.textContent =
          String(texto);
      }

      return elemento;
    }

    function renderizarEstadoVazio(
      texto
    ) {
      elementos.listaNegocios
        .replaceChildren();

      const mensagemVazia =
        criarElemento(
          "p",
          "lista-negocios-vazia",
          texto
        );

      mensagemVazia.style.fontSize =
        "13px";

      mensagemVazia.style.color =
        "#7e768f";

      mensagemVazia.style.textAlign =
        "left";

      elementos.listaNegocios
        .appendChild(
          mensagemVazia
        );

      elementos.listaNegocios
        .classList.remove(
          "hidden"
        );
    }

    function tratarErroAcesso(
      erro
    ) {
      if (
        erro?.status === 401
      ) {
        redirecionarLogin();

        return true;
      }

      if (
        erro?.status === 403
      ) {
        mostrarMensagem(
          erro?.message ||
            "Sua conta não possui permissão para realizar esta operação.",
          "aviso"
        );

        return true;
      }

      return false;
    }

    function salvarNegocioSelecionado(
      resultado,
      negocioOriginal
    ) {
      const negocio =
        resultado?.negocio ||
        resultado?.vinculo?.negocio ||
        negocioOriginal;

      if (
        !normalizarNegocioId(
          negocio
        )
      ) {
        return;
      }

      localStorage.setItem(
        "negocio",
        JSON.stringify(
          negocio
        )
      );
    }

    function redirecionarPainel() {
      if (
        estado.redirecionando
      ) {
        return;
      }

      estado.redirecionando =
        true;

      document.body
        .classList.add(
          "page-exit"
        );

      window.setTimeout(
        () => {
          window.location.href =
            "/html/painel-profissional.html";
        },
        350
      );
    }

    /*
     * =====================================================
     * ENTRAR NO NEGÓCIO
     * =====================================================
     */

    async function entrarNoNegocio(
      negocio,
      botao
    ) {
      const negocioId =
        normalizarNegocioId(
          negocio
        );

      if (!negocioId) {
        mostrarMensagem(
          "O negócio selecionado possui um identificador inválido."
        );

        return;
      }

      if (
        estado.entrandoNegocioId
      ) {
        return;
      }

      esconderMensagem();

      estado.entrandoNegocioId =
        negocioId;

      const textoOriginal =
        botao.textContent;

      botao.disabled =
        true;

      botao.textContent =
        "Entrando...";

      try {
        const resultado =
          await window.API.post(
            "/entrar-negocio",
            {
              negocio_id:
                negocioId,
            }
          );

        salvarNegocioSelecionado(
          resultado,
          negocio
        );

        mostrarMensagem(
          resultado?.mensagem ||
            "Você entrou no negócio com sucesso.",
          "sucesso"
        );

        window.setTimeout(
          redirecionarPainel,
          650
        );
      } catch (erro) {
        console.error(
          "Erro ao entrar no negócio:",
          erro
        );

        if (
          tratarErroAcesso(
            erro
          )
        ) {
          return;
        }

        mostrarMensagem(
          erro?.message ||
            "Não foi possível entrar no negócio."
        );
      } finally {
        if (
          !estado.redirecionando
        ) {
          estado.entrandoNegocioId =
            null;

          botao.disabled =
            false;

          botao.textContent =
            textoOriginal;
        }
      }
    }

    /*
     * =====================================================
     * RENDERIZAÇÃO
     * =====================================================
     */

    function criarItemNegocio(
      negocio
    ) {
      const item =
        criarElemento(
          "div",
          "item-negocio"
        );

      const informacoes =
        criarElemento(
          "div",
          "item-negocio-info"
        );

      const nome =
        criarElemento(
          "strong",
          "",
          normalizarTexto(
            negocio?.nome,
          ) ||
          "Negócio sem nome"
        );

      const slug =
        criarElemento(
          "span",
          "",
          normalizarTexto(
            negocio?.slug
          ) ||
          "Sem endereço público"
        );

      informacoes.append(
        nome,
        slug
      );

      const botaoEntrar =
        criarElemento(
          "button",
          "btn-negocio-entrar",
          "Entrar"
        );

      botaoEntrar.type =
        "button";

      botaoEntrar.addEventListener(
        "click",
        () => {
          entrarNoNegocio(
            negocio,
            botaoEntrar
          );
        }
      );

      item.append(
        informacoes,
        botaoEntrar
      );

      return item;
    }

    function renderizarNegocios(
      negocios
    ) {
      elementos.listaNegocios
        .replaceChildren();

      const lista =
        Array.isArray(negocios)
          ? negocios
          : [];

      if (
        lista.length === 0
      ) {
        renderizarEstadoVazio(
          "Nenhum negócio encontrado."
        );

        return;
      }

      const fragmento =
        document.createDocumentFragment();

      lista.forEach(
        (negocio) => {
          const negocioId =
            normalizarNegocioId(
              negocio
            );

          if (!negocioId) {
            return;
          }

          fragmento.appendChild(
            criarItemNegocio(
              negocio
            )
          );
        }
      );

      if (
        fragmento.childNodes
          .length === 0
      ) {
        renderizarEstadoVazio(
          "Nenhum negócio válido foi encontrado."
        );

        return;
      }

      elementos.listaNegocios
        .appendChild(
          fragmento
        );

      elementos.listaNegocios
        .classList.remove(
          "hidden"
        );
    }

    /*
     * =====================================================
     * BUSCA
     * =====================================================
     */

    async function buscarNegocios() {
      if (
        estado.buscando ||
        estado.entrandoNegocioId
      ) {
        return;
      }

      esconderMensagem();

      limparErroCampo(
        elementos.buscaNegocio
      );

      elementos.listaNegocios
        .classList.add(
          "hidden"
        );

      elementos.listaNegocios
        .replaceChildren();

      const termo =
        normalizarTexto(
          elementos.buscaNegocio
            .value
        );

      if (!termo) {
        marcarErroCampo(
          elementos.buscaNegocio
        );

        mostrarMensagem(
          "Digite o nome do negócio para buscar."
        );

        return;
      }

      if (
        termo.length < 2
      ) {
        marcarErroCampo(
          elementos.buscaNegocio
        );

        mostrarMensagem(
          "Digite pelo menos 2 caracteres para buscar."
        );

        return;
      }

      definirBuscando(
        true
      );

      try {
        const resultado =
          await window.API.get(
            `/negocios/buscar?termo=${
              encodeURIComponent(
                termo
              )
            }`
          );

        renderizarNegocios(
          resultado?.negocios ||
          resultado?.resultados ||
          []
        );
      } catch (erro) {
        console.error(
          "Erro ao buscar negócios:",
          erro
        );

        if (
          tratarErroAcesso(
            erro
          )
        ) {
          return;
        }

        renderizarEstadoVazio(
          "Não foi possível carregar os negócios."
        );

        mostrarMensagem(
          erro?.message ||
            "Não foi possível buscar negócios."
        );
      } finally {
        definirBuscando(
          false
        );
      }
    }

    /*
     * =====================================================
     * EVENTOS
     * =====================================================
     */

    elementos.btnBuscarNegocio
      .addEventListener(
        "click",
        buscarNegocios
      );

    elementos.buscaNegocio
      .addEventListener(
        "input",
        () => {
          limparErroCampo(
            elementos.buscaNegocio
          );

          esconderMensagem();
        }
      );

    elementos.buscaNegocio
      .addEventListener(
        "keydown",
        (evento) => {
          if (
            evento.key ===
            "Enter"
          ) {
            evento.preventDefault();

            buscarNegocios();
          }
        }
      );

    elementos.btnCriarNegocio
      .addEventListener(
        "click",
        () => {
          if (
            estado.buscando ||
            estado.entrandoNegocioId
          ) {
            return;
          }

          document.body
            .classList.add(
              "page-exit"
            );

          window.setTimeout(
            () => {
              window.location.href =
                "/html/criar-negocio.html";
            },
            350
          );
        }
      );

    elementos.linkVoltarLogin
      ?.addEventListener(
        "click",
        (evento) => {
          evento.preventDefault();

          redirecionarLogin();
        }
      );

    window.addEventListener(
      "beforeunload",
      () => {
        window.clearTimeout(
          estado.temporizadorMensagem
        );
      }
    );

    elementos.buscaNegocio
      .focus();
  }
);