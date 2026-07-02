document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");

  if (!token || !usuario || usuario.tipo !== "profissional") {
    window.location.href = "login-profissional.html";
    return;
  }

  const btnSair = document.getElementById("btnSair");
  const btnDashboard = document.getElementById("btnDashboard");
  const mensagemPainel = document.getElementById("mensagemPainel");

  const nomeNegocioAtual = document.getElementById("nomeNegocioAtual");
  const slugNegocioAtual = document.getElementById("slugNegocioAtual");
  const nomeProfissionalAtual = document.getElementById("nomeProfissionalAtual");
  const btnPerfilPublico = document.getElementById("btnPerfilPublico");

  const totalAgendados = document.getElementById("totalAgendados");
  const totalRecorrentes = document.getElementById("totalRecorrentes");
  const totalNovos = document.getElementById("totalNovos");
  const totalHoje = document.getElementById("totalHoje");

  const diaAgendaTexto = document.getElementById("diaAgendaTexto");
  const abasDias = document.getElementById("abasDias");
  const agendaVisual = document.getElementById("agendaVisual");

  const qtdLivres = document.getElementById("qtdLivres");
  const qtdBloqueados = document.getElementById("qtdBloqueados");
  const qtdAgendados = document.getElementById("qtdAgendados");

  let agenda = [];
  let diaSelecionado = null;
  let negocioAtual = null;

  function mostrarMensagem(texto, cor = "#e63946") {
    if (!mensagemPainel) return;
    mensagemPainel.textContent = texto;
    mensagemPainel.style.color = cor;
    mensagemPainel.classList.remove("oculto");
  }

  function esconderMensagem() {
    if (!mensagemPainel) return;
    mensagemPainel.textContent = "";
    mensagemPainel.classList.add("oculto");
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function formatarDataCompleta(dataIso) {
    const data = new Date(`${dataIso}T00:00:00`);

    return data.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit"
    });
  }

  function formatarDiaCurto(dataIso) {
    const data = new Date(`${dataIso}T00:00:00`);

    return data.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit"
    });
  }

  function ehHoje(dataIso) {
    const hoje = new Date().toISOString().slice(0, 10);
    return dataIso === hoje;
  }

  async function carregarNegocioAtual() {
    try {
      const resposta = await fetch(`${API_URL}/meu-negocio`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro || "Erro ao carregar negócio.");
      }

      if (!resultado.temNegocio || !resultado.negocio) {
        nomeNegocioAtual.textContent = "Nenhum negócio vinculado";
        slugNegocioAtual.textContent = "--";
        nomeProfissionalAtual.textContent = usuario.nome || "--";
        return;
      }

      negocioAtual = resultado.negocio;

      localStorage.setItem("negocio", JSON.stringify(negocioAtual));

      nomeNegocioAtual.textContent = negocioAtual.nome || "Meu negócio";
      slugNegocioAtual.textContent = negocioAtual.slug || "--";
      nomeProfissionalAtual.textContent = usuario.nome || "--";

      if (btnPerfilPublico && negocioAtual.slug) {
        btnPerfilPublico.href = `/html/perfil-negocio.html?slug=${encodeURIComponent(negocioAtual.slug)}`;
        btnPerfilPublico.classList.remove("oculto");
      }

    } catch (erro) {
      console.error("Erro ao carregar negócio atual:", erro);

      nomeNegocioAtual.textContent = "Erro ao carregar negócio";
      slugNegocioAtual.textContent = "--";
      nomeProfissionalAtual.textContent = usuario.nome || "--";

      mostrarMensagem(erro.message || "Erro ao carregar dados do negócio.");
    }
  }

  function atualizarCards() {
    const todosHorarios = agenda.flatMap((dia) => dia.horarios || []);

    const agendados = todosHorarios.filter((h) => h.status === "agendado");
    const bloqueados = todosHorarios.filter((h) => h.status === "bloqueado");
    const livres = todosHorarios.filter((h) => h.status === "livre");

    const agendadosHoje = agenda
      .filter((dia) => ehHoje(dia.data))
      .flatMap((dia) => dia.horarios || [])
      .filter((h) => h.status === "agendado");

    if (totalAgendados) totalAgendados.textContent = agendados.length;
    if (totalRecorrentes) totalRecorrentes.textContent = 0;
    if (totalNovos) totalNovos.textContent = agendados.length;
    if (totalHoje) totalHoje.textContent = agendadosHoje.length;

    if (qtdLivres) qtdLivres.textContent = livres.length;
    if (qtdBloqueados) qtdBloqueados.textContent = bloqueados.length;
    if (qtdAgendados) qtdAgendados.textContent = agendados.length;
  }

  function renderizarAbasDias() {
    abasDias.innerHTML = "";

    agenda.forEach((dia) => {
      const btn = document.createElement("button");
      btn.className = "aba-dia";
      btn.type = "button";

      if (dia.data === diaSelecionado) {
        btn.classList.add("ativo");
      }

      btn.innerHTML = `
        <strong>${ehHoje(dia.data) ? "Hoje" : formatarDiaCurto(dia.data)}</strong>
      `;

      btn.addEventListener("click", () => {
        diaSelecionado = dia.data;
        renderizarTudo();
      });

      abasDias.appendChild(btn);
    });
  }

  function montarResumoAgendamento(horario) {
    if (horario.status !== "agendado") return "";

    return `
      <div class="resumo-agendamento">
        <strong>${horario.cliente || "Cliente"}</strong>
        <span>${horario.servico || "Serviço"}</span>
        <span>${formatarMoeda(horario.valor)}</span>
      </div>
    `;
  }

  async function alternarBloqueio(data, hora, card) {
    try {
      esconderMensagem();

      card.classList.add("carregando");

      const resposta = await fetch(`${API_URL}/bloqueios-horario`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ data, hora })
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro || "Erro ao alterar horário.");
      }

      await carregarAgenda();

      mostrarMensagem(resultado.mensagem || "Agenda atualizada com sucesso.", "#2f9e63");

      setTimeout(() => {
        esconderMensagem();
      }, 1600);

    } catch (erro) {
      console.error("Erro ao alternar bloqueio:", erro);
      mostrarMensagem(erro.message || "Erro na conexão com o servidor.");
      card.classList.remove("carregando");
    }
  }

  function renderizarAgendaVisual() {
    agendaVisual.innerHTML = "";

    const dia = agenda.find((item) => item.data === diaSelecionado);

    if (!dia) {
      agendaVisual.innerHTML = `
        <div class="agenda-vazia">
          Nenhum dia disponível.
        </div>
      `;
      return;
    }

    if (diaAgendaTexto) {
      diaAgendaTexto.textContent = `${ehHoje(dia.data) ? "Hoje 💅" : "Agenda"} • ${formatarDataCompleta(dia.data)}`;
    }

    dia.horarios.forEach((horario) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = `horario-card ${horario.status}`;
      card.dataset.data = horario.data;
      card.dataset.hora = horario.hora;

      let emoji = "🟢";
      let texto = "Livre";

      if (horario.status === "bloqueado") {
        emoji = "🔒";
        texto = "Bloqueado";
      }

      if (horario.status === "agendado") {
        emoji = "🟠";
        texto = "Agendado";
      }

      if (horario.status === "realizado") {
        emoji = "✅";
        texto = "Realizado";
      }

      card.innerHTML = `
        <div class="horario-topo">
          <strong>${horario.hora}</strong>
          <span>${emoji} ${texto}</span>
        </div>

        ${montarResumoAgendamento(horario)}
      `;

      if (horario.status === "livre" || horario.status === "bloqueado") {
        card.addEventListener("click", () => {
          alternarBloqueio(horario.data, horario.hora, card);
        });
      }

      if (horario.status === "agendado") {
        card.disabled = true;
      }

      agendaVisual.appendChild(card);
    });
  }

  function renderizarTudo() {
    renderizarAbasDias();
    renderizarAgendaVisual();
    atualizarCards();
  }

  async function carregarAgenda() {
    try {
      esconderMensagem();

      agendaVisual.innerHTML = `
        <div class="agenda-vazia">
          Carregando agenda...
        </div>
      `;

      const resposta = await fetch(`${API_URL}/agenda-profissional`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro || "Erro ao carregar agenda.");
      }

      agenda = resultado.agenda || [];

      if (!agenda.length) {
        agendaVisual.innerHTML = `
          <div class="agenda-vazia">
            Nenhuma agenda disponível.
          </div>
        `;
        return;
      }

      if (!diaSelecionado) {
        diaSelecionado = agenda[0].data;
      }

      renderizarTudo();

    } catch (erro) {
      console.error("Erro ao carregar agenda:", erro);

      mostrarMensagem(erro.message || "Erro ao carregar agenda.");

      agendaVisual.innerHTML = `
        <div class="agenda-vazia">
          Não foi possível carregar a agenda.
        </div>
      `;
    }
  }

  if (btnSair) {
    btnSair.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      localStorage.removeItem("negocio");

      window.location.href = "login-profissional.html";
    });
  }

  if (btnDashboard) {
    btnDashboard.addEventListener("click", () => {
      window.location.href = "dashboard-profissional.html";
    });
  }

  await carregarNegocioAtual();
  await carregarAgenda();
});