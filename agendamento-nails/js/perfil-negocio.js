document.addEventListener("DOMContentLoaded", () => {
  const elementos = {
    nomeNegocio: document.getElementById("nomeNegocio"),
    linhaAvaliacao: document.getElementById("linhaAvaliacao"),
    descricaoNegocio: document.getElementById("descricaoNegocio"),
    cidadeBairro: document.getElementById("cidadeBairroNegocio"),
    distanciaNegocio: document.getElementById("distanciaNegocio"),
    areasNegocio: document.getElementById("areasNegocio"),

    btnWhatsapp: document.getElementById("btnWhatsapp"),
    btnMaps: document.getElementById("btnMaps"),
    btnFavorito: document.getElementById("btnFavorito"),
    btnCopiarAgenda: document.getElementById("btnCopiarAgenda"),
    btnContinuar: document.getElementById("btnContinuarAgendamento"),

    listaServicos: document.getElementById("listaServicos"),
    listaProfissionais: document.getElementById("listaProfissionais"),
    listaHorarios: document.getElementById("listaHorariosDisponiveis"),

    resumoServico: document.getElementById("resumoServico"),
    resumoProfissional: document.getElementById("resumoProfissional"),
    resumoHorario: document.getElementById("resumoHorario"),

    mensagem: document.getElementById("mensagemPerfil"),

    modal: document.getElementById("modalPerfil"),
    modalTitulo: document.getElementById("modalTitulo"),
    modalConteudo: document.getElementById("modalConteudo"),
    btnFecharModal: document.getElementById("btnFecharModal"),
    btnCancelarModal: document.getElementById("btnCancelarModal"),
    btnSalvarModal: document.getElementById("btnSalvarModal"),

    boxProfissionaisHorarios: document.getElementById(
      "boxProfissionaisHorarios"
    ),
    etapaServico: document.getElementById("etapaServico"),
    etapaHorario: document.getElementById("etapaHorario"),

    percentualPerfil: document.getElementById("perfilCompletoPercentual"),
    progressoPerfil: document.getElementById("perfilCompletoProgresso"),
    checklistPerfil: document.getElementById("perfilCompletoChecklist"),
  };

  const estado = {
    slug: null,
    negocio: null,
    negocioLocal: obterJsonLocal("negocio"),
    servicos: [],
    profissionais: [],
    servicoSelecionado: null,
    profissionalSelecionado: null,
    horarioSelecionado: null,
    tipoModal: null,
    carregandoPerfil: false,
  };

  function obterJsonLocal(chave) {
    try {
      return JSON.parse(localStorage.getItem(chave) || "null");
    } catch {
      localStorage.removeItem(chave);
      return null;
    }
  }

  function obterUsuarioAtual() {
    return obterJsonLocal("usuario");
  }

  function obterTokenAtual() {
    if (
      window.AuthService &&
      typeof window.AuthService.getToken === "function"
    ) {
      return window.AuthService.getToken();
    }

    return localStorage.getItem("token");
  }

  function limparSessao() {
    if (
      window.AuthService &&
      typeof window.AuthService.limparSessao === "function"
    ) {
      window.AuthService.limparSessao();
      return;
    }

    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("negocio");
  }

  function obterApiUrl() {
    const valor =
      typeof API_URL !== "undefined"
        ? API_URL
        : window.API_URL || "";

    return String(valor).trim().replace(/\/+$/, "");
  }

  async function lerJson(resposta) {
    if (resposta.status === 204) {
      return {};
    }

    try {
      return await resposta.json();
    } catch {
      return {};
    }
  }

  async function requisicao(
    caminho,
    {
      method = "GET",
      body,
      autenticado = false,
      headers = {},
      signal,
    } = {}
  ) {
    const apiUrl = obterApiUrl();

    if (!apiUrl) {
      throw new Error("A conexão com o servidor não está configurada.");
    }

    const cabecalhos = {
      Accept: "application/json",
      ...headers,
    };

    if (autenticado) {
      const token = obterTokenAtual();

      if (!token) {
        const erro = new Error("Sua sessão expirou. Entre novamente.");
        erro.status = 401;
        throw erro;
      }

      cabecalhos.Authorization = `Bearer ${token}`;
    }

    let corpo = body;

    if (
      body !== undefined &&
      body !== null &&
      !(body instanceof FormData)
    ) {
      cabecalhos["Content-Type"] = "application/json";
      corpo = JSON.stringify(body);
    }

    const resposta = await fetch(
      `${apiUrl}${caminho.startsWith("/") ? caminho : `/${caminho}`}`,
      {
        method,
        headers: cabecalhos,
        body: corpo,
        signal,
      }
    );

    const resultado = await lerJson(resposta);

    if (!resposta.ok) {
      const erro = new Error(
        resultado.erro ||
          resultado.mensagem ||
          "Não foi possível concluir a operação."
      );

      erro.status = resposta.status;
      erro.dados = resultado;
      throw erro;
    }

    return resultado;
  }

  function escaparHtml(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function criarElemento(tag, classe = "", texto = null) {
    const elemento = document.createElement(tag);

    if (classe) {
      elemento.className = classe;
    }

    if (texto !== null && texto !== undefined) {
      elemento.textContent = String(texto);
    }

    return elemento;
  }

  function obterUrlSegura(valor) {
    const texto = String(valor || "").trim();

    if (!texto) {
      return null;
    }

    try {
      const url = new URL(texto, window.location.origin);

      if (!["http:", "https:"].includes(url.protocol)) {
        return null;
      }

      return url.href;
    } catch {
      return null;
    }
  }

  function obterIniciais(nome, fallback = "N") {
    const partes = String(nome || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!partes.length) {
      return fallback;
    }

    if (partes.length === 1) {
      return partes[0].slice(0, 2).toUpperCase();
    }

    return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarDia(dataIso) {
    const data = new Date(`${dataIso}T00:00:00`);

    if (Number.isNaN(data.getTime())) {
      return String(dataIso || "Data");
    }

    return data.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
  }

  function formatarDataResumo(dataIso) {
    const data = new Date(`${dataIso}T00:00:00`);

    if (Number.isNaN(data.getTime())) {
      return String(dataIso || "");
    }

    return data.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function mostrarMensagem(texto, tipo = "erro") {
    if (!elementos.mensagem) {
      return;
    }

    const estilos = {
      sucesso: {
        color: "var(--sucesso)",
        background: "var(--sucesso-fundo)",
        border: "var(--sucesso-borda)",
      },
      aviso: {
        color: "var(--aviso)",
        background: "var(--aviso-fundo)",
        border: "var(--aviso-borda)",
      },
      info: {
        color: "var(--info)",
        background: "var(--info-fundo)",
        border: "var(--info-borda)",
      },
      erro: {
        color: "var(--erro)",
        background: "var(--erro-fundo)",
        border: "var(--erro-borda)",
      },
    };

    const estilo = estilos[tipo] || estilos.erro;

    elementos.mensagem.textContent = String(texto || "");
    elementos.mensagem.style.color = estilo.color;
    elementos.mensagem.style.background = estilo.background;
    elementos.mensagem.style.borderColor = estilo.border;
    elementos.mensagem.classList.remove("hidden");
  }

  function esconderMensagem() {
    if (!elementos.mensagem) {
      return;
    }

    elementos.mensagem.textContent = "";
    elementos.mensagem.removeAttribute("style");
    elementos.mensagem.classList.add("hidden");
  }

  function criarEstadoVazio(texto) {
    return criarElemento("div", "estado-vazio", texto);
  }

  function criarEstadoCarregando(texto) {
    const container = criarElemento("div", "estado-vazio");
    const loading = criarElemento("span", "af-loading");
    const spinner = criarElemento("span", "af-spinner");

    spinner.setAttribute("aria-hidden", "true");

    loading.append(spinner, criarElemento("span", "", texto));
    container.appendChild(loading);

    return container;
  }

  function ehDonoDoPerfil() {
    const usuario = obterUsuarioAtual();
    const negocioAtual = estado.negocio;
    const negocioLocal = estado.negocioLocal;

    if (!usuario?.id || !negocioAtual?.id) {
      return false;
    }

    const donoDireto =
      negocioAtual.dono_usuario_id &&
      Number(usuario.id) === Number(negocioAtual.dono_usuario_id);

    const mesmoNegocio =
      negocioLocal?.id &&
      Number(negocioLocal.id) === Number(negocioAtual.id);

    const donoPorVinculo = mesmoNegocio && negocioLocal?.papel === "dono";

    return Boolean(donoDireto || donoPorVinculo);
  }

  async function descobrirSlug() {
    const params = new URLSearchParams(window.location.search);
    const slugUrl = params.get("slug")?.trim();

    if (slugUrl) {
      estado.slug = slugUrl;
      return slugUrl;
    }

    if (estado.negocioLocal?.slug) {
      estado.slug = estado.negocioLocal.slug;
      return estado.slug;
    }

    if (!obterTokenAtual()) {
      return null;
    }

    const dados = await requisicao("/meu-negocio", {
      autenticado: true,
    });

    if (dados.temNegocio && dados.negocio?.slug) {
      estado.negocioLocal = dados.negocio;
      estado.slug = dados.negocio.slug;

      localStorage.setItem("negocio", JSON.stringify(dados.negocio));

      return estado.slug;
    }

    return null;
  }

  function renderizarFotoNegocio(negocio) {
    const atual = document.getElementById("fotoNegocio");

    if (!atual) {
      return;
    }

    const fotoUrl = obterUrlSegura(negocio.foto_url);
    let novoElemento;

    if (fotoUrl) {
      novoElemento = document.createElement("img");
      novoElemento.id = "fotoNegocio";
      novoElemento.className = "foto-negocio";
      novoElemento.src = fotoUrl;
      novoElemento.alt = `Foto de ${negocio.nome || "negócio"}`;
      novoElemento.decoding = "async";

      novoElemento.addEventListener(
        "error",
        () => {
          renderizarAvatarNegocio(negocio);
        },
        { once: true }
      );
    } else {
      novoElemento = criarElemento(
        "div",
        "avatar-negocio",
        obterIniciais(negocio.nome)
      );

      novoElemento.id = "fotoNegocio";

      novoElemento.setAttribute(
        "aria-label",
        `Avatar de ${negocio.nome || "negócio"}`
      );
    }

    atual.replaceWith(novoElemento);
  }

  function renderizarAvatarNegocio(negocio) {
    const atual = document.getElementById("fotoNegocio");

    if (!atual) {
      return;
    }

    const avatar = criarElemento(
      "div",
      "avatar-negocio",
      obterIniciais(negocio.nome)
    );

    avatar.id = "fotoNegocio";

    avatar.setAttribute(
      "aria-label",
      `Avatar de ${negocio.nome || "negócio"}`
    );

    atual.replaceWith(avatar);
  }

  function configurarContato({
    elemento,
    disponivel,
    href,
    textoDisponivel,
    textoAusente,
  }) {
    if (!elemento) {
      return;
    }

    const dono = ehDonoDoPerfil();
    const texto = elemento.querySelector("span:last-child");
    const container = elemento.closest(".contato-item");

    if (disponivel && href) {
      elemento.href = href;
      elemento.removeAttribute("aria-disabled");
      elemento.classList.remove("hidden");

      if (texto) {
        texto.textContent = textoDisponivel;
      }

      container?.classList.remove("hidden");
      return;
    }

    elemento.removeAttribute("href");

    if (dono) {
      elemento.setAttribute("aria-disabled", "true");
      elemento.classList.remove("hidden");

      if (texto) {
        texto.textContent = textoAusente;
      }

      container?.classList.remove("hidden");
      return;
    }

    elemento.classList.add("hidden");
    container?.classList.add("hidden");
  }

  function preencherNegocio(negocio) {
    renderizarFotoNegocio(negocio);

    if (elementos.nomeNegocio) {
      elementos.nomeNegocio.textContent = negocio.nome || "Negócio";
    }

    document.title = `${negocio.nome || "Perfil"} | Agenda Fashion`;

    if (elementos.linhaAvaliacao) {
      const total = Number(negocio.total_avaliacoes || 0);
      const media = Number(negocio.media_avaliacoes || 0);

      elementos.linhaAvaliacao.textContent =
        total > 0
          ? `⭐ ${media.toFixed(1)} · ${total} avaliação${
              total === 1 ? "" : "ões"
            }`
          : "⭐ Novo negócio";
    }

    if (elementos.descricaoNegocio) {
      elementos.descricaoNegocio.textContent =
        negocio.descricao ||
        "Este negócio ainda não adicionou uma descrição.";
    }

    if (elementos.cidadeBairro) {
      const localizacao = [negocio.bairro, negocio.cidade]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .join(", ");

      elementos.cidadeBairro.textContent = `📍 ${
        localizacao || "Localização não informada"
      }`;
    }

    if (elementos.areasNegocio) {
      const areas = Array.isArray(negocio.areas)
        ? negocio.areas
            .map((area) => String(area || "").trim())
            .filter(Boolean)
        : [];

      elementos.areasNegocio.replaceChildren();

      (areas.length ? areas : ["Beleza"]).forEach((area) => {
        elementos.areasNegocio.appendChild(
          criarElemento("span", "area-tag", area)
        );
      });
    }

    const numeroOriginal = String(
      negocio.whatsapp_negocio || ""
    ).replace(/\D/g, "");

    const numeroWhatsapp = numeroOriginal.startsWith("55")
      ? numeroOriginal
      : numeroOriginal
        ? `55${numeroOriginal}`
        : "";

    configurarContato({
      elemento: elementos.btnWhatsapp,
      disponivel: Boolean(numeroWhatsapp),
      href: numeroWhatsapp
        ? `https://wa.me/${numeroWhatsapp}`
        : null,
      textoDisponivel: "WhatsApp",
      textoAusente: "Adicionar WhatsApp",
    });

    const mapsUrl = obterUrlSegura(negocio.localizacao_url);

    configurarContato({
      elemento: elementos.btnMaps,
      disponivel: Boolean(mapsUrl),
      href: mapsUrl,
      textoDisponivel: "Ver no Maps",
      textoAusente: "Adicionar Maps",
    });
  }

  function ativarModoDono() {
    const dono = ehDonoDoPerfil();

    document.querySelectorAll(".dono-only").forEach((elemento) => {
      elemento.classList.toggle("hidden", !dono);
    });

    elementos.btnFavorito?.classList.toggle("hidden", dono);
  }

    function atualizarPerfilCompleto(negocio, servicos) {
    if (
      !elementos.percentualPerfil ||
      !elementos.progressoPerfil ||
      !elementos.checklistPerfil
    ) {
      return;
    }

    const itens = [
  {
    nome: "Foto",
    ok: Boolean(negocio.foto_url),
  },
  {
    nome: "Descrição",
    ok: Boolean(negocio.descricao?.trim()),
  },
  {
    nome: "WhatsApp",
    ok: Boolean(negocio.whatsapp_negocio),
  },
  {
    nome: "Localização",
    ok: Boolean(negocio.localizacao_url),
  },
  {
    nome: "Serviços",
    ok: servicos.length > 0,
  },
];

    const concluidos = itens.filter((item) => item.ok).length;
    const porcentagem = Math.round((concluidos / itens.length) * 100);

    elementos.percentualPerfil.textContent = `${porcentagem}%`;
    elementos.progressoPerfil.style.width = `${porcentagem}%`;

    const barra = elementos.progressoPerfil.parentElement;
    barra?.setAttribute("aria-valuenow", String(porcentagem));

    elementos.checklistPerfil.replaceChildren();

    itens.forEach((item) => {
      elementos.checklistPerfil.appendChild(
        criarElemento("div", "", `${item.ok ? "✅" : "○"} ${item.nome}`)
      );
    });
  }

  function atualizarResumo() {
    if (elementos.resumoServico) {
      elementos.resumoServico.textContent = `Serviço: ${
        estado.servicoSelecionado?.nome || "nenhum"
      }`;
    }

    if (elementos.resumoProfissional) {
      elementos.resumoProfissional.textContent = `Profissional: ${
        estado.profissionalSelecionado?.nome || "nenhum"
      }`;
    }

    if (elementos.resumoHorario) {
      const horario = estado.horarioSelecionado;

      elementos.resumoHorario.textContent = horario
        ? `Horário: ${formatarDataResumo(horario.data)} às ${horario.hora}`
        : "Horário: nenhum";
    }

    const completo = Boolean(
      estado.servicoSelecionado &&
        estado.profissionalSelecionado &&
        estado.horarioSelecionado
    );

    if (elementos.btnContinuar) {
      elementos.btnContinuar.disabled = !completo;
      elementos.btnContinuar.classList.toggle("btn-disabled", !completo);
    }
  }

  function limparSelecaoAposServico() {
    estado.profissionalSelecionado = null;
    estado.horarioSelecionado = null;

    elementos.listaProfissionais
      ?.querySelectorAll(".item-selecao")
      .forEach((item) => item.classList.remove("ativo"));

    elementos.listaHorarios?.replaceChildren(
      criarEstadoVazio("Escolha um profissional para visualizar os horários.")
    );
  }

  function selecionarServico(servico, card) {
    estado.servicoSelecionado = servico;
    limparSelecaoAposServico();

    elementos.listaServicos
      ?.querySelectorAll(".item-selecao")
      .forEach((item) => item.classList.remove("ativo"));

    card.classList.add("ativo");

    elementos.boxProfissionaisHorarios?.classList.remove("hidden");
    elementos.etapaServico?.classList.remove("ativa");
    elementos.etapaHorario?.classList.add("ativa");

    atualizarResumo();

    elementos.boxProfissionaisHorarios?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function criarImagemServico(servico) {
    const fotoUrl = obterUrlSegura(servico.foto_url);

    if (!fotoUrl) {
      return criarElemento("div", "servico-foto servico-sem-foto", "💅");
    }

    const imagem = document.createElement("img");

    imagem.className = "servico-foto";
    imagem.src = fotoUrl;
    imagem.alt = servico.nome || "Serviço";
    imagem.loading = "lazy";
    imagem.decoding = "async";

    imagem.addEventListener(
      "error",
      () => {
        imagem.replaceWith(
          criarElemento("div", "servico-foto servico-sem-foto", "💅")
        );
      },
      { once: true }
    );

    return imagem;
  }

  function criarCardServico(servico) {
    const card = criarElemento("article", "item-selecao");

    card.dataset.id = String(servico.id);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute(
      "aria-label",
      `Selecionar ${servico.nome || "serviço"}`
    );

    const imagem = criarImagemServico(servico);
    const titulo = criarElemento("h3", "", servico.nome || "Serviço");
    const meta = criarElemento("div", "servico-meta");

    meta.append(
      criarElemento(
        "span",
        "",
        `⏱ ${Number(servico.duracao_minutos || 0)} min`
      ),
      criarElemento("strong", "", formatarMoeda(servico.valor))
    );

    const galeria = criarElemento("div", "galeria-publica-servico");

    galeria.id = `galeriaServico-${servico.id}`;
    galeria.textContent = "Carregando trabalhos...";

    card.append(imagem, titulo, meta, galeria);

    if (ehDonoDoPerfil()) {
      const acoes = criarElemento("div", "acoes-servico");

      const editar = criarElemento(
        "button",
        "btn-editar-servico af-btn-secondary",
        "✏️ Editar"
      );

      const remover = criarElemento(
        "button",
        "btn-remover-servico af-btn-secondary",
        "🗑️ Remover"
      );

      editar.type = "button";
      editar.dataset.servicoId = String(servico.id);

      remover.type = "button";
      remover.dataset.servicoId = String(servico.id);

      acoes.append(editar, remover);
      card.appendChild(acoes);
    }

    const selecionar = (evento) => {
      if (
        evento.target.closest(".btn-editar-servico") ||
        evento.target.closest(".btn-remover-servico") ||
        evento.target.closest(".foto-publica-servico")
      ) {
        return;
      }

      selecionarServico(servico, card);
    };

    card.addEventListener("click", selecionar);

    card.addEventListener("keydown", (evento) => {
      if (evento.key !== "Enter" && evento.key !== " ") {
        return;
      }

      evento.preventDefault();
      selecionar(evento);
    });

    return card;
  }

  function renderizarServicos(servicos) {
    estado.servicos = Array.isArray(servicos) ? servicos : [];

    if (!elementos.listaServicos) {
      return;
    }

    elementos.listaServicos.replaceChildren();

    if (!estado.servicos.length) {
      elementos.listaServicos.appendChild(
        criarEstadoVazio("Nenhum serviço cadastrado.")
      );

      return;
    }

    const fragmento = document.createDocumentFragment();

    estado.servicos.forEach((servico) => {
      fragmento.appendChild(criarCardServico(servico));
    });

    elementos.listaServicos.appendChild(fragmento);

    estado.servicos.forEach((servico) => {
      void carregarGaleriaPublicaServico(servico.id);
    });
  }

  async function carregarGaleriaPublicaServico(servicoId) {
    const box = document.getElementById(`galeriaServico-${servicoId}`);

    if (!box) {
      return;
    }

    try {
      const dados = await requisicao(`/servicos/${servicoId}/fotos`);
      const fotos = Array.isArray(dados.fotos) ? dados.fotos : [];

      box.replaceChildren();

      if (!fotos.length) {
        return;
      }

      box.appendChild(
        criarElemento("strong", "", "Trabalhos realizados")
      );

      const grid = criarElemento("div", "galeria-publica-grid");

      fotos.slice(0, 4).forEach((foto) => {
        const fotoUrl = obterUrlSegura(foto.foto_url);

        if (!fotoUrl) {
          return;
        }

        const imagem = document.createElement("img");

        imagem.src = fotoUrl;
        imagem.alt = "Trabalho realizado neste serviço";
        imagem.className = "foto-publica-servico";
        imagem.loading = "lazy";
        imagem.decoding = "async";
        imagem.dataset.lightboxSrc = fotoUrl;

        grid.appendChild(imagem);
      });

      if (grid.children.length) {
        box.appendChild(grid);
      }
    } catch (erro) {
      console.warn(
        "Não foi possível carregar a galeria pública:",
        erro
      );

      box.replaceChildren();
    }
  }

  function criarFotoProfissional(profissional) {
    const fotoUrl = obterUrlSegura(profissional.foto_url);

    if (!fotoUrl) {
      return criarElemento(
        "div",
        "profissional-foto avatar-iniciais",
        obterIniciais(profissional.nome, "P")
      );
    }

    const imagem = document.createElement("img");

    imagem.className = "profissional-foto";
    imagem.src = fotoUrl;
    imagem.alt = profissional.nome || "Profissional";
    imagem.loading = "lazy";

    imagem.addEventListener(
      "error",
      () => {
        imagem.replaceWith(
          criarElemento(
            "div",
            "profissional-foto avatar-iniciais",
            obterIniciais(profissional.nome, "P")
          )
        );
      },
      { once: true }
    );

    return imagem;
  }

  async function selecionarProfissional(profissional, card) {
    estado.profissionalSelecionado = profissional;
    estado.horarioSelecionado = null;

    elementos.listaProfissionais
      ?.querySelectorAll(".item-selecao")
      .forEach((item) => item.classList.remove("ativo"));

    card.classList.add("ativo");

    atualizarResumo();
    await carregarHorariosDisponiveis();
  }

  function criarCardProfissional(profissional) {
    const card = criarElemento(
      "article",
      "item-selecao profissional-card"
    );

    card.dataset.id = String(profissional.id);
    card.tabIndex = 0;
    card.setAttribute("role", "button");

    card.setAttribute(
      "aria-label",
      `Selecionar ${profissional.nome || "profissional"}`
    );

    const info = criarElemento("div", "profissional-info");

    info.append(
      criarElemento(
        "strong",
        "",
        profissional.nome || "Profissional"
      ),
      criarElemento(
        "span",
        "",
        "Ver horários disponíveis"
      )
    );

    card.append(
      criarFotoProfissional(profissional),
      info
    );

    card.addEventListener("click", () => {
      void selecionarProfissional(profissional, card);
    });

    card.addEventListener("keydown", (evento) => {
      if (evento.key !== "Enter" && evento.key !== " ") {
        return;
      }

      evento.preventDefault();
      void selecionarProfissional(profissional, card);
    });

    return card;
  }

  function renderizarProfissionais(profissionais) {
    estado.profissionais = Array.isArray(profissionais)
      ? profissionais
      : [];

    if (!elementos.listaProfissionais) {
      return;
    }

    elementos.listaProfissionais.replaceChildren();

    if (!estado.profissionais.length) {
      elementos.listaProfissionais.appendChild(
        criarEstadoVazio("Nenhum profissional disponível.")
      );

      return;
    }

    const fragmento = document.createDocumentFragment();

    estado.profissionais.forEach((profissional) => {
      fragmento.appendChild(
        criarCardProfissional(profissional)
      );
    });

    elementos.listaProfissionais.appendChild(fragmento);
  }

  function renderizarHorariosDoDia(
    dia,
    container,
    listaDias
  ) {
    estado.horarioSelecionado = null;
    atualizarResumo();

    container.replaceChildren();

    container.appendChild(
      criarElemento("h4", "", formatarDia(dia.data))
    );

    const wrap = criarElemento("div", "horarios-wrap");
    const horarios = Array.isArray(dia.horarios)
      ? dia.horarios
      : [];

    if (!horarios.length) {
      wrap.appendChild(
        criarEstadoVazio(
          "Nenhum horário disponível neste dia."
        )
      );
    } else {
      horarios.forEach((hora) => {
        const botao = criarElemento(
          "button",
          "horario-btn",
          hora
        );

        botao.type = "button";

        botao.addEventListener("click", () => {
          estado.horarioSelecionado = {
            data: dia.data,
            hora,
          };

          container
            .querySelectorAll(".horario-btn")
            .forEach((item) => {
              item.classList.remove("ativo");
            });

          botao.classList.add("ativo");
          atualizarResumo();
        });

        wrap.appendChild(botao);
      });
    }

    container.appendChild(wrap);

    listaDias
      .querySelectorAll(".dia-btn")
      .forEach((item) => {
        item.setAttribute(
          "aria-pressed",
          String(item.classList.contains("ativo"))
        );
      });
  }

  async function carregarHorariosDisponiveis() {
    if (
      !estado.servicoSelecionado ||
      !estado.profissionalSelecionado ||
      !elementos.listaHorarios
    ) {
      return;
    }

    elementos.listaHorarios.replaceChildren(
      criarEstadoCarregando("Carregando horários...")
    );

    elementos.listaHorarios.setAttribute(
      "aria-busy",
      "true"
    );

    try {
      const query = new URLSearchParams({
        slug: estado.slug,
        servicoId: String(
          estado.servicoSelecionado.id
        ),
        profissionalId: String(
          estado.profissionalSelecionado.id
        ),
      });

      const dados = await requisicao(
        `/agenda-publica?${query.toString()}`
      );

      const disponibilidade = Array.isArray(
        dados.disponibilidade
      )
        ? dados.disponibilidade
        : [];

      elementos.listaHorarios.replaceChildren();

      if (!disponibilidade.length) {
        elementos.listaHorarios.appendChild(
          criarEstadoVazio("Nenhum horário disponível.")
        );

        return;
      }

      const listaDias = criarElemento(
        "div",
        "dias-grid"
      );

      listaDias.id = "listaDiasDisponiveis";

      const horariosDia = criarElemento(
        "div",
        "horarios-dia-box"
      );

      horariosDia.id = "horariosDoDia";

      elementos.listaHorarios.append(
        listaDias,
        horariosDia
      );

      disponibilidade.forEach((dia, indice) => {
        const botao = criarElemento(
          "button",
          "dia-btn",
          formatarDia(dia.data)
        );

        botao.type = "button";
        botao.setAttribute("aria-pressed", "false");

        botao.addEventListener("click", () => {
          listaDias
            .querySelectorAll(".dia-btn")
            .forEach((item) => {
              item.classList.remove("ativo");
            });

          botao.classList.add("ativo");

          renderizarHorariosDoDia(
            dia,
            horariosDia,
            listaDias
          );
        });

        listaDias.appendChild(botao);

        if (indice === 0) {
          botao.classList.add("ativo");

          renderizarHorariosDoDia(
            dia,
            horariosDia,
            listaDias
          );
        }
      });
    } catch (erro) {
      console.error(
        "Erro ao carregar horários:",
        erro
      );

      elementos.listaHorarios.replaceChildren(
        criarEstadoVazio(
          erro.message ||
            "Não foi possível carregar os horários."
        )
      );
    } finally {
      elementos.listaHorarios.setAttribute(
        "aria-busy",
        "false"
      );
    }
  }

    function abrirModal(titulo, tipo, html) {
    if (
      !elementos.modal ||
      !elementos.modalTitulo ||
      !elementos.modalConteudo
    ) {
      return;
    }

    estado.tipoModal = tipo;
    elementos.modalTitulo.textContent = titulo;
    elementos.modalConteudo.innerHTML = html;
    elementos.modal.classList.remove("hidden");

    document.body.style.overflow = "hidden";

    window.setTimeout(() => {
      elementos.modalConteudo
        .querySelector("input, textarea, select")
        ?.focus();
    }, 0);
  }

  function fecharModal() {
    estado.tipoModal = null;

    elementos.modal?.classList.add("hidden");

    if (elementos.modalConteudo) {
      elementos.modalConteudo.replaceChildren();
    }

    document.body.style.removeProperty("overflow");
  }

  function abrirEdicaoCampo(campo) {
    if (!ehDonoDoPerfil() || !estado.negocio) {
      return;
    }

    const negocio = estado.negocio;

    const modais = {
      foto: {
        titulo: "Alterar foto",
        tipo: "foto",
        html: `
          <label for="inputFotoNegocio">
            Nova foto do negócio
          </label>

          <input
            id="inputFotoNegocio"
            class="af-input"
            type="file"
            accept="image/*"
          >
        `,
      },

      nome: {
        titulo: "Editar nome",
        tipo: "negocio",
        html: `
          <label for="inputNome">
            Nome do negócio
          </label>

          <input
            id="inputNome"
            class="af-input"
            value="${escaparHtml(negocio.nome)}"
          >
        `,
      },

      bio: {
        titulo: "Editar descrição",
        tipo: "negocio",
        html: `
          <label for="inputDescricao">
            Descrição do negócio
          </label>

          <textarea
            id="inputDescricao"
            class="af-input"
            placeholder="Conte aos clientes sobre seu negócio"
          >${escaparHtml(negocio.descricao)}</textarea>
        `,
      },

      local: {
        titulo: "Editar localização",
        tipo: "negocio",
        html: `
          <label for="inputCidade">
            Cidade
          </label>

          <input
            id="inputCidade"
            class="af-input"
            value="${escaparHtml(negocio.cidade)}"
          >

          <label for="inputBairro">
            Bairro
          </label>

          <input
            id="inputBairro"
            class="af-input"
            value="${escaparHtml(negocio.bairro)}"
          >
        `,
      },

      whatsapp: {
        titulo: "Editar WhatsApp",
        tipo: "negocio",
        html: `
          <label for="inputWhatsapp">
            WhatsApp com DDD
          </label>

          <input
            id="inputWhatsapp"
            class="af-input"
            inputmode="tel"
            value="${escaparHtml(negocio.whatsapp_negocio)}"
            placeholder="Ex.: 62999999999"
          >
        `,
      },

      maps: {
        titulo: "Editar localização no Maps",
        tipo: "negocio",
        html: `
          <label for="inputMaps">
            Link do Google Maps
          </label>

          <input
            id="inputMaps"
            class="af-input"
            type="url"
            value="${escaparHtml(negocio.localizacao_url)}"
            placeholder="https://maps.google.com/..."
          >
        `,
      },
    };

    if (campo === "areas") {
      const atuais = Array.isArray(negocio.areas)
        ? negocio.areas
        : [];

      const opcoes = [
        "Unha",
        "Sobrancelha",
        "Cílios",
        "Cabelo",
        "Maquiagem",
        "Bronze",
        "Depilação",
        "Estética",
        "Massagem",
      ];

      abrirModal(
        "Editar áreas atendidas",
        "negocio",
        `
          <div class="areas-opcoes-modal">
            ${opcoes
              .map(
                (area) => `
                  <label class="area-opcao">
                    <input
                      type="checkbox"
                      name="areasNegocio"
                      value="${escaparHtml(area)}"
                      ${atuais.includes(area) ? "checked" : ""}
                    >

                    <span>
                      ${escaparHtml(area)}
                    </span>
                  </label>
                `
              )
              .join("")}
          </div>
        `
      );

      return;
    }

    const configuracao = modais[campo];

    if (configuracao) {
      abrirModal(
        configuracao.titulo,
        configuracao.tipo,
        configuracao.html
      );
    }
  }

  function abrirNovoServico() {
    abrirModal(
      "Novo serviço",
      "novo-servico",
      `
        <label for="inputServicoNome">
          Nome do serviço
        </label>

        <input
          id="inputServicoNome"
          class="af-input"
          placeholder="Ex.: Alongamento em gel"
        >

        <label for="inputServicoValor">
          Valor
        </label>

        <input
          id="inputServicoValor"
          class="af-input"
          type="number"
          min="0"
          step="0.01"
          placeholder="0,00"
        >

        <label for="inputServicoDuracao">
          Duração em minutos
        </label>

        <input
          id="inputServicoDuracao"
          class="af-input"
          type="number"
          min="1"
          placeholder="60"
        >

        <label for="inputServicoFoto">
          Foto de capa
        </label>

        <input
          id="inputServicoFoto"
          class="af-input"
          type="file"
          accept="image/*"
        >
      `
    );
  }

  function abrirNovoProfissional() {
    abrirModal(
      "Adicionar profissional",
      "novo-profissional",
      `
        <label for="inputProfissionalBusca">
          E-mail ou WhatsApp
        </label>

        <input
          id="inputProfissionalBusca"
          class="af-input"
          placeholder="Digite o e-mail ou WhatsApp do profissional"
        >

        <p class="af-help">
          O profissional precisa possuir uma conta cadastrada
          no Agenda Fashion.
        </p>
      `
    );
  }

  function abrirEditarServico(servico) {
    abrirModal(
      "Editar serviço",
      "editar-servico",
      `
        <input
          id="inputServicoId"
          type="hidden"
          value="${escaparHtml(servico.id)}"
        >

        <label for="inputServicoNome">
          Nome do serviço
        </label>

        <input
          id="inputServicoNome"
          class="af-input"
          value="${escaparHtml(servico.nome)}"
        >

        <label for="inputServicoValor">
          Valor
        </label>

        <input
          id="inputServicoValor"
          class="af-input"
          type="number"
          min="0"
          step="0.01"
          value="${escaparHtml(servico.valor || 0)}"
        >

        <label for="inputServicoDuracao">
          Duração em minutos
        </label>

        <input
          id="inputServicoDuracao"
          class="af-input"
          type="number"
          min="1"
          value="${escaparHtml(
            servico.duracao_minutos || 0
          )}"
        >

        <hr>

        <h3>
          Galeria do serviço
        </h3>

        <label for="inputGaleriaServico">
          Adicionar novas fotos
        </label>

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

    window.setTimeout(() => {
      void carregarGaleriaServico(servico.id);
    }, 0);
  }

  function valorCampo(id, fallback = "") {
    const elemento = document.getElementById(id);

    if (!elemento) {
      return fallback;
    }

    return String(elemento.value || "").trim();
  }

  async function salvarNegocio() {
    const negocio = estado.negocio;

    if (!negocio) {
      throw new Error("Negócio não carregado.");
    }

    const checkboxes = Array.from(
      document.querySelectorAll(
        'input[name="areasNegocio"]'
      )
    );

    const areas = checkboxes.length
      ? checkboxes
          .filter((input) => input.checked)
          .map((input) => input.value)
      : negocio.areas || [];

    const payload = {
      nome: valorCampo(
        "inputNome",
        negocio.nome
      ),

      descricao: valorCampo(
        "inputDescricao",
        negocio.descricao
      ),

      cidade: valorCampo(
        "inputCidade",
        negocio.cidade
      ),

      bairro: valorCampo(
        "inputBairro",
        negocio.bairro
      ),

      whatsapp_negocio: valorCampo(
        "inputWhatsapp",
        negocio.whatsapp_negocio
      ),

      localizacao_url: valorCampo(
        "inputMaps",
        negocio.localizacao_url
      ),

      setor: negocio.setor || "",
      areas,
    };

    if (!payload.nome) {
      throw new Error(
        "Informe o nome do negócio."
      );
    }

    const dados = await requisicao(
      "/configuracoes",
      {
        method: "PUT",
        autenticado: true,
        body: payload,
      }
    );

    estado.negocio = {
      ...estado.negocio,
      ...(dados.negocio || payload),
    };

    estado.negocioLocal = {
      ...estado.negocioLocal,
      ...(dados.negocio || {}),
    };

    localStorage.setItem(
      "negocio",
      JSON.stringify(
        estado.negocioLocal
      )
    );
  }

  async function salvarFoto() {
    const arquivo =
      document.getElementById(
        "inputFotoNegocio"
      )?.files?.[0];

    if (!arquivo) {
      throw new Error(
        "Escolha uma imagem."
      );
    }

    const formData =
      new FormData();

    formData.append(
      "foto",
      arquivo
    );

    const dados = await requisicao(
      "/api/negocios/foto",
      {
        method: "POST",
        autenticado: true,
        body: formData,
      }
    );

    estado.negocio.foto_url =
      dados.foto ||
      dados.foto_url;
  }

  async function salvarServico() {
    const nome = valorCampo(
      "inputServicoNome"
    );

    const valor = Number(
      valorCampo(
        "inputServicoValor",
        "0"
      )
    );

    const duracao = Number(
      valorCampo(
        "inputServicoDuracao",
        "0"
      )
    );

    if (!nome) {
      throw new Error(
        "Informe o nome do serviço."
      );
    }

    if (
      !Number.isFinite(valor) ||
      valor < 0
    ) {
      throw new Error(
        "Informe um valor válido."
      );
    }

    if (
      !Number.isInteger(duracao) ||
      duracao <= 0
    ) {
      throw new Error(
        "Informe uma duração válida."
      );
    }

    const dados = await requisicao(
      "/servicos",
      {
        method: "POST",
        autenticado: true,

        body: {
          nome,
          valor,
          duracao_minutos: duracao,
        },
      }
    );

    const servicoId =
      dados.servico?.id;

    const foto =
      document.getElementById(
        "inputServicoFoto"
      )?.files?.[0];

    if (foto && servicoId) {
      const formData =
        new FormData();

      formData.append(
        "foto",
        foto
      );

      await requisicao(
        `/servicos/${servicoId}/foto`,
        {
          method: "POST",
          autenticado: true,
          body: formData,
        }
      );
    }
  }

  async function salvarProfissional() {
    const emailOuWhatsapp =
      valorCampo(
        "inputProfissionalBusca"
      );

    if (!emailOuWhatsapp) {
      throw new Error(
        "Digite o e-mail ou WhatsApp do profissional."
      );
    }

    await requisicao(
      "/profissionais/vincular",
      {
        method: "POST",
        autenticado: true,
        body: {
          emailOuWhatsapp,
        },
      }
    );
  }

  async function atualizarServico() {
    const id = valorCampo(
      "inputServicoId"
    );

    const nome = valorCampo(
      "inputServicoNome"
    );

    const valor = Number(
      valorCampo(
        "inputServicoValor",
        "0"
      )
    );

    const duracao = Number(
      valorCampo(
        "inputServicoDuracao",
        "0"
      )
    );

    if (!id) {
      throw new Error(
        "Serviço inválido."
      );
    }

    if (!nome) {
      throw new Error(
        "Informe o nome do serviço."
      );
    }

    if (
      !Number.isFinite(valor) ||
      valor < 0
    ) {
      throw new Error(
        "Informe um valor válido."
      );
    }

    if (
      !Number.isInteger(duracao) ||
      duracao <= 0
    ) {
      throw new Error(
        "Informe uma duração válida."
      );
    }

    await requisicao(
      `/servicos/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        autenticado: true,

        body: {
          nome,
          valor,
          duracao_minutos: duracao,
        },
      }
    );

    await enviarFotosGaleria(id);
  }

  async function removerServico(id) {
    if (
      !window.confirm(
        "Remover este serviço?"
      )
    ) {
      return;
    }

    await requisicao(
      `/servicos/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        autenticado: true,
      }
    );

    await carregarPerfil();

    mostrarMensagem(
      "Serviço removido com sucesso.",
      "sucesso"
    );
  }

  async function carregarGaleriaServico(
    servicoId
  ) {
    const galeria =
      document.getElementById(
        "galeriaServicoPreview"
      );

    if (!galeria) {
      return;
    }

    try {
      const dados =
        await requisicao(
          `/servicos/${servicoId}/fotos`
        );

      const fotos =
        Array.isArray(dados.fotos)
          ? dados.fotos
          : [];

      galeria.replaceChildren();

      if (!fotos.length) {
        galeria.appendChild(
          criarEstadoVazio(
            "Nenhuma foto cadastrada."
          )
        );

        return;
      }

      fotos.forEach((foto) => {
        const fotoUrl =
          obterUrlSegura(
            foto.foto_url
          );

        if (!fotoUrl) {
          return;
        }

        const item =
          criarElemento(
            "div",
            "foto-galeria-item"
          );

        const imagem =
          document.createElement(
            "img"
          );

        const remover =
          criarElemento(
            "button",
            "btn-remover-foto",
            "✕"
          );

        imagem.src = fotoUrl;

        imagem.alt =
          "Foto da galeria do serviço";

        imagem.loading =
          "lazy";

        remover.type =
          "button";

        remover.dataset.fotoId =
          String(foto.id);

        remover.dataset.servicoId =
          String(servicoId);

        remover.setAttribute(
          "aria-label",
          "Remover foto da galeria"
        );

        item.append(
          imagem,
          remover
        );

        galeria.appendChild(
          item
        );
      });
    } catch (erro) {
      console.error(
        "Erro ao carregar galeria:",
        erro
      );

      galeria.replaceChildren(
        criarEstadoVazio(
          "Não foi possível carregar a galeria."
        )
      );
    }
  }

  async function enviarFotosGaleria(
    servicoId
  ) {
    const arquivos = Array.from(
      document.getElementById(
        "inputGaleriaServico"
      )?.files || []
    );

    for (const foto of arquivos) {
      const formData =
        new FormData();

      formData.append(
        "foto",
        foto
      );

      await requisicao(
        `/servicos/${servicoId}/fotos`,
        {
          method: "POST",
          autenticado: true,
          body: formData,
        }
      );
    }
  }

  async function removerFotoGaleria(
    fotoId,
    servicoId
  ) {
    if (
      !window.confirm(
        "Remover esta foto da galeria?"
      )
    ) {
      return;
    }

    await requisicao(
      `/servicos/fotos/${encodeURIComponent(
        fotoId
      )}`,
      {
        method: "DELETE",
        autenticado: true,
      }
    );

    mostrarMensagem(
      "Foto removida com sucesso.",
      "sucesso"
    );

    await carregarGaleriaServico(
      servicoId
    );
  }

  function atualizarBotaoFavorito(
    favoritado
  ) {
    if (!elementos.btnFavorito) {
      return;
    }

    elementos.btnFavorito
      .classList.toggle(
        "ativo",
        favoritado
      );

    elementos.btnFavorito.textContent =
      favoritado
        ? "❤️ Favorito"
        : "♡ Favoritar";

    elementos.btnFavorito.setAttribute(
      "aria-pressed",
      String(favoritado)
    );
  }

  async function carregarFavorito() {
    if (
      !elementos.btnFavorito ||
      !estado.negocio?.id
    ) {
      return;
    }

    if (ehDonoDoPerfil()) {
      elementos.btnFavorito
        .classList.add("hidden");

      return;
    }

    elementos.btnFavorito
      .classList.remove("hidden");

    atualizarBotaoFavorito(false);

    if (!obterTokenAtual()) {
      return;
    }

    elementos.btnFavorito.disabled =
      true;

    try {
      const dados =
        await requisicao(
          `/favoritos/${encodeURIComponent(
            estado.negocio.id
          )}/status`,
          {
            autenticado: true,
          }
        );

      atualizarBotaoFavorito(
        Boolean(dados.favoritado)
      );
    } catch (erro) {
      if (
        [401, 403].includes(
          erro.status
        )
      ) {
        limparSessao();
      } else {
        console.warn(
          "Não foi possível verificar o favorito:",
          erro
        );
      }

      atualizarBotaoFavorito(false);
    } finally {
      elementos.btnFavorito.disabled =
        false;
    }
  }

  async function alternarFavorito() {
    if (
      !estado.negocio?.id ||
      !elementos.btnFavorito
    ) {
      throw new Error(
        "Negócio inválido."
      );
    }

    if (ehDonoDoPerfil()) {
      mostrarMensagem(
        "Você não pode favoritar seu próprio negócio.",
        "aviso"
      );

      return;
    }

    if (!obterTokenAtual()) {
      mostrarMensagem(
        "Entre na sua conta para favoritar.",
        "aviso"
      );

      window.setTimeout(() => {
        window.location.href =
          "/html/login-cliente.html";
      }, 700);

      return;
    }

    const jaFavoritado =
      elementos.btnFavorito
        .classList.contains(
          "ativo"
        );

    elementos.btnFavorito.disabled =
      true;

    try {
      const dados =
        await requisicao(
          `/favoritos/${encodeURIComponent(
            estado.negocio.id
          )}`,
          {
            method:
              jaFavoritado
                ? "DELETE"
                : "POST",

            autenticado: true,

            body:
              jaFavoritado
                ? undefined
                : {},
          }
        );

      const favoritado =
        typeof dados.favoritado ===
        "boolean"
          ? dados.favoritado
          : !jaFavoritado;

      atualizarBotaoFavorito(
        favoritado
      );

      mostrarMensagem(
        dados.mensagem ||
          (
            favoritado
              ? "Adicionado aos favoritos ❤️"
              : "Removido dos favoritos."
          ),
        "sucesso"
      );
    } catch (erro) {
      if (
        [401, 403].includes(
          erro.status
        )
      ) {
        limparSessao();

        window.location.href =
          "/html/login-cliente.html";

        return;
      }

      throw erro;
    } finally {
      elementos.btnFavorito.disabled =
        false;
    }
  }

  async function copiarTexto(texto) {
    if (
      navigator.clipboard
        ?.writeText &&
      window.isSecureContext
    ) {
      await navigator.clipboard
        .writeText(texto);

      return;
    }

    const area =
      document.createElement(
        "textarea"
      );

    area.value = texto;

    area.style.position =
      "fixed";

    area.style.opacity =
      "0";

    document.body.appendChild(
      area
    );

    area.select();

    const copiou =
      document.execCommand(
        "copy"
      );

    area.remove();

    if (!copiou) {
      throw new Error(
        "Não foi possível copiar."
      );
    }
  }

  async function copiarLinkPerfil() {
    const link =
      `${window.location.origin}` +
      `/html/perfil-negocio.html?slug=` +
      encodeURIComponent(
        estado.slug
      );

    await copiarTexto(link);

    if (elementos.btnCopiarAgenda) {
      const textoOriginal =
        elementos.btnCopiarAgenda
          .textContent;

      elementos.btnCopiarAgenda
        .textContent =
        "✅ Link copiado";

      window.setTimeout(() => {
        elementos.btnCopiarAgenda
          .textContent =
          textoOriginal;
      }, 1800);
    }

    mostrarMensagem(
      "Link copiado com sucesso.",
      "sucesso"
    );
  }

  function abrirModalConfirmacao(
    tipo,
    usuario = null
  ) {
    const horario =
      estado.horarioSelecionado;

    abrirModal(
      "Confirmar agendamento",
      tipo,
      `
        <div class="resumo-modal">
          <strong>
            ${escaparHtml(
              estado
                .servicoSelecionado
                .nome
            )}
          </strong>
          <br>

          ${escaparHtml(
            formatarDataResumo(
              horario.data
            )
          )}

          às ${escaparHtml(
            horario.hora
          )}
          <br>

          Profissional:
          ${escaparHtml(
            estado
              .profissionalSelecionado
              .nome
          )}
        </div>

        <label for="inputClienteNome">
          Seu nome
        </label>

        <input
          id="inputClienteNome"
          class="af-input"
          value="${escaparHtml(
            usuario?.nome
          )}"
          placeholder="Digite seu nome"
          autocomplete="name"
        >

        <label for="inputClienteWhatsapp">
          Seu WhatsApp
        </label>

        <input
          id="inputClienteWhatsapp"
          class="af-input"
          inputmode="tel"
          value="${escaparHtml(
            usuario?.whatsapp
          )}"
          placeholder="Ex.: 62999999999"
          autocomplete="tel"
        >
      `
    );
  }

    function validarDadosAgendamento(
    nome,
    whatsapp
  ) {
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
      !estado.servicoSelecionado ||
      !estado.profissionalSelecionado ||
      !estado.horarioSelecionado
    ) {
      throw new Error(
        "Os dados do agendamento estão incompletos."
      );
    }

    return {
      nome:
        nomeNormalizado,

      whatsapp:
        whatsappNormalizado,
    };
  }

  function definirBotaoConfirmando(
    confirmando
  ) {
    if (!elementos.btnContinuar) {
      return;
    }

    elementos.btnContinuar.disabled =
      confirmando;

    elementos.btnContinuar.textContent =
      confirmando
        ? "Confirmando..."
        : "Confirmar agendamento";

    if (!confirmando) {
      atualizarResumo();
    }
  }

  function resetarFluxoAgendamento() {
    estado.servicoSelecionado =
      null;

    estado.profissionalSelecionado =
      null;

    estado.horarioSelecionado =
      null;

    elementos.listaServicos
      ?.querySelectorAll(
        ".item-selecao"
      )
      .forEach(
        (item) => {
          item.classList.remove(
            "ativo"
          );
        }
      );

    elementos.listaProfissionais
      ?.querySelectorAll(
        ".item-selecao"
      )
      .forEach(
        (item) => {
          item.classList.remove(
            "ativo"
          );
        }
      );

    elementos
      .boxProfissionaisHorarios
      ?.classList.add(
        "hidden"
      );

    elementos.etapaServico
      ?.classList.add(
        "ativa"
      );

    elementos.etapaHorario
      ?.classList.remove(
        "ativa"
      );

    atualizarResumo();
  }

  async function confirmarAgendamento({
  nome,
  whatsapp,
  autenticado,
}) {
  const cliente = validarDadosAgendamento(
    nome,
    whatsapp
  );

  const slugAgendamento = String(
    estado.slug ||
      new URLSearchParams(
        window.location.search
      ).get("slug") ||
      ""
  ).trim();

  const servicoId =
    estado.servicoSelecionado?.id;

  const profissionalId =
    estado.profissionalSelecionado?.id;

  const dataAgendamento =
    estado.horarioSelecionado?.data;

  const horaAgendamento =
    estado.horarioSelecionado?.hora;

  if (!slugAgendamento) {
    throw new Error(
      "Não foi possível identificar o negócio."
    );
  }

  if (!servicoId) {
    throw new Error(
      "Selecione um serviço."
    );
  }

  if (!profissionalId) {
    throw new Error(
      "Selecione um profissional."
    );
  }

  if (
    !dataAgendamento ||
    !horaAgendamento
  ) {
    throw new Error(
      "Selecione uma data e um horário."
    );
  }

  definirBotaoConfirmando(true);

  try {
    const payload = {
      slug: slugAgendamento,
      servico_id: servicoId,
      profissional_id: profissionalId,
      data: dataAgendamento,
      horario: horaAgendamento,
      cliente_nome: cliente.nome,
      cliente_whatsapp: cliente.whatsapp,
    };

    console.log(
      "ENVIANDO AGENDAMENTO",
      payload
    );

    const dados = await requisicao(
      "/agendamentos",
      {
        method: "POST",
        autenticado: Boolean(autenticado),
        body: payload,
      }
    );

    if (elementos.btnContinuar) {
      elementos.btnContinuar.textContent =
        "Agendado com sucesso ✅";
    }

    mostrarMensagem(
      dados.mensagem ||
        "Agendamento confirmado com sucesso 💅",
      "sucesso"
    );

    fecharModal();

    if (autenticado) {
      window.setTimeout(() => {
        window.location.href =
          "/html/meus-agendamentos.html";
      }, 1200);
    } else {
      window.setTimeout(() => {
        definirBotaoConfirmando(false);
        resetarFluxoAgendamento();

        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }, 1800);
    }

    return dados;
  } catch (erro) {
    definirBotaoConfirmando(false);

    if (erro?.status === 401) {
      limparSessao();

      window.location.href =
        "/html/login-cliente.html";
    }

    throw erro;
  }
}

  async function irParaAgenda() {
    if (
      !estado.servicoSelecionado ||
      !estado.profissionalSelecionado ||
      !estado.horarioSelecionado
    ) {
      mostrarMensagem(
        "Escolha serviço, profissional, data e horário.",
        "aviso"
      );

      return;
    }

    const token =
      obterTokenAtual();

    const usuario =
      obterUsuarioAtual();

    if (!token) {
      abrirModalConfirmacao(
        "confirmar-agendamento-visitante"
      );

      return;
    }

    if (
      usuario?.nome &&
      usuario?.whatsapp
    ) {
      await confirmarAgendamento({
        nome:
          usuario.nome,

        whatsapp:
          usuario.whatsapp,

        autenticado:
          true,
      });

      return;
    }

    abrirModalConfirmacao(
      "confirmar-agendamento-logado",
      usuario
    );
  }

  async function salvarModal() {
    if (
      !elementos.btnSalvarModal
    ) {
      return;
    }

    const textoOriginal =
      elementos.btnSalvarModal
        .textContent;

    elementos.btnSalvarModal
      .disabled =
      true;

    elementos.btnSalvarModal
      .textContent =
      "Salvando...";

    try {
      switch (
        estado.tipoModal
      ) {
        case "foto":
          await salvarFoto();
          break;

        case "negocio":
          await salvarNegocio();
          break;

        case "novo-servico":
          await salvarServico();
          break;

        case "editar-servico":
          await atualizarServico();
          break;

        case "novo-profissional":
          await salvarProfissional();
          break;

        case "confirmar-agendamento-visitante":
          await confirmarAgendamento({
            nome:
              valorCampo(
                "inputClienteNome"
              ),

            whatsapp:
              valorCampo(
                "inputClienteWhatsapp"
              ),

            autenticado:
              false,
          });

          fecharModal();

          return;

        case "confirmar-agendamento-logado":
          await confirmarAgendamento({
            nome:
              valorCampo(
                "inputClienteNome"
              ),

            whatsapp:
              valorCampo(
                "inputClienteWhatsapp"
              ),

            autenticado:
              true,
          });

          fecharModal();

          return;

        default:
          throw new Error(
            "Operação inválida."
          );
      }

      fecharModal();

      await carregarPerfil();

      mostrarMensagem(
        "Alterações salvas com sucesso.",
        "sucesso"
      );
    } catch (erro) {
      mostrarMensagem(
        erro.message ||
          "Erro ao salvar.",
        "erro"
      );
    } finally {
      elementos.btnSalvarModal
        .disabled =
        false;

      elementos.btnSalvarModal
        .textContent =
        textoOriginal;
    }
  }

  function abrirLightbox(
    src
  ) {
    const url =
      obterUrlSegura(
        src
      );

    if (!url) {
      return;
    }

    let lightbox =
      document.getElementById(
        "lightboxGaleria"
      );

    if (!lightbox) {
      lightbox =
        criarElemento(
          "div",
          "lightbox-galeria"
        );

      lightbox.id =
        "lightboxGaleria";

      lightbox.setAttribute(
        "role",
        "dialog"
      );

      lightbox.setAttribute(
        "aria-modal",
        "true"
      );

      lightbox.setAttribute(
        "aria-label",
        "Foto ampliada"
      );

      const fechar =
        criarElemento(
          "button",
          "lightbox-fechar",
          "✕"
        );

      fechar.type =
        "button";

      fechar.setAttribute(
        "aria-label",
        "Fechar foto ampliada"
      );

      const imagem =
        document.createElement(
          "img"
        );

      imagem.id =
        "lightboxImagem";

      imagem.alt =
        "Foto ampliada";

      lightbox.append(
        fechar,
        imagem
      );

      document.body.appendChild(
        lightbox
      );
    }

    const imagem =
      lightbox.querySelector(
        "#lightboxImagem"
      );

    if (imagem) {
      imagem.src =
        url;
    }

    lightbox.classList.add(
      "ativo"
    );

    document.body.style.overflow =
      "hidden";

    lightbox
      .querySelector(
        ".lightbox-fechar"
      )
      ?.focus();
  }

  function fecharLightbox() {
    document
      .getElementById(
        "lightboxGaleria"
      )
      ?.classList.remove(
        "ativo"
      );

    if (
      elementos.modal
        ?.classList.contains(
          "hidden"
        )
    ) {
      document.body.style
        .removeProperty(
          "overflow"
        );
    }
  }

  async function carregarPerfil() {
    if (
      estado.carregandoPerfil
    ) {
      return;
    }

    estado.carregandoPerfil =
      true;

    esconderMensagem();

    elementos.listaServicos
      ?.replaceChildren(
        criarEstadoCarregando(
          "Carregando serviços..."
        )
      );

    try {
      await descobrirSlug();

      if (!estado.slug) {
        throw new Error(
          "Perfil inválido."
        );
      }

      const dados =
        await requisicao(
          `/perfil-negocio/${encodeURIComponent(
            estado.slug
          )}`
        );

      if (!dados.negocio) {
        throw new Error(
          "Negócio não encontrado."
        );
      }

      estado.negocio =
        dados.negocio;

      estado.servicos =
        Array.isArray(
          dados.servicos
        )
          ? dados.servicos
          : [];

      estado.profissionais =
        Array.isArray(
          dados.profissionais
        )
          ? dados.profissionais
          : [];

      preencherNegocio(
        estado.negocio
      );

      ativarModoDono();

      renderizarServicos(
        estado.servicos
      );

      renderizarProfissionais(
        estado.profissionais
      );

      atualizarPerfilCompleto(
        estado.negocio,
        estado.servicos
      );

      resetarFluxoAgendamento();

      await carregarFavorito();
    } catch (erro) {
      console.error(
        "Erro ao carregar perfil:",
        erro
      );

      if (
        elementos.nomeNegocio
      ) {
        elementos.nomeNegocio
          .textContent =
          "Erro ao carregar perfil";
      }

      elementos.listaServicos
        ?.replaceChildren(
          criarEstadoVazio(
            "Não foi possível carregar os serviços."
          )
        );

      mostrarMensagem(
        erro.message ||
          "Erro ao carregar perfil.",
        "erro"
      );
    } finally {
      estado.carregandoPerfil =
        false;
    }
  }

  function configurarEventos() {
    elementos.btnFavorito
      ?.addEventListener(
        "click",
        () => {
          void alternarFavorito()
            .catch(
              (erro) => {
                mostrarMensagem(
                  erro.message ||
                    "Erro ao favoritar.",
                  "erro"
                );
              }
            );
        }
      );

    elementos.btnCopiarAgenda
      ?.addEventListener(
        "click",
        () => {
          void copiarLinkPerfil()
            .catch(
              () => {
                mostrarMensagem(
                  "Não foi possível copiar o link.",
                  "erro"
                );
              }
            );
        }
      );

    if (elementos.btnContinuar) {
  elementos.btnContinuar.addEventListener(
    "click",
    async (evento) => {
      evento.preventDefault();
      evento.stopPropagation();

      esconderMensagem();

      const slugUrl = new URLSearchParams(
        window.location.search
      ).get("slug");

      if (!estado.slug && slugUrl) {
        estado.slug = slugUrl;
      }

      console.log("CONFIRMAR CLICADO", {
        slug: estado.slug,
        servico: estado.servicoSelecionado,
        profissional: estado.profissionalSelecionado,
        horario: estado.horarioSelecionado,
        token: Boolean(obterTokenAtual()),
      });

      try {
        await irParaAgenda();
      } catch (erro) {
        console.error(
          "ERRO AO CONFIRMAR AGENDAMENTO:",
          erro
        );

        mostrarMensagem(
          erro?.message ||
            "Não foi possível confirmar o agendamento.",
          "erro"
        );
      }
    }
  );
}

    elementos.btnFecharModal
      ?.addEventListener(
        "click",
        fecharModal
      );

    elementos.btnCancelarModal
      ?.addEventListener(
        "click",
        fecharModal
      );

    elementos.btnSalvarModal
      ?.addEventListener(
        "click",
        () => {
          void salvarModal();
        }
      );

    elementos.modal
      ?.addEventListener(
        "click",
        (evento) => {
          if (
            evento.target ===
            elementos.modal
          ) {
            fecharModal();
          }
        }
      );

    document.addEventListener(
      "click",
      (evento) => {
        const linkDesabilitado =
          evento.target.closest(
            '[aria-disabled="true"]'
          );

        if (
          linkDesabilitado
        ) {
          evento.preventDefault();
        }

        const foto =
          evento.target.closest(
            "[data-lightbox-src]"
          );

        if (foto) {
          abrirLightbox(
            foto.dataset
              .lightboxSrc
          );

          return;
        }

        if (
          evento.target.closest(
            ".lightbox-fechar"
          ) ||
          evento.target.id ===
            "lightboxGaleria"
        ) {
          fecharLightbox();

          return;
        }

        const editarCampo =
          evento.target.closest(
            "[data-edit]"
          );

        if (editarCampo) {
          abrirEdicaoCampo(
            editarCampo.dataset
              .edit
          );

          return;
        }

        const acao =
          evento.target.closest(
            "[data-action]"
          )?.dataset.action;

        if (
          acao ===
          "novo-servico"
        ) {
          abrirNovoServico();

          return;
        }

        if (
          acao ===
          "novo-profissional"
        ) {
          abrirNovoProfissional();

          return;
        }

        const editarServico =
          evento.target.closest(
            ".btn-editar-servico"
          );

        if (editarServico) {
          const servico =
            estado.servicos.find(
              (item) =>
                Number(item.id) ===
                Number(
                  editarServico
                    .dataset
                    .servicoId
                )
            );

          if (!servico) {
            mostrarMensagem(
              "Serviço não encontrado.",
              "erro"
            );

            return;
          }

          abrirEditarServico(
            servico
          );

          return;
        }

        const removerServicoBotao =
          evento.target.closest(
            ".btn-remover-servico"
          );

        if (
          removerServicoBotao
        ) {
          void removerServico(
            removerServicoBotao
              .dataset
              .servicoId
          ).catch(
            (erro) => {
              mostrarMensagem(
                erro.message ||
                  "Erro ao remover serviço.",
                "erro"
              );
            }
          );

          return;
        }

        const removerFoto =
          evento.target.closest(
            ".btn-remover-foto"
          );

        if (removerFoto) {
          void removerFotoGaleria(
            removerFoto.dataset
              .fotoId,

            removerFoto.dataset
              .servicoId
          ).catch(
            (erro) => {
              mostrarMensagem(
                erro.message ||
                  "Erro ao remover foto.",
                "erro"
              );
            }
          );
        }
      }
    );

    document.addEventListener(
      "keydown",
      (evento) => {
        if (
          evento.key !==
          "Escape"
        ) {
          return;
        }

        if (
          document
            .getElementById(
              "lightboxGaleria"
            )
            ?.classList.contains(
              "ativo"
            )
        ) {
          fecharLightbox();

          return;
        }

        if (
          !elementos.modal
            ?.classList.contains(
              "hidden"
            )
        ) {
          fecharModal();
        }
      }
    );
  }

  async function iniciar() {
    configurarEventos();

    atualizarResumo();

    await carregarPerfil();
  }

  void iniciar();
});