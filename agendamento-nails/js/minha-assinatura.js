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

  function moeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  async function carregar() {
    const data = await API.get("/api/minha-assinatura");

    planoNome.textContent = data.plano?.nome || "-";
    assinaturaStatus.textContent = data.assinatura?.status || "GRÁTIS";
    planoValor.textContent = moeda(data.plano?.valor || 0);
    formaPagamento.textContent = data.assinatura?.forma_pagamento || "-";
    proximaCobranca.textContent = data.assinatura?.data_proxima_cobranca || "-";

    const usados = Number(data.uso?.utilizados || 0);
    const limite = data.uso?.limite;

    usoTexto.textContent = limite === null
      ? `${usados} agendamentos`
      : `${usados} de ${limite}`;

    const percentual = limite === null ? 100 : Math.min(Math.round((usados / limite) * 100), 100);
    usoBarra.style.width = `${percentual}%`;

    usoMensagem.textContent = limite === null
      ? "Seu plano possui agendamentos ilimitados."
      : `Você ainda possui ${Math.max(limite - usados, 0)} agendamento(s) disponíveis este mês.`;

    const pagamentos = data.pagamentos || [];

    if (!pagamentos.length) {
      listaPagamentos.innerHTML = `<div class="estado-vazio">Nenhum pagamento encontrado.</div>`;
      return;
    }

    listaPagamentos.innerHTML = pagamentos.map((p) => `
      <div class="pagamento-item">
        <div>
          <strong>${p.status}</strong><br>
          <span>${p.data_vencimento || "-"}</span>
        </div>
        <strong>${moeda(p.valor)}</strong>
      </div>
    `).join("");
  }

  document.getElementById("btnAlterarPlano")?.addEventListener("click", () => {
    window.location.href = "planos.html";
  });

  await carregar();
});