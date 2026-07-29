(function configurarAuthService(
  window
) {
  const CHAVES = Object.freeze({
    token: "token",
    usuario: "usuario",
    negocio: "negocio",
  });

  function obterApi() {
    if (
      !window.API ||
      typeof window.API.post !==
        "function" ||
      typeof window.API.get !==
        "function"
    ) {
      throw new Error(
        "O serviço da API não está disponível."
      );
    }

    return window.API;
  }

  function normalizarTexto(
    valor
  ) {
    return String(
      valor ?? ""
    ).trim();
  }

  function normalizarEmail(
    valor
  ) {
    return normalizarTexto(
      valor
    ).toLowerCase();
  }

  function normalizarWhatsapp(
    valor
  ) {
    let numeros =
      String(valor ?? "")
        .replace(/\D/g, "");

    if (
      (numeros.length === 12 ||
        numeros.length === 13) &&
      numeros.startsWith("55")
    ) {
      numeros =
        numeros.slice(2);
    }

    return numeros;
  }

  function normalizarPapel(
    valor
  ) {
    const papel =
      normalizarTexto(
        valor
      ).toLowerCase();

    if (
      papel === "dono" ||
      papel === "profissional"
    ) {
      return papel;
    }

    return null;
  }

  function lerJsonSeguro(
    chave
  ) {
    const valor =
      localStorage.getItem(
        chave
      );

    if (!valor) {
      return null;
    }

    try {
      return JSON.parse(
        valor
      );
    } catch (erro) {
      console.warn(
        `Valor inválido no localStorage: ${chave}`
      );

      localStorage.removeItem(
        chave
      );

      return null;
    }
  }

  function validarAutenticacao(
    resultado
  ) {
    if (
      !resultado ||
      !normalizarTexto(
        resultado.token
      ) ||
      !resultado.usuario?.id
    ) {
      throw new Error(
        "A autenticação foi concluída, mas a sessão recebida é inválida."
      );
    }
  }

  function validarContexto(
    contexto
  ) {
    if (
      !contexto ||
      !contexto.usuario?.id
    ) {
      throw new Error(
        "O servidor retornou um contexto de sessão inválido."
      );
    }

    if (
      contexto.negocio &&
      (
        !contexto.negocio.id ||
        !normalizarPapel(
          contexto.negocio.papel
        )
      )
    ) {
      throw new Error(
        "O vínculo retornado para esta conta é inválido."
      );
    }
  }

  function salvarSessao({
    token,
    usuario,
    negocio = null,
  }) {
    const tokenLimpo =
      normalizarTexto(
        token
      );

    if (
      !tokenLimpo ||
      !usuario?.id
    ) {
      throw new Error(
        "Não foi possível salvar uma sessão inválida."
      );
    }

    localStorage.setItem(
      CHAVES.token,
      tokenLimpo
    );

    localStorage.setItem(
      CHAVES.usuario,
      JSON.stringify(
        usuario
      )
    );

    if (negocio?.id) {
      localStorage.setItem(
        CHAVES.negocio,
        JSON.stringify(
          negocio
        )
      );
    } else {
      localStorage.removeItem(
        CHAVES.negocio
      );
    }
  }

  function salvarNegocio(
    negocio
  ) {
    if (!negocio?.id) {
      localStorage.removeItem(
        CHAVES.negocio
      );

      return null;
    }

    localStorage.setItem(
      CHAVES.negocio,
      JSON.stringify(
        negocio
      )
    );

    return negocio;
  }

  function limparSessao() {
    localStorage.removeItem(
      CHAVES.token
    );

    localStorage.removeItem(
      CHAVES.usuario
    );

    localStorage.removeItem(
      CHAVES.negocio
    );
  }

  function getToken() {
    return normalizarTexto(
      localStorage.getItem(
        CHAVES.token
      )
    );
  }

  function getUsuario() {
    return lerJsonSeguro(
      CHAVES.usuario
    );
  }

  function getNegocio() {
    return lerJsonSeguro(
      CHAVES.negocio
    );
  }

  function getContexto() {
    const usuario =
      getUsuario();

    const negocio =
      getNegocio();

    return {
      usuario,
      negocio,

      temNegocio:
        Boolean(
          negocio?.id
        ),

      papel:
        normalizarPapel(
          negocio?.papel
        ),
    };
  }

  function estaLogado() {
    return Boolean(
      getToken() &&
      getUsuario()?.id
    );
  }

  /*
   * Consulta os dados atuais diretamente
   * no banco através de GET /minha-sessao.
   */
  async function carregarMinhaSessao() {
    const token =
      getToken();

    if (!token) {
      const erro =
        new Error(
          "Você precisa entrar na sua conta."
        );

      erro.status = 401;

      throw erro;
    }

    try {
      const contexto =
        await obterApi().get(
          "/minha-sessao"
        );

      validarContexto(
        contexto
      );

      salvarSessao({
        token,

        usuario:
          contexto.usuario,

        negocio:
          contexto.negocio,
      });

      return {
        usuario:
          contexto.usuario,

        temNegocio:
          Boolean(
            contexto.negocio?.id
          ),

        negocio:
          contexto.negocio || null,
      };
    } catch (erro) {
      if (
        erro?.status === 401 ||
        erro?.status === 403
      ) {
        limparSessao();
      }

      throw erro;
    }
  }

  /*
   * Salva primeiro o token recebido pelo
   * login/cadastro e depois consulta
   * o contexto atualizado da conta.
   */
  async function finalizarAutenticacao(
    resultado
  ) {
    validarAutenticacao(
      resultado
    );

    salvarSessao({
      token:
        resultado.token,

      usuario:
        resultado.usuario,

      negocio:
        null,
    });

    const contexto =
      await carregarMinhaSessao();

    return {
      mensagem:
        resultado.mensagem,

      token:
        getToken(),

      usuario:
        contexto.usuario,

      temNegocio:
        contexto.temNegocio,

      negocio:
        contexto.negocio,
    };
  }

  async function cadastro({
    nome,
    email,
    whatsapp,
    senha,
  }) {
    const resultado =
      await obterApi().post(
        "/cadastro",
        {
          nome:
            normalizarTexto(
              nome
            ),

          email:
            normalizarEmail(
              email
            ),

          whatsapp:
            normalizarWhatsapp(
              whatsapp
            ),

          senha:
            String(
              senha ?? ""
            ),
        }
      );

    return finalizarAutenticacao(
      resultado
    );
  }

  async function login(
    email,
    senha
  ) {
    const emailLimpo =
      normalizarEmail(
        email
      );

    const senhaTexto =
      String(
        senha ?? ""
      );

    if (
      !emailLimpo ||
      !senhaTexto
    ) {
      throw new Error(
        "Email e senha são obrigatórios."
      );
    }

    const resultado =
      await obterApi().post(
        "/login",
        {
          email:
            emailLimpo,

          senha:
            senhaTexto,
        }
      );

    return finalizarAutenticacao(
      resultado
    );
  }

  async function loginGoogle(
    credential
  ) {
    const credencial =
      normalizarTexto(
        credential
      );

    if (!credencial) {
      throw new Error(
        "A credencial do Google é obrigatória."
      );
    }

    const resultado =
      await obterApi().post(
        "/auth/google",
        { credential: credencial }
      );

    return finalizarAutenticacao(
      resultado
    );
  }

  function obterDestino({
    usuario =
      getUsuario(),

    negocio =
      getNegocio(),

    destinoSemNegocio =
      "/html/inicio.html",

    destinoDono =
      "/html/dashboard-dono.html",

    destinoProfissional =
      "/html/agenda-profissional.html",

    destinoLogin =
      "/html/login-cliente.html",
  } = {}) {
    if (!usuario?.id) {
      return destinoLogin;
    }

    const papel =
      normalizarPapel(
        negocio?.papel
      );

    if (
      negocio?.id &&
      papel === "dono"
    ) {
      return destinoDono;
    }

    if (
      negocio?.id &&
      papel ===
        "profissional"
    ) {
      return destinoProfissional;
    }

    return destinoSemNegocio;
  }

  function redirecionarUsuario(
    opcoes = {}
  ) {
    const destino =
      obterDestino(
        opcoes
      );

    window.location.href =
      destino;

    return destino;
  }

  function exigirLogin(
    destinoLogin =
      "/html/login-cliente.html"
  ) {
    if (estaLogado()) {
      return true;
    }

    limparSessao();

    window.location.href =
      destinoLogin;

    return false;
  }

  function logout(
    destino =
      "/html/login-cliente.html"
  ) {
    limparSessao();

    window.location.href =
      destino;
  }

  window.AuthService =
    Object.freeze({
      salvarSessao,
      salvarNegocio,
      limparSessao,
      getToken,
      getUsuario,
      getNegocio,
      getContexto,
      estaLogado,
      carregarMinhaSessao,
      cadastro,
      login,
      loginGoogle,
      obterDestino,
      redirecionarUsuario,
      exigirLogin,
      logout,
    });
})(window);