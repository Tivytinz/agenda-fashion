document.addEventListener("DOMContentLoaded", () => {

  const usuario = JSON.parse(
    localStorage.getItem("usuario") || "null"
  );

  const negocio = JSON.parse(
    localStorage.getItem("negocio") || "null"
  );

  const ehDono =
    usuario?.tipo === "dono" ||
    negocio?.papel === "dono";

  if (!usuario || !ehDono) {
    window.location.href = "login-profissional.html";
    return;
  }

  const nomeUsuario =
    document.getElementById("nomeUsuario");

  const emailUsuario =
    document.getElementById("emailUsuario");

  const btnSair =
    document.getElementById("btnSair");

  const btnAlterarSenha =
    document.getElementById("btnAlterarSenha");

  if (nomeUsuario) {
    nomeUsuario.textContent =
      usuario.nome || "Usuário";
  }

  if (emailUsuario) {
    emailUsuario.textContent =
      usuario.email || "E-mail não informado";
  }

  btnAlterarSenha?.addEventListener("click", () => {
    window.location.href = "minha-conta.html";
  });

  btnSair?.addEventListener("click", () => {

    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("negocio");

    window.location.href = "inicio.html";
  });

});