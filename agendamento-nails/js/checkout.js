document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");

  if (!token || !usuario) {
    window.location.href = "login-profissional.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const planoSlug = params.get("plano");

  const checkoutResumo = document.getElementById("checkoutResumo");
  const checkoutTotal = document.getElementById("checkoutTotal");
  const cartaoCampos = document.getElementById("cartaoCampos");
  const btnConfirmar = document.getElementById("btnConfirmarCheckout");
  const mensagem = document.getElementById("mensagemCheckout");

  const pixBox = document.getElementById("pixBox");
  const pixQrCode = document.getElementById("pixQrCode");
  const pixCopiaCola = document.getElementById("pixCopiaCola");
  const btnCopiarPix = document.getElementById("btnCopiarPix");

  let planoSelecionado = null;
  let intervaloPagamento = null;

  function mostrarMensagem(texto, cor = "#e63946") {
    if (!mensagem) return;

    mensagem.textContent = texto;
    mensagem.style.color = cor;
    mensagem.classList.remove("hidden");
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function formaPagamentoSelecionada() {
    return document.querySelector("input[name='formaPagamento']:checked")?.value || "pix";
  }

  function renderPlano(plano) {
    const capacidade = plano.capacidade_agendamentos === null
      ? "Agendamentos ilimitados"
      : `${plano.capacidade_agendamentos} agendamentos por mês`;

    checkoutResumo.innerHTML = `
      <h1>${plano.nome}</h1>
      <p>${formatarMoeda(plano.valor)} / mês</p>

      <ul>
        <li>✅ ${capacidade}</li>
        <li>✅ Perfil público do negócio</li>
        <li>✅ Dashboard de crescimento</li>
        <li>✅ Gestão de agenda</li>
        ${plano.destaque ? "<li>✅ Mais visibilidade no Agenda Fashion</li>" : ""}
      </ul>
    `;

    checkoutTotal.textContent = formatarMoeda(plano.valor);
  }

  async function carregarPlano() {
    if (!planoSlug) {
      throw new Error("Plano não informado.");
    }

    const data = await API.get("/api/planos");
    const planos = data.planos || data || [];

    const plano = planos.find((item) => item.slug === planoSlug);

    if (!plano) {
      throw new Error("Plano não encontrado.");
    }

    if (Number(plano.valor || 0) === 0) {
      throw new Error("Este plano não precisa de pagamento.");
    }

    planoSelecionado = plano;
    renderPlano(plano);
  }

  function alternarCamposCartao() {
    const forma = formaPagamentoSelecionada();

    if (forma === "cartao") {
      cartaoCampos?.classList.remove("hidden");
      pixBox?.classList.add("hidden");
    } else {
      cartaoCampos?.classList.add("hidden");
    }
  }

  function validarCartao() {
    const nome = document.getElementById("nomeCartao")?.value.trim();
    const numero = document.getElementById("numeroCartao")?.value.replace(/\D/g, "");
    const validade = document.getElementById("validadeCartao")?.value.trim();
    const cvv = document.getElementById("cvvCartao")?.value.replace(/\D/g, "");

    if (!nome || nome.length < 3) {
      throw new Error("Informe o nome impresso no cartão.");
    }

    if (!numero || numero.length < 13) {
      throw new Error("Informe um número de cartão válido.");
    }

    if (!validade || !validade.includes("/")) {
      throw new Error("Informe a validade no formato MM/AA.");
    }

    if (!cvv || cvv.length < 3) {
      throw new Error("Informe o CVV.");
    }

    return {
      nome,
      numero,
      validade,
      cvv
    };
  }

  function iniciarVerificacaoPagamento(pagamentoId) {
    if (!pagamentoId) return;

    if (intervaloPagamento) {
      clearInterval(intervaloPagamento);
    }

    let tentativas = 0;

    mostrarMensagem(
      "PIX gerado com sucesso. Aguardando confirmação do pagamento...",
      "#2f9e63"
    );

    intervaloPagamento = setInterval(async () => {
      try {
        tentativas++;

        const status = await API.get(`/api/checkout/status/${pagamentoId}`);

        if (
          status.status === "CONFIRMED" ||
          status.status === "RECEIVED" ||
          status.ativo === true
        ) {
          clearInterval(intervaloPagamento);

          mostrarMensagem(
            `Pagamento confirmado! Plano ${status.plano_nome} ativado.`,
            "#2f9e63"
          );

          setTimeout(() => {
            window.location.href = "dashboard-dono.html";
          }, 1800);
        }

        if (tentativas >= 60) {
          clearInterval(intervaloPagamento);

          mostrarMensagem(
            "PIX gerado. Assim que o pagamento for confirmado, seu plano será ativado automaticamente.",
            "#2f9e63"
          );
        }

      } catch (erro) {
        console.error("Erro ao verificar pagamento:", erro);
      }
    }, 5000);
  }

  function mostrarPix(data) {
    if (data.pix?.encodedImage && pixQrCode) {
      pixQrCode.src = `data:image/png;base64,${data.pix.encodedImage}`;
    }

    if (data.pix?.payload && pixCopiaCola) {
      pixCopiaCola.value = data.pix.payload;
    }

    pixBox?.classList.remove("hidden");

    if (btnCopiarPix && pixCopiaCola) {
      btnCopiarPix.onclick = async () => {
        await navigator.clipboard.writeText(pixCopiaCola.value);

        btnCopiarPix.textContent = "Código copiado!";

        setTimeout(() => {
          btnCopiarPix.textContent = "Copiar código PIX";
        }, 1500);
      };
    }

    if (data.pagamento?.id) {
      iniciarVerificacaoPagamento(data.pagamento.id);
    }
  }

  async function confirmarCheckout() {
    try {
      if (!planoSelecionado) {
        throw new Error("Plano não carregado.");
      }

      const forma = formaPagamentoSelecionada();

      let cartao = null;

      if (forma === "cartao") {
        cartao = validarCartao();
      }

      btnConfirmar.disabled = true;
      btnConfirmar.textContent = "Gerando pagamento...";

      pixBox?.classList.add("hidden");

      const data = await API.post("/api/checkout", {
        plano_id: planoSelecionado.id,
        plano_slug: planoSelecionado.slug,
        forma_pagamento: forma,
        cartao
      });

      if (forma === "pix") {
        mostrarPix(data);
      } else {
        mostrarMensagem(
          data.mensagem || "Pagamento enviado para processamento.",
          "#2f9e63"
        );
      }

    } catch (erro) {
      mostrarMensagem(erro.message || "Erro ao gerar pagamento.");
    } finally {
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = "Confirmar assinatura";
    }
  }

  document.querySelectorAll("input[name='formaPagamento']").forEach((input) => {
    input.addEventListener("change", alternarCamposCartao);
  });

  btnConfirmar.addEventListener("click", confirmarCheckout);

  try {
    await carregarPlano();
    alternarCamposCartao();
  } catch (erro) {
    checkoutResumo.innerHTML = `
      <div class="estado-vazio">
        ${erro.message || "Erro ao carregar plano."}
      </div>
    `;

    btnConfirmar.disabled = true;
  }
});