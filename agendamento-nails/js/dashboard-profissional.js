document.addEventListener("DOMContentLoaded", async () => {
  

  const token = localStorage.getItem("token");

  const totalAgendados = document.getElementById("totalAgendados");
  const agendadosHoje = document.getElementById("agendadosHoje");
  const clientes = document.getElementById("clientes");
  const faturamento = document.getElementById("faturamento");

  const listaServicos = document.getElementById("listaServicos");

  const btnAgenda = document.getElementById("btnAgenda");
  const btnAgendamentos = document.getElementById("btnAgendamentos");
  const btnHome = document.getElementById("btnHome");
  const btnSair = document.getElementById("btnSair");

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  async function carregarDashboard() {
    const res = await fetch(`${API_URL}/dashboard-profissional`, {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const data = await res.json();

    if (!res.ok) {
      alert("Erro ao carregar dashboard");
      return;
    }

    const resumo = data.resumo;

    totalAgendados.textContent = resumo.total_agendados;
    agendadosHoje.textContent = resumo.agendados_hoje;
    clientes.textContent = resumo.clientes_unicos;
    faturamento.textContent = formatarMoeda(resumo.faturamento_estimado);

    listaServicos.innerHTML = "";

    data.servicosMaisVendidos.forEach(s => {
      const div = document.createElement("div");
      div.className = "item-servico";

      div.innerHTML = `
        <span>${s.nome}</span>
        <strong>${s.total}</strong>
      `;

      listaServicos.appendChild(div);
    });
  }

  btnAgenda.addEventListener("click", () => {
    window.location.href = "painel-profissional.html";
  });

  btnAgendamentos.addEventListener("click", () => {
    window.location.href = "agendamentos-profissional.html";
  });

  btnHome.addEventListener("click", () => {
    window.location.href = "painel-profissional.html";
  });

  btnSair.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  localStorage.removeItem("negocio");

  window.location.href = "login-profissional.html";
});

  await carregarDashboard();
});