(function configurarSessionGuard(
  window
) {
  function obterAuthService() {
    if (
      !window.AuthService ||
      typeof window.AuthService
        .carregarMinhaSessao !==
        "function"
    ) {
      throw new Error(
        "AuthService não foi carregado."
      );
    }

    return window.AuthService;
  }

  function normalizarPapel(
    valor
  ) {
    const papel =
      String(valor ?? "")
        .trim()
        .toLowerCase();

    if (
      papel === "dono" ||
      papel === "profissional"
    ) {
      return papel;
    }

    return null;
  }

  function redirecionar(
    destino
  ) {
    if (
      window.location.pathname ===
      destino
    ) {
      return;
    }

    window.location.replace(
      destino
    );
  }

  function obterDestinoPorContexto({
    usuario,
    negocio,
  }) {
    if (!usuario?.id) {
      return "/html/login-cliente.html";
    }

    const papel =
      normalizarPapel(
        negocio?.papel
      );

    if (
      negocio?.id &&
      papel === "dono"
    ) {
      return "/html/dashboard-dono.html";
    }

    if (
      negocio?.id &&
      papel === "profissional"
    ) {
      return "/html/agenda-profissional.html";
    }

    return "/html/inicio.html";
  }

  async function carregarContexto() {
    const authService =
      obterAuthService();

    if (
      !authService.estaLogado()
    ) {
      authService.limparSessao();

      const erro =
        new Error(
          "Você precisa entrar na sua conta."
        );

      erro.status = 401;

      throw erro;
    }

    return authService
      .carregarMinhaSessao();
  }

  /*
   * Exige apenas uma conta autenticada.
   *
   * Útil para:
   * - minha conta;
   * - meus agendamentos;
   * - favoritos;
   * - criar negócio.
   */
  async function exigirConta({
    destinoLogin =
      "/html/login-cliente.html",
  } = {}) {
    try {
      return await carregarContexto();
    } catch (erro) {
      if (
        erro?.status === 401 ||
        erro?.status === 403
      ) {
        obterAuthService()
          .limparSessao();

        redirecionar(
          destinoLogin
        );

        return null;
      }

      throw erro;
    }
  }

  /*
   * Exige uma conta sem negócio.
   *
   * Útil para criar-negocio.html.
   * Quem já possui vínculo é enviado
   * ao painel correspondente.
   */
  async function exigirContaSemNegocio({
    destinoLogin =
      "/html/login-profissional.html",
  } = {}) {
    const contexto =
      await exigirConta({
        destinoLogin,
      });

    if (!contexto) {
      return null;
    }

    if (
      contexto.negocio?.id
    ) {
      redirecionar(
        obterDestinoPorContexto(
          contexto
        )
      );

      return null;
    }

    return contexto;
  }

  /*
   * Exige papel de dono.
   */
  async function exigirDono({
    destinoLogin =
      "/html/login-profissional.html",

    destinoSemNegocio =
      "/html/criar-negocio.html",

    destinoSemPermissao =
      "/html/inicio.html",
  } = {}) {
    const contexto =
      await exigirConta({
        destinoLogin,
      });

    if (!contexto) {
      return null;
    }

    if (
      !contexto.negocio?.id
    ) {
      redirecionar(
        destinoSemNegocio
      );

      return null;
    }

    const papel =
      normalizarPapel(
        contexto.negocio.papel
      );

    if (papel !== "dono") {
      redirecionar(
        papel === "profissional"
          ? "/html/agenda-profissional.html"
          : destinoSemPermissao
      );

      return null;
    }

    return contexto;
  }

  /*
   * Exige papel de profissional.
   */
  async function exigirProfissional({
    destinoLogin =
      "/html/login-profissional.html",

    destinoSemNegocio =
      "/html/criar-negocio.html",

    destinoSemPermissao =
      "/html/inicio.html",
  } = {}) {
    const contexto =
      await exigirConta({
        destinoLogin,
      });

    if (!contexto) {
      return null;
    }

    if (
      !contexto.negocio?.id
    ) {
      redirecionar(
        destinoSemNegocio
      );

      return null;
    }

    const papel =
      normalizarPapel(
        contexto.negocio.papel
      );

    if (
      papel !== "profissional"
    ) {
      redirecionar(
        papel === "dono"
          ? "/html/dashboard-dono.html"
          : destinoSemPermissao
      );

      return null;
    }

    return contexto;
  }

  /*
   * Aceita dono ou profissional.
   */
  async function exigirVinculo({
    destinoLogin =
      "/html/login-profissional.html",

    destinoSemNegocio =
      "/html/criar-negocio.html",
  } = {}) {
    const contexto =
      await exigirConta({
        destinoLogin,
      });

    if (!contexto) {
      return null;
    }

    const papel =
      normalizarPapel(
        contexto.negocio?.papel
      );

    if (
      !contexto.negocio?.id ||
      !papel
    ) {
      redirecionar(
        destinoSemNegocio
      );

      return null;
    }

    return contexto;
  }

  window.SessionGuard =
    Object.freeze({
      exigirConta,
      exigirContaSemNegocio,
      exigirDono,
      exigirProfissional,
      exigirVinculo,
      obterDestinoPorContexto,
    });
})(window);