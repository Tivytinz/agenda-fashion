document.addEventListener(
  "DOMContentLoaded",
  async () => {
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

      const mensagem =
        document.getElementById(
          "mensagemPainel"
        );

      if (mensagem) {
        mensagem.textContent =
          erro?.message ||
          "Não foi possível validar sua sessão.";

        mensagem.dataset.tipo =
          "erro";

        mensagem.classList.remove(
          "oculto"
        );
      }

      return;
    }

    /*
     * O guard já realizou qualquer
     * redirecionamento necessário.
     */
    if (!contexto) {
      return;
    }

    const usuario =
      contexto.usuario;

    const negocioDaSessao =
      contexto.negocio;

    const token =
      window.AuthService
        .getToken();

    if (
      !usuario?.id ||
      !negocioDaSessao?.id ||
      !token
    ) {
      window.AuthService
        .limparSessao();

      window.location.replace(
        "/html/login-profissional.html"
      );

      return;
    }

    const btnSair =
      document.getElementById(
        "btnSair"
      );

    const btnDashboard =
      document.getElementById(
        "btnDashboard"
      );

    const mensagemPainel =
      document.getElementById(
        "mensagemPainel"
      );

    const nomeNegocioAtual =
      document.getElementById(
        "nomeNegocioAtual"
      );

    const slugNegocioAtual =
      document.getElementById(
        "slugNegocioAtual"
      );

    const nomeProfissionalAtual =
      document.getElementById(
        "nomeProfissionalAtual"
      );

    const btnPerfilPublico =
      document.getElementById(
        "btnPerfilPublico"
      );

    const totalAgendados =
      document.getElementById(
        "totalAgendados"
      );

    const totalRecorrentes =
      document.getElementById(
        "totalRecorrentes"
      );

    const totalNovos =
      document.getElementById(
        "totalNovos"
      );

    const totalHoje =
      document.getElementById(
        "totalHoje"
      );

    const diaAgendaTexto =
      document.getElementById(
        "diaAgendaTexto"
      );

    const abasDias =
      document.getElementById(
        "abasDias"
      );

    const agendaVisual =
      document.getElementById(
        "agendaVisual"
      );

    const qtdLivres =
      document.getElementById(
        "qtdLivres"
      );

    const qtdBloqueados =
      document.getElementById(
        "qtdBloqueados"
      );

    const qtdAgendados =
      document.getElementById(
        "qtdAgendados"
      );

    let agenda = [];
    let diaSelecionado = null;
    let negocioAtual = null;
    let configuracaoAgenda = null;

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
          )?.value;

      return (
        `${obterParte("year")}-` +
        `${obterParte("month")}-` +
        `${obterParte("day")}`
      );
    }

    function mostrarMensagem(
      texto,
      tipo = "erro"
    ) {
      if (!mensagemPainel) {
        return;
      }

      mensagemPainel.textContent =
        texto;

      mensagemPainel.dataset.tipo =
        tipo;

      mensagemPainel.style.color =
        tipo === "sucesso"
          ? "#237a48"
          : "#c62839";

      mensagemPainel.style.background =
        tipo === "sucesso"
          ? "#e8f8ef"
          : "#ffe5e8";

      mensagemPainel.classList.remove(
        "oculto"
      );
    }

    function esconderMensagem() {
      if (!mensagemPainel) {
        return;
      }

      mensagemPainel.textContent =
        "";

      mensagemPainel.classList.add(
        "oculto"
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

function redirecionarLogin() {
  limparSessao();

  window.location.replace(
    "/html/login-profissional.html"
  );
}

    async function requisicaoAutenticada(
      caminho,
      opcoes = {}
    ) {
      const headers = {
        ...(opcoes.headers || {}),
        Authorization:
          `Bearer ${token}`,
      };

      const resposta =
        await fetch(
          `${API_URL}${caminho}`,
          {
            ...opcoes,
            headers,
          }
        );

      if (
         resposta.status === 401 ||
         resposta.status === 403
        ) {
        redirecionarLogin();

        throw new Error(
          "Sessão expirada."
        );
      }

      return resposta;
    }

    function formatarMoeda(
      valor
    ) {
      return Number(
        valor || 0
      ).toLocaleString(
        "pt-BR",
        {
          style: "currency",
          currency: "BRL",
        }
      );
    }

    function criarDataLocal(
      dataIso
    ) {
      const [
        ano,
        mes,
        dia,
      ] = String(dataIso)
        .split("-")
        .map(Number);

      return new Date(
        ano,
        mes - 1,
        dia,
        12,
        0,
        0
      );
    }

    function formatarDataCompleta(
      dataIso
    ) {
      const data =
        criarDataLocal(
          dataIso
        );

      return data.toLocaleDateString(
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

      return data.toLocaleDateString(
        "pt-BR",
        {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
        }
      );
    }

    function ehHoje(
      dataIso
    ) {
      return (
        dataIso ===
        obterDataHojeBrasil()
      );
    }

    function statusEhAgendamento(
      status
    ) {
      return [
        "agendado",
        "confirmado",
        "realizado",
      ].includes(status);
    }

    function obterTextoStatus(
      status
    ) {
      const textos = {
        livre: "Livre",
        bloqueado: "Bloqueado",
        agendado: "Agendado",
        confirmado: "Confirmado",
        realizado: "Realizado",
        passado: "Encerrado",
      };

      return (
        textos[status] ||
        "Indisponível"
      );
    }

    function obterEmojiStatus(
      status
    ) {
      const emojis = {
        livre: "🟢",
        bloqueado: "🔒",
        agendado: "🟠",
        confirmado: "✅",
        realizado: "✔️",
        passado: "⚪",
      };

      return (
        emojis[status] ||
        "⚪"
      );
    }

    function obterClasseStatus(
      status
    ) {
      if (
        status === "livre"
      ) {
        return "disponivel";
      }

      if (
        status ===
        "bloqueado"
      ) {
        return "bloqueado";
      }

      if (
        statusEhAgendamento(
          status
        )
      ) {
        return "agendado";
      }

      return "passado";
    }

    function normalizarWhatsapp(
      whatsapp
    ) {
      let numeros = String(
        whatsapp || ""
      ).replace(/\D/g, "");

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
          "A cliente não possui WhatsApp cadastrado."
        );

        return;
      }

      const dataFormatada =
        formatarDataCompleta(
          horario.data
        );

      const mensagem =
        `Olá, ${
          horario.cliente ||
          "tudo bem"
        }! ` +
        `Estou entrando em contato sobre seu agendamento de ` +
        `${horario.servico || "serviço"} ` +
        `em ${dataFormatada}, às ${horario.hora}.`;

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

    async function carregarNegocioAtual() {
  try {
    if (
      !negocioDaSessao?.id
    ) {
      throw new Error(
        "Nenhum negócio está vinculado a esta conta."
      );
    }

    negocioAtual = {
      ...negocioDaSessao,
    };

    if (
      window.AuthService &&
      typeof window.AuthService
        .salvarNegocio === "function"
    ) {
      window.AuthService
        .salvarNegocio(
          negocioAtual
        );
    } else {
      localStorage.setItem(
        "negocio",
        JSON.stringify(
          negocioAtual
        )
      );
    }

    if (
      nomeNegocioAtual
    ) {
      nomeNegocioAtual.textContent =
        negocioAtual.nome ||
        "Meu negócio";
    }

    if (
      slugNegocioAtual
    ) {
      slugNegocioAtual.textContent =
        negocioAtual.slug
          ? `@${negocioAtual.slug}`
          : "--";
    }

    if (
      nomeProfissionalAtual
    ) {
      nomeProfissionalAtual
        .textContent =
          usuario.nome ||
          "Profissional";
    }

    if (
      btnPerfilPublico &&
      negocioAtual.slug
    ) {
      btnPerfilPublico.href =
        `/html/perfil-negocio.html` +
        `?slug=${encodeURIComponent(
          negocioAtual.slug
        )}`;

      btnPerfilPublico
        .classList.remove(
          "oculto"
        );
    } else {
      btnPerfilPublico
        ?.classList.add(
          "oculto"
        );
    }
  } catch (erro) {
    console.error(
      "Erro ao carregar negócio:",
      erro
    );

    if (
      nomeNegocioAtual
    ) {
      nomeNegocioAtual.textContent =
        "Erro ao carregar negócio";
    }

    if (
      slugNegocioAtual
    ) {
      slugNegocioAtual.textContent =
        "--";
    }

    if (
      nomeProfissionalAtual
    ) {
      nomeProfissionalAtual
        .textContent =
          usuario?.nome ||
          "--";
    }

    mostrarMensagem(
      erro?.message ||
        "Erro ao carregar os dados do negócio."
    );
  }
}

    function obterTodosAgendamentos() {
      return agenda
        .flatMap(
          (dia) =>
            dia.horarios || []
        )
        .filter(
          (horario) =>
            statusEhAgendamento(
              horario.status
            )
        );
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
          const chaveCliente =
            horario.cliente_id ||
            horario.cliente;

          if (!chaveCliente) {
            return;
          }

          const totalAtual =
            quantidadePorCliente.get(
              chaveCliente
            ) || 0;

          quantidadePorCliente.set(
            chaveCliente,
            totalAtual + 1
          );
        }
      );

      const recorrentes =
        Array.from(
          quantidadePorCliente.values()
        ).filter(
          (total) =>
            total > 1
        ).length;

      const clientesComUmAgendamento =
        Array.from(
          quantidadePorCliente.values()
        ).filter(
          (total) =>
            total === 1
        ).length;

      totalAgendados.textContent =
        String(
          agendamentos.length
        );

      totalRecorrentes.textContent =
        String(recorrentes);

      totalNovos.textContent =
        String(
          clientesComUmAgendamento
        );

      totalHoje.textContent =
        String(
          agendamentosHoje.length
        );
    }

    function atualizarResumoDia() {
      const dia = agenda.find(
        (item) =>
          item.data ===
          diaSelecionado
      );

      const horarios =
        dia?.horarios || [];

      const livres =
        horarios.filter(
          (horario) =>
            horario.status ===
            "livre"
        ).length;

      const bloqueados =
        horarios.filter(
          (horario) =>
            horario.status ===
            "bloqueado"
        ).length;

      const agendados =
        horarios.filter(
          (horario) =>
            statusEhAgendamento(
              horario.status
            )
        ).length;

      qtdLivres.textContent =
        String(livres);

      qtdBloqueados.textContent =
        String(bloqueados);

      qtdAgendados.textContent =
        String(agendados);
    }

    function renderizarAbasDias() {
      abasDias.replaceChildren();

      agenda.forEach(
        (dia) => {
          const botao =
            document.createElement(
              "button"
            );

          botao.type =
            "button";

          botao.className =
            "aba-dia";

          if (
            dia.data ===
            diaSelecionado
          ) {
            botao.classList.add(
              "ativa"
            );
          }

          const texto =
            ehHoje(dia.data)
              ? "Hoje"
              : formatarDiaCurto(
                  dia.data
                );

          botao.textContent =
            texto;

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
              diaSelecionado =
                dia.data;

              renderizarTudo();
            }
          );

          abasDias.appendChild(
            botao
          );
        }
      );
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
      const card =
        criarElemento(
          "article",
          `slot ${obterClasseStatus(
            horario.status
          )}`
        );

      card.dataset.data =
        horario.data;

      card.dataset.hora =
        horario.hora;

      card.dataset.status =
        horario.status;

      const hora =
        criarElemento(
          "span",
          "slot-hora",
          horario.hora
        );

      const status =
        criarElemento(
          "span",
          "slot-status",
          `${obterEmojiStatus(
            horario.status
          )} ${obterTextoStatus(
            horario.status
          )}`
        );

      card.append(
        hora,
        status
      );

      if (
        statusEhAgendamento(
          horario.status
        )
      ) {
        const cliente =
          criarElemento(
            "span",
            "slot-cliente",
            horario.cliente ||
              "Cliente não informado"
          );

        const servico =
          criarElemento(
            "span",
            "slot-servico",
            horario.servico ||
              "Serviço não informado"
          );

        const duracao =
          criarElemento(
            "span",
            "slot-duracao",
            `${Number(
              horario
                .duracao_minutos ||
                configuracaoAgenda
                  ?.duracao_padrao ||
                60
            )} minutos`
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
          duracao,
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

      if (
        horario.status ===
        "livre"
      ) {
        card.appendChild(
          criarElemento(
            "span",
            "slot-acao",
            "Clique para bloquear"
          )
        );
      }

      if (
        horario.status ===
        "bloqueado"
      ) {
        card.appendChild(
          criarElemento(
            "span",
            "slot-acao",
            "Clique para liberar"
          )
        );
      }

      if (
        horario.status ===
        "passado"
      ) {
        card.appendChild(
          criarElemento(
            "span",
            "slot-acao",
            "Horário encerrado"
          )
        );
      }

      if (
        horario.status ===
          "livre" ||
        horario.status ===
          "bloqueado"
      ) {
        card.classList.add(
          "clicavel"
        );

        card.tabIndex = 0;

        card.setAttribute(
          "role",
          "button"
        );

        card.setAttribute(
          "aria-label",
          `${obterTextoStatus(
            horario.status
          )}, ${horario.hora}`
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

    function renderizarAgendaVisual() {
      agendaVisual.replaceChildren();

      const dia =
        agenda.find(
          (item) =>
            item.data ===
            diaSelecionado
        );

      if (!dia) {
        agendaVisual.appendChild(
          criarElemento(
            "div",
            "agenda-vazia",
            "Nenhum dia disponível."
          )
        );

        atualizarResumoDia();

        return;
      }

      diaAgendaTexto.textContent =
        `${ehHoje(dia.data)
          ? "Hoje 💅"
          : "Agenda"} • ` +
        `${formatarDataCompleta(
          dia.data
        )}`;

      if (
        dia.trabalha ===
        false
      ) {
        agendaVisual.appendChild(
          criarElemento(
            "div",
            "agenda-vazia",
            "Você não trabalha neste dia."
          )
        );

        atualizarResumoDia();

        return;
      }

      if (
        !dia.horarios?.length
      ) {
        agendaVisual.appendChild(
          criarElemento(
            "div",
            "agenda-vazia",
            "Nenhum horário configurado para este dia."
          )
        );

        atualizarResumoDia();

        return;
      }

      dia.horarios.forEach(
        (horario) => {
          agendaVisual.appendChild(
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

    function selecionarDiaInicial() {
      const hoje =
        obterDataHojeBrasil();

      const existeHoje =
        agenda.some(
          (dia) =>
            dia.data === hoje
        );

      if (existeHoje) {
        return hoje;
      }

      const primeiroDiaTrabalhado =
        agenda.find(
          (dia) =>
            dia.trabalha !==
              false &&
            dia.horarios?.length
        );

      return (
        primeiroDiaTrabalhado
          ?.data ||
        agenda[0]?.data ||
        null
      );
    }

    async function alternarBloqueio(
      data,
      hora,
      card
    ) {
      if (
        card.classList.contains(
          "carregando"
        )
      ) {
        return;
      }

      try {
        esconderMensagem();

        card.classList.add(
          "carregando"
        );

        card.setAttribute(
          "aria-busy",
          "true"
        );

        const resposta =
          await requisicaoAutenticada(
            "/bloqueios-horario",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                data,
                hora,
              }),
            }
          );

        const resultado =
          await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            resultado.erro ||
              resultado.mensagem ||
              "Erro ao alterar horário."
          );
        }

        await carregarAgenda();

        mostrarMensagem(
          resultado.mensagem ||
            "Agenda atualizada com sucesso.",
          "sucesso"
        );

        window.setTimeout(
          esconderMensagem,
          2200
        );
      } catch (erro) {
        console.error(
          "Erro ao alterar bloqueio:",
          erro
        );

        mostrarMensagem(
          erro.message ||
            "Erro na conexão com o servidor."
        );

        card.classList.remove(
          "carregando"
        );

        card.removeAttribute(
          "aria-busy"
        );
      }
    }

    async function carregarAgenda() {
      try {
        agendaVisual.replaceChildren(
          criarElemento(
            "div",
            "agenda-vazia",
            "Carregando agenda..."
          )
        );

        const resposta =
          await requisicaoAutenticada(
            "/agenda-profissional"
          );

        const resultado =
          await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            resultado.erro ||
              resultado.mensagem ||
              "Erro ao carregar agenda."
          );
        }

        agenda = Array.isArray(
          resultado.agenda
        )
          ? resultado.agenda
          : [];

        configuracaoAgenda =
          resultado.configuracao ||
          null;

        if (!agenda.length) {
          diaSelecionado =
            null;

          abasDias.replaceChildren();

          agendaVisual.replaceChildren(
            criarElemento(
              "div",
              "agenda-vazia",
              "Nenhuma agenda disponível."
            )
          );

          totalAgendados.textContent =
            "0";

          totalRecorrentes.textContent =
            "0";

          totalNovos.textContent =
            "0";

          totalHoje.textContent =
            "0";

          atualizarResumoDia();

          return;
        }

        const diaAindaExiste =
          agenda.some(
            (dia) =>
              dia.data ===
              diaSelecionado
          );

        if (
          !diaSelecionado ||
          !diaAindaExiste
        ) {
          diaSelecionado =
            selecionarDiaInicial();
        }

        renderizarTudo();
      } catch (erro) {
        console.error(
          "Erro ao carregar agenda:",
          erro
        );

        mostrarMensagem(
          erro.message ||
            "Erro ao carregar agenda."
        );

        agendaVisual.replaceChildren(
          criarElemento(
            "div",
            "agenda-vazia",
            "Não foi possível carregar a agenda."
          )
        );
      }
    }

    btnSair?.addEventListener(
      "click",
      () => {
        redirecionarLogin();
      }
    );

    if (
  btnDashboard
) {
  btnDashboard.textContent =
    "Início";

  btnDashboard.addEventListener(
    "click",
    () => {
      window.location.href =
        "/html/inicio.html";
    }
  );
}

    await carregarNegocioAtual();
    await carregarAgenda();
  }
);