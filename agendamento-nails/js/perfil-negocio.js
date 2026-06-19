document.addEventListener("DOMContentLoaded", async () => {
  const API_URL = "https://agenda-fashion-production.up.railway.app";

  const fotoNegocio = document.getElementById("fotoNegocio");
  const nomeNegocio = document.getElementById("nomeNegocio");
  const linhaAvaliacao = document.getElementById("linhaAvaliacao");
  const descricaoNegocio = document.getElementById("descricaoNegocio");
  const cidadeBairro = document.getElementById("cidadeBairroNegocio");
  const areasNegocio = document.getElementById("areasNegocio");

  const btnWhatsapp = document.getElementById("btnWhatsapp");
  const btnMaps = document.getElementById("btnMaps");
  const btnFavorito = document.getElementById("btnFavorito");
  const btnCopiarAgenda = document.getElementById("btnCopiarAgenda");
  const btnContinuar = document.getElementById("btnContinuarAgendamento");

  const listaServicos = document.getElementById("listaServicos");
  const listaProfissionais = document.getElementById("listaProfissionais");
  const resumoServico = document.getElementById("resumoServico");
  const resumoProfissional = document.getElementById("resumoProfissional");
  const mensagem = document.getElementById("mensagemPerfil");

  const modal = document.getElementById("modalPerfil");
  const modalTitulo = document.getElementById("modalTitulo");
  const modalConteudo = document.getElementById("modalConteudo");
  const btnFecharModal = document.getElementById("btnFecharModal");
  const btnCancelarModal = document.getElementById("btnCancelarModal");
  const btnSalvarModal = document.getElementById("btnSalvarModal");

  const boxServicos = document.getElementById("boxServicos");
  const boxProfissionaisHorarios = document.getElementById("boxProfissionaisHorarios");
  const etapaServico = document.getElementById("etapaServico");
  const etapaHorario = document.getElementById("etapaHorario");
  const listaHorariosDisponiveis = document.getElementById("listaHorariosDisponiveis");
  const resumoHorario = document.getElementById("resumoHorario");



  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");
  let negocioLocal = JSON.parse(localStorage.getItem("negocio") || "null");

  const params = new URLSearchParams(window.location.search);
  let slug = params.get("slug") || negocioLocal?.slug || null;

  let negocioAtual = null;
  let servicoSelecionado = null;
  let profissionalSelecionado = null;
  let tipoEdicao = null;
  let servicosAtuais = [];
  let horarioSelecionado = null;

  function mostrarMensagem(texto, cor = "#e63946") {
    if (!mensagem) return;
    mensagem.textContent = texto;
    mensagem.style.color = cor;
    mensagem.classList.remove("hidden");
  }

  function esconderMensagem() {
    if (!mensagem) return;
    mensagem.textContent = "";
    mensagem.classList.add("hidden");
  }

  function ehDonoDoPerfil() {
    if (!usuario || !negocioAtual) return false;

    const ehDono =
      usuario.tipo === "dono" ||
      negocioLocal?.papel === "dono" ||
      usuario.eh_dono === true ||
      usuario.dono === true ||
      usuario.is_dono === true;

    return ehDono && Number(negocioLocal?.id) === Number(negocioAtual.id);
  }

  async function descobrirSlug() {
    if (slug) return slug;

    const token = localStorage.getItem("token");
    if (!token) return null;

    const resposta = await fetch(`${API_URL}/meu-negocio`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const dados = await resposta.json();

    if (dados.temNegocio && dados.negocio?.slug) {
      negocioLocal = dados.negocio;
      localStorage.setItem("negocio", JSON.stringify(dados.negocio));
      slug = dados.negocio.slug;
      return slug;
    }

    return null;
  }

  function preencherNegocio(n) {
    if (fotoNegocio) {

  if (n.foto_url && n.foto_url.trim()) {

    fotoNegocio.src = n.foto_url;
    fotoNegocio.style.display = "block";

  }   else {

    const iniciais = (n.nome || "N")
      .split(" ")
      .map(p => p[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    fotoNegocio.outerHTML = `
      <div id="fotoNegocio" class="avatar-negocio">
        ${iniciais}
      </div>
    `;
  }
  
}
    if (linhaAvaliacao) {

    const total = Number(n.total_avaliacoes || 0);
    const media = Number(n.media_avaliacoes || 0);

    linhaAvaliacao.textContent =
      total > 0
        ? `⭐ ${media.toFixed(1)} • ${total} avaliação${total > 1 ? "ões" : ""}`
        : "⭐ Novo negócio";
    }

    if (nomeNegocio) {
      nomeNegocio.textContent = n.nome || "Negócio";
    }

    if (descricaoNegocio) {
      descricaoNegocio.textContent =
        n.descricao || "Este negócio ainda não adicionou uma descrição.";
    }

    if (cidadeBairro) {
      const cidade = n.cidade || "Cidade não informada";
      const bairro = n.bairro || "Região";
      cidadeBairro.textContent = `📍 ${cidade}, ${bairro}`;
    }

    if (areasNegocio) {
      const areas = Array.isArray(n.areas) ? n.areas : [];

      areasNegocio.innerHTML = areas.length
        ? areas.map((area) => `<span class="area-tag">${area}</span>`).join("")
        : `<span class="area-tag">Beleza</span>`;
    }

    if (btnWhatsapp) {
      if (n.whatsapp_negocio) {
        const numero = String(n.whatsapp_negocio).replace(/\D/g, "");
        btnWhatsapp.href = `https://wa.me/55${numero}`;
        btnWhatsapp.classList.remove("hidden");
      } else if (ehDonoDoPerfil()) {
        btnWhatsapp.classList.remove("hidden");
        btnWhatsapp.removeAttribute("href");
      }
    }

    if (btnMaps) {
      if (n.localizacao_url) {
        btnMaps.href = n.localizacao_url;
        btnMaps.classList.remove("hidden");
      } else if (ehDonoDoPerfil()) {
        btnMaps.classList.remove("hidden");
        btnMaps.removeAttribute("href");
      }
    }
  }

  function ativarModoDono() {
    if (!ehDonoDoPerfil()) return;

    document.querySelectorAll(".dono-only").forEach((el) => {
      el.classList.remove("hidden");
    });

    btnFavorito?.classList.add("hidden");
  }

  function atualizarResumo() {
  if (resumoServico) {
    resumoServico.textContent = `Serviço: ${servicoSelecionado?.nome || "nenhum"}`;
  }

  if (resumoProfissional) {
    resumoProfissional.textContent = `Profissional: ${profissionalSelecionado?.nome || "nenhum"}`;
  }

  if (resumoHorario) {
    const textoHorario =
      horarioSelecionado?.hora ||
      horarioSelecionado?.horario ||
      horarioSelecionado?.inicio ||
      horarioSelecionado?.data_hora ||
      "nenhum";

    resumoHorario.textContent = `Horário: ${horarioSelecionado ? textoHorario : "nenhum"}`;
  }

  const ativo =
    servicoSelecionado &&
    profissionalSelecionado &&
    horarioSelecionado;

  if (btnContinuar) {
    btnContinuar.disabled = !ativo;
    btnContinuar.classList.toggle("btn-disabled", !ativo);
  }
}

function renderizarServicos(servicos = []) {
  if (!listaServicos) return;
  
  servicosAtuais = servicos;

  listaServicos.innerHTML = "";

  if (!servicos.length) {
    listaServicos.innerHTML = `
      <div class="estado-vazio">Nenhum serviço cadastrado.</div>
    `;
    return;
  }

  servicos.forEach((servico) => {
    const card = document.createElement("div");
    card.className = "item-selecao";
    card.dataset.id = servico.id;

    const valor = Number(servico.valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

    card.innerHTML = `
      ${
        servico.foto_url
          ? `<img class="servico-foto" src="${servico.foto_url}" alt="${servico.nome}">`
          : `<div class="servico-foto"></div>`
      }

      <strong>${servico.nome || "Serviço"}</strong>
      <span>${valor}</span>
      <span>${servico.duracao_minutos || 0} min</span>

      ${
        ehDonoDoPerfil()
          ? `
            <div class="acoes-servico">
              <button type="button" class="btn-editar-servico" data-servico-id="${servico.id}">
                ✏️ Editar
              </button>

              <button type="button" class="btn-remover-servico" data-servico-id="${servico.id}">
                🗑️ Remover
              </button>
            </div>
          `
          : ""
      }
    `;

    card.addEventListener("click", (e) => {
      if (
        e.target.closest(".btn-editar-servico") ||
        e.target.closest(".btn-remover-servico")
      ) return;

      servicoSelecionado = servico;
      profissionalSelecionado = null;
      horarioSelecionado = null;

      listaServicos.querySelectorAll(".item-selecao").forEach((el) => {
        el.classList.remove("ativo");
      });

      card.classList.add("ativo");

      boxProfissionaisHorarios.classList.remove("hidden");
      etapaServico.classList.remove("ativa");
      etapaHorario.classList.add("ativa");

      listaHorariosDisponiveis.innerHTML = `
        <div class="estado-vazio">Escolha um profissional para ver os horários.</div>
      `;

      atualizarResumo();

      boxProfissionaisHorarios.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    listaServicos.appendChild(card);
  });
}

  function renderizarProfissionais(profissionais = []) {
  if (!listaProfissionais) return;

  listaProfissionais.innerHTML = "";

  if (!profissionais.length) {
    listaProfissionais.innerHTML = `
      <div class="estado-vazio">Nenhum profissional disponível.</div>
    `;
    return;
  }

  profissionais.forEach((profissional) => {
    const card = document.createElement("div");
    card.className = "item-selecao profissional-card";
    card.dataset.id = profissional.id;

    card.innerHTML = `
      ${
  profissional.foto_url
    ? `
      <img
        class="profissional-foto"
        src="${profissional.foto_url}"
        alt="${profissional.nome || "Profissional"}"
      >
    `
    : `
      <div class="profissional-foto avatar-iniciais">
        ${(profissional.nome || "P")
          .split(" ")
          .map(p => p[0])
          .join("")
          .substring(0, 2)
          .toUpperCase()}
      </div>
    `
}

      <div class="profissional-info">
        <strong>${profissional.nome || "Profissional"}</strong>
        <span>Ver horários disponíveis</span>
      </div>
    `;

    card.addEventListener("click", async () => {
      profissionalSelecionado = profissional;
      horarioSelecionado = null;

      listaProfissionais.querySelectorAll(".item-selecao").forEach((el) => {
        el.classList.remove("ativo");
      });

      card.classList.add("ativo");

      atualizarResumo();
      await carregarHorariosDisponiveis();
    });

    listaProfissionais.appendChild(card);
  });
}

async function carregarHorariosDisponiveis() {
  if (!servicoSelecionado || !profissionalSelecionado) return;

  listaHorariosDisponiveis.innerHTML = `
    <div class="estado-vazio">Carregando horários...</div>
  `;

  try {
    const resposta = await fetch(
      `${API_URL}/agenda-publica?slug=${encodeURIComponent(slug)}&servicoId=${servicoSelecionado.id}&profissionalId=${profissionalSelecionado.id}`
    );

    const data = await resposta.json();

    if (!resposta.ok) {
      throw new Error(data.erro || "Erro ao carregar horários.");
    }

    const disponibilidade = data.disponibilidade || [];

    if (!disponibilidade.length) {
      listaHorariosDisponiveis.innerHTML = `
        <div class="estado-vazio">Nenhum horário disponível.</div>
      `;
      return;
    }

    listaHorariosDisponiveis.innerHTML = `
      <div id="listaDiasDisponiveis" class="dias-grid"></div>
      <div id="horariosDoDia" class="horarios-dia-box"></div>
    `;

    const listaDias = document.getElementById("listaDiasDisponiveis");
    const horariosDoDia = document.getElementById("horariosDoDia");

    function formatarDia(dataISO) {
      const data = new Date(`${dataISO}T00:00:00`);
      return data.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit"
      });
    }

    function renderizarHorariosDoDia(diaSelecionado) {
      horariosDoDia.innerHTML = `
        <h4>${formatarDia(diaSelecionado.data)}</h4>
        <div class="horarios-wrap"></div>
      `;

      const wrap = horariosDoDia.querySelector(".horarios-wrap");

      if (!diaSelecionado.horarios.length) {
        wrap.innerHTML = `
          <div class="estado-vazio">Nenhum horário disponível neste dia.</div>
        `;
        return;
      }

      diaSelecionado.horarios.forEach((hora) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "horario-btn";
        btn.textContent = hora;

        btn.addEventListener("click", () => {
          horarioSelecionado = {
            data: diaSelecionado.data,
            hora
          };

          horariosDoDia.querySelectorAll(".horario-btn").forEach((el) => {
            el.classList.remove("ativo");
          });

          btn.classList.add("ativo");
          atualizarResumo();
        });

        wrap.appendChild(btn);
      });
    }

    disponibilidade.forEach((dia, index) => {
      const btnDia = document.createElement("button");
      btnDia.type = "button";
      btnDia.className = "dia-btn";
      btnDia.textContent = formatarDia(dia.data);

      btnDia.addEventListener("click", () => {
        horarioSelecionado = null;

        listaDias.querySelectorAll(".dia-btn").forEach((el) => {
          el.classList.remove("ativo");
        });

        btnDia.classList.add("ativo");
        renderizarHorariosDoDia(dia);
        atualizarResumo();
      });

      listaDias.appendChild(btnDia);

      if (index === 0) {
        btnDia.classList.add("ativo");
        renderizarHorariosDoDia(dia);
      }
    });

  } catch (erro) {
    console.error(erro);

    listaHorariosDisponiveis.innerHTML = `
      <div class="estado-vazio">${erro.message}</div>
    `;
  }
}

  function abrirModal(titulo, tipo, html) {
    tipoEdicao = tipo;
    modalTitulo.textContent = titulo;
    modalConteudo.innerHTML = html;
    modal.classList.remove("hidden");
  }

  function fecharModal() {
    tipoEdicao = null;
    modal.classList.add("hidden");
    modalConteudo.innerHTML = "";
  }

  function abrirEdicaoCampo(campo) {
    if (!ehDonoDoPerfil()) return;
    if (campo === "foto") {
      abrirModal(
        "Alterar foto",
        "foto",
        `<input id="inputFotoNegocio" class="af-input" type="file" accept="image/*">`
      );
    }

    if (campo === "nome") {
      abrirModal(
        "Editar nome",
        "negocio",
        `<input id="inputNome" class="af-input" value="${negocioAtual.nome || ""}">`
      );
    }

    if (campo === "bio") {
      abrirModal(
        "Editar bio",
        "negocio",
        `<textarea id="inputDescricao" class="af-input">${negocioAtual.descricao || ""}</textarea>`
      );
    }

    if (campo === "local") {
      abrirModal(
        "Editar localização",
        "negocio",
        `
          <input id="inputCidade" class="af-input" placeholder="Cidade" value="${negocioAtual.cidade || ""}">
          <input id="inputBairro" class="af-input" placeholder="Bairro" value="${negocioAtual.bairro || ""}">
        `
      );
    }

    if (campo === "whatsapp") {
      abrirModal(
        "Editar WhatsApp",
        "negocio",
        `<input id="inputWhatsapp" class="af-input" value="${negocioAtual.whatsapp_negocio || ""}">`
      );
    }

    if (campo === "maps") {
      abrirModal(
        "Editar Maps",
        "negocio",
        `<input id="inputMaps" class="af-input" value="${negocioAtual.localizacao_url || ""}">`
      );
    }

    if (campo === "areas") {
      abrirModal(
        "Editar áreas",
        "negocio",
        `<input id="inputAreas" class="af-input" value="${Array.isArray(negocioAtual.areas) ? negocioAtual.areas.join(", ") : ""}">`
      );
    }
  }

function abrirNovoServico() {
  abrirModal(
    "Novo serviço",
    "novo-servico",
    `
      <input id="inputServicoNome" class="af-input" placeholder="Nome do serviço">
      <input id="inputServicoValor" class="af-input" type="number" step="0.01" placeholder="Valor">
      <input id="inputServicoDuracao" class="af-input" type="number" placeholder="Duração em minutos">
      <input id="inputServicoFoto" class="af-input" type="file" accept="image/*">
    `
  );
}

function abrirNovoProfissional() {
  abrirModal(
    "Adicionar profissional",
    "novo-profissional",
    `
      <input
        id="inputProfissionalBusca"
        class="af-input"
        placeholder="Digite o e-mail ou WhatsApp do profissional"
      >

      <p style="font-size: 13px; color: #7e768f; margin-top: 10px;">
        O profissional precisa ter uma conta profissional cadastrada.
      </p>
    `
  );
}

  async function salvarNegocio() {
    const token = localStorage.getItem("token");

    const payload = {
      nome: document.getElementById("inputNome")?.value?.trim() ?? negocioAtual.nome,
      descricao: document.getElementById("inputDescricao")?.value?.trim() ?? negocioAtual.descricao,
      cidade: document.getElementById("inputCidade")?.value?.trim() ?? negocioAtual.cidade,
      bairro: document.getElementById("inputBairro")?.value?.trim() ?? negocioAtual.bairro,
      whatsapp_negocio: document.getElementById("inputWhatsapp")?.value?.trim() ?? negocioAtual.whatsapp_negocio,
      localizacao_url: document.getElementById("inputMaps")?.value?.trim() ?? negocioAtual.localizacao_url,
      setor: negocioAtual.setor || "",
      areas: document.getElementById("inputAreas")
        ? document.getElementById("inputAreas").value.split(",").map(a => a.trim()).filter(Boolean)
        : negocioAtual.areas || []
    };

    const resposta = await fetch(`${API_URL}/configuracoes`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await resposta.json();

    if (!resposta.ok) {
      throw new Error(data.erro || "Erro ao salvar.");
    }

    negocioAtual = {
      ...negocioAtual,
      ...data.negocio
    };

    localStorage.setItem("negocio", JSON.stringify(data.negocio));

    preencherNegocio(negocioAtual);
  }

  async function salvarFoto() {
    const token = localStorage.getItem("token");
    const file = document.getElementById("inputFotoNegocio")?.files?.[0];

    if (!file) {
      throw new Error("Escolha uma imagem.");
    }

    const formData = new FormData();
    formData.append("foto", file);

    const resposta = await fetch(`${API_URL}/api/negocios/foto`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const data = await resposta.json();

    if (!resposta.ok) {
      throw new Error(data.erro || "Erro ao enviar foto.");
    }

    negocioAtual.foto_url = data.foto;

    window.location.reload();
  }

  async function salvarServico() {
  const token = localStorage.getItem("token");

  const nome = document.getElementById("inputServicoNome")?.value?.trim();
  const valor = document.getElementById("inputServicoValor")?.value;
  const duracao = document.getElementById("inputServicoDuracao")?.value;

  if (!nome) throw new Error("Informe o nome do serviço.");

  const resposta = await fetch(`${API_URL}/servicos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      nome,
      valor: Number(valor || 0),
      duracao_minutos: Number(duracao || 0)
    })
  });

  const data = await resposta.json();
  console.log("SERVICO CRIADO", data);

  if (!resposta.ok) {
    throw new Error(data.erro || "Erro ao criar serviço.");
  }
const idServico = data.servico?.id;
const foto = document.getElementById("inputServicoFoto")?.files?.[0];

if (foto && idServico) {
  const formData = new FormData();
  formData.append("foto", foto);

  const fotoResposta = await fetch(`${API_URL}/servicos/${idServico}/foto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  const fotoData = await fotoResposta.json();

  if (!fotoResposta.ok) {
    throw new Error(fotoData.erro || "Serviço criado, mas erro ao enviar foto.");
  }
}

}

async function salvarProfissional() {
  const token = localStorage.getItem("token");

  const emailOuWhatsapp =
    document.getElementById("inputProfissionalBusca")?.value?.trim();

  if (!emailOuWhatsapp) {
    throw new Error("Digite o e-mail ou WhatsApp do profissional.");
  }

  const resposta = await fetch(`${API_URL}/profissionais/vincular`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      emailOuWhatsapp
    })
  });

  const data = await resposta.json();

  if (!resposta.ok) {
    throw new Error(data.erro || "Erro ao vincular profissional.");
  }
}

async function atualizarServico() {
  const token = localStorage.getItem("token");

  const id = document.getElementById("inputServicoId")?.value;
  const nome = document.getElementById("inputServicoNome")?.value?.trim();
  const valor = document.getElementById("inputServicoValor")?.value;
  const duracao = document.getElementById("inputServicoDuracao")?.value;

  if (!nome) throw new Error("Informe o nome do serviço.");

  const resposta = await fetch(`${API_URL}/servicos/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      nome,
      valor: Number(valor || 0),
      duracao_minutos: Number(duracao || 0)
    })
  });

  const data = await resposta.json();

  if (!resposta.ok) {
    throw new Error(data.erro || "Erro ao atualizar serviço.");
  }
}

async function removerServico(id) {
  const token = localStorage.getItem("token");

  const resposta = await fetch(`${API_URL}/servicos/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(data.erro || "Erro ao remover serviço.");
  }

  mostrarMensagem("Serviço removido com sucesso.", "#2f9e63");
  await carregarPerfil();
}

  async function salvarModal() {
    try {
      btnSalvarModal.disabled = true;
      btnSalvarModal.textContent = "Salvando...";

      if (tipoEdicao === "foto") {
        await salvarFoto();
      }

      if (tipoEdicao === "negocio") {
        await salvarNegocio();
      }
      
      if (tipoEdicao === "novo-servico") {
  await salvarServico();
}

      if (tipoEdicao === "editar-servico") {
  await atualizarServico();
}

      if (tipoEdicao === "novo-profissional") {
  await salvarProfissional();
}

      if (tipoEdicao === "confirmar-agendamento-visitante") {
  await confirmarAgendamentoVisitante();
}


      fecharModal();
      mostrarMensagem("Salvo com sucesso 💅", "#2f9e63");
      await carregarPerfil();

    } catch (erro) {
      mostrarMensagem(erro.message || "Erro ao salvar.");
    } finally {
      btnSalvarModal.disabled = false;
      btnSalvarModal.textContent = "Salvar";
    }
  }

  async function alternarFavorito() {
  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");

  if (!token || usuario?.tipo !== "cliente") {
    mostrarMensagem("Entre como cliente para favoritar.");
    window.location.href = "login-cliente.html";
    return;
  }

  const jaFavoritado = btnFavorito.classList.contains("ativo");

  const resposta = await fetch(`${API_URL}/favoritos/${negocioAtual.id}`, {
    method: jaFavoritado ? "DELETE" : "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await resposta.json();

  if (!resposta.ok) {
    throw new Error(data.erro || "Erro ao atualizar favorito.");
  }

  btnFavorito.classList.toggle("ativo", !jaFavoritado);
  btnFavorito.innerHTML = jaFavoritado ? "♡ Favoritar" : "❤️ Favorito";

  mostrarMensagem(
    jaFavoritado ? "Removido dos favoritos." : "Adicionado aos favoritos ❤️",
    "#2f9e63"
  );
}

  async function carregarFavorito() {
  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");

  if (
    !token ||
    usuario?.tipo !== "cliente" ||
    !negocioAtual?.id ||
    !btnFavorito ||
    ehDonoDoPerfil()
  ) {
    return;
  }

  try {
    const resposta = await fetch(`${API_URL}/favoritos/${negocioAtual.id}/status`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const resultado = await resposta.json();

    if (resultado.favoritado) {
      btnFavorito.classList.add("ativo");
      btnFavorito.innerHTML = "❤️ Favorito";
    }
  } catch {}
}

  async function copiarLinkPerfil() {
  try {
    const link =
      `${window.location.origin}/html/perfil-negocio.html?slug=${encodeURIComponent(slug)}`;

    await navigator.clipboard.writeText(link);

    btnCopiarAgenda.textContent = "✅ Link copiado";

    setTimeout(() => {
      btnCopiarAgenda.textContent = "Copiar link";
    }, 2000);

    mostrarMensagem("Link copiado com sucesso 💅", "#2f9e63");

  } catch (erro) {
    mostrarMensagem("Não foi possível copiar o link.");
  }
}

  function irParaAgenda() {
  if (!servicoSelecionado || !profissionalSelecionado || !horarioSelecionado) {
    mostrarMensagem("Escolha serviço, profissional e horário.");
    return;
  }

  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");

  if (!token || usuario?.tipo !== "cliente") {
    abrirModal(
      "Confirmar agendamento",
      "confirmar-agendamento-visitante",
      `
        <div class="resumo-modal">
          <strong>${servicoSelecionado.nome}</strong><br>
          ${horarioSelecionado.data} às ${horarioSelecionado.hora}<br>
          Profissional: ${profissionalSelecionado.nome}
        </div>

        <label>Seu nome</label>
        <input id="inputClienteNome" class="af-input" placeholder="Digite seu nome">

        <label>Seu WhatsApp</label>
        <input id="inputClienteWhatsapp" class="af-input" placeholder="Ex: 62999999999">
      `
    );

    return;
  }

  confirmarAgendamentoLogado();
}

async function confirmarAgendamentoLogado() {
  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");

  if (!usuario?.nome || !usuario?.whatsapp) {
    abrirModal(
      "Confirmar agendamento",
      "confirmar-agendamento-visitante",
      `
        <div class="resumo-modal">
          <strong>${servicoSelecionado.nome}</strong><br>
          ${horarioSelecionado.data} às ${horarioSelecionado.hora}<br>
          Profissional: ${profissionalSelecionado.nome}
        </div>

        <label>Seu nome</label>
        <input id="inputClienteNome" class="af-input" value="${usuario?.nome || ""}">

        <label>Seu WhatsApp</label>
        <input id="inputClienteWhatsapp" class="af-input" value="${usuario?.whatsapp || ""}">
      `
    );

    return;
  }

  const resposta = await fetch(`${API_URL}/agendamentos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      slug,
      servico_id: servicoSelecionado.id,
      profissional_id: profissionalSelecionado.id,
      data: horarioSelecionado.data,
      horario: horarioSelecionado.hora,
      cliente_nome: usuario.nome,
      cliente_whatsapp: usuario.whatsapp
    })
  });

  const data = await resposta.json();

  if (!resposta.ok) {
  throw new Error(data.erro || "Erro ao confirmar agendamento.");
}

btnContinuar.disabled = true;
btnContinuar.textContent = "Agendado com sucesso ✅";

mostrarMensagem("Agendamento confirmado com sucesso 💅", "#2f9e63");

setTimeout(() => {
  window.location.href = "meus-agendamentos.html";
}, 1200);

}

  async function carregarPerfil() {
    try {
      esconderMensagem();

      await descobrirSlug();

      if (!slug) {
        throw new Error("Perfil inválido.");
      }

      const resposta = await fetch(`${API_URL}/perfil-negocio/${encodeURIComponent(slug)}`);
      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro || "Erro ao carregar perfil.");
      }

      negocioAtual = resultado.negocio;

      preencherNegocio(negocioAtual);
      ativarModoDono();
      renderizarServicos(resultado.servicos || []);
      renderizarProfissionais(resultado.profissionais || []);
      await carregarFavorito();

    } catch (erro) {
      console.error("Erro perfil:", erro);
      nomeNegocio.textContent = "Erro ao carregar";
      mostrarMensagem(erro.message || "Erro ao carregar perfil.");
    }
  }

  btnFavorito?.addEventListener("click", async () => {
  try {
    await alternarFavorito();
  } catch (erro) {
    mostrarMensagem(erro.message || "Erro ao favoritar.");
  }
});

  document.addEventListener("click", async (e) => {
  const edit = e.target.closest("[data-edit]");
  if (edit) {
    abrirEdicaoCampo(edit.dataset.edit);
    return;
  }

  const action = e.target.closest("[data-action]");

  if (action?.dataset.action === "novo-servico") {
    abrirNovoServico();
    return;
  }

  if (action?.dataset.action === "novo-profissional") {
    abrirNovoProfissional();
    return;
  }

  const btnEditarServico = e.target.closest(".btn-editar-servico");

if (btnEditarServico) {
  const id = btnEditarServico.dataset.servicoId;

  const servico = servicosAtuais.find(
    (item) => Number(item.id) === Number(id)
  );

  if (!servico) {
    mostrarMensagem("Serviço não encontrado.");
    return;
  }

  abrirModal(
    "Editar serviço",
    "editar-servico",
    `
      <input id="inputServicoId" type="hidden" value="${servico.id}">

      <input
        id="inputServicoNome"
        class="af-input"
        placeholder="Nome do serviço"
        value="${servico.nome || ""}"
      >

      <input
        id="inputServicoValor"
        class="af-input"
        type="number"
        step="0.01"
        placeholder="Valor"
        value="${servico.valor || 0}"
      >

      <input
        id="inputServicoDuracao"
        class="af-input"
        type="number"
        placeholder="Duração em minutos"
        value="${servico.duracao_minutos || 0}"
      >
    `
  );

  return;
}

const btnRemoverServico = e.target.closest(".btn-remover-servico");
if (btnRemoverServico) {
  const id = btnRemoverServico.dataset.servicoId;

  if (!confirm("Remover este serviço?")) return;

  await removerServico(id);
  return;
}

});

async function confirmarAgendamentoVisitante() {
  const nome = document.getElementById("inputClienteNome")?.value?.trim();
  const whatsapp = document.getElementById("inputClienteWhatsapp")?.value?.trim();

  if (!nome || !whatsapp) {
    throw new Error("Informe nome e WhatsApp.");
  }

  const resposta = await fetch(`${API_URL}/agendamentos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      slug,
      servico_id: servicoSelecionado.id,
      profissional_id: profissionalSelecionado.id,
      data: horarioSelecionado.data,
      horario: horarioSelecionado.hora,
      cliente_nome: nome,
      cliente_whatsapp: whatsapp
    })
  });

  const data = await resposta.json();

  if (!resposta.ok) {
  throw new Error(data.erro || "Erro ao confirmar agendamento.");
}

btnContinuar.disabled = true;
btnContinuar.textContent = "Agendado com sucesso ✅";

mostrarMensagem("Agendamento confirmado com sucesso 💅", "#2f9e63");

setTimeout(() => {
  window.location.href = "meus-agendamentos.html";
}, 1200);

}

  btnFecharModal?.addEventListener("click", fecharModal);
  btnCancelarModal?.addEventListener("click", fecharModal);
  btnSalvarModal?.addEventListener("click", salvarModal);

  btnCopiarAgenda?.addEventListener("click", copiarLinkPerfil);
  btnContinuar?.addEventListener("click", irParaAgenda);

  await carregarPerfil();
});