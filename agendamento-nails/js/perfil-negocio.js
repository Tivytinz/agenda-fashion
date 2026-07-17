document.addEventListener("DOMContentLoaded", async () => {


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
  if (
    !usuario?.id ||
    !negocioAtual?.id
  ) {
    return false;
  }

  const usuarioEhDonoDireto =
    negocioAtual.dono_usuario_id &&
    Number(usuario.id) ===
      Number(
        negocioAtual.dono_usuario_id
      );

  const mesmoNegocioDaSessao =
    negocioLocal?.id &&
    Number(negocioLocal.id) ===
      Number(negocioAtual.id);

  const usuarioEhDonoPeloVinculo =
    mesmoNegocioDaSessao &&
    negocioLocal?.papel ===
      "dono";

  return Boolean(
    usuarioEhDonoDireto ||
    usuarioEhDonoPeloVinculo
  );
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

  function atualizarPerfilCompleto(negocio, servicos = []) {

  const percentual =
    document.getElementById("perfilCompletoPercentual");

  const progresso =
    document.getElementById("perfilCompletoProgresso");

  const checklist =
    document.getElementById("perfilCompletoChecklist");

  if (!percentual || !progresso || !checklist) return;

  const itens = [
    {
      nome: "Foto",
      ok: !!negocio.foto_url
    },
    {
      nome: "Descrição",
      ok: !!negocio.descricao?.trim()
    },
    {
      nome: "WhatsApp",
      ok: !!negocio.whatsapp_negocio
    },
    {
      nome: "Localização",
      ok: !!negocio.localizacao_url
    },
    {
      nome: "Serviços",
      ok: servicos.length > 0
    }
  ];

  const concluidos =
    itens.filter(i => i.ok).length;

  const total =
    itens.length;

  const porcentagem =
    Math.round((concluidos / total) * 100);

  percentual.textContent =
    `${porcentagem}%`;

  progresso.style.width =
    `${porcentagem}%`;

  checklist.innerHTML =
    itens.map(item => `
      <div>
        ${item.ok ? "✅" : "❌"} ${item.nome}
      </div>
    `).join("");
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

async function carregarGaleriaPublicaServico(servicoId) {
  const box = document.getElementById(`galeriaServico-${servicoId}`);

  if (!box) return;

  try {
    const resposta = await fetch(`${API_URL}/servicos/${servicoId}/fotos`);
    const data = await resposta.json();

    const fotos = data.fotos || [];

    if (!fotos.length) {
      box.innerHTML = "";
      return;
    }

    box.innerHTML = `
      <strong>Trabalhos realizados</strong>

      <div class="galeria-publica-grid">
        ${fotos.slice(0, 4).map(foto => `
          <img
  src="${foto.foto_url}"
  alt="Foto do serviço"
  class="foto-publica-servico"
  data-lightbox-src="${foto.foto_url}"
>
        `).join("")}
      </div>
    `;

  } catch (err) {
    box.innerHTML = "";
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
          ? `<img src="${servico.foto_url}" class="servico-foto" alt="${servico.nome || "Serviço"}">`
          : `<div class="servico-foto servico-sem-foto">💅</div>`
      }

      <h3>${servico.nome || "Serviço"}</h3>

      <div class="servico-meta">
        <span>⏱ ${servico.duracao_minutos || 0} min</span>
        <strong>💰 ${valor}</strong>
      </div>

      <div
        class="galeria-publica-servico"
        id="galeriaServico-${servico.id}"
      >
        Carregando trabalhos...
      </div>

      ${
        ehDonoDoPerfil()
          ? `
            <div class="acoes-servico">
              <button
                type="button"
                class="btn-editar-servico af-btn-secondary"
                data-servico-id="${servico.id}"
              >
                ✏️ Editar
              </button>

              <button
                type="button"
                class="btn-remover-servico af-btn-secondary"
                data-servico-id="${servico.id}"
              >
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
        e.target.closest(".btn-remover-servico") ||
        e.target.closest(".foto-publica-servico")
      ) {
        return;
      }

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
    carregarGaleriaPublicaServico(servico.id);
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
  const areasAtuais = Array.isArray(negocioAtual.areas)
    ? negocioAtual.areas
    : [];

  const opcoesAreas = [
    "Unha",
    "Sobrancelha",
    "Cílios",
    "Cabelo",
    "Maquiagem",
    "Bronze",
    "Depilação",
    "Estética",
    "Massagem"
  ];

  abrirModal(
    "Editar áreas atendidas",
    "negocio",
    `
      <div class="areas-opcoes-modal">
        ${opcoesAreas.map(area => `
          <label class="area-opcao">
            <input
              type="checkbox"
              name="areasNegocio"
              value="${area}"
              ${areasAtuais.includes(area) ? "checked" : ""}
            >
            <span>${area}</span>
          </label>
        `).join("")}
      </div>
    `
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
      areas: Array.from(
      document.querySelectorAll('input[name="areasNegocio"]:checked')
      ).length
      ? Array.from(
      document.querySelectorAll('input[name="areasNegocio"]:checked')
      ).map(input => input.value)
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

  await enviarFotosGaleria(id);

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

if (
  tipoEdicao ===
  "confirmar-agendamento-logado"
) {
  const nome =
    document.getElementById(
      "inputClienteNome"
    )?.value;

  const whatsapp =
    document.getElementById(
      "inputClienteWhatsapp"
    )?.value;

  await confirmarAgendamentoLogado({
    nome,
    whatsapp,
  });

  fecharModal();

  return;
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

  function obterTokenAtual() {
  if (
    window.AuthService &&
    typeof window.AuthService
      .getToken === "function"
  ) {
    return window.AuthService
      .getToken();
  }

  return localStorage.getItem(
    "token"
  );
}
function obterUsuarioAtual() {
  try {
    return JSON.parse(
      localStorage.getItem(
        "usuario"
      ) || "null"
    );
  } catch {
    localStorage.removeItem(
      "usuario"
    );

    return null;
  }
}

function escaparHtml(
  valor
) {
  return String(
    valor ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function atualizarBotaoFavorito(
  favoritado
) {
  if (!btnFavorito) {
    return;
  }

  btnFavorito.classList.toggle(
    "ativo",
    favoritado
  );

  btnFavorito.textContent =
    favoritado
      ? "❤️ Favorito"
      : "♡ Favoritar";

  btnFavorito.setAttribute(
    "aria-pressed",
    String(favoritado)
  );
}

function redirecionarParaLogin() {
  if (
    window.AuthService &&
    typeof window.AuthService
      .limparSessao === "function"
  ) {
    window.AuthService
      .limparSessao();
  }

  window.location.href =
    "/html/login-cliente.html";
}

  async function alternarFavorito() {
  if (
    !btnFavorito ||
    !negocioAtual?.id
  ) {
    throw new Error(
      "Negócio inválido."
    );
  }

  if (ehDonoDoPerfil()) {
    mostrarMensagem(
      "Você não pode favoritar seu próprio negócio."
    );

    return;
  }

  const token =
    obterTokenAtual();

  if (!token) {
    mostrarMensagem(
      "Entre na sua conta para favoritar."
    );

    window.location.href =
      "/html/login-cliente.html";

    return;
  }

  if (
    !window.API ||
    typeof window.API.post !==
      "function" ||
    typeof window.API.delete !==
      "function"
  ) {
    throw new Error(
      "O serviço da API não foi carregado."
    );
  }

  const jaFavoritado =
    btnFavorito.classList.contains(
      "ativo"
    );

  btnFavorito.disabled =
    true;

  try {
    const caminho =
      `/favoritos/${encodeURIComponent(
        negocioAtual.id
      )}`;

    const resultado =
      jaFavoritado
        ? await window.API.delete(
            caminho
          )
        : await window.API.post(
            caminho,
            {}
          );

    const favoritado =
      typeof resultado?.favoritado ===
      "boolean"
        ? resultado.favoritado
        : !jaFavoritado;

    atualizarBotaoFavorito(
      favoritado
    );

    mostrarMensagem(
      resultado?.mensagem ||
        (
          favoritado
            ? "Adicionado aos favoritos ❤️"
            : "Removido dos favoritos."
        ),
      "#2f9e63"
    );
  } catch (erro) {
    if (
      erro?.status === 401 ||
      erro?.status === 403
    ) {
      redirecionarParaLogin();
      return;
    }

    throw erro;
  } finally {
    btnFavorito.disabled =
      false;
  }
}

  async function carregarFavorito() {
  if (
    !btnFavorito ||
    !negocioAtual?.id
  ) {
    return;
  }

  if (ehDonoDoPerfil()) {
    btnFavorito.classList.add(
      "hidden"
    );

    return;
  }

  btnFavorito.classList.remove(
    "hidden"
  );

  atualizarBotaoFavorito(
    false
  );

  const token =
    obterTokenAtual();

  /*
   * Visitante pode visualizar o perfil,
   * apenas não possui favorito salvo.
   */
  if (!token) {
    return;
  }

  if (
    !window.API ||
    typeof window.API.get !==
      "function"
  ) {
    console.warn(
      "API não carregada para verificar favorito."
    );

    return;
  }

  btnFavorito.disabled =
    true;

  try {
    const resultado =
      await window.API.get(
        `/favoritos/${encodeURIComponent(
          negocioAtual.id
        )}/status`
      );

    atualizarBotaoFavorito(
      Boolean(
        resultado?.favoritado
      )
    );
  } catch (erro) {
    if (
      erro?.status === 401 ||
      erro?.status === 403
    ) {
      window.AuthService
        ?.limparSessao?.();

      atualizarBotaoFavorito(
        false
      );

      return;
    }

    console.warn(
      "Não foi possível verificar o favorito:",
      erro
    );

    atualizarBotaoFavorito(
      false
    );
  } finally {
    btnFavorito.disabled =
      false;
  }
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

  async function irParaAgenda() {
  if (
    !servicoSelecionado ||
    !profissionalSelecionado ||
    !horarioSelecionado
  ) {
    mostrarMensagem(
      "Escolha serviço, profissional e horário."
    );

    return;
  }

  const token =
    obterTokenAtual();

  const usuarioAtual =
    obterUsuarioAtual();

  /*
   * Sem token, mantém o fluxo
   * público de visitante.
   */
  if (!token) {
    abrirModal(
      "Confirmar agendamento",
      "confirmar-agendamento-visitante",
      `
        <div class="resumo-modal">
          <strong>${escaparHtml(
            servicoSelecionado.nome
          )}</strong><br>

          ${escaparHtml(
            horarioSelecionado.data
          )} às ${escaparHtml(
            horarioSelecionado.hora
          )}<br>

          Profissional:
          ${escaparHtml(
            profissionalSelecionado.nome
          )}
        </div>

        <label for="inputClienteNome">
          Seu nome
        </label>

        <input
          id="inputClienteNome"
          class="af-input"
          placeholder="Digite seu nome"
        >

        <label for="inputClienteWhatsapp">
          Seu WhatsApp
        </label>

        <input
          id="inputClienteWhatsapp"
          class="af-input"
          placeholder="Ex.: 62999999999"
        >
      `
    );

    return;
  }

  /*
   * Qualquer conta autenticada pode
   * realizar um agendamento.
   */
  if (
    usuarioAtual?.nome &&
    usuarioAtual?.whatsapp
  ) {
    try {
      await confirmarAgendamentoLogado({
        nome:
          usuarioAtual.nome,

        whatsapp:
          usuarioAtual.whatsapp,
      });
    } catch (erro) {
      mostrarMensagem(
        erro?.message ||
          "Não foi possível confirmar o agendamento."
      );
    }

    return;
  }

  /*
   * Conta autenticada sem nome ou
   * WhatsApp completo.
   */
  abrirModal(
    "Confirmar agendamento",
    "confirmar-agendamento-logado",
    `
      <div class="resumo-modal">
        <strong>${escaparHtml(
          servicoSelecionado.nome
        )}</strong><br>

        ${escaparHtml(
          horarioSelecionado.data
        )} às ${escaparHtml(
          horarioSelecionado.hora
        )}<br>

        Profissional:
        ${escaparHtml(
          profissionalSelecionado.nome
        )}
      </div>

      <label for="inputClienteNome">
        Seu nome
      </label>

      <input
        id="inputClienteNome"
        class="af-input"
        value="${escaparHtml(
          usuarioAtual?.nome
        )}"
        placeholder="Digite seu nome"
      >

      <label for="inputClienteWhatsapp">
        Seu WhatsApp
      </label>

      <input
        id="inputClienteWhatsapp"
        class="af-input"
        value="${escaparHtml(
          usuarioAtual?.whatsapp
        )}"
        placeholder="Ex.: 62999999999"
      >
    `
  );
}

async function confirmarAgendamentoLogado({
  nome,
  whatsapp,
} = {}) {
  const token =
    obterTokenAtual();

  if (!token) {
    throw new Error(
      "Sua sessão expirou. Entre novamente."
    );
  }

  if (
    !window.API ||
    typeof window.API.post !==
      "function"
  ) {
    throw new Error(
      "O serviço da API não foi carregado."
    );
  }

  const nomeNormalizado =
    String(nome || "")
      .trim()
      .replace(/\s+/g, " ");

  const whatsappNormalizado =
    String(whatsapp || "")
      .replace(/\D/g, "");

  if (
    nomeNormalizado.length < 2
  ) {
    throw new Error(
      "Informe seu nome."
    );
  }

  if (
    ![10, 11].includes(
      whatsappNormalizado.length
    )
  ) {
    throw new Error(
      "Informe um WhatsApp válido com DDD."
    );
  }

  if (
    !servicoSelecionado ||
    !profissionalSelecionado ||
    !horarioSelecionado
  ) {
    throw new Error(
      "Os dados do agendamento estão incompletos."
    );
  }

  if (btnContinuar) {
    btnContinuar.disabled =
      true;

    btnContinuar.textContent =
      "Confirmando...";
  }

  try {
    const resultado =
      await window.API.post(
        "/agendamentos",
        {
          slug,

          servico_id:
            servicoSelecionado.id,

          profissional_id:
            profissionalSelecionado.id,

          data:
            horarioSelecionado.data,

          horario:
            horarioSelecionado.hora,

          cliente_nome:
            nomeNormalizado,

          cliente_whatsapp:
            whatsappNormalizado,
        }
      );

    if (
      !resultado?.agendamento?.id
    ) {
      throw new Error(
        "O servidor não confirmou o agendamento."
      );
    }

    if (btnContinuar) {
      btnContinuar.textContent =
        "Agendado com sucesso ✅";
    }

    mostrarMensagem(
      resultado?.mensagem ||
        "Agendamento confirmado com sucesso 💅",
      "#2f9e63"
    );

    window.setTimeout(
      () => {
        window.location.href =
          "/html/meus-agendamentos.html";
      },
      1200
    );

    return resultado;
  } catch (erro) {
    if (btnContinuar) {
      btnContinuar.disabled =
        false;

      btnContinuar.textContent =
        "Continuar";
    }

    if (
      erro?.status === 401
    ) {
      window.AuthService
        ?.limparSessao?.();

      window.location.href =
        "/html/login-cliente.html";
    }

    throw erro;
  }
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
      atualizarPerfilCompleto(
      negocioAtual,
      resultado.servicos || []
);
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

function abrirLightbox(src) {
  let lightbox = document.getElementById("lightboxGaleria");

  if (!lightbox) {
    lightbox = document.createElement("div");
    lightbox.id = "lightboxGaleria";
    lightbox.className = "lightbox-galeria";

    lightbox.innerHTML = `
      <button
        type="button"
        class="lightbox-fechar"
      >
        ✕
      </button>

      <img
        id="lightboxImagem"
        src=""
        alt="Foto ampliada"
      >
    `;

    document.body.appendChild(lightbox);
  }

  const imagem = document.getElementById("lightboxImagem");
  imagem.src = src;

  lightbox.classList.add("ativo");
}

function fecharLightbox() {
  const lightbox = document.getElementById("lightboxGaleria");

  if (lightbox) {
    lightbox.classList.remove("ativo");
  }
}

  document.addEventListener("click", async (e) => {
    const fotoLightbox = e.target.closest("[data-lightbox-src]");

if (fotoLightbox) {
  abrirLightbox(fotoLightbox.dataset.lightboxSrc);
  return;
}

if (
  e.target.closest(".lightbox-fechar") ||
  e.target.id === "lightboxGaleria"
) {
  fecharLightbox();
  return;
}
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

  const btnRemoverFoto = e.target.closest(".btn-remover-foto");

if (btnRemoverFoto) {
  const fotoId = btnRemoverFoto.dataset.fotoId;
  const servicoId = document.getElementById("inputServicoId")?.value;

  try {
    await removerFotoGaleria(fotoId);

    if (servicoId) {
      await carregarGaleriaServico(servicoId);
    }
  } catch (erro) {
    mostrarMensagem(erro.message || "Erro ao remover foto.");
  }

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

    <hr style="margin:16px 0">

    <h3>Galeria do serviço</h3>

    <input
      id="inputGaleriaServico"
      type="file"
      multiple
      accept="image/*"
      class="af-input"
    >

    <div
      id="galeriaServicoPreview"
      class="galeria-servico"
    >
      Carregando fotos...
    </div>
  `
);

setTimeout(() => {
  carregarGaleriaServico(servico.id);
}, 100);

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

async function carregarGaleriaServico(servicoId) {
  try {
    const resposta = await fetch(`${API_URL}/servicos/${servicoId}/fotos`);
    const data = await resposta.json();

    const galeria = document.getElementById("galeriaServicoPreview");
    if (!galeria) return;

    if (!data.fotos?.length) {
      galeria.innerHTML = `<div class="estado-vazio">Nenhuma foto.</div>`;
      return;
    }

    galeria.innerHTML = data.fotos.map(foto => `
      <div class="foto-galeria-item">
        <img src="${foto.foto_url}">
        <button
          type="button"
          class="btn-remover-foto"
          data-foto-id="${foto.id}"
        >
          ✕
        </button>
      </div>
    `).join("");

  } catch (err) {
    console.error("Erro ao carregar galeria:", err);
  }
}

async function removerFotoGaleria(fotoId) {
  const token = localStorage.getItem("token");

  if (!confirm("Remover esta foto da galeria?")) return;

  const resposta = await fetch(`${API_URL}/servicos/fotos/${fotoId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(data.erro || "Erro ao remover foto.");
  }

  mostrarMensagem("Foto removida com sucesso.", "#2f9e63");
}

async function enviarFotosGaleria(servicoId) {

  const token =
    localStorage.getItem("token");

  const arquivos =
    document.getElementById("inputGaleriaServico")?.files;

  if (!arquivos?.length) return;

  for (const foto of arquivos) {

    const formData = new FormData();

    formData.append("foto", foto);

    await fetch(
      `${API_URL}/servicos/${servicoId}/fotos`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      }
    );
  }
}

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