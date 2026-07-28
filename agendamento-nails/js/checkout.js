document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const elementos = {
      checkoutResumo:
        document.getElementById(
          "checkoutResumo"
        ),

      checkoutTotal:
        document.getElementById(
          "checkoutTotal"
        ),

      cartaoCampos:
        document.getElementById(
          "cartaoCampos"
        ),

      btnConfirmar:
        document.getElementById(
          "btnConfirmarCheckout"
        ),

      mensagem:
        document.getElementById(
          "mensagemCheckout"
        ),

      pixBox:
        document.getElementById(
          "pixBox"
        ),

      pixQrCode:
        document.getElementById(
          "pixQrCode"
        ),

      pixCopiaCola:
        document.getElementById(
          "pixCopiaCola"
        ),

      btnCopiarPix:
        document.getElementById(
          "btnCopiarPix"
        ),

      nomeCartao:
        document.getElementById(
          "nomeCartao"
        ),

      numeroCartao:
        document.getElementById(
          "numeroCartao"
        ),

      validadeCartao:
        document.getElementById(
          "validadeCartao"
        ),

      cvvCartao:
        document.getElementById(
          "cvvCartao"
        ),

      cpfCnpj:
        document.getElementById(
          "cpfCnpj"
        ),

      formasPagamento:
        Array.from(
          document.querySelectorAll(
            "input[name='formaPagamento']"
          )
        ),
    };

    const elementosObrigatorios = [
      elementos.checkoutResumo,
      elementos.checkoutTotal,
      elementos.btnConfirmar,
      elementos.mensagem,
      elementos.cpfCnpj,
    ];

    if (
      elementosObrigatorios.some(
        (elemento) => !elemento
      )
    ) {
      console.error(
        "A estrutura necessária do checkout não foi encontrada."
      );

      return;
    }

    const estado = {
      planoSelecionado: null,
      processando: false,
      pagamentoGerado: false,
      pixGerado: false,
      temporizadorStatus: null,
      temporizadorRedirecionamento:
        null,
      verificacaoStatusAtiva: false,
      tentativasStatus: 0,
      chaveIdempotencia: null,
    };

    const parametros =
      new URLSearchParams(
        window.location.search
      );

    const planoSlug =
      String(
        parametros.get("plano") ||
        ""
      ).trim();

    const formatadorMoeda =
      new Intl.NumberFormat(
        "pt-BR",
        {
          style: "currency",
          currency: "BRL",
        }
      );

    /*
     * =====================================================
     * SESSÃO
     * =====================================================
     */

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
    }

    function redirecionarLogin() {
      limparSessao();

      window.location.replace(
        "/html/login-profissional.html"
      );
    }

    function tratarErroSessao(
      erro
    ) {
      if (
        erro?.status !== 401
      ) {
        return false;
      }

      redirecionarLogin();

      return true;
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
      ).trim();
    }

    function normalizarNumero(
      valor
    ) {
      const numero =
        Number(valor);

      return Number.isFinite(
        numero
      )
        ? numero
        : 0;
    }

    function formatarMoeda(
      valor
    ) {
      return formatadorMoeda
        .format(
          normalizarNumero(
            valor
          )
        );
    }

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

    /*
     * =====================================================
     * MENSAGENS
     * =====================================================
     */

    function limparMensagem() {
      elementos.mensagem
        .textContent = "";

      elementos.mensagem
        .className =
          "checkout-mensagem hidden";

      delete elementos.mensagem
        .dataset.tipo;
    }

    function mostrarMensagem(
      texto,
      tipo = "erro"
    ) {
      elementos.mensagem
        .textContent =
          normalizarTexto(texto) ||
          "Ocorreu um erro.";

      elementos.mensagem
        .className =
          "checkout-mensagem";

      elementos.mensagem
        .classList.add(
          tipo
        );

      elementos.mensagem
        .dataset.tipo =
          tipo;
    }

    /*
     * =====================================================
     * BOTÕES
     * =====================================================
     */

    function definirTextoBotaoConfirmar(
      texto,
      icone = "🔒"
    ) {
      elementos.btnConfirmar
        .replaceChildren();

      const elementoIcone =
        criarElemento(
          "span",
          "",
          icone
        );

      elementoIcone.setAttribute(
        "aria-hidden",
        "true"
      );

      elementos.btnConfirmar.append(
        elementoIcone,
        document.createTextNode(
          ` ${texto}`
        )
      );
    }

    function definirTextoBotaoCopiar(
      texto,
      icone = "📋"
    ) {
      if (
        !elementos.btnCopiarPix
      ) {
        return;
      }

      elementos.btnCopiarPix
        .replaceChildren();

      const elementoIcone =
        criarElemento(
          "span",
          "",
          icone
        );

      elementoIcone.setAttribute(
        "aria-hidden",
        "true"
      );

      elementos.btnCopiarPix.append(
        elementoIcone,
        document.createTextNode(
          ` ${texto}`
        )
      );
    }

    function definirProcessando(
      ativo,
      texto =
        "Processando pagamento..."
    ) {
      estado.processando =
        Boolean(ativo);

      elementos.btnConfirmar.disabled =
        estado.processando ||
        !estado.planoSelecionado ||
        estado.pagamentoGerado;

      elementos.formasPagamento
        .forEach(
          (input) => {
            input.disabled =
              estado.processando ||
              estado.pagamentoGerado;
          }
        );

      if (estado.processando) {
        definirTextoBotaoConfirmar(
          texto,
          "⏳"
        );

        return;
      }

      if (
        estado.pagamentoGerado
      ) {
        definirTextoBotaoConfirmar(
          "Pagamento gerado",
          "✓"
        );

        return;
      }

      definirTextoBotaoConfirmar(
        "Confirmar assinatura",
        "🔒"
      );
    }

    /*
     * =====================================================
     * PLANO
     * =====================================================
     */

    function formaPagamentoSelecionada() {
      return (
        elementos.formasPagamento
          .find(
            (input) =>
              input.checked
          )?.value ||
        "pix"
      );
    }

    function criarChaveIdempotencia() {
      if (
        window.crypto &&
        typeof window.crypto.randomUUID ===
          "function"
      ) {
        return window.crypto.randomUUID();
      }

      return [
        "checkout",
        Date.now(),
        Math.random()
          .toString(36)
          .slice(2),
        Math.random()
          .toString(36)
          .slice(2),
      ].join("-");
    }

    function criarItemBeneficio(
      texto
    ) {
      const item =
        criarElemento("li");

      item.append(
        document.createTextNode(
          `✅ ${texto}`
        )
      );

      return item;
    }

    function renderizarPlano(
      plano
    ) {
      elementos.checkoutResumo
        .replaceChildren();

      const titulo =
        criarElemento(
          "h1",
          "",
          plano.nome ||
          "Plano"
        );

      const preco =
        criarElemento(
          "p",
          "",
          `${formatarMoeda(
            plano.valor
          )} / mês`
        );

      const lista =
        criarElemento("ul");

      const capacidadeBruta =
        plano.capacidade_agendamentos ??
        plano.limite_agendamentos ??
        null;

      const capacidadeTexto =
        capacidadeBruta === null
          ? "Agendamentos ilimitados"
          : `${normalizarNumero(
              capacidadeBruta
            )} agendamentos por mês`;

      const limiteProfissionais =
        plano.limite_profissionais;

      const profissionaisTexto =
        limiteProfissionais === null ||
        limiteProfissionais === undefined
          ? "Profissionais ilimitados"
          : `${normalizarNumero(
              limiteProfissionais
            )} ${
              normalizarNumero(
                limiteProfissionais
              ) === 1
                ? "profissional"
                : "profissionais"
            }`;

      const limiteServicos =
        plano.limite_servicos;

      const servicosTexto =
        limiteServicos === null ||
        limiteServicos === undefined
          ? "Serviços ilimitados"
          : `${normalizarNumero(
              limiteServicos
            )} serviço${
              normalizarNumero(
                limiteServicos
              ) === 1
                ? ""
                : "s"
            }`;

      const beneficios = [
        capacidadeTexto,
        profissionaisTexto,
        servicosTexto,
        "Perfil público do negócio",
        "Dashboard de crescimento",
        "Gestão da agenda e da equipe",
      ];

      if (plano.destaque) {
        beneficios.push(
          "Mais visibilidade no Agenda Fashion"
        );
      }

      beneficios.forEach(
        (beneficio) => {
          lista.appendChild(
            criarItemBeneficio(
              beneficio
            )
          );
        }
      );

      elementos.checkoutResumo.append(
        titulo,
        preco,
        lista
      );

      elementos.checkoutTotal
        .textContent =
          formatarMoeda(
            plano.valor
          );
    }

    function extrairPlanos(
      resposta
    ) {
      if (
        Array.isArray(resposta)
      ) {
        return resposta;
      }

      if (
        Array.isArray(
          resposta?.planos
        )
      ) {
        return resposta.planos;
      }

      return [];
    }

    async function carregarPlano() {
      if (!planoSlug) {
        throw new Error(
          "Plano não informado. Volte para a página de planos e escolha uma opção."
        );
      }

      const resposta =
        await window.API.get(
          "/planos"
        );

      const planos =
        extrairPlanos(
          resposta
        );

      const plano =
        planos.find(
          (item) =>
            normalizarTexto(
              item?.slug
            ) === planoSlug
        );

      if (!plano) {
        throw new Error(
          "O plano selecionado não foi encontrado."
        );
      }

      if (
        normalizarNumero(
          plano.valor
        ) <= 0
      ) {
        throw new Error(
          "Este plano não precisa de pagamento."
        );
      }

      estado.planoSelecionado =
        plano;

      renderizarPlano(
        plano
      );

      definirProcessando(
        false
      );
    }

    /*
     * =====================================================
     * FORMA DE PAGAMENTO
     * =====================================================
     */

    function alternarCamposCartao() {
      const usandoCartao =
        formaPagamentoSelecionada() ===
        "cartao";

      elementos.cartaoCampos
        ?.classList.toggle(
          "hidden",
          !usandoCartao
        );

      if (usandoCartao) {
        elementos.pixBox
          ?.classList.add(
            "hidden"
          );
      } else if (
        estado.pixGerado
      ) {
        elementos.pixBox
          ?.classList.remove(
            "hidden"
          );
      }

      limparMensagem();
    }

    /*
     * =====================================================
     * MÁSCARAS DO CARTÃO
     * =====================================================
     */

    function formatarNumeroCartao(
      valor
    ) {
      return normalizarTexto(
        valor
      )
        .replace(
          /\D/g,
          ""
        )
        .slice(
          0,
          19
        )
        .replace(
          /(\d{4})(?=\d)/g,
          "$1 "
        );
    }

    function formatarValidade(
      valor
    ) {
      const numeros =
        normalizarTexto(
          valor
        )
          .replace(
            /\D/g,
            ""
          )
          .slice(
            0,
            4
          );

      if (
        numeros.length <= 2
      ) {
        return numeros;
      }

      return `${numeros.slice(
        0,
        2
      )}/${numeros.slice(2)}`;
    }

    function normalizarDocumento(
      valor
    ) {
      return normalizarTexto(
        valor
      ).replace(/\D/g, "");
    }

    function calcularDigitoDocumento(
      documento,
      pesos
    ) {
      const soma = pesos.reduce(
        (total, peso, indice) =>
          total +
          Number(documento[indice]) *
          peso,
        0
      );

      const resto = soma % 11;

      return resto < 2
        ? 0
        : 11 - resto;
    }

    function documentoValido(
      valor
    ) {
      const documento =
        normalizarDocumento(valor);

      if (
        ![11, 14].includes(
          documento.length
        ) ||
        /^(\d)\1+$/.test(
          documento
        )
      ) {
        return false;
      }

      const pesos =
        documento.length === 11
          ? [
              [10, 9, 8, 7, 6, 5, 4, 3, 2],
              [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
            ]
          : [
              [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
              [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
            ];

      const indicePrimeiro =
        documento.length - 2;

      return (
        calcularDigitoDocumento(
          documento,
          pesos[0]
        ) ===
          Number(
            documento[
              indicePrimeiro
            ]
          ) &&
        calcularDigitoDocumento(
          documento,
          pesos[1]
        ) ===
          Number(
            documento[
              indicePrimeiro + 1
            ]
          )
      );
    }

    function formatarDocumento(
      valor
    ) {
      const documento =
        normalizarDocumento(
          valor
        ).slice(0, 14);

      if (documento.length <= 11) {
        return documento
          .replace(
            /(\d{3})(\d)/,
            "$1.$2"
          )
          .replace(
            /(\d{3})(\d)/,
            "$1.$2"
          )
          .replace(
            /(\d{3})(\d{1,2})$/,
            "$1-$2"
          );
      }

      return documento
        .replace(
          /^(\d{2})(\d)/,
          "$1.$2"
        )
        .replace(
          /^(\d{2})\.(\d{3})(\d)/,
          "$1.$2.$3"
        )
        .replace(
          /\.(\d{3})(\d)/,
          ".$1/$2"
        )
        .replace(
          /(\d{4})(\d)/,
          "$1-$2"
        );
    }

    function validarDocumentoCobranca() {
      const documento =
        normalizarDocumento(
          elementos.cpfCnpj
            ?.value
        );

      if (
        !documentoValido(
          documento
        )
      ) {
        elementos.cpfCnpj
          ?.focus();

        throw new Error(
          "Informe um CPF ou CNPJ válido."
        );
      }

      return documento;
    }

    function configurarMascaras() {
      elementos.cpfCnpj
        ?.addEventListener(
          "input",
          (evento) => {
            evento.target.value =
              formatarDocumento(
                evento.target.value
              );

            estado.chaveIdempotencia =
              null;
          }
        );

      elementos.numeroCartao
        ?.addEventListener(
          "input",
          (evento) => {
            evento.target.value =
              formatarNumeroCartao(
                evento.target.value
              );
          }
        );

      elementos.validadeCartao
        ?.addEventListener(
          "input",
          (evento) => {
            evento.target.value =
              formatarValidade(
                evento.target.value
              );
          }
        );

      elementos.cvvCartao
        ?.addEventListener(
          "input",
          (evento) => {
            evento.target.value =
              normalizarTexto(
                evento.target.value
              )
                .replace(
                  /\D/g,
                  ""
                )
                .slice(
                  0,
                  4
                );
          }
        );
    }

    /*
     * =====================================================
     * VALIDAÇÃO DO CARTÃO
     * =====================================================
     */

    function cartaoPassaNoLuhn(
      numero
    ) {
      let soma = 0;
      let deveDobrar =
        false;

      for (
        let indice =
          numero.length - 1;
        indice >= 0;
        indice -= 1
      ) {
        let digito =
          Number(
            numero[indice]
          );

        if (deveDobrar) {
          digito *= 2;

          if (
            digito > 9
          ) {
            digito -= 9;
          }
        }

        soma += digito;

        deveDobrar =
          !deveDobrar;
      }

      return (
        soma % 10 === 0
      );
    }

    function validarValidadeCartao(
      validade
    ) {
      const correspondencia =
        /^(\d{2})\/(\d{2})$/
          .exec(
            validade
          );

      if (
        !correspondencia
      ) {
        return false;
      }

      const mes =
        Number(
          correspondencia[1]
        );

      const ano =
        2000 +
        Number(
          correspondencia[2]
        );

      if (
        mes < 1 ||
        mes > 12
      ) {
        return false;
      }

      const agora =
        new Date();

      const fimDoMes =
        new Date(
          ano,
          mes,
          0,
          23,
          59,
          59,
          999
        );

      return (
        fimDoMes >= agora
      );
    }

    function validarCartao() {
      const nome =
        normalizarTexto(
          elementos.nomeCartao
            ?.value
        );

      const numero =
        normalizarTexto(
          elementos.numeroCartao
            ?.value
        ).replace(
          /\D/g,
          ""
        );

      const validade =
        normalizarTexto(
          elementos.validadeCartao
            ?.value
        );

      const cvv =
        normalizarTexto(
          elementos.cvvCartao
            ?.value
        ).replace(
          /\D/g,
          ""
        );

      if (
        nome.length < 3
      ) {
        elementos.nomeCartao
          ?.focus();

        throw new Error(
          "Informe o nome impresso no cartão."
        );
      }

      if (
        numero.length < 13 ||
        numero.length > 19 ||
        !cartaoPassaNoLuhn(
          numero
        )
      ) {
        elementos.numeroCartao
          ?.focus();

        throw new Error(
          "Informe um número de cartão válido."
        );
      }

      if (
        !validarValidadeCartao(
          validade
        )
      ) {
        elementos.validadeCartao
          ?.focus();

        throw new Error(
          "Informe uma validade futura no formato MM/AA."
        );
      }

      if (
        cvv.length < 3 ||
        cvv.length > 4
      ) {
        elementos.cvvCartao
          ?.focus();

        throw new Error(
          "Informe um CVV válido."
        );
      }

      return {
        nome,
        numero,
        validade,
        cvv,
      };
    }

    /*
     * =====================================================
     * STATUS DO PAGAMENTO
     * =====================================================
     */

    function obterStatusPagamento(
      resposta
    ) {
      return normalizarTexto(
        resposta?.status ??
        resposta?.pagamento?.status ??
        resposta?.assinatura?.status
      ).toUpperCase();
    }

    function pagamentoConfirmado(
      resposta
    ) {
      const status =
        obterStatusPagamento(
          resposta
        );

      return (
        [
          "CONFIRMED",
          "RECEIVED",
          "PAID",
          "ACTIVE",
        ].includes(
          status
        ) ||
        resposta?.ativo === true ||
        resposta?.assinatura
          ?.ativo === true
      );
    }

    function obterPagamentoId(
      resposta
    ) {
      return (
        resposta?.pagamento?.id ??
        resposta?.pagamento_id ??
        resposta?.payment_id ??
        resposta?.id ??
        null
      );
    }

    function obterNomePlanoStatus(
      resposta
    ) {
      return normalizarTexto(
        resposta?.plano_nome ??
        resposta?.plano?.nome ??
        estado.planoSelecionado
          ?.nome
      );
    }

    function concluirPagamento(
      resposta = {}
    ) {
      estado.verificacaoStatusAtiva =
        false;

      window.clearTimeout(
        estado.temporizadorStatus
      );

      const nomePlano =
        obterNomePlanoStatus(
          resposta
        );

      mostrarMensagem(
        nomePlano
          ? `Pagamento confirmado. O plano ${nomePlano} foi ativado.`
          : "Pagamento confirmado e assinatura ativada.",
        "sucesso"
      );

      definirTextoBotaoConfirmar(
        "Assinatura confirmada",
        "✓"
      );

      estado
        .temporizadorRedirecionamento =
          window.setTimeout(
            () => {
              window.location.replace(
                "/html/dashboard-dono.html"
              );
            },
            1600
          );
    }

    async function verificarStatusPagamento(
      pagamentoId
    ) {
      if (
        !estado.verificacaoStatusAtiva
      ) {
        return;
      }

      try {
        estado.tentativasStatus +=
          1;

        const resposta =
          await window.API.get(
            `/checkout/status/${encodeURIComponent(
              pagamentoId
            )}`
          );

        if (
          pagamentoConfirmado(
            resposta
          )
        ) {
          concluirPagamento(
            resposta
          );

          return;
        }

        if (
          estado.tentativasStatus >=
          24
        ) {
          estado
            .verificacaoStatusAtiva =
              false;

          mostrarMensagem(
            "O pagamento foi gerado. Assim que ele for confirmado, seu plano será ativado automaticamente.",
            "aviso"
          );

          return;
        }
      } catch (erro) {
        if (
          tratarErroSessao(
            erro
          )
        ) {
          return;
        }

        console.error(
          "Erro ao verificar pagamento:",
          erro
        );

        if (
          estado.tentativasStatus >=
          24
        ) {
          estado
            .verificacaoStatusAtiva =
              false;

          mostrarMensagem(
            "Não foi possível acompanhar a confirmação agora. Consulte sua assinatura em alguns instantes.",
            "aviso"
          );

          return;
        }
      }

      const intervalo =
        estado.tentativasStatus <= 6
          ? 5000
          : estado.tentativasStatus <= 12
            ? 10000
            : 20000;

      estado.temporizadorStatus =
        window.setTimeout(
          () => {
            verificarStatusPagamento(
              pagamentoId
            );
          },
          intervalo
        );
    }

    function iniciarVerificacaoPagamento(
      pagamentoId
    ) {
      if (!pagamentoId) {
        mostrarMensagem(
          "Pagamento gerado. A confirmação será processada automaticamente.",
          "sucesso"
        );

        return;
      }

      window.clearTimeout(
        estado.temporizadorStatus
      );

      estado.verificacaoStatusAtiva =
        true;

      estado.tentativasStatus =
        0;

      mostrarMensagem(
        "Pagamento gerado. Aguardando a confirmação...",
        "sucesso"
      );

      estado.temporizadorStatus =
        window.setTimeout(
          () => {
            verificarStatusPagamento(
              pagamentoId
            );
          },
          2500
        );
    }

    /*
     * =====================================================
     * PIX
     * =====================================================
     */

    function extrairPix(
      resposta
    ) {
      const pix =
        resposta?.pix ||
        resposta?.pagamento?.pix ||
        {};

      return {
        imagem:
          pix.encodedImage ??
          pix.encoded_image ??
          pix.qrCodeImage ??
          pix.qr_code_image ??
          resposta?.encodedImage ??
          "",

        codigo:
          pix.payload ??
          pix.copiaCola ??
          pix.copia_cola ??
          pix.qrCode ??
          pix.qr_code ??
          resposta?.payload ??
          "",
      };
    }

    function mostrarPix(
      resposta
    ) {
      const pix =
        extrairPix(
          resposta
        );

      if (
        pix.imagem &&
        elementos.pixQrCode
      ) {
        elementos.pixQrCode.src =
          pix.imagem.startsWith(
            "data:image/"
          )
            ? pix.imagem
            : `data:image/png;base64,${pix.imagem}`;
      }

      if (
        elementos.pixCopiaCola
      ) {
        elementos.pixCopiaCola
          .value =
            pix.codigo;
      }

      estado.pixGerado =
        true;

      elementos.pixBox
        ?.classList.remove(
          "hidden"
        );

      elementos.pixBox
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

      iniciarVerificacaoPagamento(
        obterPagamentoId(
          resposta
        )
      );
    }

    async function copiarTexto(
      texto
    ) {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard
          .writeText(
            texto
          );

        return;
      }

      const campo =
        document.createElement(
          "textarea"
        );

      campo.value =
        texto;

      campo.setAttribute(
        "readonly",
        ""
      );

      campo.style.position =
        "fixed";

      campo.style.opacity =
        "0";

      document.body.appendChild(
        campo
      );

      campo.select();

      const copiado =
        document.execCommand(
          "copy"
        );

      campo.remove();

      if (!copiado) {
        throw new Error(
          "Não foi possível copiar o código PIX."
        );
      }
    }

    async function copiarCodigoPix() {
      const codigo =
        normalizarTexto(
          elementos.pixCopiaCola
            ?.value
        );

      if (!codigo) {
        mostrarMensagem(
          "O código PIX ainda não foi carregado.",
          "aviso"
        );

        return;
      }

      try {
        await copiarTexto(
          codigo
        );

        definirTextoBotaoCopiar(
          "Código copiado",
          "✓"
        );

        window.setTimeout(
          () => {
            definirTextoBotaoCopiar(
              "Copiar código PIX",
              "📋"
            );
          },
          1700
        );
      } catch (erro) {
        mostrarMensagem(
          erro?.message ||
          "Não foi possível copiar o código PIX.",
          "erro"
        );
      }
    }

    /*
     * =====================================================
     * CONFIRMAÇÃO
     * =====================================================
     */

    async function confirmarCheckout() {
      if (
        estado.processando ||
        estado.pagamentoGerado
      ) {
        return;
      }

      limparMensagem();

      try {
        if (
          !estado.planoSelecionado
        ) {
          throw new Error(
            "O plano ainda não foi carregado."
          );
        }

        const forma =
          formaPagamentoSelecionada();

        const cpfCnpj =
          validarDocumentoCobranca();

        const cartao =
          forma === "cartao"
            ? validarCartao()
            : null;

        estado.chaveIdempotencia =
          estado.chaveIdempotencia ||
          criarChaveIdempotencia();

        definirProcessando(
          true,
          forma === "pix"
            ? "Gerando PIX..."
            : "Processando cartão..."
        );

        elementos.pixBox
          ?.classList.add(
            "hidden"
          );

        const resposta =
          await window.API.post(
            "/checkout",
            {
              plano_id:
                estado
                  .planoSelecionado
                  .id,

              plano_slug:
                estado
                  .planoSelecionado
                  .slug,

              forma_pagamento:
                forma,

              cpf_cnpj:
                cpfCnpj,

              cartao,
            },
            {
              headers: {
                "Idempotency-Key":
                  estado.chaveIdempotencia,
              },
            }
          );

        estado.pagamentoGerado =
          true;

        definirProcessando(
          false
        );

        if (
          pagamentoConfirmado(
            resposta
          )
        ) {
          concluirPagamento(
            resposta
          );

          return;
        }

        if (
          forma === "pix"
        ) {
          mostrarPix(
            resposta
          );

          return;
        }

        mostrarMensagem(
          resposta?.mensagem ||
          "Pagamento enviado para processamento.",
          "sucesso"
        );

        iniciarVerificacaoPagamento(
          obterPagamentoId(
            resposta
          )
        );
      } catch (erro) {
        console.error(
          "Erro ao gerar pagamento:",
          erro
        );

        if (
          tratarErroSessao(
            erro
          )
        ) {
          return;
        }

        estado.pagamentoGerado =
          false;

        definirProcessando(
          false
        );

        mostrarMensagem(
          erro?.message ||
          "Não foi possível gerar o pagamento.",
          "erro"
        );
      }
    }

    /*
     * =====================================================
     * ERRO DE CARREGAMENTO
     * =====================================================
     */

    function mostrarErroCarregamento(
      erro
    ) {
      elementos.checkoutResumo
        .replaceChildren(
          criarElemento(
            "div",
            "estado-vazio",
            erro?.message ||
            "Não foi possível carregar o plano."
          )
        );

      elementos.checkoutTotal
        .textContent =
          formatarMoeda(0);

      estado.planoSelecionado =
        null;

      definirProcessando(
        false
      );
    }

    /*
     * =====================================================
     * EVENTOS
     * =====================================================
     */

    elementos.formasPagamento
      .forEach(
        (input) => {
          input.addEventListener(
            "change",
            () => {
              estado.chaveIdempotencia =
                null;

              alternarCamposCartao();
            }
          );
        }
      );

    elementos.btnConfirmar
      .addEventListener(
        "click",
        confirmarCheckout
      );

    elementos.btnCopiarPix
      ?.addEventListener(
        "click",
        copiarCodigoPix
      );

    window.addEventListener(
      "beforeunload",
      () => {
        estado.verificacaoStatusAtiva =
          false;

        window.clearTimeout(
          estado.temporizadorStatus
        );

        window.clearTimeout(
          estado
            .temporizadorRedirecionamento
        );
      }
    );

    /*
     * =====================================================
     * INICIALIZAÇÃO
     * =====================================================
     */

    if (
      !window.API ||
      typeof window.API.get !==
        "function" ||
      typeof window.API.post !==
        "function"
    ) {
      mostrarErroCarregamento(
        new Error(
          "O serviço da API não foi carregado."
        )
      );

      return;
    }

    if (!obterToken()) {
      redirecionarLogin();

      return;
    }

    configurarMascaras();

    alternarCamposCartao();

    definirProcessando(
      true,
      "Carregando plano..."
    );

    try {
      await carregarPlano();
    } catch (erro) {
      console.error(
        "Erro ao carregar plano:",
        erro
      );

      if (
        tratarErroSessao(
          erro
        )
      ) {
        return;
      }

      mostrarErroCarregamento(
        erro
      );
    }
  }
);
