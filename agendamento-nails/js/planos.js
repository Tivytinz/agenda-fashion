document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const elementos = {
      lista:
        document.getElementById(
          "listaPlanos"
        ),

      mensagem:
        document.getElementById(
          "mensagemPlanos"
        ),
    };

    if (!elementos.lista) {
      console.error(
        "A lista de planos não foi encontrada."
      );

      return;
    }

    if (
      !window.API ||
      typeof window.API.get !==
        "function"
    ) {
      exibirErroLista(
        "O serviço da API não foi carregado."
      );

      return;
    }

    const estado = {
      planos: [],
      planoAtualId: null,
      planoAtualSlug: null,
      carregando: false,
      temporizadorMensagem: null,
    };

    function criarElemento(
      tag,
      classe = "",
      texto = null
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
        texto !== null &&
        texto !== undefined
      ) {
        elemento.textContent =
          String(texto);
      }

      return elemento;
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

    function normalizarTexto(
      valor
    ) {
      return String(
        valor ?? ""
      ).trim();
    }

    function converterNumero(
      valor,
      fallback = 0
    ) {
      const numero =
        Number(valor);

      return Number.isFinite(
        numero
      )
        ? numero
        : fallback;
    }

    function formatarPreco(
      valor
    ) {
      const numero =
        converterNumero(valor);

      if (numero <= 0) {
        return "Grátis";
      }

      return numero.toLocaleString(
        "pt-BR",
        {
          style:
            "currency",

          currency:
            "BRL",
        }
      );
    }

    function formatarCapacidade(
      capacidade
    ) {
      if (
        capacidade === null ||
        capacidade === undefined
      ) {
        return "Agendamentos ilimitados";
      }

      const quantidade =
        Math.max(
          Math.trunc(
            converterNumero(
              capacidade
            )
          ),
          0
        );

      return (
        `${quantidade} ` +
        `agendamento${
          quantidade === 1
            ? ""
            : "s"
        } por mês`
      );
    }

    function formatarLimite(
      limite,
      singular,
      plural
    ) {
      if (
        limite === null ||
        limite === undefined
      ) {
        return `${plural} ilimitados`;
      }

      const quantidade =
        Math.max(
          Math.trunc(
            converterNumero(
              limite
            )
          ),
          0
        );

      return (
        `${quantidade} ` +
        `${quantidade === 1 ? singular : plural}`
      );
    }

    function mostrarMensagem(
      texto,
      tipo = "erro",
      esconderDepois = false
    ) {
      if (!elementos.mensagem) {
        return;
      }

      window.clearTimeout(
        estado.temporizadorMensagem
      );

      elementos.mensagem
        .textContent =
          String(texto || "");

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

      if (esconderDepois) {
        estado.temporizadorMensagem =
          window.setTimeout(
            esconderMensagem,
            4000
          );
      }
    }

    function esconderMensagem() {
      if (!elementos.mensagem) {
        return;
      }

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
    }

    function criarEstadoLista(
      texto,
      {
        icone = "🚀",
        permitirTentativa = false,
      } = {}
    ) {
      const container =
        criarElemento(
          "div",
          "estado-vazio"
        );

      const conteudo =
        criarElemento(
          "div",
          "estado-vazio-conteudo"
        );

      const elementoIcone =
        criarElemento(
          "div",
          "estado-vazio-icone",
          icone
        );

      elementoIcone.setAttribute(
        "aria-hidden",
        "true"
      );

      const mensagem =
        criarElemento(
          "p",
          "",
          texto
        );

      conteudo.append(
        elementoIcone,
        mensagem
      );

      if (permitirTentativa) {
        const botao =
          criarElemento(
            "button",
            "af-btn-secondary",
            "Tentar novamente"
          );

        botao.type =
          "button";

        botao.addEventListener(
          "click",
          () => {
            void carregarPagina();
          }
        );

        conteudo.appendChild(
          botao
        );
      }

      container.appendChild(
        conteudo
      );

      return container;
    }

    function exibirErroLista(
      texto
    ) {
      elementos.lista
        .replaceChildren(
          criarEstadoLista(
            texto,
            {
              icone:
                "⚠️",

              permitirTentativa:
                true,
            }
          )
        );

      elementos.lista
        .setAttribute(
          "aria-busy",
          "false"
        );
    }

    function definirCarregando(
      carregando
    ) {
      estado.carregando =
        carregando;

      elementos.lista
        .setAttribute(
          "aria-busy",
          String(carregando)
        );

      if (carregando) {
        const estadoCarregando =
          criarElemento(
            "div",
            "estado-vazio"
          );

        const loading =
          criarElemento(
            "span",
            "af-loading"
          );

        const spinner =
          criarElemento(
            "span",
            "af-spinner"
          );

        spinner.setAttribute(
          "aria-hidden",
          "true"
        );

        loading.append(
          spinner,
          criarElemento(
            "span",
            "",
            "Carregando planos..."
          )
        );

        estadoCarregando
          .appendChild(
            loading
          );

        elementos.lista
          .replaceChildren(
            estadoCarregando
          );
      }
    }

    function planoEhAtual(
      plano
    ) {
      if (
        estado.planoAtualId !== null
      ) {
        return (
          Number(plano.id) ===
          Number(
            estado.planoAtualId
          )
        );
      }

      if (
        estado.planoAtualSlug
      ) {
        return (
          normalizarTexto(
            plano.slug
          ) ===
          estado.planoAtualSlug
        );
      }

      return false;
    }

    function criarBeneficio(
      texto
    ) {
      const beneficio =
        criarElemento(
          "span"
        );

      const icone =
        criarElemento(
          "b",
          "",
          "✓"
        );

      icone.setAttribute(
        "aria-hidden",
        "true"
      );

      beneficio.append(
        icone,
        document.createTextNode(
          texto
        )
      );

      return beneficio;
    }

    function criarCardPlano(
      plano
    ) {
      const destaque =
        Boolean(
          plano.destaque
        );

      const atual =
        planoEhAtual(
          plano
        );

      const gratuito =
        converterNumero(
          plano.valor
        ) <= 0;

      const card =
        criarElemento(
          "article",
          "plano-card af-card"
        );

      card.dataset.planoId =
        String(
          plano.id ?? ""
        );

      card.dataset.planoSlug =
        normalizarTexto(
          plano.slug
        );

      card.classList.toggle(
        "destaque",
        destaque &&
          !atual
      );

      card.classList.toggle(
        "plano-atual",
        atual
      );

      if (atual) {
        const seloAtual =
          criarElemento(
            "span",
            "af-badge",
            "✓ Seu plano atual"
          );

        card.appendChild(
          seloAtual
        );
      } else if (destaque) {
        const seloDestaque =
          criarElemento(
            "span",
            "af-badge",
            "✦ Mais recomendado"
          );

        card.appendChild(
          seloDestaque
        );
      }

      const titulo =
        criarElemento(
          "h2",
          "",
          plano.nome ||
          "Plano"
        );

      const preco =
        criarElemento(
          "div",
          "plano-preco"
        );

      preco.appendChild(
        document.createTextNode(
          formatarPreco(
            plano.valor
          )
        )
      );

      if (!gratuito) {
        preco.appendChild(
          criarElemento(
            "small",
            "",
            "/mês"
          )
        );
      }

      const beneficios =
        criarElemento(
          "div",
          "plano-beneficios"
        );

      beneficios.append(
        criarBeneficio(
          formatarCapacidade(
            plano
              .capacidade_agendamentos
          )
        ),

        criarBeneficio(
          formatarLimite(
            plano.limite_profissionais,
            "profissional",
            "profissionais"
          )
        ),

        criarBeneficio(
          formatarLimite(
            plano.limite_servicos,
            "serviço",
            "serviços"
          )
        ),

        criarBeneficio(
          "Perfil público do negócio"
        ),

        criarBeneficio(
          "Agendamento online"
        ),

        criarBeneficio(
          "Gestão da agenda e equipe"
        ),

        criarBeneficio(
          "Painel de crescimento"
        )
      );

      if (destaque) {
        beneficios.appendChild(
          criarBeneficio(
            "Plano recomendado para negócios em crescimento"
          )
        );
      }

      const botao =
        criarElemento(
          "button",
          atual
            ? "af-btn-secondary btn-disabled"
            : "af-btn-primary",
          atual
            ? "Plano atual"
            : gratuito
              ? "Começar grátis"
              : "Escolher este plano"
        );

      botao.type =
        "button";

      botao.disabled =
        atual;

      botao.setAttribute(
        "aria-label",
        atual
          ? `${plano.nome} é o seu plano atual`
          : `Escolher o plano ${plano.nome}`
      );

      if (!atual) {
        botao.addEventListener(
          "click",
          () => {
            selecionarPlano(
              plano
            );
          }
        );
      }

      card.append(
        titulo,
        preco,
        beneficios,
        botao
      );

      return card;
    }

    function renderizarPlanos() {
      elementos.lista
        .replaceChildren();

      if (!estado.planos.length) {
        elementos.lista
          .appendChild(
            criarEstadoLista(
              "Nenhum plano está disponível no momento.",
              {
                icone:
                  "📋",
              }
            )
          );

        elementos.lista
          .setAttribute(
            "aria-busy",
            "false"
          );

        return;
      }

      const fragmento =
        document.createDocumentFragment();

      estado.planos
        .forEach(
          (plano) => {
            fragmento.appendChild(
              criarCardPlano(
                plano
              )
            );
          }
        );

      elementos.lista
        .appendChild(
          fragmento
        );

      elementos.lista
        .setAttribute(
          "aria-busy",
          "false"
        );
    }

    function selecionarPlano(
      plano
    ) {
      esconderMensagem();

      const slug =
        normalizarTexto(
          plano.slug
        );

      if (!slug) {
        mostrarMensagem(
          "Este plano ainda não está disponível para contratação.",
          "aviso"
        );

        return;
      }

      if (
        planoEhAtual(
          plano
        )
      ) {
        mostrarMensagem(
          "Este já é o seu plano atual.",
          "sucesso",
          true
        );

        return;
      }

      const gratuito =
        converterNumero(
          plano.valor
        ) <= 0;

      if (gratuito) {
        mostrarMensagem(
          "Seu negócio já começa automaticamente no plano Grátis.",
          "aviso"
        );

        return;
      }

      window.location.href =
        `/html/checkout.html?plano=${
          encodeURIComponent(
            slug
          )
        }`;
    }

    async function buscarPlanos() {
      const resultado =
        await window.API.get(
          "/planos"
        );

      if (
        Array.isArray(
          resultado
        )
      ) {
        return resultado;
      }

      return Array.isArray(
        resultado?.planos
      )
        ? resultado.planos
        : [];
    }

    async function buscarPlanoAtual() {
      if (!obterToken()) {
        return null;
      }

      try {
        const resultado =
          await window.API.get(
            "/meu-plano"
          );

        return resultado || null;
      } catch (erro) {
        /*
         * 404 significa que a conta ainda
         * não possui um negócio vinculado.
         * A página de planos continua pública.
         */
        if (
          erro?.status === 404
        ) {
          return null;
        }

        if (
          erro?.status === 401 ||
          erro?.status === 403
        ) {
          console.warn(
            "Não foi possível identificar o plano atual.",
            erro
          );

          return null;
        }

        console.warn(
          "Erro ao consultar plano atual:",
          erro
        );

        return null;
      }
    }

    async function carregarPagina() {
      if (
        estado.carregando
      ) {
        return;
      }

      esconderMensagem();
      definirCarregando(true);

      try {
        const [
          planos,
          planoAtual,
        ] = await Promise.all([
          buscarPlanos(),
          buscarPlanoAtual(),
        ]);

        estado.planos =
          planos;

        estado.planoAtualId =
          planoAtual?.plano_id ??
          planoAtual?.plano?.id ??
          null;

        estado.planoAtualSlug =
          normalizarTexto(
            planoAtual?.plano_slug ??
            planoAtual?.plano?.slug
          ) || null;

        renderizarPlanos();
      } catch (erro) {
        console.error(
          "Erro ao carregar planos:",
          erro
        );

        exibirErroLista(
          erro?.message ||
          "Não foi possível carregar os planos."
        );

        mostrarMensagem(
          erro?.message ||
          "Não foi possível carregar os planos.",
          "erro"
        );
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

    window.addEventListener(
      "beforeunload",
      () => {
        window.clearTimeout(
          estado.temporizadorMensagem
        );
      }
    );

    await carregarPagina();
  }
);
