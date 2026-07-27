document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const elementos = {
      planoNome:
        document.getElementById(
          "planoNome"
        ),

      assinaturaStatus:
        document.getElementById(
          "assinaturaStatus"
        ),

      planoValor:
        document.getElementById(
          "planoValor"
        ),

      formaPagamento:
        document.getElementById(
          "formaPagamento"
        ),

      proximaCobranca:
        document.getElementById(
          "proximaCobranca"
        ),

      usoTexto:
        document.getElementById(
          "usoTexto"
        ),

      usoBarra:
        document.getElementById(
          "usoBarra"
        ),

      usoMensagem:
        document.getElementById(
          "usoMensagem"
        ),

      listaPagamentos:
        document.getElementById(
          "listaPagamentos"
        ),

      mensagem:
        document.getElementById(
          "mensagemAssinatura"
        ),

      btnAlterarPlano:
        document.getElementById(
          "btnAlterarPlano"
        ),

      btnNovoPix:
        document.getElementById(
          "btnNovoPix"
        ),

      btnCancelarAssinatura:
        document.getElementById(
          "btnCancelarAssinatura"
        ),
    };

    const obrigatorios = [
      elementos.planoNome,
      elementos.assinaturaStatus,
      elementos.planoValor,
      elementos.formaPagamento,
      elementos.proximaCobranca,
      elementos.usoTexto,
      elementos.usoBarra,
      elementos.usoMensagem,
      elementos.listaPagamentos,
    ];

    if (
      obrigatorios.some(
        (elemento) => !elemento
      )
    ) {
      console.error(
        "Elementos obrigatórios da página de assinatura não foram encontrados."
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
        "O serviço da API não foi carregado.",
        "erro"
      );

      return;
    }

    if (
      !window.AuthService ||
      typeof window.AuthService
        .limparSessao !==
        "function"
    ) {
      mostrarMensagem(
        "O serviço de autenticação não foi carregado.",
        "erro"
      );

      return;
    }

    if (
      !window.SessionGuard ||
      typeof window.SessionGuard
        .exigirConta !==
        "function"
    ) {
      window.location.replace(
        "/html/login-cliente.html"
      );

      return;
    }

    const estado = {
      contexto: null,
      dados: null,
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

    function formatarMoeda(
      valor
    ) {
      return converterNumero(
        valor
      ).toLocaleString(
        "pt-BR",
        {
          style:
            "currency",

          currency:
            "BRL",
        }
      );
    }

    function formatarData(
      valor
    ) {
      if (!valor) {
        return "-";
      }

      const texto =
        String(valor)
          .slice(0, 10);

      const partes =
        texto
          .split("-")
          .map(Number);

      if (
        partes.length !== 3 ||
        partes.some(
          (parte) =>
            !Number.isFinite(
              parte
            )
        )
      ) {
        return "-";
      }

      const [
        ano,
        mes,
        dia,
      ] = partes;

      const data =
        new Date(
          ano,
          mes - 1,
          dia
        );

      if (
        Number.isNaN(
          data.getTime()
        )
      ) {
        return "-";
      }

      return data
        .toLocaleDateString(
          "pt-BR",
          {
            day:
              "2-digit",

            month:
              "2-digit",

            year:
              "numeric",
          }
        );
    }

    function normalizarStatus(
      valor
    ) {
      return String(
        valor || ""
      )
        .trim()
        .toUpperCase();
    }

    function traduzirStatus(
      status,
      gratuito = false
    ) {
      if (gratuito) {
        return "Grátis";
      }

      const mapa = {
        ACTIVE:
          "Ativo",

        PENDING:
          "Pendente",

        OVERDUE:
          "Vencido",

        CANCELED:
          "Cancelado",

        CANCELLED:
          "Cancelado",

        INACTIVE:
          "Inativo",

        RECEIVED:
          "Pago",

        CONFIRMED:
          "Confirmado",

        REFUNDED:
          "Estornado",
      };

      const normalizado =
        normalizarStatus(
          status
        );

      return (
        mapa[normalizado] ||
        normalizado ||
        "-"
      );
    }

    function traduzirForma(
      forma
    ) {
      const mapa = {
        PIX:
          "PIX",

        CREDIT_CARD:
          "Cartão",

        DEBIT_CARD:
          "Cartão de débito",

        BOLETO:
          "Boleto",

        UNDEFINED:
          "-",
      };

      const normalizada =
        String(
          forma || ""
        )
          .trim()
          .toUpperCase();

      return (
        mapa[normalizada] ||
        forma ||
        "-"
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
        .classList.add(
          tipo
        );

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

    function redirecionarLogin() {
      window.AuthService
        .limparSessao();

      window.location.replace(
        "/html/login-cliente.html"
      );
    }

    function criarEstadoLista(
      texto,
      icone = "🧾"
    ) {
      const container =
        criarElemento(
          "div",
          "estado-vazio"
        );

      const conteudo =
        criarElemento(
          "div"
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

      conteudo.append(
        elementoIcone,
        criarElemento(
          "p",
          "",
          texto
        )
      );

      container.appendChild(
        conteudo
      );

      return container;
    }

    function definirCarregando(
      carregando
    ) {
      estado.carregando =
        carregando;

      elementos.listaPagamentos
        .setAttribute(
          "aria-busy",
          String(carregando)
        );

      [
        elementos.btnAlterarPlano,
        elementos.btnNovoPix,
        elementos.btnCancelarAssinatura,
      ].forEach(
        (botao) => {
          if (botao) {
            botao.disabled =
              carregando;
          }
        }
      );

      if (carregando) {
        elementos.listaPagamentos
          .replaceChildren(
            criarEstadoLista(
              "Carregando pagamentos...",
              "⏳"
            )
          );
      }
    }

    function definirStatus(
      status,
      gratuito,
      acessoAte = null
    ) {
      const elemento =
        elementos.assinaturaStatus;

      const normalizado =
        gratuito
          ? "FREE"
          : normalizarStatus(
              status
            );

      const cancelamentoAgendado =
        [
          "CANCELED",
          "CANCELLED",
        ].includes(
          normalizado
        ) &&
        acessoAte;

      elemento.textContent =
        cancelamentoAgendado
          ? `Ativo até ${formatarData(
              acessoAte
            )}`
          : traduzirStatus(
              normalizado,
              gratuito
            );

      elemento.dataset.status =
        normalizado;

      elemento.classList.remove(
        "pendente",
        "vencido",
        "cancelado"
      );

      if (
        normalizado ===
        "PENDING"
      ) {
        elemento.classList.add(
          "pendente"
        );
      }

      if (
        normalizado ===
        "OVERDUE"
      ) {
        elemento.classList.add(
          "vencido"
        );
      }

      if (
        [
          "CANCELED",
          "CANCELLED",
          "INACTIVE",
        ].includes(
          normalizado
        )
      ) {
        elemento.classList.add(
          "cancelado"
        );
      }
    }

    function renderizarPlano(
      dados
    ) {
      const plano =
        dados?.plano || {};

      const assinatura =
        dados?.assinatura ||
        null;

      const valor =
        converterNumero(
          plano.valor
        );

      const gratuito =
        valor <= 0;

      const status =
        normalizarStatus(
          assinatura?.status
        );

      const cancelada =
        [
          "CANCELED",
          "CANCELLED",
        ].includes(status);

      elementos.planoNome
        .textContent =
          plano.nome ||
          (
            gratuito
              ? "Plano gratuito"
              : "Plano"
          );

      elementos.planoValor
        .textContent =
          formatarMoeda(
            valor
          );

      elementos.formaPagamento
        .textContent =
          assinatura
            ? traduzirForma(
                assinatura
                  .forma_pagamento
              )
            : "-";

      elementos.proximaCobranca
        .textContent =
          assinatura &&
          !cancelada
            ? formatarData(
                assinatura
                  .data_proxima_cobranca
              )
            : "-";

      definirStatus(
        assinatura?.status,
        gratuito &&
          (
            !assinatura ||
            assinatura.ativo ===
              false
          ),
        assinatura?.ativo !==
          false
          ? assinatura
          ?.data_proxima_cobranca
          : null
      );

      configurarAcoes({
        plano,
        assinatura,
        gratuito,
      });
    }

    function renderizarUso(
      uso
    ) {
      const utilizados =
        Math.max(
          converterNumero(
            uso?.utilizados
          ),
          0
        );

      const limiteBruto =
        uso?.limite ??
        uso?.capacidade_agendamentos ??
        null;

      const ilimitado =
        limiteBruto === null ||
        limiteBruto === undefined;

      let percentual = 0;

      if (ilimitado) {
        elementos.usoTexto
          .textContent =
            `${utilizados} agendamento` +
            `${utilizados === 1 ? "" : "s"}`;

        elementos.usoMensagem
          .textContent =
            "Seu plano possui agendamentos ilimitados.";

        percentual = 100;
      } else {
        const limite =
          Math.max(
            converterNumero(
              limiteBruto
            ),
            0
          );

        percentual =
          limite > 0
            ? Math.min(
                Math.round(
                  (
                    utilizados /
                    limite
                  ) * 100
                ),
                100
              )
            : 0;

        const restantes =
          Math.max(
            limite -
              utilizados,
            0
          );

        elementos.usoTexto
          .textContent =
            `${utilizados} de ${limite}`;

        if (
          utilizados >=
          limite
        ) {
          elementos.usoMensagem
            .textContent =
              "A capacidade mensal do plano foi atingida.";
        } else {
          elementos.usoMensagem
            .textContent =
              `Você ainda possui ${restantes} ` +
              `agendamento${restantes === 1 ? "" : "s"} ` +
              "disponível" +
              `${restantes === 1 ? "" : "is"} neste mês.`;
        }
      }

      elementos.usoBarra
        .style.width =
          `${percentual}%`;

      const barra =
        elementos.usoBarra
          .parentElement;

      barra?.setAttribute(
        "aria-valuenow",
        String(percentual)
      );
    }

    function criarPagamento(
      pagamento
    ) {
      const item =
        criarElemento(
          "article",
          "pagamento-item"
        );

      const informacoes =
        criarElemento(
          "div"
        );

      const status =
        criarElemento(
          "strong",
          "",
          traduzirStatus(
            pagamento.status
          )
        );

      const dataPagamento =
        pagamento.data_pagamento
          ? `Pago em ${formatarData(
              pagamento
                .data_pagamento
            )}`
          : `Vencimento: ${formatarData(
              pagamento
                .data_vencimento
            )}`;

      const data =
        criarElemento(
          "span",
          "",
          dataPagamento
        );

      const valor =
        criarElemento(
          "strong",
          "",
          formatarMoeda(
            pagamento.valor
          )
        );

      informacoes.append(
        status,
        document.createElement(
          "br"
        ),
        data
      );

      item.append(
        informacoes,
        valor
      );

      return item;
    }

    function renderizarPagamentos(
      pagamentos
    ) {
      const lista =
        Array.isArray(
          pagamentos
        )
          ? pagamentos
          : [];

      elementos.listaPagamentos
        .replaceChildren();

      if (!lista.length) {
        elementos.listaPagamentos
          .appendChild(
            criarEstadoLista(
              "Nenhum pagamento encontrado.",
              "♡"
            )
          );

        return;
      }

      const fragmento =
        document.createDocumentFragment();

      lista.forEach(
        (pagamento) => {
          fragmento.appendChild(
            criarPagamento(
              pagamento
            )
          );
        }
      );

      elementos.listaPagamentos
        .appendChild(
          fragmento
        );
    }

    function configurarAcoes({
      plano,
      assinatura,
      gratuito,
    }) {
      const status =
        normalizarStatus(
          assinatura?.status
        );

      const possuiAssinaturaPaga =
        Boolean(
          assinatura &&
          converterNumero(
            plano?.valor
          ) > 0
        );

      if (
        elementos.btnAlterarPlano
      ) {
        elementos.btnAlterarPlano
          .disabled =
            false;

        elementos.btnAlterarPlano
          .textContent =
            gratuito
              ? "Conhecer planos"
              : "Alterar plano";
      }

      /*
       * Um plano gratuito não possui cobrança
       * para gerar ou assinatura paga para cancelar.
       */
      elementos.btnNovoPix
        ?.classList.toggle(
          "hidden",
          !possuiAssinaturaPaga
        );

      elementos.btnCancelarAssinatura
        ?.classList.toggle(
          "hidden",
          !possuiAssinaturaPaga ||
          [
            "CANCELED",
            "CANCELLED",
          ].includes(status)
        );

      if (
        elementos.btnNovoPix
      ) {
        elementos.btnNovoPix
          .disabled =
            ![
              "PENDING",
              "OVERDUE",
            ].includes(
              status
            );
      }

      if (
        elementos.btnCancelarAssinatura
      ) {
        elementos.btnCancelarAssinatura
          .disabled =
            ![
              "ACTIVE",
            ].includes(
              status
            );
      }
    }

    async function cancelarAssinatura() {
      if (
        estado.carregando
      ) {
        return;
      }

      const confirmou =
        window.confirm(
          "Deseja cancelar a renovação desta assinatura?\n\n" +
          "Seu plano continuará ativo até o fim do período já pago. " +
          "As próximas cobranças pendentes serão removidas."
        );

      if (!confirmou) {
        return;
      }

      const botao =
        elementos
          .btnCancelarAssinatura;

      const textoAnterior =
        botao?.textContent;

      if (botao) {
        botao.disabled = true;
        botao.textContent =
          "Cancelando...";
      }

      esconderMensagem();

      try {
        const resultado =
          await window.API.delete(
            "/minha-assinatura"
          );

        await carregarAssinatura();

        const acessoAteResultado =
          formatarData(
            resultado?.acesso_ate
          );

        mostrarMensagem(
          resultado?.mensagem ||
          (
            "Renovação cancelada. " +
            (
              acessoAteResultado !== "-"
                ? `Seu plano ficará ativo até ${acessoAteResultado}.`
                : "Seu plano ficará ativo até o fim do período já pago."
            )
          ),
          "sucesso"
        );
      } catch (erro) {
        console.error(
          "Erro ao cancelar assinatura:",
          erro
        );

        if (
          erro?.status === 401
        ) {
          redirecionarLogin();

          return;
        }

        mostrarMensagem(
          erro?.message ||
            "Não foi possível cancelar a renovação.",
          "erro"
        );
      } finally {
        if (
          botao &&
          !botao.classList
            .contains("hidden")
        ) {
          botao.textContent =
            textoAnterior ||
            "Cancelar assinatura";

          configurarAcoes({
            plano:
              estado.dados?.plano ||
              {},

            assinatura:
              estado.dados
                ?.assinatura ||
              null,

            gratuito:
              converterNumero(
                estado.dados
                  ?.plano
                  ?.valor
              ) <= 0,
          });
        }
      }
    }

    async function carregarAssinatura() {
      if (
        estado.carregando
      ) {
        return;
      }

      esconderMensagem();

      definirCarregando(
        true
      );

      try {
        const dados =
          await window.API.get(
            "/minha-assinatura"
          );

        estado.dados =
          dados || {};

        renderizarPlano(
          estado.dados
        );

        renderizarUso(
          estado.dados.uso ||
          {}
        );

        renderizarPagamentos(
          estado.dados
            .pagamentos ||
          []
        );
      } catch (erro) {
        console.error(
          "Erro ao carregar assinatura:",
          erro
        );

        if (
          erro?.status === 401
        ) {
          redirecionarLogin();

          return;
        }

        elementos.planoNome
          .textContent =
            "Não disponível";

        elementos.assinaturaStatus
          .textContent =
            "-";

        elementos.planoValor
          .textContent =
            "-";

        elementos.formaPagamento
          .textContent =
            "-";

        elementos.proximaCobranca
          .textContent =
            "-";

        elementos.usoTexto
          .textContent =
            "0 de 0";

        elementos.usoBarra
          .style.width =
            "0%";

        elementos.usoMensagem
          .textContent =
            "Não foi possível carregar o uso do plano.";

        elementos.listaPagamentos
          .replaceChildren(
            criarEstadoLista(
              "Não foi possível carregar os pagamentos.",
              "⚠️"
            )
          );

        mostrarMensagem(
          erro?.message ||
            "Não foi possível carregar sua assinatura.",
          "erro"
        );
      } finally {
        definirCarregando(
          false
        );

        if (estado.dados) {
          renderizarPlano(
            estado.dados
          );
        }
      }
    }

    function configurarEventos() {
      elementos.btnAlterarPlano
        ?.addEventListener(
          "click",
          () => {
            window.location.href =
              "/html/planos.html";
          }
        );

      elementos.btnNovoPix
        ?.addEventListener(
          "click",
          () => {
            mostrarMensagem(
              "A geração de uma nova cobrança PIX ainda será conectada ao backend.",
              "aviso",
              true
            );
          }
        );

      elementos.btnCancelarAssinatura
        ?.addEventListener(
          "click",
          () => {
            cancelarAssinatura();
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
    }

    async function iniciar() {
      configurarEventos();

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

        await carregarAssinatura();
      } catch (erro) {
        console.error(
          "Erro ao validar sessão:",
          erro
        );

        if (
          erro?.status === 401
        ) {
          redirecionarLogin();

          return;
        }

        mostrarMensagem(
          erro?.message ||
            "Não foi possível validar sua sessão.",
          "erro"
        );
      }
    }

    await iniciar();
  }
);
