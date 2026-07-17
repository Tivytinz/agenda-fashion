document.addEventListener("DOMContentLoaded", () => {
  const elementos = {
    form: document.getElementById(
      "formCadastroProfissional"
    ),

    nome: document.getElementById(
      "nome"
    ),

    email: document.getElementById(
      "email"
    ),

    whatsapp: document.getElementById(
      "whatsapp"
    ),

    senha: document.getElementById(
      "senha"
    ),

    confirmarSenha:
      document.getElementById(
        "confirmarSenha"
      ),

    botao: document.getElementById(
      "btnCadastroProfissional"
    ),

    mensagem: document.getElementById(
      "mensagemCadastro"
    ),

    toggleSenha:
      document.getElementById(
        "toggleSenha"
      ),

    toggleConfirmarSenha:
      document.getElementById(
        "toggleConfirmarSenha"
      ),
  };

  const obrigatorios = [
    elementos.form,
    elementos.nome,
    elementos.email,
    elementos.whatsapp,
    elementos.senha,
    elementos.confirmarSenha,
    elementos.botao,
    elementos.mensagem,
  ];

  if (
    obrigatorios.some(
      (elemento) => !elemento
    )
  ) {
    console.error(
      "Elementos obrigatórios do cadastro profissional não foram encontrados."
    );

    return;
  }

  if (
    !window.AuthService ||
    typeof window.AuthService
      .cadastro !== "function"
  ) {
    console.error(
      "AuthService não foi carregado."
    );

    mostrarMensagem(
      "O sistema de autenticação não foi carregado. Atualize a página."
    );

    return;
  }

  const CHAVE_EMAIL =
    "ultimoEmailProfissional";

  let enviando = false;
  let temporizadorRedirecionamento =
    null;

  function normalizarTexto(valor) {
    return String(valor ?? "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function normalizarEmail(valor) {
    return String(valor ?? "")
      .trim()
      .toLowerCase();
  }

  function normalizarWhatsapp(valor) {
    let numeros =
      String(valor ?? "")
        .replace(/\D/g, "");

    if (
      (numeros.length === 12 ||
        numeros.length === 13) &&
      numeros.startsWith("55")
    ) {
      numeros = numeros.slice(2);
    }

    return numeros;
  }

  function aplicarMascaraWhatsapp(
    valor
  ) {
    const numeros =
      normalizarWhatsapp(valor)
        .slice(0, 11);

    if (numeros.length <= 2) {
      return numeros;
    }

    if (numeros.length <= 6) {
      return (
        `(${numeros.slice(0, 2)}) ` +
        numeros.slice(2)
      );
    }

    if (numeros.length <= 10) {
      return (
        `(${numeros.slice(0, 2)}) ` +
        `${numeros.slice(2, 6)}-` +
        numeros.slice(6)
      );
    }

    return (
      `(${numeros.slice(0, 2)}) ` +
      `${numeros.slice(2, 7)}-` +
      numeros.slice(7)
    );
  }

  function nomeValido(valor) {
    const nome =
      normalizarTexto(valor);

    return (
      nome.length >= 2 &&
      nome.length <= 120
    );
  }

  function emailValido(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalizarEmail(valor)
    );
  }

  function whatsappValido(valor) {
    return [10, 11].includes(
      normalizarWhatsapp(valor).length
    );
  }

  function senhaValida(valor) {
    const senha =
      String(valor ?? "");

    const tamanhoEmBytes =
      new TextEncoder()
        .encode(senha)
        .length;

    return (
      tamanhoEmBytes >= 6 &&
      tamanhoEmBytes <= 72
    );
  }

  function limparErroCampo(campo) {
    campo?.removeAttribute(
      "aria-invalid"
    );

    campo?.classList.remove(
      "input-error",
      "shake"
    );
  }

  function limparErros() {
    [
      elementos.nome,
      elementos.email,
      elementos.whatsapp,
      elementos.senha,
      elementos.confirmarSenha,
    ].forEach(limparErroCampo);
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

      campo.classList.remove(
        "shake"
      );

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
    elementos.mensagem.textContent =
      "";

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
      nomeValido(
        elementos.nome.value
      ) &&
      emailValido(
        elementos.email.value
      ) &&
      whatsappValido(
        elementos.whatsapp.value
      ) &&
      senhaValida(
        elementos.senha.value
      ) &&
      elementos.senha.value ===
        elementos.confirmarSenha.value
    );
  }

  function atualizarBotao() {
    elementos.botao.disabled =
      enviando ||
      !formularioValido();

    elementos.botao.classList.toggle(
      "btn-disabled",
      elementos.botao.disabled
    );

    if (
      !enviando &&
      !elementos.botao.classList
        .contains("btn-success") &&
      !elementos.botao.classList
        .contains("btn-error")
    ) {
      elementos.botao.textContent =
        "Criar conta";
    }
  }

  function validarFormulario() {
    limparErros();

    if (
      !nomeValido(
        elementos.nome.value
      )
    ) {
      marcarErro(elementos.nome);

      mostrarMensagem(
        "Digite um nome válido."
      );

      return false;
    }

    if (
      !emailValido(
        elementos.email.value
      )
    ) {
      marcarErro(elementos.email);

      mostrarMensagem(
        "Digite um e-mail válido."
      );

      return false;
    }

    if (
      !whatsappValido(
        elementos.whatsapp.value
      )
    ) {
      marcarErro(
        elementos.whatsapp
      );

      mostrarMensagem(
        "Digite um WhatsApp com DDD."
      );

      return false;
    }

    if (
      !senhaValida(
        elementos.senha.value
      )
    ) {
      marcarErro(elementos.senha);

      mostrarMensagem(
        "A senha deve ter entre 6 e 72 bytes."
      );

      return false;
    }

    if (
      elementos.senha.value !==
      elementos.confirmarSenha.value
    ) {
      marcarErro(
        elementos.senha,
        elementos.confirmarSenha
      );

      mostrarMensagem(
        "As senhas não coincidem."
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

    [
      elementos.nome,
      elementos.email,
      elementos.whatsapp,
      elementos.senha,
      elementos.confirmarSenha,
    ].forEach((campo) => {
      campo.disabled = ativo;
    });

    if (elementos.toggleSenha) {
      elementos.toggleSenha.disabled =
        ativo;
    }

    if (
      elementos.toggleConfirmarSenha
    ) {
      elementos
        .toggleConfirmarSenha
        .disabled = ativo;
    }

    elementos.botao.disabled =
      ativo ||
      !formularioValido();

    elementos.botao.classList.toggle(
      "btn-disabled",
      elementos.botao.disabled
    );

    if (ativo) {
      limparEstadoBotao();

      elementos.botao.textContent =
        "Criando conta...";
    }
  }

  function configurarToggleSenha(
    botao,
    campo,
    rotulo
  ) {
    botao?.addEventListener(
      "click",
      () => {
        const visivel =
          campo.type === "text";

        campo.type =
          visivel
            ? "password"
            : "text";

        botao.textContent =
          visivel ? "🙈" : "🙉";

        botao.setAttribute(
          "aria-pressed",
          String(!visivel)
        );

        botao.setAttribute(
          "aria-label",
          visivel
            ? `Mostrar ${rotulo}`
            : `Ocultar ${rotulo}`
        );
      }
    );
  }

  function tratarCamposDoErro(
    erro
  ) {
    const mensagem =
      String(
        erro?.message || ""
      ).toLowerCase();

    if (
      mensagem.includes("email")
    ) {
      marcarErro(elementos.email);
      return;
    }

    if (
      mensagem.includes("whatsapp")
    ) {
      marcarErro(
        elementos.whatsapp
      );

      return;
    }

    if (
      mensagem.includes("senha")
    ) {
      marcarErro(
        elementos.senha,
        elementos.confirmarSenha
      );
    }
  }

  function obterDestino(resultado) {
    return window.AuthService
      .obterDestino({
        usuario:
          resultado.usuario,

        negocio:
          resultado.negocio,

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
      }, 600);
  }

  async function cadastrar(evento) {
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
      const dados = {
        nome:
          normalizarTexto(
            elementos.nome.value
          ),

        email:
          normalizarEmail(
            elementos.email.value
          ),

        whatsapp:
          normalizarWhatsapp(
            elementos.whatsapp.value
          ),

        senha:
          elementos.senha.value,
      };

      const resultado =
        await window.AuthService
          .cadastro(dados);

      localStorage.setItem(
        CHAVE_EMAIL,
        dados.email
      );

      const destino =
        obterDestino(resultado);

      mostrarMensagem(
        "Conta criada com sucesso. Agora configure seu negócio.",
        "sucesso"
      );

      elementos.botao.textContent =
        "Conta criada";

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
        "Erro no cadastro profissional:",
        erro
      );

      tratarCamposDoErro(erro);

      mostrarMensagem(
        erro?.message ||
          "Não foi possível criar a conta."
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

  elementos.whatsapp.addEventListener(
    "input",
    () => {
      elementos.whatsapp.value =
        aplicarMascaraWhatsapp(
          elementos.whatsapp.value
        );

      limparErroCampo(
        elementos.whatsapp
      );

      esconderMensagem();
      limparEstadoBotao();
      atualizarBotao();
    }
  );

  [
    elementos.nome,
    elementos.email,
    elementos.senha,
    elementos.confirmarSenha,
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
    cadastrar
  );

  configurarToggleSenha(
    elementos.toggleSenha,
    elementos.senha,
    "senha"
  );

  configurarToggleSenha(
    elementos.toggleConfirmarSenha,
    elementos.confirmarSenha,
    "confirmação da senha"
  );

  atualizarBotao();
  elementos.nome.focus();

  window.addEventListener(
    "beforeunload",
    () => {
      window.clearTimeout(
        temporizadorRedirecionamento
      );
    }
  );
});