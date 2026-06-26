document.addEventListener("DOMContentLoaded", async () => {
  

  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");
  const token = localStorage.getItem("token");

  if (!usuario || usuario.tipo !== "admin" || !token) {
    window.location.href = "inicio.html";
    return;
  }

  let periodoAtual = "all";

  const el = (id) => document.getElementById(id);

  const campos = {
    totalNegocios: el("totalNegocios"),
    totalClientes: el("totalClientes"),
    totalProfissionais: el("totalProfissionais"),
    totalAgendamentos: el("totalAgendamentos"),

    usuariosHoje: el("usuariosHoje"),
    negociosHoje: el("negociosHoje"),
    agendamentosHoje: el("agendamentosHoje"),
    taxaConversaoGeral: el("taxaConversaoGeral"),

    visitasPlataforma: el("visitasPlataforma"),
    cliquesWhatsapp: el("cliquesWhatsapp"),
    cliquesMaps: el("cliquesMaps"),
    favoritosTotais: el("favoritosTotais"),
    cidadeTop: el("cidadeTop"),
    setorTop: el("setorTop"),

    negociosSemServico: el("negociosSemServico"),
    negociosSemMaps: el("negociosSemMaps"),
    negociosSemWhatsapp: el("negociosSemWhatsapp"),
    negociosCompletos: el("negociosCompletos")
  };

  const listas = {
    negocios: el("listaNegociosAdmin"),
    agendamentos: el("listaAgendamentosAdmin"),
    rankingNegociosAgendados: el("rankingNegociosAgendados"),
    rankingNegociosVistos: el("rankingNegociosVistos"),
    rankingCidades: el("rankingCidades"),
    usuariosRecentes: el("listaUsuariosRecentes")
  };

  function sair() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("negocio");
    window.location.href = "inicio.html";
  }

  function setText(id, valor) {
    if (campos[id]) campos[id].textContent = valor ?? 0;
  }

  function mostrarVazio(container, texto) {
    if (!container) return;

    container.innerHTML = `
      <div class="estado-vazio">
        ${texto}
      </div>
    `;
  }

  function formatarData(data) {
    if (!data) return "-";

    try {
      return new Date(data).toLocaleDateString("pt-BR");
    } catch {
      return data;
    }
  }

  function renderizarListaSimples(container, lista, config) {
    if (!container) return;

    if (!lista || !lista.length) {
      mostrarVazio(container, config.vazio || "Nenhum dado encontrado.");
      return;
    }

    container.innerHTML = "";

    lista.forEach((item) => {
      const card = document.createElement("div");
      card.className = "admin-item";

      card.innerHTML = `
        <div class="admin-item-topo">
          <strong>${config.titulo(item)}</strong>

          ${
            config.badge
              ? `<span class="status-admin ${config.badgeClasse ? config.badgeClasse(item) : "status-ativo"}">
                  ${config.badge(item)}
                </span>`
              : ""
          }
        </div>

        ${
          config.linhas
            ? config.linhas(item).map((linha) => `<p>${linha}</p>`).join("")
            : ""
        }
      `;

      container.appendChild(card);
    });
  }

  async function apiGet(url) {
    const resposta = await fetch(`${API_URL}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
      throw new Error(resultado.erro || "Erro ao carregar dados.");
    }

    return resultado;
  }

  async function carregarDashboard() {
    try {
      const data = await apiGet(`/admin/dashboard?periodo=${periodoAtual}`);

      setText("totalNegocios", data.totalNegocios);
      setText("totalClientes", data.totalClientes);
      setText("totalProfissionais", data.totalProfissionais);
      setText("totalAgendamentos", data.totalAgendamentos);

      setText("usuariosHoje", data.usuariosHoje || 0);
      setText("negociosHoje", data.negociosHoje || 0);
      setText("agendamentosHoje", data.agendamentosHoje || 0);
      setText("taxaConversaoGeral", `${data.taxaConversaoGeral || 0}%`);

      setText("visitasPlataforma", data.visitasPlataforma || 0);
      setText("cliquesWhatsapp", data.cliquesWhatsapp || 0);
      setText("cliquesMaps", data.cliquesMaps || 0);
      setText("favoritosTotais", data.favoritosTotais || 0);
      setText("cidadeTop", data.cidadeTop || "-");
      setText("setorTop", data.setorTop || "-");

      setText("negociosSemServico", data.negociosSemServico || 0);
      setText("negociosSemMaps", data.negociosSemMaps || 0);
      setText("negociosSemWhatsapp", data.negociosSemWhatsapp || 0);
      setText("negociosCompletos", data.negociosCompletos || 0);

    } catch (erro) {
      console.error("Erro dashboard admin:", erro);
    }
  }

  async function carregarNegocios() {
    try {
      const data = await apiGet("/admin/negocios");

      renderizarListaSimples(listas.negocios, data.negocios || [], {
        vazio: "Nenhum negócio encontrado.",
        titulo: (n) => n.nome || "Negócio",
        badge: (n) => n.ativo === false ? "Inativo" : "Ativo",
        badgeClasse: (n) => n.ativo === false ? "status-inativo" : "status-ativo",
        linhas: (n) => [
          `📍 ${n.cidade || "Cidade não informada"}`,
          `📞 ${n.whatsapp_negocio || "Sem WhatsApp"}`,
          `🔗 ${n.slug || "-"}`
        ]
      });

    } catch (erro) {
      console.error("Erro negócios admin:", erro);
      mostrarVazio(listas.negocios, "Erro ao carregar negócios.");
    }
  }

  async function carregarAgendamentos() {
    try {
      const data = await apiGet("/admin/agendamentos");

      renderizarListaSimples(listas.agendamentos, data.agendamentos || [], {
        vazio: "Nenhum agendamento encontrado.",
        titulo: (a) => a.cliente_nome || "Cliente",
        badge: (a) => a.status || "agendado",
        badgeClasse: () => "status-ativo",
        linhas: (a) => [
          `🏢 ${a.negocio || "-"}`,
          `💅 ${a.servico || "-"}`,
          `📅 ${formatarData(a.data)} ${a.horario || ""}`
        ]
      });

    } catch (erro) {
      console.error("Erro agendamentos admin:", erro);
      mostrarVazio(listas.agendamentos, "Erro ao carregar agendamentos.");
    }
  }

  async function carregarMarketing() {
    try {
      const data = await apiGet("/admin/marketing");

      renderizarListaSimples(listas.rankingNegociosAgendados, data.negociosMaisAgendados || [], {
        vazio: "Nenhum ranking de agendamentos.",
        titulo: (n) => n.nome || "Negócio",
        badge: (n) => `${n.total || 0} agend.`,
        badgeClasse: () => "status-ativo",
        linhas: (n) => [
          `📍 ${n.cidade || "Cidade não informada"}`,
          `💰 Faturamento estimado: R$ ${Number(n.faturamento || 0).toFixed(2)}`
        ]
      });

      renderizarListaSimples(listas.rankingNegociosVistos, data.negociosMaisVistos || [], {
        vazio: "Nenhum perfil visualizado ainda.",
        titulo: (n) => n.nome || "Negócio",
        badge: (n) => `${n.visitas || 0} visitas`,
        badgeClasse: () => "status-ativo",
        linhas: (n) => [
          `📍 ${n.cidade || "Cidade não informada"}`,
          `📲 WhatsApp: ${n.cliques_whatsapp || 0}`
        ]
      });

      renderizarListaSimples(listas.rankingCidades, data.cidades || [], {
        vazio: "Nenhuma cidade encontrada.",
        titulo: (c) => c.cidade || "Cidade",
        badge: (c) => `${c.total || 0}`,
        badgeClasse: () => "status-ativo",
        linhas: (c) => [
          `🏢 ${c.total || 0} negócio(s)`
        ]
      });

      renderizarListaSimples(listas.usuariosRecentes, data.usuariosRecentes || [], {
        vazio: "Nenhum usuário recente.",
        titulo: (u) => u.nome || "Usuário",
        badge: (u) => u.tipo || "-",
        badgeClasse: () => "status-ativo",
        linhas: (u) => [
          `📧 ${u.email || "-"}`,
          `📅 ${formatarData(u.created_at)}`
        ]
      });

    } catch (erro) {
      console.error("Erro marketing admin:", erro);

      mostrarVazio(listas.rankingNegociosAgendados, "Erro ao carregar ranking.");
      mostrarVazio(listas.rankingNegociosVistos, "Erro ao carregar visualizações.");
      mostrarVazio(listas.rankingCidades, "Erro ao carregar cidades.");
      mostrarVazio(listas.usuariosRecentes, "Erro ao carregar usuários.");
    }
  }

  document.querySelectorAll(".filtro-periodo").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".filtro-periodo").forEach((b) => {
        b.classList.remove("ativo");
      });

      btn.classList.add("ativo");
      periodoAtual = btn.dataset.periodo || "all";

      await carregarDashboard();
    });
  });

  document.getElementById("btnSairAdmin")?.addEventListener("click", sair);

  await carregarDashboard();
  await carregarNegocios();
  await carregarAgendamentos();
  await carregarMarketing();
});