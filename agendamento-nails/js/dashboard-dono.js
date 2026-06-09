document.addEventListener("DOMContentLoaded", async () => {
  const API_URL = "https://agenda-fashion-production.up.railway.app";

  const token = localStorage.getItem("token");

  const usuario = JSON.parse(
    localStorage.getItem("usuario") || "null"
  );

  const negocio = JSON.parse(
    localStorage.getItem("negocio") || "null"
  );

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

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
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

  async function carregarDashboard() {
    try {
      const periodo = filtroPeriodo?.value || "7";

      const res = await fetch(`${API_URL}/dashboard-dono?periodo=${periodo}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || "Erro ao carregar dashboard.");
      }

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

  await carregarDashboard();
});