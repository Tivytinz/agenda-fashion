window.AuthService = {
  salvarSessao({ token, usuario, negocio = null }) {
    localStorage.setItem("token", token);
    localStorage.setItem("usuario", JSON.stringify(usuario));

    if (negocio) {
      localStorage.setItem("negocio", JSON.stringify(negocio));
    } else {
      localStorage.removeItem("negocio");
    }
  },

  limparSessao() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("negocio");
  },

  getToken() {
    return localStorage.getItem("token");
  },

  getUsuario() {
    return JSON.parse(localStorage.getItem("usuario") || "null");
  },

  getNegocio() {
    return JSON.parse(localStorage.getItem("negocio") || "null");
  },

  estaLogado() {
    return !!this.getToken() && !!this.getUsuario();
  },

  async login(email, senha) {
    const resultado = await API.post("/login", {
      email: email.trim(),
      senha
    });

    let negocio = null;

    try {
      const dadosNegocio = await API.get("/meu-negocio");

      if (dadosNegocio.temNegocio) {
        negocio = dadosNegocio.negocio;
      }
    } catch (erro) {
      console.warn("Usuário sem negócio ou erro ao buscar negócio:", erro);
    }

    this.salvarSessao({
      token: resultado.token,
      usuario: resultado.usuario,
      negocio
    });

    return {
      usuario: resultado.usuario,
      negocio
    };
  },

  redirecionarUsuario(usuario, negocio) {
    if (usuario?.tipo === "admin") {
      window.location.href = "/html/admin.html";
      return;
    }

    if (usuario?.tipo === "dono" || negocio?.papel === "dono") {
      window.location.href = "/html/dashboard-dono.html";
      return;
    }

    if (
      usuario?.tipo === "funcionario" ||
      usuario?.tipo === "funcionário" ||
      usuario?.tipo === "profissional" ||
      negocio?.papel === "funcionario" ||
      negocio?.papel === "funcionário" ||
      negocio?.papel === "profissional"
    ) {
      window.location.href = "/html/agenda-profissional.html";
      return;
    }

    if (usuario?.tipo === "cliente") {
      window.location.href = "/html/inicio.html";
      return;
    }

    window.location.href = "/html/inicio.html";
  },

  logout() {
    this.limparSessao();
    window.location.href = "/html/login-profissional.html";
  }
};