document.addEventListener("DOMContentLoaded", () => {
  const elementos = {
    form: document.getElementById("formLoginProfissional"),
    email: document.getElementById("email"),
    senha: document.getElementById("senha"),
    botao: document.getElementById("btnLoginProfissional"),
    mensagem: document.getElementById("mensagemLogin"),
    toggleSenha: document.getElementById("toggleSenha"),
  };

  const obrigatorios = [
    elementos.form,
    elementos.email,
    elementos.senha,
    elementos.botao,
    elementos.mensagem,
  ];

  if (obrigatorios.some((elemento) => !elemento)) {
    console.error(
      "Elementos obrigatórios do login profissional não foram encontrados."
    );

    return;
  }

  if (
    !window.AuthService ||
    typeof window.AuthService.login !== "function" ||
    typeof window.AuthService.obterDestino !== "function"
  ) {
    console.error("AuthService não foi carregado.");

    mostrarMensagem(
      "O sistema de autenticação não foi carregado. Atualize a página."
    );

    return;
  }

  const CHAVE_EMAIL = "ultimoEmailProfissional";

  let enviando = false;
  let temporizadorRedirecionamento = null;

  function normalizarEmail(valor) {
    return String(valor ?? "")
      .trim()
      .toLowerCase();
  }

  function emailValido(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalizarEmail(valor)
    );
  }

  function limparErroCampo(campo) {
    campo?.removeAttribute("aria-invalid");

    campo?.classList.remove(
      "input-error",
      "shake"
    );
  }

  function limparErros() {
    limparErroCampo(elementos.email);
    limparErroCampo(elementos.senha);
  }

  function marcarErro(...campos) {
    campos.forEach((campo) => {
      if (!campo) {
        return;
      }

      campo.setAttribute(
        "aria-invalid",
        "true"
      );

      campo.classList.remove("shake");

      void campo.offsetWidth;

      campo.classList.add(
        "input-error",
        "shake"
      );
    });

    campos[0]?.focus();
  }

  function mostrarMensagem(
    texto,
    tipo = "erro"
  ) {
    elementos.mensagem.textContent =
      texto;

    elementos.mensagem.classList.remove(
      "hidden",
      "erro",
      "sucesso"
    );

    elementos.mensagem.classList.add(
      tipo
    );
  }

  function esconderMensagem() {
    elementos.mensagem.textContent = "";

    elementos.mensagem.classList.add(
      "hidden"
    );

    elementos.mensagem.classList.remove(
      "erro",
      "sucesso"
    );
  }

  function limparEstadoBotao() {
    elementos.botao.classList.remove(
      "btn-success",
      "btn-error"
    );
  }

  function formularioValido() {
    return (
      emailValido(elementos.email.value) &&
      String(elementos.senha.value).length > 0
    );
  }

  function atualizarBotao() {
    elementos.botao.disabled =
      enviando || !formularioValido();

    elementos.botao.classList.toggle(
      "btn-disabled",
      elementos.botao.disabled
    );

    if (
      !enviando &&
      !elementos.botao.classList.contains(
        "btn-success"
      ) &&
      !elementos.botao.classList.contains(
        "btn-error"
      )
    ) {
      elementos.botao.textContent =
        "Entrar";
    }
  }

  function validarFormulario() {
    limparErros();

    if (!emailValido(elementos.email.value)) {
      marcarErro(elementos.email);

      mostrarMensagem(
        "Digite um e-mail válido."
      );

      return false;
    }

    if (!elementos.senha.value) {
      marcarErro(elementos.senha);

      mostrarMensagem(
        "Digite sua senha."
      );

      return false;
    }

    return true;
  }

  function definirCarregando(ativo) {
    enviando = ativo;

    elementos.form.setAttribute(
      "aria-busy",
      String(ativo)
    );

    elementos.email.disabled = ativo;
    elementos.senha.disabled = ativo;

    if (elementos.toggleSenha) {
      elementos.toggleSenha.disabled =
        ativo;
    }

    elementos.botao.disabled =
      ativo || !formularioValido();

    elementos.botao.classList.toggle(
      "btn-disabled",
      elementos.botao.disabled
    );

    if (ativo) {
      limparEstadoBotao();

      elementos.botao.textContent =
        "Entrando...";
    }
  }

  function configurarToggleSenha() {
    elementos.toggleSenha?.addEventListener(
      "click",
      () => {
        const senhaVisivel =
          elementos.senha.type === "text";

        elementos.senha.type =
          senhaVisivel
            ? "password"
            : "text";

        elementos.toggleSenha.textContent =
          senhaVisivel ? "🙈" : "🙉";

        elementos.toggleSenha.setAttribute(
          "aria-pressed",
          String(!senhaVisivel)
        );

        elementos.toggleSenha.setAttribute(
          "aria-label",
          senhaVisivel
            ? "Mostrar senha"
            : "Ocultar senha"
        );
      }
    );
  }

  function obterDestino(resultado) {
    return window.AuthService.obterDestino({
      usuario: resultado.usuario,
      negocio: resultado.negocio,

      destinoSemNegocio:
        "/html/criar-negocio.html",

      destinoDono:
        "/html/dashboard-dono.html",

      destinoProfissional:
        "/html/agenda-profissional.html",

      destinoLogin:
        "/html/login-profissional.html",
    });
  }

  function redirecionar(destino) {
    temporizadorRedirecionamento =
      window.setTimeout(() => {
        document.body.classList.add(
          "page-exit"
        );

        window.setTimeout(() => {
          window.location.href =
            destino;
        }, 250);
      }, 500);
  }

  async function entrar(evento) {
    evento.preventDefault();

    if (enviando) {
      return;
    }

    esconderMensagem();
    limparEstadoBotao();

    if (!validarFormulario()) {
      atualizarBotao();
      return;
    }

    definirCarregando(true);

    try {
      const email = normalizarEmail(
        elementos.email.value
      );

      const resultado =
        await window.AuthService.login(
          email,
          elementos.senha.value
        );

      localStorage.setItem(
        CHAVE_EMAIL,
        email
      );

      const destino =
        obterDestino(resultado);

      mostrarMensagem(
        "Login realizado com sucesso.",
        "sucesso"
      );

      elementos.botao.textContent =
        "Login realizado";

      elementos.botao.classList.remove(
        "btn-disabled",
        "btn-error"
      );

      elementos.botao.classList.add(
        "btn-success"
      );

      redirecionar(destino);
    } catch (erro) {
      console.error(
        "Erro no login profissional:",
        erro
      );

      if (erro?.status === 401) {
        marcarErro(
          elementos.email,
          elementos.senha
        );
      } else if (erro?.status === 403) {
        marcarErro(elementos.email);
      }

      mostrarMensagem(
        erro?.message ||
          "Não foi possível realizar o login."
      );

      elementos.botao.textContent =
        "Tentar novamente";

      elementos.botao.classList.remove(
        "btn-success",
        "btn-disabled"
      );

      elementos.botao.classList.add(
        "btn-error"
      );
    } finally {
      definirCarregando(false);
      atualizarBotao();
    }
  }

  const emailSalvo =
    localStorage.getItem(CHAVE_EMAIL);

  if (
    emailSalvo &&
    !elementos.email.value
  ) {
    elementos.email.value =
      emailSalvo;
  }

  [
    elementos.email,
    elementos.senha,
  ].forEach((campo) => {
    campo.addEventListener(
      "input",
      () => {
        limparErroCampo(campo);
        esconderMensagem();
        limparEstadoBotao();
        atualizarBotao();
      }
    );
  });

  elementos.form.addEventListener(
    "submit",
    entrar
  );

  configurarToggleSenha();
  atualizarBotao();

  if (elementos.email.value) {
    elementos.senha.focus();
  } else {
    elementos.email.focus();
  }

  window.addEventListener(
    "beforeunload",
    () => {
      window.clearTimeout(
        temporizadorRedirecionamento
      );
    }
  );
});