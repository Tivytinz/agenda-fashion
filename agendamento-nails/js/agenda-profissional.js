document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const elementos = {
      btnSair:
        document.getElementById(
          "btnSair"
        ),

      btnDashboard:
        document.getElementById(
          "btnDashboard"
        ),

      mensagemPainel:
        document.getElementById(
          "mensagemPainel"
        ),

      nomeNegocioAtual:
        document.getElementById(
          "nomeNegocioAtual"
        ),

      slugNegocioAtual:
        document.getElementById(
          "slugNegocioAtual"
        ),

      nomeProfissionalAtual:
        document.getElementById(
          "nomeProfissionalAtual"
        ),

      btnPerfilPublico:
        document.getElementById(
          "btnPerfilPublico"
        ),

      totalAgendados:
        document.getElementById(
          "totalAgendados"
        ),

      totalRecorrentes:
        document.getElementById(
          "totalRecorrentes"
        ),

      totalNovos:
        document.getElementById(
          "totalNovos"
        ),

      totalHoje:
        document.getElementById(
          "totalHoje"
        ),

      diaAgendaTexto:
        document.getElementById(
          "diaAgendaTexto"
        ),

      abasDias:
        document.getElementById(
          "abasDias"
        ),

      agendaVisual:
        document.getElementById(
          "agendaVisual"
        ),

      qtdLivres:
        document.getElementById(
          "qtdLivres"
        ),

      qtdBloqueados:
        document.getElementById(
          "qtdBloqueados"
        ),

      qtdAgendados:
        document.getElementById(
          "qtdAgendados"
        ),
    };

    const elementosObrigatorios = [
      elementos.mensagemPainel,
      elementos.nomeNegocioAtual,
      elementos.slugNegocioAtual,
      elementos.nomeProfissionalAtual,
      elementos.totalAgendados,
      elementos.totalRecorrentes,
      elementos.totalNovos,
      elementos.totalHoje,
      elementos.diaAgendaTexto,
      elementos.abasDias,
      elementos.agendaVisual,
      elementos.qtdLivres,
      elementos.qtdBloqueados,
      elementos.qtdAgendados,
    ];

    if (
      elementosObrigatorios.some(
        (elemento) => !elemento
      )
    ) {
      console.error(
        "A estrutura necessária da agenda profissional não foi encontrada."
      );

      return;
    }

    const estado = {
      agenda: [],
      diaSelecionado: null,
      negocioAtual: null,
      configuracaoAgenda: null,
      carregandoAgenda: false,
      alterandoHorario: false,
      mensagemTimer: null,
    };

    /*
     * =====================================================
     * SERVIÇOS OBRIGATÓRIOS
     * =====================================================
     */

    if (
      !window.SessionGuard ||
      typeof window.SessionGuard
        .exigirProfissional !==
        "function"
    ) {
      console.error(
        "SessionGuard não foi carregado."
      );

      window.location.replace(
        "/html/login-profissional.html"
      );

      return;
    }

    if (
      !window.API ||
      typeof window.API.get !==
        "function" ||
      typeof window.API.post !==
        "function"
    ) {
      mostrarMensagem(
        "O serviço da API não foi carregado.",
        "erro"
      );

      return;
    }

    /*
     * =====================================================
     * SESSÃO
     * =====================================================
     */

    let contexto;

    try {
      contexto =
        await window.SessionGuard
          .exigirProfissional({
            destinoLogin:
              "/html/login-profissional.html",

            destinoSemNegocio:
              "/html/criar-negocio.html",

            destinoSemPermissao:
              "/html/inicio.html",
          });
    } catch (erro) {
      console.error(
        "Erro ao validar acesso à agenda:",
        erro
      );

      mostrarMensagem(
        erro?.message ||
          "Não foi possível validar sua sessão.",
        "erro"
      );

      return;
    }

    if (!contexto) {
      return;
    }

    const usuario =
      contexto.usuario;

    const negocioDaSessao =
      contexto.negocio;

    const token =
      window.AuthService &&
      typeof window.AuthService
        .getToken === "function"
        ? window.AuthService
            .getToken()
        : localStorage.getItem(
            "token"
          );

    if (
      !usuario?.id ||
      !negocioDaSessao?.id ||
      !token
    ) {
      redirecionarLogin();

      return;
    }

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

    function normalizarStatus(
      valor
    ) {
      return normalizarTexto(
        valor
      ).toLowerCase();
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
        erro?.status !== 401 &&
        erro?.status !== 403
      ) {
        return false;
      }

      redirecionarLogin();

      return true;
    }

    /*
     * =====================================================
     * MENSAGENS
     * =====================================================
     */

    function esconderMensagem() {
      window.clearTimeout(
        estado.mensagemTimer
      );

      elementos.mensagemPainel
        .textContent = "";

      elementos.mensagemPainel
        .classList.add(
          "oculto"
        );

      delete elementos
        .mensagemPainel
        .dataset.tipo;
    }

    function mostrarMensagem(
      texto,
      tipo = "erro",
      ocultarDepois = 0
    ) {
      window.clearTimeout(
        estado.mensagemTimer
      );

      elementos.mensagemPainel
        .textContent =
          normalizarTexto(texto) ||
          "Ocorreu um erro.";

      elementos.mensagemPainel
        .dataset.tipo =
          tipo;

      elementos.mensagemPainel
        .classList.remove(
          "oculto"
        );

      if (
        ocultarDepois > 0
      ) {
        estado.mensagemTimer =
          window.setTimeout(
            esconderMensagem,
            ocultarDepois
          );
      }
    }

    /*
     * =====================================================
     * DATAS
     * =====================================================
     */

    function obterDataHojeBrasil() {
      const partes =
        new Intl.DateTimeFormat(
          "pt-BR",
          {
            timeZone:
              "America/Sao_Paulo",

            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }
        ).formatToParts(
          new Date()
        );

      const obterParte =
        (tipo) =>
          partes.find(
            (parte) =>
              parte.type === tipo
          )?.value || "";

      return (
        `${obterParte("year")}-` +
        `${obterParte("month")}-` +
        `${obterParte("day")}`
      );
    }

    function criarDataLocal(
      dataIso
    ) {
      const correspondencia =
        /^(\d{4})-(\d{2})-(\d{2})$/
          .exec(
            normalizarTexto(
              dataIso
            )
          );

      if (!correspondencia) {
        return null;
      }

      const ano =
        Number(
          correspondencia[1]
        );

      const mes =
        Number(
          correspondencia[2]
        );

      const dia =
        Number(
          correspondencia[3]
        );

      const data =
        new Date(
          ano,
          mes - 1,
          dia,
          12,
          0,
          0
        );

      return Number.isNaN(
        data.getTime()
      )
        ? null
        : data;
    }

    function formatarDataCompleta(
      dataIso
    ) {
      const data =
        criarDataLocal(
          dataIso
        );

      if (!data) {
        return normalizarTexto(
          dataIso
        );
      }

      return data
        .toLocaleDateString(
          "pt-BR",
          {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
          }
        );
    }

    function formatarDiaCurto(
      dataIso
    ) {
      const data =
        criarDataLocal(
          dataIso
        );

      if (!data) {
        return normalizarTexto(
          dataIso
        );
      }

      return data
        .toLocaleDateString(
          "pt-BR",
          {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
          }
        )
        .replace(
          ".",
          ""
        );
    }

    function ehHoje(
      dataIso
    ) {
      return (
        normalizarTexto(
          dataIso
        ) ===
        obterDataHojeBrasil()
      );
    }

    /*
     * =====================================================
     * FORMATAÇÃO
     * =====================================================
     */

    function formatarMoeda(
      valor
    ) {
      const numero =
        Number(valor);

      return formatadorMoeda
        .format(
          Number.isFinite(
            numero
          )
            ? numero
            : 0
        );
    }

    /*
     * =====================================================
     * STATUS
     * =====================================================
     */

    function statusEhAgendamento(
      status
    ) {
      return [
        "agendado",
        "confirmado",
        "realizado",
      ].includes(
        normalizarStatus(
          status
        )
      );
    }

    function obterTextoStatus(
      status
    ) {
      const textos = {
        livre:
          "Livre",

        bloqueado:
          "Bloqueado",

        agendado:
          "Agendado",

        confirmado:
          "Confirmado",

        realizado:
          "Realizado",

        passado:
          "Encerrado",
      };

      return (
        textos[
          normalizarStatus(
            status
          )
        ] ||
        "Indisponível"
      );
    }

    function obterEmojiStatus(
      status
    ) {
      const emojis = {
        livre:
          "🟢",

        bloqueado:
          "🔒",

        agendado:
          "🟠",

        confirmado:
          "✅",

        realizado:
          "✔️",

        passado:
          "⚪",
      };

      return (
        emojis[
          normalizarStatus(
            status
          )
        ] ||
        "⚪"
      );
    }

    function obterClasseStatus(
      status
    ) {
      const statusNormalizado =
        normalizarStatus(
          status
        );

      if (
        statusNormalizado ===
        "livre"
      ) {
        return "disponivel";
      }

      if (
        statusNormalizado ===
        "bloqueado"
      ) {
        return "bloqueado";
      }

      if (
        statusEhAgendamento(
          statusNormalizado
        )
      ) {
        return "agendado";
      }

      return "passado";
    }

    /*
     * =====================================================
     * WHATSAPP
     * =====================================================
     */

    function normalizarWhatsapp(
      whatsapp
    ) {
      let numeros =
        normalizarTexto(
          whatsapp
        ).replace(
          /\D/g,
          ""
        );

      if (
        numeros.length === 10 ||
        numeros.length === 11
      ) {
        numeros =
          `55${numeros}`;
      }

      return numeros;
    }

    function abrirWhatsapp(
      horario
    ) {
      const numero =
        normalizarWhatsapp(
          horario
            .cliente_whatsapp
        );

      if (!numero) {
        mostrarMensagem(
          "A cliente não possui WhatsApp cadastrado.",
          "aviso",
          3000
        );

        return;
      }

      const dataFormatada =
        formatarDataCompleta(
          horario.data
        );

      const nomeCliente =
        normalizarTexto(
          horario.cliente
        ) ||
        "tudo bem";

      const servico =
        normalizarTexto(
          horario.servico
        ) ||
        "serviço";

      const mensagem =
        `Olá, ${nomeCliente}! ` +
        "Estou entrando em contato sobre seu agendamento de " +
        `${servico} em ${dataFormatada}, às ${horario.hora}.`;

      const url =
        `https://wa.me/${numero}` +
        `?text=${encodeURIComponent(
          mensagem
        )}`;

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    }

    /*
     * =====================================================
     * API
     * =====================================================
     */

    async function apiGet(
      caminho
    ) {
      try {
        return await window.API.get(
          caminho
        );
      } catch (erro) {
        tratarErroSessao(
          erro
        );

        throw erro;
      }
    }

    async function apiPost(
      caminho,
      dados
    ) {
      try {
        return await window.API.post(
          caminho,
          dados
        );
      } catch (erro) {
        tratarErroSessao(
          erro
        );

        throw erro;
      }
    }

    /*
     * =====================================================
     * NEGÓCIO ATUAL
     * =====================================================
     */

    function carregarNegocioAtual() {
      estado.negocioAtual = {
        ...negocioDaSessao,
      };

      if (
        window.AuthService &&
        typeof window.AuthService
          .salvarNegocio ===
          "function"
      ) {
        window.AuthService
          .salvarNegocio(
            estado.negocioAtual
          );
      } else {
        localStorage.setItem(
          "negocio",
          JSON.stringify(
            estado.negocioAtual
          )
        );
      }

      elementos.nomeNegocioAtual
        .textContent =
          normalizarTexto(
            estado.negocioAtual
              .nome
          ) ||
          "Meu negócio";

      elementos.slugNegocioAtual
        .textContent =
          estado.negocioAtual
            .slug
            ? `@${estado.negocioAtual.slug}`
            : "--";

      elementos.nomeProfissionalAtual
        .textContent =
          normalizarTexto(
            usuario.nome
          ) ||
          "Profissional";

      if (
        elementos.btnPerfilPublico &&
        estado.negocioAtual.slug
      ) {
        elementos.btnPerfilPublico.href =
          "/html/perfil-negocio.html" +
          `?slug=${encodeURIComponent(
            estado.negocioAtual.slug
          )}`;

        elementos.btnPerfilPublico
          .classList.remove(
            "oculto"
          );
      } else {
        elementos.btnPerfilPublico
          ?.classList.add(
            "oculto"
          );
      }
    }

    /*
     * =====================================================
     * MÉTRICAS
     * =====================================================
     */

    function obterTodosAgendamentos() {
      return estado.agenda
        .flatMap(
          (dia) =>
            Array.isArray(
              dia?.horarios
            )
              ? dia.horarios
              : []
        )
        .filter(
          (horario) =>
            statusEhAgendamento(
              horario?.status
            )
        );
    }

    function obterChaveCliente(
      horario
    ) {
      if (
        horario?.cliente_id
      ) {
        return (
          `id:` +
          `${horario.cliente_id}`
        );
      }

      const whatsapp =
        normalizarWhatsapp(
          horario
            ?.cliente_whatsapp
        );

      if (whatsapp) {
        return (
          `whatsapp:` +
          `${whatsapp}`
        );
      }

      const nome =
        normalizarTexto(
          horario?.cliente
        ).toLowerCase();

      return nome
        ? `nome:${nome}`
        : null;
    }

    function atualizarCardsGerais() {
      const agendamentos =
        obterTodosAgendamentos();

      const agendamentosHoje =
        agendamentos.filter(
          (horario) =>
            ehHoje(
              horario.data
            )
        );

      const quantidadePorCliente =
        new Map();

      agendamentos.forEach(
        (horario) => {
          const chave =
            obterChaveCliente(
              horario
            );

          if (!chave) {
            return;
          }

          quantidadePorCliente.set(
            chave,
            (
              quantidadePorCliente.get(
                chave
              ) || 0
            ) + 1
          );
        }
      );

      const quantidades =
        Array.from(
          quantidadePorCliente
            .values()
        );

      const recorrentes =
        quantidades.filter(
          (total) =>
            total > 1
        ).length;

      const novos =
        quantidades.filter(
          (total) =>
            total === 1
        ).length;

      elementos.totalAgendados
        .textContent =
          String(
            agendamentos.length
          );

      elementos.totalRecorrentes
        .textContent =
          String(
            recorrentes
          );

      elementos.totalNovos
        .textContent =
          String(
            novos
          );

      elementos.totalHoje
        .textContent =
          String(
            agendamentosHoje.length
          );
    }

    /*
     * =====================================================
     * RESUMO DO DIA
     * =====================================================
     */

    function obterDiaSelecionado() {
      return estado.agenda.find(
        (dia) =>
          dia?.data ===
          estado.diaSelecionado
      );
    }

    function atualizarResumoDia() {
      const dia =
        obterDiaSelecionado();

      const horarios =
        Array.isArray(
          dia?.horarios
        )
          ? dia.horarios
          : [];

      const livres =
        horarios.filter(
          (horario) =>
            normalizarStatus(
              horario.status
            ) ===
            "livre"
        ).length;

      const bloqueados =
        horarios.filter(
          (horario) =>
            normalizarStatus(
              horario.status
            ) ===
            "bloqueado"
        ).length;

      const agendados =
        horarios.filter(
          (horario) =>
            statusEhAgendamento(
              horario.status
            )
        ).length;

      elementos.qtdLivres
        .textContent =
          String(
            livres
          );

      elementos.qtdBloqueados
        .textContent =
          String(
            bloqueados
          );

      elementos.qtdAgendados
        .textContent =
          String(
            agendados
          );
    }

    /*
     * =====================================================
     * ABAS DOS DIAS
     * =====================================================
     */

    function renderizarAbasDias() {
      elementos.abasDias
        .replaceChildren();

      estado.agenda.forEach(
        (dia) => {
          if (!dia?.data) {
            return;
          }

          const botao =
            criarElemento(
              "button",
              "aba-dia"
            );

          const ativa =
            dia.data ===
            estado.diaSelecionado;

          botao.type =
            "button";

          botao.id =
            `aba-dia-${dia.data}`;

          botao.dataset.data =
            dia.data;

          botao.setAttribute(
            "role",
            "tab"
          );

          botao.setAttribute(
            "aria-selected",
            String(ativa)
          );

          if (ativa) {
            botao.classList.add(
              "ativa"
            );
          }

          botao.textContent =
            ehHoje(
              dia.data
            )
              ? "Hoje"
              : formatarDiaCurto(
                  dia.data
                );

          if (
            dia.trabalha ===
            false
          ) {
            botao.title =
              "Dia não trabalhado";
          }

          botao.addEventListener(
            "click",
            () => {
              estado.diaSelecionado =
                dia.data;

              renderizarTudo();
            }
          );

          elementos.abasDias
            .appendChild(
              botao
            );
        }
      );
    }

    /*
     * =====================================================
     * SLOTS
     * =====================================================
     */

    function criarBotaoWhatsapp(
      horario
    ) {
      const botao =
        criarElemento(
          "button",
          "btn-whatsapp",
          "Conversar no WhatsApp"
        );

      botao.type =
        "button";

      botao.addEventListener(
        "click",
        (evento) => {
          evento.stopPropagation();

          abrirWhatsapp(
            horario
          );
        }
      );

      return botao;
    }

    function criarSlotHorario(
      horario
    ) {
      const statusNormalizado =
        normalizarStatus(
          horario.status
        );

      const card =
        criarElemento(
          "article",
          `slot ${obterClasseStatus(
            statusNormalizado
          )}`
        );

      card.dataset.data =
        horario.data || "";

      card.dataset.hora =
        horario.hora || "";

      card.dataset.status =
        statusNormalizado;

      const hora =
        criarElemento(
          "span",
          "slot-hora",
          horario.hora ||
          "--:--"
        );

      const status =
        criarElemento(
          "span",
          "slot-status",
          `${obterEmojiStatus(
            statusNormalizado
          )} ${obterTextoStatus(
            statusNormalizado
          )}`
        );

      card.append(
        hora,
        status
      );

      if (
        statusEhAgendamento(
          statusNormalizado
        )
      ) {
        const cliente =
          criarElemento(
            "span",
            "slot-cliente",
            normalizarTexto(
              horario.cliente
            ) ||
            "Cliente não informado"
          );

        const servico =
          criarElemento(
            "span",
            "slot-servico",
            normalizarTexto(
              horario.servico
            ) ||
            "Serviço não informado"
          );

        const duracao =
          Number(
            horario
              .duracao_minutos ??
            estado
              .configuracaoAgenda
              ?.duracao_padrao ??
            60
          );

        const duracaoTexto =
          Number.isFinite(
            duracao
          ) &&
          duracao > 0
            ? duracao
            : 60;

        const elementoDuracao =
          criarElemento(
            "span",
            "slot-duracao",
            `${duracaoTexto} minutos`
          );

        const valor =
          criarElemento(
            "span",
            "slot-valor",
            formatarMoeda(
              horario.valor
            )
          );

        card.append(
          cliente,
          servico,
          elementoDuracao,
          valor
        );

        if (
          horario
            .cliente_whatsapp
        ) {
          card.appendChild(
            criarBotaoWhatsapp(
              horario
            )
          );
        }

        return card;
      }

      const textosAcao = {
        livre:
          "Clique para bloquear",

        bloqueado:
          "Clique para liberar",

        passado:
          "Horário encerrado",
      };

      card.appendChild(
        criarElemento(
          "span",
          "slot-acao",
          textosAcao[
            statusNormalizado
          ] ||
          "Horário indisponível"
        )
      );

      if (
        statusNormalizado ===
          "livre" ||
        statusNormalizado ===
          "bloqueado"
      ) {
        card.classList.add(
          "clicavel"
        );

        card.tabIndex =
          0;

        card.setAttribute(
          "role",
          "button"
        );

        card.setAttribute(
          "aria-label",
          `${obterTextoStatus(
            statusNormalizado
          )}, ${horario.hora}. ${
            textosAcao[
              statusNormalizado
            ]
          }.`
        );

        const executarAlteracao =
          () => {
            alternarBloqueio(
              horario.data,
              horario.hora,
              card
            );
          };

        card.addEventListener(
          "click",
          executarAlteracao
        );

        card.addEventListener(
          "keydown",
          (evento) => {
            if (
              evento.key ===
                "Enter" ||
              evento.key ===
                " "
            ) {
              evento.preventDefault();

              executarAlteracao();
            }
          }
        );
      }

      return card;
    }

    /*
     * =====================================================
     * RENDERIZAÇÃO DA AGENDA
     * =====================================================
     */

    function renderizarAgendaVisual() {
      elementos.agendaVisual
        .replaceChildren();

      const dia =
        obterDiaSelecionado();

      if (!dia) {
        elementos.diaAgendaTexto
          .textContent =
            "nenhum dia";

        elementos.agendaVisual
          .appendChild(
            criarElemento(
              "div",
              "agenda-vazia",
              "Nenhum dia disponível."
            )
          );

        atualizarResumoDia();

        return;
      }

      const prefixoHoje =
        ehHoje(
          dia.data
        )
          ? "hoje • "
          : "";

      elementos.diaAgendaTexto
        .textContent =
          `${prefixoHoje}${formatarDataCompleta(
            dia.data
          )}`;

      if (
        dia.trabalha ===
        false
      ) {
        elementos.agendaVisual
          .appendChild(
            criarElemento(
              "div",
              "agenda-vazia",
              "Você não trabalha neste dia."
            )
          );

        atualizarResumoDia();

        return;
      }

      const horarios =
        Array.isArray(
          dia.horarios
        )
          ? dia.horarios
          : [];

      if (!horarios.length) {
        elementos.agendaVisual
          .appendChild(
            criarElemento(
              "div",
              "agenda-vazia",
              "Nenhum horário configurado para este dia."
            )
          );

        atualizarResumoDia();

        return;
      }

      horarios.forEach(
        (horario) => {
          elementos.agendaVisual
            .appendChild(
              criarSlotHorario(
                horario
              )
            );
        }
      );

      atualizarResumoDia();
    }

    function renderizarTudo() {
      renderizarAbasDias();
      renderizarAgendaVisual();
      atualizarCardsGerais();
    }

    /*
     * =====================================================
     * DIA INICIAL
     * =====================================================
     */

    function selecionarDiaInicial() {
      const hoje =
        obterDataHojeBrasil();

      const existeHoje =
        estado.agenda.some(
          (dia) =>
            dia?.data ===
            hoje
        );

      if (existeHoje) {
        return hoje;
      }

      const primeiroDiaTrabalhado =
        estado.agenda.find(
          (dia) =>
            dia?.trabalha !==
              false &&
            Array.isArray(
              dia?.horarios
            ) &&
            dia.horarios.length > 0
        );

      return (
        primeiroDiaTrabalhado
          ?.data ||
        estado.agenda[0]
          ?.data ||
        null
      );
    }

    function zerarResumo() {
      elementos.totalAgendados
        .textContent =
          "0";

      elementos.totalRecorrentes
        .textContent =
          "0";

      elementos.totalNovos
        .textContent =
          "0";

      elementos.totalHoje
        .textContent =
          "0";

      elementos.qtdLivres
        .textContent =
          "0";

      elementos.qtdBloqueados
        .textContent =
          "0";

      elementos.qtdAgendados
        .textContent =
          "0";
    }

    /*
     * =====================================================
     * CARREGAMENTO DA AGENDA
     * =====================================================
     */

    async function carregarAgenda({
      manterMensagem = false,
    } = {}) {
      if (
        estado.carregandoAgenda
      ) {
        return;
      }

      estado.carregandoAgenda =
        true;

      if (!manterMensagem) {
        esconderMensagem();
      }

      elementos.agendaVisual
        .replaceChildren(
          criarElemento(
            "div",
            "agenda-vazia",
            "Carregando agenda..."
          )
        );

      try {
        const resultado =
          await apiGet(
            "/agenda-profissional"
          );

        estado.agenda =
          Array.isArray(
            resultado?.agenda
          )
            ? resultado.agenda
            : [];

        estado.configuracaoAgenda =
          resultado
            ?.configuracao ||
          null;

        if (
          !estado.agenda.length
        ) {
          estado.diaSelecionado =
            null;

          elementos.abasDias
            .replaceChildren();

          elementos.diaAgendaTexto
            .textContent =
              "nenhum dia";

          elementos.agendaVisual
            .replaceChildren(
              criarElemento(
                "div",
                "agenda-vazia",
                "Nenhuma agenda disponível."
              )
            );

          zerarResumo();

          return;
        }

        const diaAindaExiste =
          estado.agenda.some(
            (dia) =>
              dia?.data ===
              estado.diaSelecionado
          );

        if (
          !estado.diaSelecionado ||
          !diaAindaExiste
        ) {
          estado.diaSelecionado =
            selecionarDiaInicial();
        }

        renderizarTudo();
      } catch (erro) {
        console.error(
          "Erro ao carregar agenda:",
          erro
        );

        if (
          tratarErroSessao(
            erro
          )
        ) {
          return;
        }

        mostrarMensagem(
          erro?.message ||
            "Não foi possível carregar a agenda.",
          "erro"
        );

        elementos.agendaVisual
          .replaceChildren(
            criarElemento(
              "div",
              "agenda-vazia",
              "Não foi possível carregar a agenda. Atualize a página e tente novamente."
            )
          );
      } finally {
        estado.carregandoAgenda =
          false;
      }
    }

    /*
     * =====================================================
     * BLOQUEIO E LIBERAÇÃO
     * =====================================================
     */

    async function alternarBloqueio(
      data,
      hora,
      card
    ) {
      if (
        estado.alterandoHorario ||
        card.classList.contains(
          "carregando"
        )
      ) {
        return;
      }

      estado.alterandoHorario =
        true;

      esconderMensagem();

      card.classList.add(
        "carregando"
      );

      card.setAttribute(
        "aria-busy",
        "true"
      );

      try {
        const resultado =
          await apiPost(
            "/bloqueios-horario",
            {
              data,
              hora,
            }
          );

        await carregarAgenda({
          manterMensagem:
            true,
        });

        mostrarMensagem(
          resultado?.mensagem ||
            "Agenda atualizada com sucesso.",
          "sucesso",
          2600
        );
      } catch (erro) {
        console.error(
          "Erro ao alterar bloqueio:",
          erro
        );

        if (
          tratarErroSessao(
            erro
          )
        ) {
          return;
        }

        mostrarMensagem(
          erro?.message ||
            "Não foi possível alterar o horário.",
          "erro"
        );

        card.classList.remove(
          "carregando"
        );

        card.removeAttribute(
          "aria-busy"
        );
      } finally {
        estado.alterandoHorario =
          false;
      }
    }

    /*
     * =====================================================
     * EVENTOS
     * =====================================================
     */

    elementos.btnSair
      ?.addEventListener(
        "click",
        redirecionarLogin
      );

    elementos.btnDashboard
      ?.addEventListener(
        "click",
        () => {
          window.location.href =
            "/html/inicio.html";
        }
      );

    window.addEventListener(
      "beforeunload",
      () => {
        window.clearTimeout(
          estado.mensagemTimer
        );
      }
    );

    /*
     * =====================================================
     * INICIALIZAÇÃO
     * =====================================================
     */

    try {
      carregarNegocioAtual();

      await carregarAgenda();
    } catch (erro) {
      console.error(
        "Erro ao iniciar agenda profissional:",
        erro
      );

      mostrarMensagem(
        erro?.message ||
          "Não foi possível iniciar a agenda profissional.",
        "erro"
      );
    }
  }
);