document.addEventListener("DOMContentLoaded", async () => {
  const elementos = {
    totalAgendados:
      document.getElementById("totalAgendados"),

    totalLivres:
      document.getElementById("totalLivres"),

    totalBloqueados:
      document.getElementById("totalBloqueados"),

    filtroProfissional:
      document.getElementById("filtroProfissional"),

    filtroStatus:
      document.getElementById("filtroStatus"),

    diasAgenda:
      document.getElementById("diasAgenda"),

    listaAgendaGeral:
      document.getElementById("listaAgendaGeral"),

    listaNotificacoes:
      document.getElementById("listaNotificacoes"),

    btnHoje:
      document.getElementById("btnHoje"),

    btnLimparFiltros:
      document.getElementById("btnLimparFiltros"),

    agendaConteudo:
      document.querySelector(".agenda-conteudo"),

    agendaConteudoHeader:
      document.querySelector(".agenda-conteudo-header"),
  };

  const elementosObrigatorios = [
    elementos.totalAgendados,
    elementos.totalLivres,
    elementos.totalBloqueados,
    elementos.filtroProfissional,
    elementos.filtroStatus,
    elementos.diasAgenda,
    elementos.listaAgendaGeral,
    elementos.listaNotificacoes,
    elementos.btnHoje,
  ];

  if (
    elementosObrigatorios.some(
      (elemento) => !elemento
    )
  ) {
    console.error(
      "A estrutura necessária da agenda geral não foi encontrada."
    );

    return;
  }

  const estado = {
    agenda: [],
    diaSelecionado: null,
    contexto: null,

    carregandoAgenda: false,
    carregandoNotificacoes: false,

    horariosEmAlteracao: new Set(),

    mensagemTimer: null,
  };

  /*
   * =====================================================
   * UTILITÁRIOS
   * =====================================================
   */

  function normalizarTexto(valor) {
    return String(valor ?? "").trim();
  }

  function normalizarStatus(valor) {
    return normalizarTexto(valor).toLowerCase();
  }

  function criarElemento(
    tag,
    classe = "",
    conteudo = null
  ) {
    const elemento =
      document.createElement(tag);

    if (classe) {
      elemento.className = classe;
    }

    if (
      conteudo !== null &&
      conteudo !== undefined
    ) {
      elemento.textContent =
        String(conteudo);
    }

    return elemento;
  }

  /*
   * =====================================================
   * SESSÃO
   * =====================================================
   */

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

    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("negocio");
  }

  function redirecionarLogin() {
    limparSessao();

    window.location.replace(
      "/html/login-profissional.html"
    );
  }

  function tratarErroAutorizacao(erro) {
    if (erro?.status === 401) {
      redirecionarLogin();

      return true;
    }

    if (erro?.status === 403) {
      window.location.replace(
        "/html/inicio.html"
      );

      return true;
    }

    return false;
  }

  /*
   * =====================================================
   * MENSAGENS
   * =====================================================
   */

  function criarMensagemAgenda() {
    const existente =
      document.getElementById(
        "mensagemAgendaGeral"
      );

    if (existente) {
      return existente;
    }

    const mensagem =
      criarElemento(
        "div",
        "mensagem-agenda-geral hidden"
      );

    mensagem.id =
      "mensagemAgendaGeral";

    mensagem.setAttribute(
      "role",
      "status"
    );

    mensagem.setAttribute(
      "aria-live",
      "polite"
    );

    if (
      elementos.agendaConteudoHeader
    ) {
      elementos.agendaConteudoHeader
        .insertAdjacentElement(
          "afterend",
          mensagem
        );
    } else {
      elementos.agendaConteudo
        ?.prepend(mensagem);
    }

    return mensagem;
  }

  const mensagemAgenda =
    criarMensagemAgenda();

  function esconderMensagem() {
    window.clearTimeout(
      estado.mensagemTimer
    );

    if (!mensagemAgenda) {
      return;
    }

    mensagemAgenda.textContent = "";

    mensagemAgenda.className =
      "mensagem-agenda-geral hidden";

    delete mensagemAgenda.dataset.tipo;
  }

  function mostrarMensagem(
    mensagem,
    tipo = "erro",
    tempo = 4000
  ) {
    if (!mensagemAgenda) {
      return;
    }

    window.clearTimeout(
      estado.mensagemTimer
    );

    mensagemAgenda.textContent =
      normalizarTexto(mensagem) ||
      "Ocorreu um erro.";

    mensagemAgenda.className =
      "mensagem-agenda-geral";

    mensagemAgenda.dataset.tipo =
      tipo;

    if (tempo > 0) {
      estado.mensagemTimer =
        window.setTimeout(
          esconderMensagem,
          tempo
        );
    }
  }

  /*
   * =====================================================
   * ESTADOS VISUAIS
   * =====================================================
   */

  function criarEstadoVazio({
    icone = "📅",
    titulo = "Nenhum resultado encontrado",
    descricao = "",
    compacto = false,
  } = {}) {
    const caixa =
      criarElemento(
        "div",
        `estado-vazio${
          compacto
            ? " estado-vazio-compacto"
            : ""
        }`
      );

    if (!compacto) {
      const elementoIcone =
        criarElemento(
          "span",
          "estado-vazio-icone",
          icone
        );

      elementoIcone.setAttribute(
        "aria-hidden",
        "true"
      );

      caixa.appendChild(
        elementoIcone
      );
    }

    if (titulo) {
      caixa.appendChild(
        criarElemento(
          "strong",
          "",
          titulo
        )
      );
    }

    if (descricao) {
      caixa.appendChild(
        criarElemento(
          "p",
          "",
          descricao
        )
      );
    }

    return caixa;
  }

  /*
   * =====================================================
   * DATAS
   * =====================================================
   */

  function obterHojeBrasil() {
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

    function obterParte(tipo) {
      return (
        partes.find(
          (parte) =>
            parte.type === tipo
        )?.value || ""
      );
    }

    return (
      `${obterParte("year")}-` +
      `${obterParte("month")}-` +
      `${obterParte("day")}`
    );
  }

  function criarDataLocal(dataIso) {
    const resultado =
      /^(\d{4})-(\d{2})-(\d{2})$/
        .exec(
          normalizarTexto(dataIso)
        );

    if (!resultado) {
      return null;
    }

    const data =
      new Date(
        Number(resultado[1]),
        Number(resultado[2]) - 1,
        Number(resultado[3]),
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

  function capitalizar(valor) {
    const conteudo =
      normalizarTexto(valor);

    if (!conteudo) {
      return "";
    }

    return (
      conteudo.charAt(0).toUpperCase() +
      conteudo.slice(1)
    );
  }

  function formatarDiaSemana(dataIso) {
    const data =
      criarDataLocal(dataIso);

    if (!data) {
      return "Dia";
    }

    return capitalizar(
      data
        .toLocaleDateString(
          "pt-BR",
          {
            weekday: "short",
          }
        )
        .replace(".", "")
    );
  }

  function formatarDataCurta(dataIso) {
    const data =
      criarDataLocal(dataIso);

    if (!data) {
      return normalizarTexto(dataIso);
    }

    return data.toLocaleDateString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
      }
    );
  }

  function formatarDataCompleta(dataIso) {
    const data =
      criarDataLocal(dataIso);

    if (!data) {
      return normalizarTexto(dataIso);
    }

    return capitalizar(
      data.toLocaleDateString(
        "pt-BR",
        {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
        }
      )
    );
  }

  function formatarHora(valor) {
    const resultado =
      /^(\d{2}):(\d{2})/
        .exec(
          normalizarTexto(valor)
        );

    if (!resultado) {
      return (
        normalizarTexto(valor) ||
        "--:--"
      );
    }

    return (
      `${resultado[1]}:` +
      `${resultado[2]}`
    );
  }

  function formatarDataHora(valor) {
    const data =
      new Date(valor);

    if (
      Number.isNaN(
        data.getTime()
      )
    ) {
      return "Data não informada";
    }

    return data.toLocaleString(
      "pt-BR",
      {
        dateStyle: "short",
        timeStyle: "short",
      }
    );
  }

  function ehHoje(dataIso) {
    return (
      normalizarTexto(dataIso) ===
      obterHojeBrasil()
    );
  }

  /*
   * =====================================================
   * STATUS
   * =====================================================
   */

  function ehAgendamento(status) {
    return [
      "agendado",
      "confirmado",
      "realizado",
    ].includes(
      normalizarStatus(status)
    );
  }

  function statusCombinaComFiltro(
    status,
    filtro
  ) {
    const statusAtual =
      normalizarStatus(status);

    const filtroSelecionado =
      normalizarStatus(filtro);

    if (
      !filtroSelecionado ||
      filtroSelecionado === "todos"
    ) {
      return true;
    }

    if (
      filtroSelecionado ===
      "agendado"
    ) {
      return ehAgendamento(
        statusAtual
      );
    }

    return (
      statusAtual ===
      filtroSelecionado
    );
  }

  function obterTextoStatus(status) {
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
        normalizarStatus(status)
      ] ||
      "Indisponível"
    );
  }

  function obterClasseStatus(status) {
    const statusAtual =
      normalizarStatus(status);

    const statusValidos = [
      "livre",
      "bloqueado",
      "agendado",
      "confirmado",
      "realizado",
    ];

    return statusValidos.includes(
      statusAtual
    )
      ? statusAtual
      : "passado";
  }

  /*
   * =====================================================
   * API
   * =====================================================
   */

  function extrairAgenda(resposta) {
    if (Array.isArray(resposta)) {
      return resposta;
    }

    return Array.isArray(
      resposta?.agenda
    )
      ? resposta.agenda
      : [];
  }

  function extrairNotificacoes(
    resposta
  ) {
    if (Array.isArray(resposta)) {
      return resposta;
    }

    return Array.isArray(
      resposta?.notificacoes
    )
      ? resposta.notificacoes
      : [];
  }

  async function apiGet(caminho) {
    try {
      return await window.API.get(
        caminho
      );
    } catch (erro) {
      tratarErroAutorizacao(
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
      tratarErroAutorizacao(
        erro
      );

      throw erro;
    }
  }

  /*
   * =====================================================
   * DIA SELECIONADO
   * =====================================================
   */

  function obterDiaSelecionado() {
    return estado.agenda.find(
      (dia) =>
        normalizarTexto(
          dia?.data
        ) ===
        estado.diaSelecionado
    );
  }

  function selecionarDiaInicial() {
    const hoje =
      obterHojeBrasil();

    const existeHoje =
      estado.agenda.some(
        (dia) =>
          normalizarTexto(
            dia?.data
          ) ===
          hoje
      );

    if (existeHoje) {
      return hoje;
    }

    return (
      normalizarTexto(
        estado.agenda[0]?.data
      ) ||
      null
    );
  }

  /*
   * =====================================================
   * RESUMO
   * =====================================================
   */

  function atualizarResumo(
    horarios = []
  ) {
    const totalAgendados =
      horarios.filter(
        (horario) =>
          ehAgendamento(
            horario?.status
          )
      ).length;

    const totalLivres =
      horarios.filter(
        (horario) =>
          normalizarStatus(
            horario?.status
          ) === "livre"
      ).length;

    const totalBloqueados =
      horarios.filter(
        (horario) =>
          normalizarStatus(
            horario?.status
          ) === "bloqueado"
      ).length;

    elementos.totalAgendados
      .textContent =
        String(totalAgendados);

    elementos.totalLivres
      .textContent =
        String(totalLivres);

    elementos.totalBloqueados
      .textContent =
        String(totalBloqueados);
  }

  function atualizarBotaoHoje() {
    const hoje =
      obterHojeBrasil();

    const existeHoje =
      estado.agenda.some(
        (dia) =>
          normalizarTexto(
            dia?.data
          ) ===
          hoje
      );

    elementos.btnHoje.disabled =
      !existeHoje;

    elementos.btnHoje.title =
      existeHoje
        ? "Ir para a agenda de hoje"
        : "O período carregado não inclui hoje";
  }

  /*
   * =====================================================
   * DIAS
   * =====================================================
   */

  function renderizarDias() {
    elementos.diasAgenda
      .replaceChildren();

    estado.agenda.forEach(
      (dia) => {
        const data =
          normalizarTexto(
            dia?.data
          );

        if (!data) {
          return;
        }

        const ativo =
          data ===
          estado.diaSelecionado;

        const botao =
          criarElemento(
            "button",
            "dia-btn"
          );

        botao.type = "button";

        botao.dataset.data =
          data;

        botao.setAttribute(
          "role",
          "tab"
        );

        botao.setAttribute(
          "aria-selected",
          String(ativo)
        );

        botao.setAttribute(
          "aria-label",
          formatarDataCompleta(
            data
          )
        );

        if (ativo) {
          botao.classList.add(
            "ativo"
          );
        }

        botao.append(
          criarElemento(
            "strong",
            "",
            ehHoje(data)
              ? "Hoje"
              : formatarDiaSemana(
                  data
                )
          ),

          criarElemento(
            "span",
            "",
            formatarDataCurta(
              data
            )
          )
        );

        botao.addEventListener(
          "click",
          () => {
            estado.diaSelecionado =
              data;

            renderizarTudo();

            window.setTimeout(
              () => {
                botao.scrollIntoView({
                  behavior:
                    "smooth",

                  block:
                    "nearest",

                  inline:
                    "center",
                });
              },
              0
            );
          }
        );

        elementos.diasAgenda
          .appendChild(botao);
      }
    );
  }

  /*
   * =====================================================
   * FILTRO DE PROFISSIONAIS
   * =====================================================
   */

  function renderizarFiltroProfissionais(
    dia
  ) {
    const valorAtual =
      elementos.filtroProfissional
        .value ||
      "todos";

    const profissionais =
      Array.isArray(
        dia?.profissionais
      )
        ? dia.profissionais
        : [];

    const profissionaisMap =
      new Map();

    profissionais.forEach(
      (profissional) => {
        if (
          profissional?.id ===
            undefined ||
          profissional?.id ===
            null
        ) {
          return;
        }

        profissionaisMap.set(
          String(profissional.id),

          normalizarTexto(
            profissional.nome
          ) ||
          "Profissional"
        );
      }
    );

    elementos.filtroProfissional
      .replaceChildren();

    const opcaoTodos =
      criarElemento(
        "option",
        "",
        "Todos os profissionais"
      );

    opcaoTodos.value =
      "todos";

    elementos.filtroProfissional
      .appendChild(opcaoTodos);

    Array.from(
      profissionaisMap.entries()
    )
      .sort(
        (
          [, nomeA],
          [, nomeB]
        ) =>
          nomeA.localeCompare(
            nomeB,
            "pt-BR"
          )
      )
      .forEach(
        ([id, nome]) => {
          const opcao =
            criarElemento(
              "option",
              "",
              nome
            );

          opcao.value =
            id;

          elementos.filtroProfissional
            .appendChild(opcao);
        }
      );

    elementos.filtroProfissional
      .value =
        profissionaisMap.has(
          valorAtual
        )
          ? valorAtual
          : "todos";
  }

  /*
   * =====================================================
   * AVATAR
   * =====================================================
   */

  function obterIniciais(nome) {
    const partes =
      normalizarTexto(nome)
        .split(/\s+/)
        .filter(Boolean);

    if (!partes.length) {
      return "P";
    }

    if (partes.length === 1) {
      return partes[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return (
      `${partes[0][0]}` +
      `${partes[
        partes.length - 1
      ][0]}`
    ).toUpperCase();
  }

  function criarAvatarIniciais(
    nome
  ) {
    const avatar =
      criarElemento(
        "div",
        "profissional-foto avatar-iniciais",
        obterIniciais(nome)
      );

    avatar.setAttribute(
      "aria-hidden",
      "true"
    );

    return avatar;
  }

  function criarAvatar(
    profissional
  ) {
    const nome =
      normalizarTexto(
        profissional?.nome
      ) ||
      "Profissional";

    const foto =
      normalizarTexto(
        profissional?.foto_url
      );

    if (!foto) {
      return criarAvatarIniciais(
        nome
      );
    }

    const imagem =
      document.createElement("img");

    imagem.className =
      "profissional-foto";

    imagem.src =
      foto;

    imagem.alt =
      `Foto de ${nome}`;

    imagem.loading =
      "lazy";

    imagem.decoding =
      "async";

    imagem.addEventListener(
      "error",
      () => {
        imagem.replaceWith(
          criarAvatarIniciais(
            nome
          )
        );
      },
      {
        once: true,
      }
    );

    return imagem;
  }

  /*
   * =====================================================
   * CARD DE HORÁRIO
   * =====================================================
   */

  function criarHorarioCard(
    profissional,
    dia,
    horario
  ) {
    const status =
      normalizarStatus(
        horario?.status
      );

    const hora =
      formatarHora(
        horario?.hora
      );

    const card =
      criarElemento(
        "article",
        `horario-card ${obterClasseStatus(
          status
        )}`
      );

    card.dataset.profissionalId =
      String(
        profissional?.id ?? ""
      );

    card.dataset.data =
      normalizarTexto(
        dia?.data
      );

    card.dataset.hora =
      hora;

    card.dataset.status =
      status;

    card.append(
      criarElemento(
        "strong",
        "",
        hora
      ),

      criarElemento(
        "span",
        "",
        obterTextoStatus(
          status
        )
      )
    );

    if (ehAgendamento(status)) {
      card.append(
        criarElemento(
          "span",
          "",
          normalizarTexto(
            horario?.cliente
          ) ||
          "Cliente não informado"
        ),

        criarElemento(
          "span",
          "",
          normalizarTexto(
            horario?.servico
          ) ||
          "Serviço não informado"
        )
      );

      return card;
    }

    if (
      ![
        "livre",
        "bloqueado",
      ].includes(status)
    ) {
      return card;
    }

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
        status
      )}, ${hora}. Clique para ${
        status === "livre"
          ? "bloquear"
          : "liberar"
      }.`
    );

    const alterarHorario =
      () => {
        alternarBloqueioHorario(
          profissional.id,
          dia.data,
          horario.hora,
          card
        );
      };

    card.addEventListener(
      "click",
      alterarHorario
    );

    card.addEventListener(
      "keydown",
      (evento) => {
        if (
          evento.key === "Enter" ||
          evento.key === " "
        ) {
          evento.preventDefault();

          alterarHorario();
        }
      }
    );

    return card;
  }

  /*
   * =====================================================
   * BLOCO DO PROFISSIONAL
   * =====================================================
   */

  function criarBlocoProfissional(
    profissional,
    dia,
    horarios
  ) {
    const nome =
      normalizarTexto(
        profissional?.nome
      ) ||
      "Profissional";

    const bloco =
      criarElemento(
        "article",
        "profissional-agenda"
      );

    const topo =
      criarElemento(
        "header",
        "profissional-topo"
      );

    const informacoes =
      criarElemento(
        "div",
        "profissional-info"
      );

    const textosProfissional =
      criarElemento("div");

    const quantidade =
      horarios.length;

    textosProfissional.append(
      criarElemento(
        "strong",
        "",
        nome
      ),

      criarElemento(
        "span",
        "",
        `${quantidade} horário${
          quantidade === 1
            ? ""
            : "s"
        } exibido${
          quantidade === 1
            ? ""
            : "s"
        }`
      )
    );

    informacoes.append(
      criarAvatar(profissional),
      textosProfissional
    );

    const totalAgendados =
      horarios.filter(
        (horario) =>
          ehAgendamento(
            horario?.status
          )
      ).length;

    const badge =
      criarElemento(
        "span",
        "badge-agendados",
        `${totalAgendados} agendado${
          totalAgendados === 1
            ? ""
            : "s"
        }`
      );

    topo.append(
      informacoes,
      badge
    );

    const grid =
      criarElemento(
        "div",
        "horarios-grid"
      );

    Array.from(horarios)
      .sort(
        (horarioA, horarioB) =>
          formatarHora(
            horarioA?.hora
          ).localeCompare(
            formatarHora(
              horarioB?.hora
            )
          )
      )
      .forEach(
        (horario) => {
          grid.appendChild(
            criarHorarioCard(
              profissional,
              dia,
              horario
            )
          );
        }
      );

    bloco.append(
      topo,
      grid
    );

    return bloco;
  }

  /*
   * =====================================================
   * RENDERIZAÇÃO DA AGENDA
   * =====================================================
   */

  function renderizarAgenda() {
    const dia =
      obterDiaSelecionado();

    elementos.listaAgendaGeral
      .replaceChildren();

    if (!dia) {
      atualizarResumo([]);

      elementos.listaAgendaGeral
        .appendChild(
          criarEstadoVazio({
            titulo:
              "Nenhum dia disponível",

            descricao:
              "Não encontramos dias para exibir nesta agenda.",
          })
        );

      return;
    }

    renderizarFiltroProfissionais(
      dia
    );

    const profissionais =
      Array.isArray(
        dia.profissionais
      )
        ? dia.profissionais
        : [];

    const filtroProfissional =
      elementos.filtroProfissional
        .value ||
      "todos";

    const filtroStatus =
      elementos.filtroStatus
        .value ||
      "todos";

    const profissionaisSelecionados =
      profissionais.filter(
        (profissional) => {
          if (
            filtroProfissional ===
            "todos"
          ) {
            return true;
          }

          return (
            String(
              profissional?.id
            ) ===
            filtroProfissional
          );
        }
      );

    const horariosResumo =
      profissionaisSelecionados
        .flatMap(
          (profissional) =>
            Array.isArray(
              profissional?.horarios
            )
              ? profissional.horarios
              : []
        );

    atualizarResumo(
      horariosResumo
    );

    let quantidadeBlocos = 0;

    profissionaisSelecionados
      .forEach(
        (profissional) => {
          const horarios =
            (
              Array.isArray(
                profissional?.horarios
              )
                ? profissional.horarios
                : []
            ).filter(
              (horario) =>
                statusCombinaComFiltro(
                  horario?.status,
                  filtroStatus
                )
            );

          if (!horarios.length) {
            return;
          }

          elementos.listaAgendaGeral
            .appendChild(
              criarBlocoProfissional(
                profissional,
                dia,
                horarios
              )
            );

          quantidadeBlocos += 1;
        }
      );

    if (!quantidadeBlocos) {
      elementos.listaAgendaGeral
        .appendChild(
          criarEstadoVazio({
            icone:
              "🔎",

            titulo:
              "Nenhum horário encontrado",

            descricao:
              "Altere os filtros para visualizar outros horários da equipe.",
          })
        );
    }
  }

  function renderizarTudo() {
    renderizarDias();
    renderizarAgenda();
    atualizarBotaoHoje();
  }

  /*
   * =====================================================
   * BLOQUEIO E LIBERAÇÃO
   * =====================================================
   */

  async function alternarBloqueioHorario(
    profissionalId,
    data,
    hora,
    card
  ) {
    const chave =
      `${profissionalId}|` +
      `${data}|` +
      `${hora}`;

    if (
      estado.horariosEmAlteracao
        .has(chave)
    ) {
      return;
    }

    estado.horariosEmAlteracao
      .add(chave);

    esconderMensagem();

    card.classList.add(
      "carregando"
    );

    card.setAttribute(
      "aria-busy",
      "true"
    );

    try {
      const resposta =
        await apiPost(
          "/bloqueios-horario",
          {
            profissional_id:
              profissionalId,

            data,
            hora,
          }
        );

      await carregarAgendaGeral({
        preservarDia:
          true,

        silencioso:
          true,
      });

      mostrarMensagem(
        resposta?.mensagem ||
          "Horário atualizado com sucesso.",

        "sucesso",
        3000
      );
    } catch (erro) {
      console.error(
        "Erro ao alterar horário:",
        erro
      );

      if (
        tratarErroAutorizacao(
          erro
        )
      ) {
        return;
      }

      card.classList.remove(
        "carregando"
      );

      card.removeAttribute(
        "aria-busy"
      );

      mostrarMensagem(
        erro?.message ||
          "Não foi possível alterar o horário.",

        "erro",
        0
      );
    } finally {
      estado.horariosEmAlteracao
        .delete(chave);
    }
  }

  /*
   * =====================================================
   * NOTIFICAÇÕES
   * =====================================================
   */

  function renderizarNotificacoes(
    notificacoes
  ) {
    elementos.listaNotificacoes
      .replaceChildren();

    if (!notificacoes.length) {
      elementos.listaNotificacoes
        .appendChild(
          criarEstadoVazio({
            titulo:
              "Nenhuma notificação recente",

            descricao:
              "Novos agendamentos e atualizações aparecerão aqui.",

            compacto:
              true,
          })
        );

      return;
    }

    notificacoes
      .slice(0, 20)
      .forEach(
        (notificacao) => {
          const card =
            criarElemento(
              "article",
              "notificacao-card"
            );

          card.append(
            criarElemento(
              "strong",
              "",
              normalizarTexto(
                notificacao?.titulo
              ) ||
              "Atualização da agenda"
            ),

            criarElemento(
              "p",
              "",
              normalizarTexto(
                notificacao?.mensagem
              ) ||
              "Sem detalhes adicionais."
            ),

            criarElemento(
              "small",
              "",
              formatarDataHora(
                notificacao?.created_at
              )
            )
          );

          elementos.listaNotificacoes
            .appendChild(card);
        }
      );
  }

  async function carregarNotificacoes() {
    if (
      estado.carregandoNotificacoes
    ) {
      return;
    }

    estado.carregandoNotificacoes =
      true;

    elementos.listaNotificacoes
      .replaceChildren(
        criarEstadoVazio({
          titulo:
            "Carregando notificações...",

          compacto:
            true,
        })
      );

    try {
      const resposta =
        await apiGet(
          "/notificacoes"
        );

      renderizarNotificacoes(
        extrairNotificacoes(
          resposta
        )
      );
    } catch (erro) {
      console.error(
        "Erro ao carregar notificações:",
        erro
      );

      if (
        tratarErroAutorizacao(
          erro
        )
      ) {
        return;
      }

      elementos.listaNotificacoes
        .replaceChildren(
          criarEstadoVazio({
            titulo:
              "Não foi possível carregar as notificações",

            descricao:
              "Atualize a página para tentar novamente.",

            compacto:
              true,
          })
        );
    } finally {
      estado.carregandoNotificacoes =
        false;
    }
  }

  /*
   * =====================================================
   * CARREGAMENTO DA AGENDA
   * =====================================================
   */

  async function carregarAgendaGeral({
    preservarDia = false,
    silencioso = false,
  } = {}) {
    if (estado.carregandoAgenda) {
      return;
    }

    estado.carregandoAgenda =
      true;

    if (!silencioso) {
      esconderMensagem();

      elementos.listaAgendaGeral
        .replaceChildren(
          criarEstadoVazio({
            icone:
              "⏳",

            titulo:
              "Carregando agenda geral",

            descricao:
              "Aguarde enquanto buscamos os horários da equipe.",
          })
        );
    }

    try {
      const resposta =
        await apiGet(
          "/agenda-geral"
        );

      estado.agenda =
        extrairAgenda(resposta)
          .filter(
            (dia) =>
              normalizarTexto(
                dia?.data
              )
          );

      if (!estado.agenda.length) {
        estado.diaSelecionado =
          null;

        elementos.diasAgenda
          .replaceChildren();

        atualizarResumo([]);
        atualizarBotaoHoje();

        elementos.listaAgendaGeral
          .replaceChildren(
            criarEstadoVazio({
              icone:
                "📭",

              titulo:
                "Nenhuma agenda encontrada",

              descricao:
                "Configure os horários dos profissionais para começar.",
            })
          );

        return;
      }

      const diaAnteriorExiste =
        estado.agenda.some(
          (dia) =>
            normalizarTexto(
              dia?.data
            ) ===
            estado.diaSelecionado
        );

      if (
        !preservarDia ||
        !estado.diaSelecionado ||
        !diaAnteriorExiste
      ) {
        estado.diaSelecionado =
          selecionarDiaInicial();
      }

      renderizarTudo();
    } catch (erro) {
      console.error(
        "Erro ao carregar agenda geral:",
        erro
      );

      if (
        tratarErroAutorizacao(
          erro
        )
      ) {
        return;
      }

      atualizarResumo([]);

      elementos.listaAgendaGeral
        .replaceChildren(
          criarEstadoVazio({
            icone:
              "⚠️",

            titulo:
              "Não foi possível carregar a agenda",

            descricao:
              erro?.message ||
              "Atualize a página e tente novamente.",
          })
        );

      mostrarMensagem(
        erro?.message ||
          "Não foi possível carregar a agenda geral.",

        "erro",
        0
      );
    } finally {
      estado.carregandoAgenda =
        false;
    }
  }

  /*
   * =====================================================
   * EVENTOS
   * =====================================================
   */

  elementos.filtroProfissional
    .addEventListener(
      "change",
      renderizarAgenda
    );

  elementos.filtroStatus
    .addEventListener(
      "change",
      renderizarAgenda
    );

  elementos.btnLimparFiltros
    ?.addEventListener(
      "click",
      () => {
        elementos.filtroProfissional
          .value =
            "todos";

        elementos.filtroStatus
          .value =
            "todos";

        renderizarAgenda();
      }
    );

  elementos.btnHoje.addEventListener(
    "click",
    () => {
      const hoje =
        obterHojeBrasil();

      const existeHoje =
        estado.agenda.some(
          (dia) =>
            normalizarTexto(
              dia?.data
            ) ===
            hoje
        );

      if (!existeHoje) {
        return;
      }

      estado.diaSelecionado =
        hoje;

      renderizarTudo();

      elementos.diasAgenda
        .querySelector(
          `[data-data="${hoje}"]`
        )
        ?.scrollIntoView({
          behavior:
            "smooth",

          block:
            "nearest",

          inline:
            "center",
        });
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

  if (
    !window.SessionGuard ||
    typeof window.SessionGuard
      .exigirDono !== "function"
  ) {
    console.error(
      "SessionGuard.exigirDono não foi carregado."
    );

    mostrarMensagem(
      "Não foi possível validar o acesso à agenda geral.",
      "erro",
      0
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
      "erro",
      0
    );

    return;
  }

  try {
    estado.contexto =
      await window.SessionGuard
        .exigirDono({
          destinoLogin:
            "/html/login-profissional.html",

          destinoSemNegocio:
            "/html/criar-negocio.html",

          destinoSemPermissao:
            "/html/inicio.html",
        });
  } catch (erro) {
    console.error(
      "Erro ao validar acesso à agenda geral:",
      erro
    );

    mostrarMensagem(
      erro?.message ||
        "Não foi possível validar sua sessão.",

      "erro",
      0
    );

    return;
  }

  if (!estado.contexto) {
    return;
  }

  await Promise.all([
    carregarAgendaGeral(),
    carregarNotificacoes(),
  ]);
});