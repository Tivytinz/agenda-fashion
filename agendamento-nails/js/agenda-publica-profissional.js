document.addEventListener("DOMContentLoaded", async () => {
 
  const nomeNegocio = document.getElementById("nomeNegocio");
  const nomeProfissional = document.getElementById("nomeProfissional");
  const resumoServico = document.getElementById("resumoServico");
  const diasScroll = document.getElementById("diasScroll");
  const listaHorarios = document.getElementById("listaHorarios");

  const modal = document.getElementById("modalConfirmarAgendamento");
  const resumoAgendamento = document.getElementById("resumoAgendamento");
  const nomeCliente = document.getElementById("nomeCliente");
  const whatsappCliente = document.getElementById("whatsappCliente");
  const mensagemAgendamento = document.getElementById("mensagemAgendamento");

  const btnConfirmar = document.getElementById("btnConfirmarAgendamento");
  const btnCancelar = document.getElementById("btnCancelarAgendamento");
  const btnFechar = document.getElementById("btnFecharModalAgendamento");

  const params = new URLSearchParams(window.location.search);

  const slug = params.get("slug");

  const servicoId =
    params.get("servico") ||
    params.get("servicoId");

  const profissionalId =
    params.get("profissional") ||
    params.get("profissionalId");

  let agendaAtual = [];
  let diaSelecionado = null;
  let horarioSelecionado = null;
  let dadosAgenda = null;

  function mostrarMensagem(texto, cor = "#2f9e63") {
    mensagemAgendamento.textContent = texto;
    mensagemAgendamento.style.color = cor;
    mensagemAgendamento.classList.remove("hidden");
  }

  function esconderMensagem() {
    mensagemAgendamento.textContent = "";
    mensagemAgendamento.classList.add("hidden");
  }

  function formatarData(dataIso) {
    const data = new Date(`${dataIso}T00:00:00`);

    return data.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit"
    });
  }

  function limparWhatsapp(valor) {
    return String(valor || "").replace(/\D/g, "");
  }

  function fecharModal() {
    modal.classList.add("hidden");
    horarioSelecionado = null;
    esconderMensagem();
  }

  function abrirModal(horario) {
    horarioSelecionado = horario;

    resumoAgendamento.innerHTML = `
      <strong>${dadosAgenda?.servico?.nome || "Serviço"}</strong><br>
      ${formatarData(diaSelecionado)} às ${horario}<br>
      Profissional: ${dadosAgenda?.profissional?.nome || "Profissional"}
    `;

    esconderMensagem();
    modal.classList.remove("hidden");

    setTimeout(() => {
      nomeCliente.focus();
    }, 100);
  }

  function renderizarHorarios() {
    listaHorarios.innerHTML = "";

    const dia = agendaAtual.find((item) => item.data === diaSelecionado);

    if (!dia || !dia.horarios.length) {
      listaHorarios.innerHTML = `
        <div class="estado-vazio">
          Nenhum horário disponível nesse dia.
        </div>
      `;
      return;
    }

    dia.horarios.forEach((hora) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "horario-card";

      card.innerHTML = `
        <strong>${hora}</strong>
        <span>Disponível</span>
      `;

      card.addEventListener("click", () => abrirModal(hora));

      listaHorarios.appendChild(card);
    });
  }

  function renderizarDias() {
    diasScroll.innerHTML = "";

    agendaAtual.forEach((dia, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `dia-btn ${index === 0 ? "ativo" : ""}`;

      const dataFormatada = formatarData(dia.data);

      btn.innerHTML = `
        <span>${index === 0 ? "Hoje" : dataFormatada.split(",")[0]}</span>
        <small>${dataFormatada.replace(".", "")}</small>
      `;

      btn.addEventListener("click", () => {
        document.querySelectorAll(".dia-btn").forEach((item) => {
          item.classList.remove("ativo");
        });

        btn.classList.add("ativo");

        diaSelecionado = dia.data;
        renderizarHorarios();
      });

      diasScroll.appendChild(btn);
    });

    if (agendaAtual.length) {
      diaSelecionado = agendaAtual[0].data;
      renderizarHorarios();
    }
  }

  async function carregarAgenda() {
    try {
      if (
        !slug ||
        !servicoId ||
        servicoId === "null" ||
        !profissionalId ||
        profissionalId === "null"
      ) {
        listaHorarios.innerHTML = `
          <div class="estado-vazio">
            Dados do agendamento inválidos. Volte e escolha serviço e profissional.
          </div>
        `;
        return;
      }

      listaHorarios.innerHTML = `
        <div class="estado-vazio">
          Carregando horários...
        </div>
      `;

      const url =
        `${API_URL}/agenda-publica?slug=${encodeURIComponent(slug)}` +
        `&servicoId=${encodeURIComponent(servicoId)}` +
        `&profissionalId=${encodeURIComponent(profissionalId)}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.erro || "Erro ao carregar agenda pública.");
      }

      dadosAgenda = data;
      agendaAtual = data.disponibilidade || [];

      nomeNegocio.textContent = data.negocio?.nome || "Agenda Fashion";
      nomeProfissional.textContent = data.profissional?.nome || "Escolha seu horário";

      resumoServico.textContent =
        `${data.servico?.nome || "Serviço"} • R$ ${Number(data.servico?.valor || 0).toFixed(2)}`;

      renderizarDias();

    } catch (erro) {
      console.error("Erro agenda pública:", erro);

      listaHorarios.innerHTML = `
        <div class="estado-vazio">
          ${erro.message || "Erro ao carregar agenda pública."}
        </div>
      `;
    }
  }

  async function confirmarAgendamento() {
    try {
      const nome = nomeCliente.value.trim();
      const whatsapp = limparWhatsapp(whatsappCliente.value);

      if (nome.length < 3) {
        mostrarMensagem("Informe seu nome.", "#e63946");
        return;
      }

      if (whatsapp.length < 10) {
        mostrarMensagem("Informe um WhatsApp válido.", "#e63946");
        return;
      }

      if (!diaSelecionado || !horarioSelecionado) {
        mostrarMensagem("Escolha um horário.", "#e63946");
        return;
      }

      btnConfirmar.disabled = true;
      btnConfirmar.textContent = "Agendando...";

      const response = await fetch(`${API_URL}/agendamentos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug,
          servico_id: servicoId,
          profissional_id: profissionalId,
          data: diaSelecionado,
          horario: horarioSelecionado,
          cliente_nome: nome,
          cliente_whatsapp: whatsapp
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.erro || "Erro ao criar agendamento.");
      }

      mostrarMensagem("Agendamento realizado com sucesso 💅");

      setTimeout(() => {
        window.location.href = `finalizar-agendamento.html?status=sucesso&slug=${encodeURIComponent(slug)}`;
      }, 900);

    } catch (erro) {
      console.error("Erro ao confirmar agendamento:", erro);
      mostrarMensagem(erro.message || "Erro ao criar agendamento.", "#e63946");
    } finally {
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = "Confirmar";
    }
  }

  btnConfirmar.addEventListener("click", confirmarAgendamento);
  btnCancelar.addEventListener("click", fecharModal);
  btnFechar.addEventListener("click", fecharModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      fecharModal();
    }
  });

  whatsappCliente.addEventListener("input", () => {
    whatsappCliente.value = limparWhatsapp(whatsappCliente.value);
  });

  await carregarAgenda();
});