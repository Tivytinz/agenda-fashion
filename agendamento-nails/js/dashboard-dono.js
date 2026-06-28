document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");
  const negocio = JSON.parse(localStorage.getItem("negocio") || "null");

  const ehDono =
    usuario?.tipo === "dono" ||
    negocio?.papel === "dono";

  if (!token || !usuario || !ehDono) {
    window.location.href = "login-profissional.html";
    return;
  }

  const filtroPeriodo = document.getElementById("filtroPeriodo");

  const agendamentosHoje = document.getElementById("agendamentosHoje");
  const agendamentosPeriodo = document.getElementById("agendamentosPeriodo");
  const faturamentoHoje = document.getElementById("faturamentoHoje");
  const faturamentoPeriodo = document.getElementById("faturamentoPeriodo");
  const clientesNovos = document.getElementById("clientesNovos");
  const clientesRecorrentes = document.getElementById("clientesRecorrentes");
  const servicosVendidos = document.getElementById("servicosVendidos");
  const ticketMedio = document.getElementById("ticketMedio");

  const visitasPerfil = document.getElementById("visitasPerfil");
  const cliquesWhatsapp = document.getElementById("cliquesWhatsapp");
  const cliquesMaps = document.getElementById("cliquesMaps");
  const favoritosRecebidos = document.getElementById("favoritosRecebidos");
  const taxaConversao = document.getElementById("taxaConversao");

  const listaResumoDias = document.getElementById("listaResumoDias");
  const rankingProfissionais = document.getElementById("rankingProfissionais");
  const rankingServicos = document.getElementById("rankingServicos");
  const rankingClientes = document.getElementById("rankingClientes");

  // Elementos opcionais do bloco de plano
  const planoNome = document.getElementById("planoNome");
  const planoValor = document.getElementById("planoValor");
  const planoUso = document.getElementById("planoUso");
  const planoRestantes = document.getElementById("planoRestantes");
  const planoPercentual = document.getElementById("planoPercentual");
  const planoBarra = document.getElementById("planoBarra");
  const planoMensagem = document.getElementById("planoMensagem");
  const btnUpgradePlano = document.getElementById("btnUpgradePlano");

  function formatarMoeda(valor) {
    if (window.Utils?.formatarMoeda) {
      return Utils.formatarMoeda(valor);
    }

    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  async function apiGet(path) {
    if (window.API?.get) {
      return API.get(path);
    }

    const res = await fetch(`${API_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.erro || "Erro ao carregar dados.");
    }

    return data;
  }

  function mostrarVazio(elemento, texto) {
    if (!elemento) return;

    elemento.innerHTML = `
      <div class="estado-vazio">
        ${texto}
      </div>
    `;
  }

  function renderRanking(container, lista, tipo) {
    if (!container) return;

    container.innerHTML = "";

    if (!lista || !lista.length) {
      mostrarVazio(container, "Nenhum dado encontrado.");
      return;
    }

    lista.forEach((item, index) => {
      const div = document.createElement("div");
      div.className = "ranking-item";

      div.innerHTML = `
        <div class="ranking-left">
          <div class="ranking-avatar">
            ${tipo === "profissional" ? "👤" : tipo === "servico" ? "💅" : "👥"}
          </div>

          <div class="ranking-info">
            <strong>${index + 1}. ${item.nome || "Sem nome"}</strong>
            <span>
              ${item.subtitulo || `${item.total || 0} agendamento(s)`}
            </span>
          </div>
        </div>

        <div class="ranking-right">
          <strong>${formatarMoeda(item.faturamento || 0)}</strong>
          <span>faturamento</span>
        </div>
      `;

      container.appendChild(div);
    });
  }

  function renderResumoDias(lista) {
    if (!listaResumoDias) return;

    listaResumoDias.innerHTML = "";

    if (!lista || !lista.length) {
      mostrarVazio(listaResumoDias, "Nenhum dado diário encontrado.");
      return;
    }

    lista.forEach((dia) => {
      const div = document.createElement("div");
      div.className = "ranking-item";

      div.innerHTML = `
        <div class="ranking-left">
          <div class="ranking-avatar">📅</div>

          <div class="ranking-info">
            <strong>${dia.data || "Data"}</strong>
            <span>${dia.agendamentos || 0} agendamento(s)</span>
          </div>
        </div>

        <div class="ranking-right">
          <strong>${formatarMoeda(dia.faturamento || 0)}</strong>
          <span>no dia</span>
        </div>
      `;

      listaResumoDias.appendChild(div);
    });
  }

  function renderPlano(plano) {
    if (!plano) return;

    const capacidade = plano.capacidade_agendamentos;
    const utilizados = Number(plano.utilizados || 0);
    const ilimitado = plano.ilimitado || capacidade === null;
    const percentual = ilimitado
      ? 100
      : Math.min(Math.round((utilizados / capacidade) * 100), 100);

    const restantes = ilimitado
      ? null
      : Math.max(Number(capacidade || 0) - utilizados, 0);

    if (planoNome) {
      planoNome.textContent = plano.plano_nome || plano.nome || "Plano";
    }

    if (planoValor) {
      planoValor.textContent = ilimitado
        ? "Premium"
        : formatarMoeda(plano.valor || 0);
    }

    if (planoUso) {
      planoUso.textContent = ilimitado
        ? `${utilizados} agendamentos este mês`
        : `${utilizados} de ${capacidade} agendamentos`;
    }

    if (planoRestantes) {
      planoRestantes.textContent = ilimitado
        ? "Agendamentos ilimitados"
        : `${restantes} agendamento(s) restante(s)`;
    }

    if (planoPercentual) {
      planoPercentual.textContent = ilimitado
        ? "Ilimitado"
        : `${percentual}%`;
    }

    if (planoBarra) {
      planoBarra.style.width = ilimitado ? "100%" : `${percentual}%`;
    }

    if (planoMensagem) {
      if (ilimitado) {
        planoMensagem.textContent =
          "Seu negócio está no plano com capacidade ilimitada.";
      } else if (utilizados >= capacidade) {
        planoMensagem.textContent =
          "🎉 Parabéns! Você atingiu a capacidade do seu plano. No Agenda Fashion, o limite significa sucesso.";
      } else if (percentual >= 80) {
        planoMensagem.textContent =
          `🚀 Sua agenda está crescendo. Faltam apenas ${restantes} agendamento(s) para atingir a capacidade do plano.`;
      } else {
        planoMensagem.textContent =
          "Acompanhe aqui o crescimento da sua agenda este mês.";
      }
    }

    if (btnUpgradePlano) {
  btnUpgradePlano.classList.remove("hidden");

  btnUpgradePlano.textContent = "Gerenciar assinatura";

  btnUpgradePlano.onclick = () => {
    window.location.href = "minha-assinatura.html";
  };
}
  }

  async function carregarPlano() {
    try {
      const plano = await apiGet("/api/meu-plano");
      renderPlano(plano);
    } catch (erro) {
      console.error("Erro ao carregar plano:", erro);

      if (planoMensagem) {
        planoMensagem.textContent = "Não foi possível carregar seu plano.";
      }
    }
  }

  async function carregarDashboard() {
    try {
      const periodo = filtroPeriodo?.value || "7";

      const data = await apiGet(`/dashboard-dono?periodo=${periodo}`);

      const resumo = data.resumo || {};
      const performance = data.performance || {};

      if (agendamentosHoje) agendamentosHoje.textContent = resumo.agendamentos_hoje || 0;
      if (agendamentosPeriodo) agendamentosPeriodo.textContent = resumo.agendamentos_periodo || 0;

      if (faturamentoHoje) faturamentoHoje.textContent = formatarMoeda(resumo.faturamento_hoje || 0);
      if (faturamentoPeriodo) faturamentoPeriodo.textContent = formatarMoeda(resumo.faturamento_periodo || 0);

      if (clientesNovos) clientesNovos.textContent = resumo.clientes_novos || 0;
      if (clientesRecorrentes) clientesRecorrentes.textContent = resumo.clientes_recorrentes || 0;
      if (servicosVendidos) servicosVendidos.textContent = resumo.servicos_vendidos || 0;
      if (ticketMedio) ticketMedio.textContent = formatarMoeda(resumo.ticket_medio || 0);

      if (visitasPerfil) visitasPerfil.textContent = performance.visitas_perfil || 0;
      if (cliquesWhatsapp) cliquesWhatsapp.textContent = performance.cliques_whatsapp || 0;
      if (cliquesMaps) cliquesMaps.textContent = performance.cliques_maps || 0;
      if (favoritosRecebidos) favoritosRecebidos.textContent = performance.favoritos_recebidos || 0;
      if (taxaConversao) taxaConversao.textContent = `${performance.taxa_conversao || 0}%`;

      renderResumoDias(data.resumo_dias || []);
      renderRanking(rankingProfissionais, data.ranking_profissionais || [], "profissional");
      renderRanking(rankingServicos, data.ranking_servicos || [], "servico");
      renderRanking(rankingClientes, data.ranking_clientes || [], "cliente");

    } catch (erro) {
      console.error("Erro dashboard dono:", erro);

      mostrarVazio(listaResumoDias, "Erro ao carregar resumo diário.");
      mostrarVazio(rankingProfissionais, "Erro ao carregar profissionais.");
      mostrarVazio(rankingServicos, "Erro ao carregar serviços.");
      mostrarVazio(rankingClientes, "Erro ao carregar clientes.");
    }
  }

  filtroPeriodo?.addEventListener("change", carregarDashboard);

  await carregarPlano();
  await carregarDashboard();
});