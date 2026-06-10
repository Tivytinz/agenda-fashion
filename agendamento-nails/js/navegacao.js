document.addEventListener("DOMContentLoaded", () => {
  const nav = document.getElementById("appNav");
  if (!nav) return;

  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");
  const negocio = JSON.parse(localStorage.getItem("negocio") || "null");

  function page(nome) {
    return `/html/${nome}`;
  }

  function ativarPaginaAtual() {
    const paginaAtual = window.location.pathname.split("/").pop();

    nav.querySelectorAll("a").forEach((link) => {
      const href = (link.getAttribute("href") || "").split("?")[0];
      const hrefPagina = href.split("/").pop();

      if (hrefPagina === paginaAtual) {
        link.classList.add("ativo");
      }
    });
  }

  function render(itens) {
    nav.innerHTML = itens
      .map((item) => `
        <a href="${item.href}" class="nav-item">
          <span>${item.icone}</span>
          <small>${item.texto}</small>
        </a>
      `)
      .join("");

    ativarPaginaAtual();
  }

  if (!usuario) {
    render([
      { href: page("inicio.html"), icone: "🏠", texto: "Início" },
      { href: page("login-cliente.html"), icone: "👤", texto: "Entrar" }
    ]);
    return;
  }

  const tipo = usuario.tipo;

  const ehDono =
    tipo === "dono" ||
    negocio?.papel === "dono" ||
    usuario?.eh_dono === true ||
    usuario?.dono === true ||
    usuario?.is_dono === true;

  const ehFuncionario =
    tipo === "funcionario" ||
    tipo === "funcionário" ||
    tipo === "profissional" ||
    negocio?.papel === "funcionario" ||
    negocio?.papel === "funcionário" ||
    negocio?.papel === "profissional";

  const perfilHref = negocio?.slug
    ? `${page("perfil-negocio.html")}?slug=${encodeURIComponent(negocio.slug)}`
    : page("perfil-negocio.html");

  if (ehDono) {
    render([
      { href: page("inicio.html"), icone: "🏠", texto: "Início" },
      { href: page("agenda-geral.html"), icone: "📅", texto: "Agenda" },
      { href: page("dashboard-dono.html"), icone: "📊", texto: "Dash" },
      { href: perfilHref, icone: "🏢", texto: "Perfil" },
      { href: page("minha-conta.html"), icone: "⚙️", texto: "Config" }
    ]);
    return;
  }

  if (ehFuncionario) {
    render([
      { href: page("inicio.html"), icone: "🏠", texto: "Início" },
      { href: page("agenda-profissional.html"), icone: "📅", texto: "Agenda" },
      { href: page("perfil-profissional.html"), icone: "👤", texto: "Perfil" },
      { href: page("minha-conta.html"), icone: "⚙️", texto: "Config" }
    ]);
    return;
  }

  if (tipo === "cliente") {
    render([
      { href: page("inicio.html"), icone: "🏠", texto: "Início" },
      { href: page("meus-agendamentos.html"), icone: "📅", texto: "Agend." },
      { href: page("favoritos.html"), icone: "❤️", texto: "Favoritos" },
      { href: page("minha-conta.html"), icone: "⚙️", texto: "Config" }
    ]);
    return;
  }

  render([
    { href: page("inicio.html"), icone: "🏠", texto: "Início" },
    { href: page("login-cliente.html"), icone: "👤", texto: "Entrar" }
  ]);
});