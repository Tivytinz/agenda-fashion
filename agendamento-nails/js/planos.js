document.addEventListener("DOMContentLoaded", async () => {
  const listaPlanos = document.getElementById("listaPlanos");

  function formatarPreco(valor) {
    const numero = Number(valor || 0);

    if (numero === 0) return "Grátis";

    return numero.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function renderizarPlanos(planos) {
    if (!listaPlanos) return;

    if (!planos.length) {
      listaPlanos.innerHTML = `
        <div class="estado-vazio">
          Nenhum plano encontrado.
        </div>
      `;
      return;
    }

    listaPlanos.innerHTML = "";

    planos.forEach((plano) => {
      const card = document.createElement("article");
      card.className = `plano-card af-card ${plano.destaque ? "destaque" : ""}`;

      const capacidade = plano.capacidade_agendamentos === null
        ? "Agendamentos ilimitados"
        : `${plano.capacidade_agendamentos} agendamentos/mês`;

      card.innerHTML = `
        ${plano.destaque ? `<span class="af-badge">Mais recomendado</span>` : ""}

        <h2>${plano.nome}</h2>

        <div class="plano-preco">
          ${formatarPreco(plano.valor)}
          ${Number(plano.valor || 0) > 0 ? "<small>/mês</small>" : ""}
        </div>

        <div class="plano-beneficios">
          <span>✅ ${capacidade}</span>
          <span>✅ Perfil público do negócio</span>
          <span>✅ Dashboard de crescimento</span>
          <span>✅ Gestão de agenda</span>
          ${plano.destaque ? "<span>✅ Mais visibilidade no Agenda Fashion</span>" : ""}
        </div>

        <button
          class="af-btn-primary"
          type="button"
          data-plano-id="${plano.id}"
          data-plano-slug="${plano.slug}"
        >
          ${Number(plano.valor || 0) === 0 ? "Plano atual" : "Quero crescer"}
        </button>
      `;

      const botao = card.querySelector("button");

      botao.addEventListener("click", () => {
        if (Number(plano.valor || 0) === 0) return;

        window.location.href =
  `checkout.html?plano=${encodeURIComponent(plano.slug)}`;
      });

      listaPlanos.appendChild(card);
    });
  }

  async function carregarPlanos() {
    try {
      const data = await API.get("/api/planos");

      renderizarPlanos(data.planos || data || []);

    } catch (erro) {
      console.error("Erro ao carregar planos:", erro);

      listaPlanos.innerHTML = `
        <div class="estado-vazio">
          Não foi possível carregar os planos.
        </div>
      `;
    }
  }

  await carregarPlanos();
});