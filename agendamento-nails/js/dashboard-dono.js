document.addEventListener(
  "DOMContentLoaded",
  async () => {
    if (
      !window.SessionGuard ||
      typeof window.SessionGuard
        .exigirDono !== "function"
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
        "Erro ao validar acesso ao dashboard:",
        erro
      );

      const mensagem =
        document.getElementById(
          "mensagemDashboard"
        );

      if (mensagem) {
        mensagem.textContent =
          erro?.message ||
          "Não foi possível validar sua sessão.";

        mensagem.className =
          "mensagem-dashboard mensagem-erro";
      }

      return;
    }

    /*
     * O guard já realizou o
     * redirecionamento necessário.
     */
    if (!contexto) {
      return;
    }

    const token =
      window.AuthService.getToken();

    if (!token) {
      window.location.replace(
        "/html/login-profissional.html"
      );

      return;
    }

  const elementos = {
    pagina:
      document.getElementById(
        "dashboardDonoPage"
      ),

    nomeNegocio:
      document.getElementById(
        "nomeNegocio"
      ),

    mensagemDashboard:
      document.getElementById(
        "mensagemDashboard"
      ),

    filtroPeriodo:
      document.getElementById(
        "filtroPeriodo"
      ),

    btnAtualizarDashboard:
      document.getElementById(
        "btnAtualizarDashboard"
      ),

    agendamentosHoje:
      document.getElementById(
        "agendamentosHoje"
      ),

    agendamentosPeriodo:
      document.getElementById(
        "agendamentosPeriodo"
      ),

    faturamentoHoje:
      document.getElementById(
        "faturamentoHoje"
      ),

    faturamentoPeriodo:
      document.getElementById(
        "faturamentoPeriodo"
      ),

    clientesNovos:
      document.getElementById(
        "clientesNovos"
      ),

    clientesRecorrentes:
      document.getElementById(
        "clientesRecorrentes"
      ),

    servicosVendidos:
      document.getElementById(
        "servicosVendidos"
      ),

    ticketMedio:
      document.getElementById(
        "ticketMedio"
      ),

    visitasPerfil:
      document.getElementById(
        "visitasPerfil"
      ),

    cliquesWhatsapp:
      document.getElementById(
        "cliquesWhatsapp"
      ),

    cliquesMaps:
      document.getElementById(
        "cliquesMaps"
      ),

    favoritosRecebidos:
      document.getElementById(
        "favoritosRecebidos"
      ),

    taxaConversao:
      document.getElementById(
        "taxaConversao"
      ),

    listaResumoDias:
      document.getElementById(
        "listaResumoDias"
      ),

    rankingProfissionais:
      document.getElementById(
        "rankingProfissionais"
      ),

    rankingServicos:
      document.getElementById(
        "rankingServicos"
      ),

    rankingClientes:
      document.getElementById(
        "rankingClientes"
      ),

    planoNome:
      document.getElementById(
        "planoNome"
      ),

    planoValor:
      document.getElementById(
        "planoValor"
      ),

    crescimentoTotal:
      document.getElementById(
        "crescimentoTotal"
      ),

    crescimentoMarco:
      document.getElementById(
        "crescimentoMarco"
      ),

    crescimentoApoio:
      document.getElementById(
        "crescimentoApoio"
      ),

    crescimentoProgresso:
      document.getElementById(
        "crescimentoProgresso"
      ),

    crescimentoBarra:
      document.getElementById(
        "crescimentoBarra"
      ),

    planoMensagem:
      document.getElementById(
        "planoMensagem"
      ),

    btnUpgradePlano:
      document.getElementById(
        "btnUpgradePlano"
      ),

    linkPerfilPublico:
      document.getElementById(
        "linkPerfilPublico"
      ),
  };

  const estado = {
    requisicaoDashboard: null,
    idRequisicaoDashboard: 0,
    temporizadorMensagem: null,
    faixaCrescimento:
      "carregando",
  };

  const formatadorMoeda =
    new Intl.NumberFormat(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL",
      }
    );

  function obterApiUrl() {
    return typeof API_URL === "string"
      ? API_URL
          .trim()
          .replace(/\/$/, "")
      : "";
  }

  function converterNumero(
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
    return formatadorMoeda.format(
      converterNumero(valor)
    );
  }

  function registrarComportamento(
    nome,
    propriedades = {}
  ) {
    window.AFAnalytics
      ?.registrar?.(
        nome,
        {
          propriedades,
        }
      );
  }

  function pluralizarAgendamento(
    quantidade
  ) {
    return Number(
      quantidade
    ) === 1
      ? "agendamento"
      : "agendamentos";
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

  function definirTexto(
    elemento,
    valor
  ) {
    if (!elemento) {
      return;
    }

    elemento.textContent =
      String(valor ?? "");
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

function redirecionarProfissional() {
  window.location.replace(
    "/html/agenda-profissional.html"
  );
}

  function mostrarMensagem(
    texto,
    tipo = "",
    removerDepois = false
  ) {
    const elemento =
      elementos.mensagemDashboard;

    if (!elemento) {
      return;
    }

    window.clearTimeout(
      estado.temporizadorMensagem
    );

    elemento.textContent =
      texto;

    elemento.className =
      "mensagem-dashboard";

    if (tipo) {
      elemento.classList.add(
        `mensagem-${tipo}`
      );
    }

    if (removerDepois) {
      estado.temporizadorMensagem =
        window.setTimeout(
          () => {
            elemento.textContent =
              "";

            elemento.className =
              "mensagem-dashboard";
          },
          3500
        );
    }
  }

  function definirCarregando(
    ativo
  ) {
    elementos.pagina?.classList.toggle(
      "carregando-dashboard",
      ativo
    );

    elementos.pagina?.setAttribute(
      "aria-busy",
      String(ativo)
    );

    if (
      elementos.filtroPeriodo
    ) {
      elementos.filtroPeriodo.disabled =
        ativo;
    }

    if (
      elementos.btnAtualizarDashboard
    ) {
      elementos.btnAtualizarDashboard.disabled =
        ativo;
    }
  }

  async function lerJson(
    resposta
  ) {
    const tipo =
      resposta.headers
        ?.get?.(
          "content-type"
        ) || "";

    if (
      !tipo.includes(
        "application/json"
      )
    ) {
      return {};
    }

    return resposta
      .json()
      .catch(
        () => ({})
      );
  }

  async function apiGet(
    caminho,
    {
      signal,
      redirecionarAcessoNegado = false,
    } = {}
  ) {
    const apiUrl =
      obterApiUrl();

    if (!apiUrl) {
      throw new Error(
        "API_URL não está configurada."
      );
    }

    const resposta =
      await fetch(
        `${apiUrl}${caminho}`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${token}`,

            Accept:
              "application/json",
          },

          cache: "no-store",
          signal,
        }
      );

    const dados =
      await lerJson(
        resposta
      );

    if (
      resposta.status === 401
    ) {
      redirecionarLogin();

      throw Object.assign(
        new Error(
          "Sessão expirada."
        ),
        {
          status: 401,
        }
      );
    }

    if (
      resposta.status === 403
    ) {
      if (
        redirecionarAcessoNegado
      ) {
        redirecionarProfissional();
      }

      throw Object.assign(
        new Error(
          dados.erro ||
            dados.mensagem ||
            "Apenas o dono pode acessar este dashboard."
        ),
        {
          status: 403,
        }
      );
    }

    if (!resposta.ok) {
      throw Object.assign(
        new Error(
          dados.erro ||
            dados.mensagem ||
            "Erro ao carregar dados."
        ),
        {
          status:
            resposta.status,
        }
      );
    }

    return dados;
  }

  function salvarNegocioDoDashboard(
  negocio
) {
  if (!negocio) {
    return;
  }

  const negocioNormalizado = {
    ...negocio,

    id:
      negocio.id ||
      negocio.negocio_id ||
      null,

    papel:
      "dono",
  };

  if (
    window.AuthService &&
    typeof window.AuthService
      .salvarNegocio === "function"
  ) {
    window.AuthService
      .salvarNegocio(
        negocioNormalizado
      );

    return;
  }

  localStorage.setItem(
    "negocio",
    JSON.stringify(
      negocioNormalizado
    )
  );
}

  function mostrarVazio(
    elemento,
    texto
  ) {
    if (!elemento) {
      return;
    }

    elemento.replaceChildren(
      criarElemento(
        "div",
        "estado-vazio",
        texto
      )
    );
  }

  function criarItemRanking({
    item = {},
    indice,
    tipo,
  }) {
    const icones = {
      profissional: "👤",
      servico: "💅",
      cliente: "👥",
    };

    const total =
      converterNumero(
        item.total
      );

    const card =
      criarElemento(
        "article",
        "ranking-item"
      );

    const esquerda =
      criarElemento(
        "div",
        "ranking-left"
      );

    const avatar =
      criarElemento(
        "div",
        "ranking-avatar",
        icones[tipo] ||
          "⭐"
      );

    const informacoes =
      criarElemento(
        "div",
        "ranking-info"
      );

    const nome =
      criarElemento(
        "strong",
        "",
        `${indice + 1}. ${
          item.nome ||
          "Sem nome"
        }`
      );

    const subtitulo =
      criarElemento(
        "span",
        "",
        `${total} ${pluralizarAgendamento(
          total
        )}`
      );

    informacoes.append(
      nome,
      subtitulo
    );

    esquerda.append(
      avatar,
      informacoes
    );

    const direita =
      criarElemento(
        "div",
        "ranking-right"
      );

    direita.append(
      criarElemento(
        "strong",
        "",
        formatarMoeda(
          item.faturamento
        )
      ),

      criarElemento(
        "span",
        "",
        "faturamento"
      )
    );

    card.append(
      esquerda,
      direita
    );

    return card;
  }

  function renderizarRanking(
    elemento,
    lista,
    tipo
  ) {
    if (!elemento) {
      return;
    }

    if (
      !Array.isArray(lista) ||
      lista.length === 0
    ) {
      mostrarVazio(
        elemento,
        "Nenhum dado encontrado."
      );

      return;
    }

    const fragmento =
      document.createDocumentFragment();

    lista.forEach(
      (item, indice) => {
        fragmento.appendChild(
          criarItemRanking({
            item,
            indice,
            tipo,
          })
        );
      }
    );

    elemento.replaceChildren(
      fragmento
    );
  }

  function renderizarResumoDias(
    lista
  ) {
    const elemento =
      elementos.listaResumoDias;

    if (!elemento) {
      return;
    }

    if (
      !Array.isArray(lista) ||
      lista.length === 0
    ) {
      mostrarVazio(
        elemento,
        "Nenhum resultado encontrado no período."
      );

      return;
    }

    const fragmento =
      document.createDocumentFragment();

    lista.forEach(
      (dia = {}) => {
        const quantidade =
          converterNumero(
            dia.agendamentos
          );

        const card =
          criarElemento(
            "article",
            "ranking-item"
          );

        const esquerda =
          criarElemento(
            "div",
            "ranking-left"
          );

        const avatar =
          criarElemento(
            "div",
            "ranking-avatar",
            "📅"
          );

        const informacoes =
          criarElemento(
            "div",
            "ranking-info"
          );

        informacoes.append(
          criarElemento(
            "strong",
            "",
            dia.data ||
              "Data"
          ),

          criarElemento(
            "span",
            "",
            `${quantidade} ${pluralizarAgendamento(
              quantidade
            )}`
          )
        );

        esquerda.append(
          avatar,
          informacoes
        );

        const direita =
          criarElemento(
            "div",
            "ranking-right"
          );

        direita.append(
          criarElemento(
            "strong",
            "",
            formatarMoeda(
              dia.faturamento
            )
          ),

          criarElemento(
            "span",
            "",
            "no dia"
          )
        );

        card.append(
          esquerda,
          direita
        );

        fragmento.appendChild(
          card
        );
      }
    );

    elemento.replaceChildren(
      fragmento
    );
  }

  function preencherResumo(
    resumo = {}
  ) {
    definirTexto(
      elementos.agendamentosHoje,
      converterNumero(
        resumo.agendamentos_hoje
      )
    );

    definirTexto(
      elementos.agendamentosPeriodo,
      converterNumero(
        resumo.agendamentos_periodo
      )
    );

    definirTexto(
      elementos.faturamentoHoje,
      formatarMoeda(
        resumo.faturamento_hoje
      )
    );

    definirTexto(
      elementos.faturamentoPeriodo,
      formatarMoeda(
        resumo.faturamento_periodo
      )
    );

    definirTexto(
      elementos.clientesNovos,
      converterNumero(
        resumo.clientes_novos
      )
    );

    definirTexto(
      elementos.clientesRecorrentes,
      converterNumero(
        resumo.clientes_recorrentes
      )
    );

    definirTexto(
      elementos.servicosVendidos,
      converterNumero(
        resumo.servicos_vendidos
      )
    );

    definirTexto(
      elementos.ticketMedio,
      formatarMoeda(
        resumo.ticket_medio
      )
    );
  }

  function preencherPerformance(
    performance = {}
  ) {
    definirTexto(
      elementos.visitasPerfil,
      converterNumero(
        performance.visitas_perfil
      )
    );

    definirTexto(
      elementos.cliquesWhatsapp,
      converterNumero(
        performance.cliques_whatsapp
      )
    );

    definirTexto(
      elementos.cliquesMaps,
      converterNumero(
        performance.cliques_maps
      )
    );

    definirTexto(
      elementos.favoritosRecebidos,
      converterNumero(
        performance.favoritos_recebidos
      )
    );

    definirTexto(
      elementos.taxaConversao,
      `${converterNumero(
        performance.taxa_conversao
      )}%`
    );
  }

  function renderizarDashboard(
    dados = {}
  ) {
    preencherResumo(
      dados.resumo
    );

    preencherPerformance(
      dados.performance
    );

    renderizarResumoDias(
      dados.resumo_dias
    );

    renderizarRanking(
      elementos.rankingProfissionais,
      dados.ranking_profissionais,
      "profissional"
    );

    renderizarRanking(
      elementos.rankingServicos,
      dados.ranking_servicos,
      "servico"
    );

    renderizarRanking(
      elementos.rankingClientes,
      dados.ranking_clientes,
      "cliente"
    );

    if (
      dados.negocio?.nome
    ) {
      definirTexto(
        elementos.nomeNegocio,
        dados.negocio.nome
      );
    }

    if (
      elementos.linkPerfilPublico &&
      dados.negocio?.slug
    ) {
      elementos.linkPerfilPublico
        .href =
          `/html/perfil-negocio.html?slug=${encodeURIComponent(
            dados.negocio.slug
          )}`;
    }

    salvarNegocioDoDashboard(
      dados.negocio
    );
  }

  function normalizarPlano(
    resposta = {}
  ) {
    return resposta.plano &&
      typeof resposta.plano ===
        "object"
      ? resposta.plano
      : resposta;
  }

  function renderizarPlano(
    resposta
  ) {
    const plano =
      normalizarPlano(
        resposta
      );

    const capacidadeBruta =
      plano.capacidade_agendamentos ??
      plano.limite_agendamentos ??
      null;

    const capacidade =
      capacidadeBruta === null
        ? null
        : converterNumero(
            capacidadeBruta
          );

    const utilizados =
      converterNumero(
        plano.utilizados ??
          plano.agendamentos_utilizados
      );

    const ilimitado =
      Boolean(
        plano.ilimitado
      ) ||
      capacidade === null;

    const percentualComercial =
      ilimitado ||
      capacidade <= 0
        ? 0
        : Math.min(
            Math.round(
              (
                utilizados /
                capacidade
              ) * 100
            ),
            100
          );

    const marcos = [
      5,
      10,
      20,
      30,
      50,
      75,
      100,
      150,
      200,
      300,
      500,
      750,
      1000,
    ];

    const proximoMarco =
      marcos.find(
        (marco) =>
          marco >
          utilizados
      ) ||
      (
        Math.floor(
          utilizados /
          500
        ) +
        1
      ) *
        500;

    const marcoAnterior =
      [
        0,
        ...marcos,
      ]
        .filter(
          (marco) =>
            marco <=
            utilizados
        )
        .at(
          -1
        ) ||
      0;

    const intervaloMarco =
      Math.max(
        proximoMarco -
          marcoAnterior,
        1
      );

    let percentualMarco =
      Math.min(
        Math.round(
          (
            (
              utilizados -
              marcoAnterior
            ) /
            intervaloMarco
          ) *
            100
        ),
        100
      );

    const novaFase =
      !ilimitado &&
      capacidade > 0 &&
      utilizados >=
        capacidade;

    definirTexto(
      elementos.planoNome,
      plano.plano_nome ||
        plano.nome ||
        "Plano"
    );

    definirTexto(
      elementos.planoValor,
      plano.valor !==
          undefined &&
        plano.valor !== null
        ? formatarMoeda(
            plano.valor
          )
        : "-"
    );

    definirTexto(
      elementos.crescimentoTotal,
      utilizados
    );

    definirTexto(
      elementos.crescimentoMarco,
      novaFase
        ? "Nova fase pronta"
        : `${proximoMarco} ${pluralizarAgendamento(
            proximoMarco
          )}`
    );

    if (
      elementos.crescimentoBarra
    ) {
      if (novaFase) {
        percentualMarco =
          100;
      }

      elementos.crescimentoBarra
        .style.width =
          `${percentualMarco}%`;
    }

    elementos.crescimentoProgresso
      ?.setAttribute(
        "aria-valuenow",
        String(
          percentualMarco
        )
      );

    let faixa =
      "ganhando_ritmo";

    let mensagem =
      `Seu negócio conquistou ${utilizados} ` +
      `${pluralizarAgendamento(
        utilizados
      )} neste mês. Cada horário preenchido mostra que seu negócio está avançando 💅`;

    let apoio =
      "Seu trabalho merece ser cada vez mais escolhido.";

    if (
      utilizados === 0
    ) {
      faixa =
        "comecando";

      mensagem =
        "Seu próximo agendamento abre uma nova história. Divulgue seu perfil e deixe seus horários prontos.";

      apoio =
        "A primeira conquista começa com um horário disponível.";
    } else if (
      utilizados === 1
    ) {
      faixa =
        "primeira_conquista";

      mensagem =
        "Sua primeira conquista do mês já chegou. É assim que um negócio ganha ritmo 💅";

      apoio =
        "Cada cliente atendida fortalece sua história.";
    } else if (
      novaFase
    ) {
      faixa =
        "nova_fase";

      mensagem =
        "Você chegou a um novo marco — isso é prova do seu sucesso. Para continuar recebendo novos agendamentos, abra a próxima fase do seu negócio.";

      apoio =
        "Seu crescimento trouxe você até aqui. Vamos continuar.";
    } else if (
      !ilimitado &&
      percentualComercial >= 80
    ) {
      faixa =
        "crescendo";

      mensagem =
        "Seu trabalho está sendo cada vez mais escolhido. Você está pronta para a próxima fase do seu crescimento.";

      apoio =
        "O próximo passo existe porque sua agenda cresceu.";
    }

    definirTexto(
      elementos.planoMensagem,
      mensagem
    );

    definirTexto(
      elementos.crescimentoApoio,
      apoio
    );

    estado.faixaCrescimento =
      faixa;

    elementos.btnUpgradePlano
      ?.classList.toggle(
        "hidden",
        (
          ilimitado ||
          percentualComercial < 80
        ) &&
        !novaFase
      );

    registrarComportamento(
      "mensagem_crescimento_visualizada",
      {
        faixa,
        agendamentos_mes:
          utilizados,
      }
    );
  }

  function mostrarErroPlano() {
    definirTexto(
      elementos.planoNome,
      "Não disponível"
    );

    definirTexto(
      elementos.planoValor,
      "-"
    );

    definirTexto(
      elementos.crescimentoTotal,
      "0"
    );

    definirTexto(
      elementos.crescimentoMarco,
      "Próxima conquista"
    );

    definirTexto(
      elementos.crescimentoApoio,
      "Continue cuidando da sua agenda enquanto tentamos novamente."
    );

    definirTexto(
      elementos.planoMensagem,
      "Não foi possível carregar as informações do plano."
    );

    if (
      elementos.crescimentoBarra
    ) {
      elementos.crescimentoBarra.style.width =
        "0%";
    }

    elementos.crescimentoProgresso
      ?.setAttribute(
        "aria-valuenow",
        "0"
      );
  }

  async function apiGet(
    caminho,
    {
      signal,
      redirecionarAcessoNegado = false,
    } = {}
  ) {
    const apiUrl =
      obterApiUrl();

    if (!apiUrl) {
      throw new Error(
        "API_URL não está configurada."
      );
    }

    const resposta =
      await fetch(
        `${apiUrl}${caminho}`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${token}`,

            Accept:
              "application/json",
          },

          cache: "no-store",
          signal,
        }
      );

    const dados =
      await lerJson(
        resposta
      );

    if (
      resposta.status === 401
    ) {
      redirecionarLogin();

      throw Object.assign(
        new Error(
          "Sessão expirada."
        ),
        {
          status: 401,
        }
      );
    }

    if (
      resposta.status === 403
    ) {
      if (
        redirecionarAcessoNegado
      ) {
        redirecionarProfissional();
      }

      throw Object.assign(
        new Error(
          dados.erro ||
            dados.mensagem ||
            "Apenas o dono pode acessar este dashboard."
        ),
        {
          status: 403,
        }
      );
    }

    if (!resposta.ok) {
      throw Object.assign(
        new Error(
          dados.erro ||
            dados.mensagem ||
            "Erro ao carregar dados."
        ),
        {
          status:
            resposta.status,
        }
      );
    }

    return dados;
  }

  function obterPeriodoInicial() {
    const permitido =
      new Set([
        "hoje",
        "7dias",
        "30dias",
        "mes",
      ]);

    const salvo =
      sessionStorage.getItem(
        "dashboardDonoPeriodo"
      );

    return permitido.has(
      salvo
    )
      ? salvo
      : "7dias";
  }

  async function carregarDashboard() {
    const periodo =
      elementos.filtroPeriodo
        ?.value ||
      "7dias";

    sessionStorage.setItem(
      "dashboardDonoPeriodo",
      periodo
    );

    estado.requisicaoDashboard
      ?.abort();

    estado.requisicaoDashboard =
      new AbortController();

    const idRequisicao =
      ++estado.idRequisicaoDashboard;

    definirCarregando(
      true
    );

    mostrarMensagem(
      "Atualizando dashboard..."
    );

    try {
      const dados =
        await apiGet(
          `/dashboard-dono?periodo=${encodeURIComponent(
            periodo
          )}`,
          {
            signal:
              estado
                .requisicaoDashboard
                .signal,

            redirecionarAcessoNegado:
              true,
          }
        );

      if (
        idRequisicao !==
        estado.idRequisicaoDashboard
      ) {
        return;
      }

      renderizarDashboard(
        dados
      );

      const horario =
        new Intl.DateTimeFormat(
          "pt-BR",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        ).format(
          new Date()
        );

      mostrarMensagem(
        `Dashboard atualizado às ${horario}.`,
        "sucesso",
        true
      );
    } catch (erro) {
      if (
        erro.name ===
          "AbortError" ||
        erro.status === 401 ||
        erro.status === 403
      ) {
        return;
      }

      console.error(
        "Erro ao carregar dashboard:",
        erro
      );

      mostrarVazio(
        elementos.listaResumoDias,
        "Não foi possível carregar o resumo diário."
      );

      mostrarVazio(
        elementos.rankingProfissionais,
        "Não foi possível carregar os profissionais."
      );

      mostrarVazio(
        elementos.rankingServicos,
        "Não foi possível carregar os serviços."
      );

      mostrarVazio(
        elementos.rankingClientes,
        "Não foi possível carregar os clientes."
      );

      mostrarMensagem(
        erro.message ||
          "Erro ao carregar o dashboard.",
        "erro"
      );
    } finally {
      if (
        idRequisicao ===
        estado.idRequisicaoDashboard
      ) {
        definirCarregando(
          false
        );
      }
    }
  }

  function configurarEventos() {
    elementos.filtroPeriodo
      ?.addEventListener(
        "change",
        () => {
          registrarComportamento(
            "periodo_dashboard_alterado",
            {
              periodo:
                elementos
                  .filtroPeriodo
                  ?.value ||
                "7dias",
            }
          );

          void carregarDashboard();
        }
      );

    elementos.btnAtualizarDashboard
      ?.addEventListener(
        "click",
        carregarDashboard
      );

    elementos.btnUpgradePlano
      ?.addEventListener(
        "click",
        () => {
          registrarComportamento(
            "upgrade_selecionado",
            {
              origem:
                "dashboard_dono",
              faixa:
                estado
                  .faixaCrescimento,
            }
          );

          window.location.href =
            "minha-assinatura.html";
        }
      );

    document
      .querySelectorAll(
        "[data-acao-dashboard]"
      )
      .forEach(
        (elemento) => {
          elemento
            .addEventListener(
              "click",
              () => {
                registrarComportamento(
                  "acao_dashboard_selecionada",
                  {
                    acao:
                      elemento
                        .dataset
                        .acaoDashboard ||
                      "desconhecida",
                    papel:
                      "dono",
                  }
                );
              }
            );
        }
      );

    window.addEventListener(
      "online",
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          carregarDashboard();
        }
      }
    );

    window.addEventListener(
      "beforeunload",
      () => {
        estado.requisicaoDashboard
          ?.abort();

        window.clearTimeout(
          estado.temporizadorMensagem
        );
      }
    );
  }

 async function carregarPlano() {
  try {
    const plano = await apiGet(
      "/meu-plano"
    );

    renderizarPlano(plano);
  } catch (erro) {
    if (erro.status !== 401) {
      console.error(
        "Erro ao carregar plano:",
        erro
      );

      renderizarPlano(null);
    }
  }
} 

 async function iniciar() {
  if (
    contexto.negocio?.nome
  ) {
    definirTexto(
      elementos.nomeNegocio,
      contexto.negocio.nome
    );
  }

  if (
    elementos.filtroPeriodo
  ) {
    elementos.filtroPeriodo.value =
      obterPeriodoInicial();
  }

  configurarEventos();

  await Promise.allSettled([
    carregarPlano(),
    carregarDashboard(),
  ]);
}

  void iniciar();
});
