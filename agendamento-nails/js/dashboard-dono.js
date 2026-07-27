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

    planoUso:
      document.getElementById(
        "planoUso"
      ),

    planoRestantes:
      document.getElementById(
        "planoRestantes"
      ),

    planoPercentual:
      document.getElementById(
        "planoPercentual"
      ),

    planoProgresso:
      document.getElementById(
        "planoProgresso"
      ),

    planoBarra:
      document.getElementById(
        "planoBarra"
      ),

    planoMensagem:
      document.getElementById(
        "planoMensagem"
      ),

    btnUpgradePlano:
      document.getElementById(
        "btnUpgradePlano"
      ),
  };

  const estado = {
    requisicaoDashboard: null,
    idRequisicaoDashboard: 0,
    temporizadorMensagem: null,
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

    const percentual =
      ilimitado
        ? 100
        : capacidade > 0
          ? Math.min(
              Math.round(
                (
                  utilizados /
                  capacidade
                ) * 100
              ),
              100
            )
          : 0;

    const restantes =
      ilimitado
        ? null
        : Math.max(
            capacidade -
              utilizados,
            0
          );

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
        : ilimitado
          ? "Agendamentos ilimitados"
          : "-"
    );

    definirTexto(
      elementos.planoUso,
      ilimitado
        ? `${utilizados} agendamentos neste mês`
        : `${utilizados} de ${capacidade} agendamentos`
    );

    definirTexto(
      elementos.planoRestantes,
      ilimitado
        ? "Capacidade ilimitada"
        : `${restantes} ${pluralizarAgendamento(
            restantes
          )} restantes`
    );

    definirTexto(
      elementos.planoPercentual,
      ilimitado
        ? "Ilimitado"
        : `${percentual}%`
    );

    if (
      elementos.planoBarra
    ) {
      elementos.planoBarra.style.width =
        `${percentual}%`;
    }

    elementos.planoProgresso
      ?.setAttribute(
        "aria-valuenow",
        String(percentual)
      );

    let mensagem =
      "Acompanhe aqui o uso mensal do seu plano.";

    if (ilimitado) {
      mensagem =
        "Seu plano permite agendamentos ilimitados.";
    } else if (
      capacidade > 0 &&
      utilizados >= capacidade
    ) {
      mensagem =
        "Sua agenda atingiu a capacidade atual do plano.";
    } else if (
      percentual >= 90
    ) {
      mensagem =
        `Sua agenda está quase cheia. ` +
        `Restam ${restantes} ` +
        `${pluralizarAgendamento(
          restantes
        )}. Compare com o próximo plano.`;
    } else if (
      percentual >= 80
    ) {
      mensagem =
        `Sua agenda está crescendo. ` +
        `Restam ${restantes} ` +
        `${pluralizarAgendamento(
          restantes
        )} neste plano.`;
    }

    definirTexto(
      elementos.planoMensagem,
      mensagem
    );

    elementos.btnUpgradePlano
      ?.classList.remove(
        "hidden"
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
      elementos.planoUso,
      "0 agendamentos"
    );

    definirTexto(
      elementos.planoRestantes,
      "-"
    );

    definirTexto(
      elementos.planoPercentual,
      "0%"
    );

    definirTexto(
      elementos.planoMensagem,
      "Não foi possível carregar as informações do plano."
    );

    if (
      elementos.planoBarra
    ) {
      elementos.planoBarra.style.width =
        "0%";
    }

    elementos.planoProgresso
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
        carregarDashboard
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
          window.location.href =
            "minha-assinatura.html";
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
