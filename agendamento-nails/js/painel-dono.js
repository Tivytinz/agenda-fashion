document.addEventListener("DOMContentLoaded", async () => {

  const API_URL = "https://agenda-fashion-production.up.railway.app";

  const token = localStorage.getItem("token");

  const usuario = JSON.parse(
    localStorage.getItem("usuario") || "null"
  );

  // =============================
  // 🔐 VALIDAÇÃO
  // =============================
  if (!token || !usuario) {
    window.location.href = "login-profissional.html";
    return;
  }

  // =============================
  // 🎯 ELEMENTOS
  // =============================
  const nomeNegocio = document.getElementById("nomeNegocio");
  const cidadeNegocio = document.getElementById("cidadeNegocio");
  const fotoNegocio = document.getElementById("fotoNegocio");

  const totalHoje = document.getElementById("totalHoje");
  const faturamentoHoje = document.getElementById("faturamentoHoje");
  const clientesSemana = document.getElementById("clientesSemana");
  const avaliacaoMedia = document.getElementById("avaliacaoMedia");

  const agendaResumo = document.getElementById("agendaResumo");

  const listaProfissionais = document.getElementById("listaProfissionais");

  const listaServicos = document.getElementById("listaServicos");

  const listaClientes = document.getElementById("listaClientes");

  const visitasPerfil = document.getElementById("visitasPerfil");
  const cliquesWhatsapp = document.getElementById("cliquesWhatsapp");
  const cliquesMaps = document.getElementById("cliquesMaps");
  const taxaConversao = document.getElementById("taxaConversao");

  const btnAbrirPerfil = document.getElementById("btnAbrirPerfil");
  const btnCopiarLink = document.getElementById("btnCopiarLink");
  const btnWhatsapp = document.getElementById("btnWhatsapp");
  const btnMaps = document.getElementById("btnMaps");

  const btnAdicionarProfissional = document.getElementById("btnAdicionarProfissional");
  const btnNovoServico = document.getElementById("btnNovoServico");

  let negocio = null;

  // =============================
  // 💰 FORMATAÇÃO
  // =============================
  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  // =============================
  // 🔗 LINK PERFIL
  // =============================
  function gerarLinkPerfil() {

    if (!negocio?.slug) return "";

    return `${window.location.origin}/html/perfil-negocio.html?slug=${negocio.slug}`;
  }

  // =============================
  // 🏢 CARREGAR NEGÓCIO
  // =============================
  async function carregarNegocio() {

    try {

      const resposta = await fetch(
        `${API_URL}/meu-negocio`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro || "Erro negócio");
      }

      negocio = resultado.negocio;

      nomeNegocio.textContent =
        negocio.nome || "Meu negócio";

      cidadeNegocio.textContent =
        `📍 ${negocio.cidade || "Cidade não informada"}`;

      if (negocio.foto_url) {
        fotoNegocio.src = negocio.foto_url;
      }

    } catch (erro) {

      console.error(erro);

      nomeNegocio.textContent =
        "Erro ao carregar negócio";
    }
  }

  // =============================
  // 📊 DASHBOARD
  // =============================
  async function carregarDashboard() {

    try {

      const resposta = await fetch(
        `${API_URL}/dashboard-profissional`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro);
      }

      const resumo = resultado.resumo || {};

      totalHoje.textContent =
        resumo.total_hoje || 0;

      faturamentoHoje.textContent =
        formatarMoeda(
          resumo.faturamento_hoje || 0
        );

      clientesSemana.textContent =
        resumo.clientes_semana || 0;

      avaliacaoMedia.textContent =
        resumo.avaliacao_media || "5.0";

      visitasPerfil.textContent =
        resumo.visitas_perfil || 0;

      cliquesWhatsapp.textContent =
        resumo.cliques_whatsapp || 0;

      cliquesMaps.textContent =
        resumo.cliques_maps || 0;

      taxaConversao.textContent =
        `${resumo.taxa_conversao || 0}%`;

    } catch (erro) {

      console.error(
        "Erro dashboard:",
        erro
      );
    }
  }

  // =============================
  // 📅 AGENDA
  // =============================
  async function carregarAgendaHoje() {

    try {

      const resposta = await fetch(
        `${API_URL}/agenda-profissional`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro);
      }

      const hoje =
        new Date()
        .toISOString()
        .slice(0, 10);

      const agendaHoje =
        resultado.agenda.find(
          item => item.data === hoje
        );

      if (
        !agendaHoje ||
        !agendaHoje.horarios.length
      ) {

        agendaResumo.innerHTML = `
          <div class="estado-vazio">
            Nenhum horário hoje.
          </div>
        `;

        return;
      }

      const agendados =
        agendaHoje.horarios.filter(
          item => item.status === "agendado"
        );

      if (!agendados.length) {

        agendaResumo.innerHTML = `
          <div class="estado-vazio">
            Nenhum atendimento hoje.
          </div>
        `;

        return;
      }

      agendaResumo.innerHTML = "";

      agendados.forEach(item => {

        const card =
          document.createElement("div");

        card.className =
          "agenda-item";

        card.innerHTML = `
          <div>
            <strong>
              ${item.hora}
              •
              ${item.cliente || "Cliente"}
            </strong>

            <span>
              💅 ${item.servico || "Serviço"}
            </span>
          </div>

          <div class="status-agenda agendado">
            Agendado
          </div>
        `;

        agendaResumo.appendChild(card);

      });

    } catch (erro) {

      console.error(
        "Erro agenda:",
        erro
      );

      agendaResumo.innerHTML = `
        <div class="estado-vazio">
          Erro ao carregar agenda.
        </div>
      `;
    }
  }

  // =============================
  // 👥 PROFISSIONAIS
  // =============================
  async function carregarProfissionais() {

    try {

      const resposta = await fetch(
        `${API_URL}/meu-negocio`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const resultado = await resposta.json();

      const profissionais =
        resultado.profissionais || [];

      if (!profissionais.length) {

        listaProfissionais.innerHTML = `
          <div class="estado-vazio">
            Nenhum profissional cadastrado.
          </div>
        `;

        return;
      }

      listaProfissionais.innerHTML = "";

      profissionais.forEach(profissional => {

        const card =
          document.createElement("div");

        card.className =
          "profissional-card";

        card.innerHTML = `
          <div class="profissional-topo">

            <img
              src="${profissional.foto_url || "/public/img/negocio-padrao.png"}"
              onerror="this.onerror=null; this.src='/public/img/negocio-padrao.png';"
              class="profissional-foto"
            >

            <div>
              <strong>
                ${profissional.nome}
              </strong>

              <span>
                Profissional ativo
              </span>
            </div>

          </div>

          <div class="profissional-acoes">

            <button class="btn-secundario">
              Agenda
            </button>

            <button class="btn-primario">
              Editar
            </button>

          </div>
        `;

        listaProfissionais.appendChild(card);

      });

    } catch (erro) {

      console.error(
        "Erro profissionais:",
        erro
      );
    }
  }

  // =============================
  // 💅 SERVIÇOS
  // =============================
  async function carregarServicos() {

    try {

      const resposta = await fetch(
        `${API_URL}/servicos`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const resultado = await resposta.json();

      const servicos =
        resultado.servicos || [];

      if (!servicos.length) {

        listaServicos.innerHTML = `
          <div class="estado-vazio">
            Nenhum serviço cadastrado.
          </div>
        `;

        return;
      }

      listaServicos.innerHTML = "";

      servicos.forEach(servico => {

        const item =
          document.createElement("div");

        item.className =
          "servico-item";

        item.innerHTML = `
          <div>

            <strong>
              ${servico.nome}
            </strong>

            <span>
              ⏱️ ${servico.duracao_minutos || 0} min
            </span>

          </div>

          <div class="servico-valor">
            ${formatarMoeda(servico.valor)}
          </div>
        `;

        listaServicos.appendChild(item);

      });

    } catch (erro) {

      console.error(
        "Erro serviços:",
        erro
      );
    }
  }

  // =============================
  // 👤 CLIENTES
  // =============================
  async function carregarClientes() {

    listaClientes.innerHTML = `
      <div class="estado-vazio">
        Clientes aparecerão aqui 💅
      </div>
    `;
  }

  // =============================
  // 🔗 AÇÕES
  // =============================
  btnAbrirPerfil?.addEventListener(
    "click",
    () => {

      if (!negocio?.slug) return;

      window.open(
        `perfil-negocio.html?slug=${negocio.slug}`,
        "_blank"
      );
    }
  );

  btnCopiarLink?.addEventListener(
    "click",
    async () => {

      const link = gerarLinkPerfil();

      if (!link) return;

      await navigator.clipboard.writeText(link);

      alert("Link copiado 💅");
    }
  );

  btnWhatsapp?.addEventListener(
    "click",
    () => {

      if (!negocio?.whatsapp_negocio) return;

      window.open(
        `https://wa.me/${negocio.whatsapp_negocio}`,
        "_blank"
      );
    }
  );

  btnMaps?.addEventListener(
    "click",
    () => {

      if (!negocio?.localizacao_url) return;

      window.open(
        negocio.localizacao_url,
        "_blank"
      );
    }
  );

  btnAdicionarProfissional?.addEventListener(
    "click",
    () => {

      window.location.href =
        "equipe.html";
    }
  );

  btnNovoServico?.addEventListener(
    "click",
    () => {

      window.location.href =
        "servicos.html";
    }
  );

  // =============================
  // 🚀 INIT
  // =============================
  await carregarNegocio();

  await carregarDashboard();

  await carregarAgendaHoje();

  await carregarProfissionais();

  await carregarServicos();

  await carregarClientes();

});