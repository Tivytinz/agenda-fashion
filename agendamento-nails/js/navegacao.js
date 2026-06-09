document.addEventListener("DOMContentLoaded", () => {
  const nav = document.getElementById("appNav");
  if (!nav) return;

  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");
  const negocio = JSON.parse(localStorage.getItem("negocio") || "null");

  function ativarPaginaAtual() {
    const paginaAtual = window.location.pathname.split("/").pop();

    nav.querySelectorAll("a").forEach((link) => {
      const href = (link.getAttribute("href") || "").split("?")[0];

      if (href === paginaAtual) {
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
      { href: "inicio.html", icone: "🏠", texto: "Início" },
      { href: "login-cliente.html", icone: "👤", texto: "Entrar" }
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
    ? `perfil-negocio.html?slug=${encodeURIComponent(negocio.slug)}`
    : "perfil-negocio.html";

  if (ehDono) {
    render([
      { href: "inicio.html", icone: "🏠", texto: "Início" },
      { href: "agenda-geral.html", icone: "📅", texto: "Agenda" },
      { href: "dashboard-dono.html", icone: "📊", texto: "Dash" },
      { href: perfilHref, icone: "🏢", texto: "Perfil" },
      { href: "minha-conta.html", icone: "⚙️", texto: "Config" }
    ]);
    return;
  }

  if (ehFuncionario) {
    render([
      { href: "inicio.html", icone: "🏠", texto: "Início" },
      { href: "agenda-profissional.html", icone: "📅", texto: "Agenda" },
      { href: "perfil-profissional.html", icone: "👤", texto: "Perfil" },
      { href: "minha-conta.html", icone: "⚙️", texto: "Config" }
    ]);
    return;
  }

  if (tipo === "cliente") {
    render([
      { href: "inicio.html", icone: "🏠", texto: "Início" },
      { href: "meus-agendamentos.html", icone: "📅", texto: "Agend." },
      { href: "favoritos.html", icone: "❤️", texto: "Favoritos" },
      { href: "minha-conta.html", icone: "⚙️", texto: "Config" }
    ]);
    return;
  }

  render([
    { href: "inicio.html", icone: "🏠", texto: "Início" },
    { href: "login-cliente.html", icone: "👤", texto: "Entrar" }
  ]);
});