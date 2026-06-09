document.addEventListener("DOMContentLoaded", async () => {
  const API_URL = "https://agenda-fashion-production.up.railway.app";

  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");

  if (!token || usuario?.tipo !== "profissional") {
    window.location.href = "login-profissional.html";
    return;
  }

  const nomeProfissional = document.getElementById("nomeProfissional");
  const resumoDia = document.getElementById("resumoDia");
  const diasScroll = document.getElementById("diasScroll");
  const listaHorarios = document.getElementById("listaHorarios");

  const modal = document.getElementById("modalHorario");
  const modalTitulo = document.getElementById("modalTitulo");
  const modalDescricao = document.getElementById("modalDescricao");
  const btnCancelarModal = document.getElementById("btnCancelarModal");
  const btnConfirmarModal = document.getElementById("btnConfirmarModal");

  let agenda = [];
  let diaSelecionado = null;
  let horarioSelecionado = null;

  function saudacao() {
    const hora = new Date().getHours();

    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
  }

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

  function abrirModal(horario) {
    horarioSelecionado = horario;

    if (horario.status === "livre") {
      modalTitulo.textContent = `Bloquear ${horario.hora}?`;
      modalDescricao.textContent = "Esse horário ficará indisponível para clientes.";
      btnConfirmarModal.textContent = "Bloquear";
    }

    if (horario.status === "bloqueado") {
      modalTitulo.textContent = `Liberar ${horario.hora}?`;
      modalDescricao.textContent = "Esse horário voltará a ficar disponível para agendamento.";
      btnConfirmarModal.textContent = "Liberar";
    }

    modal.classList.remove("hidden");
  }

  function fecharModal() {
    modal.classList.add("hidden");
    horarioSelecionado = null;
  }

  async function alternarBloqueio() {
    if (!horarioSelecionado) return;

    try {
      btnConfirmarModal.disabled = true;
      btnConfirmarModal.textContent = "Salvando...";

      const res = await fetch(`${API_URL}/bloqueios-horario`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: horarioSelecionado.data,
          hora: horarioSelecionado.hora
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.erro || "Erro ao alterar horário.");
        return;
      }

      fecharModal();
      await carregarAgenda();

    } catch (err) {
      alert("Erro na conexão com o servidor.");
    } finally {
      btnConfirmarModal.disabled = false;
    }
  }

  function atualizarResumoDia() {
    const dia = agenda.find((d) => d.data === diaSelecionado);

    if (!dia) {
      resumoDia.textContent = "Você possui 0 atendimentos hoje";
      return;
    }

    const agendadosHoje = dia.horarios.filter((h) => h.status === "agendado").length;

    resumoDia.textContent = ehHoje(dia.data)
      ? `Você possui ${agendadosHoje} atendimento(s) hoje`
      : `${agendadosHoje} atendimento(s) neste dia`;
  }

  function renderizarDias() {
    diasScroll.innerHTML = "";

    agenda.forEach((dia) => {
      const btn = document.createElement("button");
      btn.className = "dia-btn";
      btn.type = "button";

      if (dia.data === diaSelecionado) {
        btn.classList.add("ativo");
      }

      btn.innerHTML = `
        <span>${ehHoje(dia.data) ? "Hoje" : formatarData(dia.data).split(",")[0]}</span>
        <small>${formatarData(dia.data).replace(".", "")}</small>
      `;

      btn.addEventListener("click", () => {
        diaSelecionado = dia.data;
        renderizarTudo();
      });

      diasScroll.appendChild(btn);
    });
  }

  function renderizarHorarios() {
    listaHorarios.innerHTML = "";

    const dia = agenda.find((d) => d.data === diaSelecionado);

    if (!dia || !dia.horarios.length) {
      listaHorarios.innerHTML = `
        <div class="estado-vazio">
          Nenhum horário encontrado.
        </div>
      `;
      return;
    }

    dia.horarios.forEach((horario) => {
      const card = document.createElement("div");
      card.className = `horario-card ${horario.status}`;

      let textoStatus = "Livre";

      if (horario.status === "bloqueado") textoStatus = "Bloqueado";
      if (horario.status === "agendado") textoStatus = "Agendado";

      card.innerHTML = `
        <div class="horario-topo">
          <strong>${horario.hora}</strong>
          <span class="status-horario ${horario.status}">
            ${textoStatus}
          </span>
        </div>
      `;

      if (horario.status === "agendado") {
        card.innerHTML += `
          <div class="agendamento-info">
            <strong>${horario.cliente || "Cliente"}</strong>
            <span>💅 ${horario.servico || "Serviço"}</span>
            <span>💰 R$ ${horario.valor || "0,00"}</span>
          </div>
        `;
      }

      if (horario.status === "livre" || horario.status === "bloqueado") {
        card.addEventListener("click", () => abrirModal(horario));
      }

      listaHorarios.appendChild(card);
    });
  }

  function renderizarTudo() {
    renderizarDias();
    renderizarHorarios();
    atualizarResumoDia();
  }

  async function carregarAgenda() {
    try {
      listaHorarios.innerHTML = `
        <div class="estado-vazio">
          Carregando agenda...
        </div>
      `;

      const res = await fetch(`${API_URL}/agenda-profissional`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || "Erro ao carregar agenda.");
      }

      agenda = data.agenda || [];

      if (!diaSelecionado && agenda.length) {
        diaSelecionado = agenda[0].data;
      }

      nomeProfissional.textContent = `${saudacao()}, ${usuario.nome || "profissional"} 💅`;

      renderizarTudo();

    } catch (err) {
      listaHorarios.innerHTML = `
        <div class="estado-vazio">
          ${err.message || "Erro ao carregar agenda."}
        </div>
      `;
    }
  }

  btnCancelarModal.addEventListener("click", fecharModal);
  btnConfirmarModal.addEventListener("click", alternarBloqueio);

  await carregarAgenda();
});