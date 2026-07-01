document.addEventListener("DOMContentLoaded", () => {
  const email = document.getElementById("email");
  const senha = document.getElementById("senha");
  const btn = document.getElementById("btnLoginProfissional");
  const mensagem = document.getElementById("mensagemLogin");
  const toggleSenha = document.getElementById("toggleSenha");

  const STORAGE_EMAIL = "ultimoEmailProfissional";

  if (!email || !senha || !btn || !mensagem || !toggleSenha) {
    console.error("Elementos do login profissional não encontrados.");
    return;
  }

  const emailSalvo = localStorage.getItem(STORAGE_EMAIL);
  if (emailSalvo) email.value = emailSalvo;

  function mostrarMensagem(texto, cor = "#e63946") {
    mensagem.textContent = texto;
    mensagem.style.color = cor;
    mensagem.classList.remove("hidden");
  }

  function esconderMensagem() {
    mensagem.textContent = "";
    mensagem.classList.add("hidden");
  }

  function validarEmail(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
  }

  function formularioValido() {
    return validarEmail(email.value) && senha.value.trim().length >= 6;
  }

  function atualizarBotao() {
    btn.disabled = !formularioValido();
    btn.classList.toggle("btn-disabled", btn.disabled);
    btn.innerHTML = "Entrar";
  }

  function marcarErro(...inputs) {
    inputs.forEach((input) => {
      input.classList.remove("shake");
      void input.offsetWidth;
      input.classList.add("input-error", "shake");
    });
  }

  function limparErros(...inputs) {
    inputs.forEach((input) => {
      input.classList.remove("input-error", "shake");
    });
  }

  function handleEnter(e) {
    if (e.key === "Enter" && !btn.disabled) {
      btn.click();
    }
  }

  toggleSenha.addEventListener("click", () => {
    senha.type = senha.type === "password" ? "text" : "password";
    toggleSenha.textContent = senha.type === "password" ? "🙈" : "🙉";
  });

  email.addEventListener("input", atualizarBotao);
  senha.addEventListener("input", atualizarBotao);

  email.addEventListener("keydown", handleEnter);
  senha.addEventListener("keydown", handleEnter);

  btn.addEventListener("click", async () => {
    esconderMensagem();
    limparErros(email, senha);

    if (!validarEmail(email.value)) {
      marcarErro(email);
      mostrarMensagem("Digite um e-mail válido.");
      return;
    }

    if (senha.value.trim().length < 6) {
      marcarErro(senha);
      mostrarMensagem("Senha inválida.");
      return;
    }

    try {
      btn.disabled = true;
      btn.classList.add("btn-disabled");
      btn.innerHTML = `<span class="spinner-emoji">⏳</span> Entrando...`;

      const { usuario, negocio } = await AuthService.login(
        email.value,
        senha.value
      );

      localStorage.setItem(STORAGE_EMAIL, email.value.trim());

      mostrarMensagem("Login realizado com sucesso 💅", "#2f9e63");

      btn.innerHTML = "✅ Sucesso";
      btn.classList.remove("btn-disabled", "btn-error");
      btn.classList.add("btn-success");

      setTimeout(() => {
        AuthService.redirecionarUsuario(usuario, negocio);
      }, 700);

    } catch (erro) {
      mostrarMensagem(erro.message || "Erro na conexão com o servidor.");
      marcarErro(email, senha);

      btn.innerHTML = "❌ Erro";
      btn.classList.remove("btn-disabled", "btn-success");
      btn.classList.add("btn-error");

      setTimeout(atualizarBotao, 1400);
    }
  });

  atualizarBotao();
});