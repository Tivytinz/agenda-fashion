document.addEventListener("DOMContentLoaded", async () => {
  const API_URL = "https://agenda-fashion-production.up.railway.app";

  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");

  if (!token || !usuario || usuario.tipo !== "cliente") {
    window.location.href = "login-cliente.html";
    return;
  }

  const lista = document.getElementById("listaAgendamentos");
  const mensagem = document.getElementById("mensagemAgendamentos");
  const filtros = document.querySelectorAll(".filtro");

  let agendamentos = [];
  let filtroAtual = "agendado";

  function mostrarMensagem(texto, cor = "#e63946") {
    mensagem.textContent = texto;
    mensagem.style.color = cor;
    mensagem.classList.remove("hidden");
  }

  function esconderMensagem() {
    mensagem.textContent = "";
    mensagem.classList.add("hidden");
  }

  function formatarData(dataIso) {
    const data = new Date(`${dataIso}T00:00:00`);
    return data.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  async function cancelarAgendamento(id) {
    try {
      esconderMensagem();

      const confirmar = confirm("Deseja cancelar este agendamento?");
      if (!confirmar) return;

      const res = await fetch(`${API_URL}/agendamentos/${id}/cancelar`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || "Erro ao cancelar agendamento.");
      }

      mostrarMensagem("Agendamento cancelado com sucesso.", "#2f9e63");
      await carregarAgendamentos();

    } catch (err) {
      mostrarMensagem(err.message || "Erro na conexão.");
    }
  }

  async function avaliarAgendamento(id, nota) {
    try {
      esconderMensagem();

      const res = await fetch(`${API_URL}/agendamentos/${id}/avaliar`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ avaliacao: nota })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || "Erro ao avaliar agendamento.");
      }

      mostrarMensagem("Avaliação enviada com sucesso 💅", "#2f9e63");
      await carregarAgendamentos();

    } catch (err) {
      mostrarMensagem(err.message || "Erro na conexão.");
    }
  }

  function renderizar() {
    lista.innerHTML = "";

    const filtrados = agendamentos.filter((item) => item.status === filtroAtual);

    if (!filtrados.length) {
      lista.innerHTML = `
        <div class="estado-vazio">
          Nenhum agendamento ${filtroAtual} encontrado.
        </div>
      `;
      return;
    }

    filtrados.forEach((item) => {
      const card = document.createElement("article");
      card.className = "af-card card-agendamento";

      card.innerHTML = `
        <div class="card-topo">
          <div>
            <h3>${item.negocio || "Negócio"}</h3>
            <span>${item.servico || "Serviço"}</span>
          </div>

          <span class="status ${item.status}">
            ${item.status}
          </span>
        </div>

        <div class="info-agendamento">
          <span>📅 ${formatarData(item.data)}</span>
          <span>⏰ ${item.horario}</span>
          <span>💅 Profissional: ${item.profissional || "Não informado"}</span>
          <span>💰 Valor: ${formatarMoeda(item.valor)}</span>
        </div>

        <div class="acoes-agendamento"></div>
      `;

      const acoes = card.querySelector(".acoes-agendamento");

      if (item.status === "agendado") {
        const btnCancelar = document.createElement("button");
        btnCancelar.className = "btn-cancelar";
        btnCancelar.textContent = "Cancelar agendamento";
        btnCancelar.addEventListener("click", () => cancelarAgendamento(item.id));
        acoes.appendChild(btnCancelar);
      }

      if (item.status === "realizado") {
        if (item.avaliacao) {
          const avaliado = document.createElement("div");
          avaliado.className = "avaliado";
          avaliado.textContent = `Sua avaliação: ${"⭐".repeat(Number(item.avaliacao))}`;
          acoes.appendChild(avaliado);
        } else {
          const box = document.createElement("div");
          box.className = "avaliacao-box";
          box.innerHTML = `
            <p>Avalie esse atendimento:</p>
            <div class="estrelas"></div>
          `;

          const estrelas = box.querySelector(".estrelas");

          for (let i = 1; i <= 5; i++) {
            const estrela = document.createElement("button");
            estrela.className = "estrela";
            estrela.textContent = "⭐";
            estrela.title = `${i} estrela(s)`;
            estrela.addEventListener("click", () => avaliarAgendamento(item.id, i));
            estrelas.appendChild(estrela);
          }

          acoes.appendChild(box);
        }
      }

      lista.appendChild(card);
    });
  }

  async function carregarAgendamentos() {
    try {
      esconderMensagem();

      lista.innerHTML = `
        <div class="estado-vazio">
          Carregando agendamentos...
        </div>
      `;

      const res = await fetch(`${API_URL}/meus-agendamentos`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || "Erro ao carregar agendamentos.");
      }

      agendamentos = data.agendamentos || [];
      renderizar();

    } catch (err) {
      mostrarMensagem(err.message || "Erro na conexão.");
      lista.innerHTML = `
        <div class="estado-vazio">
          Não foi possível carregar seus agendamentos.
        </div>
      `;
    }
  }

  filtros.forEach((btn) => {
    btn.addEventListener("click", () => {
      filtros.forEach((b) => b.classList.remove("ativo"));
      btn.classList.add("ativo");

      filtroAtual = btn.dataset.filtro;
      renderizar();
    });
  });

  await carregarAgendamentos();
});