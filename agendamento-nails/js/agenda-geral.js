document.addEventListener("DOMContentLoaded", async () => {
  const API_URL = "http://localhost:3000";

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

  const totalAgendados = document.getElementById("totalAgendados");
  const totalLivres = document.getElementById("totalLivres");
  const totalBloqueados = document.getElementById("totalBloqueados");

  const filtroProfissional = document.getElementById("filtroProfissional");
  const filtroStatus = document.getElementById("filtroStatus");

  const diasAgenda = document.getElementById("diasAgenda");
  const listaAgendaGeral = document.getElementById("listaAgendaGeral");
  const btnHoje = document.getElementById("btnHoje");

  let agenda = [];
  let diaSelecionado = null;

  function formatarData(dataIso) {
    const data = new Date(`${dataIso}T00:00:00`);

    return data.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit"
    });
  }

  function ehHoje(dataIso) {
    return dataIso === new Date().toISOString().slice(0, 10);
  }

  function atualizarResumo(horarios) {
    totalAgendados.textContent = horarios.filter(h => h.status === "agendado").length;
    totalLivres.textContent = horarios.filter(h => h.status === "livre").length;
    totalBloqueados.textContent = horarios.filter(h => h.status === "bloqueado").length;
  }

  function renderizarDias() {
    diasAgenda.innerHTML = "";

    agenda.forEach((dia) => {
      const btn = document.createElement("button");
      btn.className = "dia-btn";
      btn.type = "button";

      if (dia.data === diaSelecionado) {
        btn.classList.add("ativo");
      }

      btn.innerHTML = `
        <strong>${ehHoje(dia.data) ? "Hoje" : formatarData(dia.data).split(",")[0]}</strong>
        <span>${formatarData(dia.data)}</span>
      `;

      btn.addEventListener("click", () => {
        diaSelecionado = dia.data;
        renderizarTudo();
      });

      diasAgenda.appendChild(btn);
    });
  }

  function renderizarFiltrosProfissionais(dia) {
    const valorAtual = filtroProfissional.value || "todos";

    filtroProfissional.innerHTML = `<option value="todos">Todos</option>`;

    const nomes = new Map();

    dia.profissionais.forEach((prof) => {
      nomes.set(String(prof.id), prof.nome);
    });

    nomes.forEach((nome, id) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = nome;
      filtroProfissional.appendChild(option);
    });

    filtroProfissional.value = nomes.has(valorAtual) ? valorAtual : "todos";
  }

  function renderizarAgenda() {
    const dia = agenda.find(d => d.data === diaSelecionado);

    if (!dia || !dia.profissionais?.length) {
      listaAgendaGeral.innerHTML = `
        <div class="estado-vazio">
          Nenhuma agenda encontrada.
        </div>
      `;
      atualizarResumo([]);
      return;
    }

    renderizarFiltrosProfissionais(dia);

    const profissionalFiltro = filtroProfissional.value;
    const statusFiltro = filtroStatus.value;

    let todosHorariosResumo = [];

    let profissionaisFiltrados = dia.profissionais.filter((prof) => {
      return profissionalFiltro === "todos" || String(prof.id) === profissionalFiltro;
    });

    listaAgendaGeral.innerHTML = "";

    profissionaisFiltrados.forEach((profissional) => {
      let horarios = profissional.horarios || [];

      todosHorariosResumo.push(...horarios);

      if (statusFiltro !== "todos") {
        horarios = horarios.filter(h => h.status === statusFiltro);
      }

      if (!horarios.length) return;

      const totalAgendadosProf = horarios.filter(h => h.status === "agendado").length;

      const bloco = document.createElement("article");
      bloco.className = "profissional-agenda";

      bloco.innerHTML = `
        <div class="profissional-topo">
          <div class="profissional-info">
            <img
              class="profissional-foto"
              src="${profissional.foto_url || "https://via.placeholder.com/100x100/f3b0d7/ffffff?text=💅"}"
              alt="${profissional.nome || "Profissional"}"
            >

            <div>
              <strong>${profissional.nome || "Profissional"}</strong>
              <span>${horarios.length} horário(s) exibido(s)</span>
            </div>
          </div>

          <div class="badge-agendados">
            ${totalAgendadosProf} agendado(s)
          </div>
        </div>

        <div class="horarios-grid"></div>
      `;

      const grid = bloco.querySelector(".horarios-grid");

      horarios.forEach((h) => {
        const card = document.createElement("div");
        card.className = `horario-card ${h.status}`;

        let textoStatus = "Livre";
        if (h.status === "bloqueado") textoStatus = "Bloqueado";
        if (h.status === "agendado") textoStatus = "Agendado";

        card.innerHTML = `
          <strong>${h.hora}</strong>
          <span>${textoStatus}</span>
          ${
            h.status === "agendado"
              ? `
                <span>${h.cliente || "Cliente"}</span>
                <span>${h.servico || "Serviço"}</span>
              `
              : ""
          }
        `;

        grid.appendChild(card);
      });

      listaAgendaGeral.appendChild(bloco);
    });

    if (!listaAgendaGeral.innerHTML.trim()) {
      listaAgendaGeral.innerHTML = `
        <div class="estado-vazio">
          Nenhum horário encontrado com esse filtro.
        </div>
      `;
    }

    atualizarResumo(todosHorariosResumo);
  }

  function renderizarTudo() {
    renderizarDias();
    renderizarAgenda();
  }

  async function carregarAgendaGeral() {
    try {
      listaAgendaGeral.innerHTML = `
        <div class="estado-vazio">
          Carregando agenda geral...
        </div>
      `;

      const res = await fetch(`${API_URL}/agenda-geral`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || "Erro ao carregar agenda geral.");
      }

      agenda = data.agenda || [];

      if (!agenda.length) {
        listaAgendaGeral.innerHTML = `
          <div class="estado-vazio">
            Nenhuma agenda encontrada.
          </div>
        `;
        return;
      }

      diaSelecionado = agenda[0].data;

      renderizarTudo();

    } catch (err) {
      console.error("Erro agenda geral:", err);

      listaAgendaGeral.innerHTML = `
        <div class="estado-vazio">
          ${err.message || "Erro ao carregar agenda geral."}
        </div>
      `;
    }
  }

  filtroProfissional?.addEventListener("change", renderizarAgenda);
  filtroStatus?.addEventListener("change", renderizarAgenda);

  btnHoje?.addEventListener("click", () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const existe = agenda.find(d => d.data === hoje);

    if (existe) {
      diaSelecionado = hoje;
      renderizarTudo();
    }
  });

  await carregarAgendaGeral();
});