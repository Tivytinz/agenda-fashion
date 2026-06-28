document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login-profissional.html";
    return;
  }

  const planoNome = document.getElementById("planoNome");
  const assinaturaStatus = document.getElementById("assinaturaStatus");
  const planoValor = document.getElementById("planoValor");
  const formaPagamento = document.getElementById("formaPagamento");
  const proximaCobranca = document.getElementById("proximaCobranca");
  const usoTexto = document.getElementById("usoTexto");
  const usoBarra = document.getElementById("usoBarra");
  const usoMensagem = document.getElementById("usoMensagem");
  const listaPagamentos = document.getElementById("listaPagamentos");

  const btnAlterarPlano = document.getElementById("btnAlterarPlano");
  const btnNovoPix = document.getElementById("btnNovoPix");
  const btnCancelarAssinatura = document.getElementById("btnCancelarAssinatura");

  function moeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function formatarData(data) {
    if (!data) return "-";

    return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
  }

  function traduzirStatus(status) {
    const mapa = {
      ACTIVE: "Ativo",
      PENDING: "Pendente",
      OVERDUE: "Vencido",
      CANCELED: "Cancelado",
      CANCELLED: "Cancelado",
      RECEIVED: "Pago",
      CONFIRMED: "Confirmado"
    };

    return mapa[status] || status || "Grátis";
  }

  function traduzirForma(forma) {
    const mapa = {
      pix: "PIX",
      cartao: "Cartão",
      CREDIT_CARD: "Cartão",
      PIX: "PIX"
    };

    return mapa[forma] || forma || "-";
  }

  function renderPagamentos(pagamentos) {
    if (!listaPagamentos) return;

    if (!pagamentos.length) {
      listaPagamentos.innerHTML = `
        <div class="estado-vazio">
          Nenhum pagamento encontrado.
        </div>
      `;
      return;
    }

    listaPagamentos.innerHTML = pagamentos.map((p) => `
      <div class="pagamento-item">
        <div>
          <strong>${traduzirStatus(p.status)}</strong><br>
          <span>${formatarData(p.data_vencimento)}</span>
        </div>

        <strong>${moeda(p.valor)}</strong>
      </div>
    `).join("");
  }

  function renderUso(uso) {
    const usados = Number(uso?.utilizados || 0);
    const limite = uso?.limite;

    if (limite === null || limite === undefined) {
      usoTexto.textContent = `${usados} agendamento(s)`;
      usoBarra.style.width = "100%";
      usoMensagem.textContent = "Seu plano possui agendamentos ilimitados.";
      return;
    }

    const percentual = Math.min(
      Math.round((usados / Number(limite || 1)) * 100),
      100
    );

    usoTexto.textContent = `${usados} de ${limite}`;
    usoBarra.style.width = `${percentual}%`;

    usoMensagem.textContent =
      `Você ainda possui ${Math.max(Number(limite) - usados, 0)} agendamento(s) disponíveis este mês.`;
  }

  async function carregar() {
    try {
      const data = await API.get("/api/minha-assinatura");

      planoNome.textContent = data.plano?.nome || "Gratuito";
      assinaturaStatus.textContent = traduzirStatus(data.assinatura?.status);
      planoValor.textContent = moeda(data.plano?.valor || 0);
      formaPagamento.textContent = traduzirForma(data.assinatura?.forma_pagamento);
      proximaCobranca.textContent = formatarData(data.assinatura?.data_proxima_cobranca);

      renderUso(data.uso || {});
      renderPagamentos(data.pagamentos || []);

    } catch (erro) {
      console.error("Erro ao carregar assinatura:", erro);

      if (listaPagamentos) {
        listaPagamentos.innerHTML = `
          <div class="estado-vazio">
            Não foi possível carregar sua assinatura.
          </div>
        `;
      }
    }
  }

  btnAlterarPlano?.addEventListener("click", () => {
    window.location.href = "planos.html";
  });

  btnNovoPix?.addEventListener("click", () => {
    alert("Geração de novo PIX será implementada na próxima etapa.");
  });

  btnCancelarAssinatura?.addEventListener("click", async () => {
    const confirmar = confirm(
      "Tem certeza que deseja cancelar sua assinatura? Seu acesso pago poderá ser encerrado no fim do ciclo."
    );

    if (!confirmar) return;

    alert("Cancelamento será implementado na próxima etapa.");
  });

  await carregar();
});