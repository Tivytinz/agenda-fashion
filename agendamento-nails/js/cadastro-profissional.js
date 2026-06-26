document.addEventListener("DOMContentLoaded", () => {
  

  const nome = document.getElementById("nome");
  const email = document.getElementById("email");
  const whatsapp = document.getElementById("whatsapp");
  const senha = document.getElementById("senha");
  const confirmarSenha = document.getElementById("confirmarSenha");

  const btn = document.getElementById("btnCadastroProfissional");
  const mensagem = document.getElementById("mensagemCadastro");

  const toggleSenha = document.getElementById("toggleSenha");
  const toggleConfirmarSenha = document.getElementById("toggleConfirmarSenha");

  if (!nome || !email || !whatsapp || !senha || !confirmarSenha || !btn || !mensagem) {
    console.error("Elementos do cadastro profissional não encontrados.");
    return;
  }

  function desativarBotao() {
    btn.disabled = true;
    btn.classList.add("btn-disabled");
  }

  function ativarBotao() {
    btn.disabled = false;
    btn.classList.remove("btn-disabled");
  }

  function mostrarMensagem(texto, cor = "#e63946") {
    mensagem.textContent = texto;
    mensagem.style.color = cor;
    mensagem.classList.remove("hidden");
  }

  function esconderMensagem() {
    mensagem.textContent = "";
    mensagem.classList.add("hidden");
  }

  function limparEstadoBotao() {
    btn.classList.remove("btn-success", "btn-error");
  }

  function limparErros(...inputs) {
    inputs.forEach((input) => {
      input.classList.remove("input-error", "shake");
    });
  }

  function tremerInputs(...inputs) {
    inputs.forEach((input) => {
      input.classList.remove("shake");
      void input.offsetWidth;
      input.classList.add("input-error", "shake");
    });
  }

  function validarEmail(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
  }

  function mascaraWhatsapp(valor) {
    let numeros = valor.replace(/\D/g, "").slice(0, 11);

    if (numeros.length <= 2) return numeros;
    if (numeros.length <= 7) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    }
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  }

  function formularioValido() {
    return (
      nome.value.trim().length >= 2 &&
      validarEmail(email.value) &&
      whatsapp.value.replace(/\D/g, "").length >= 10 &&
      senha.value.trim().length >= 6 &&
      confirmarSenha.value.trim().length >= 6 &&
      senha.value === confirmarSenha.value
    );
  }

  function validarFormulario() {
    esconderMensagem();
    limparErros(nome, email, whatsapp, senha, confirmarSenha);
    limparEstadoBotao();
    btn.innerHTML = "Cadastrar";

    if (formularioValido()) {
      ativarBotao();
    } else {
      desativarBotao();
    }
  }

  whatsapp.addEventListener("input", () => {
    whatsapp.value = mascaraWhatsapp(whatsapp.value);
    validarFormulario();
  });

  [nome, email, senha, confirmarSenha].forEach((campo) => {
    campo.addEventListener("input", validarFormulario);
  });

  toggleSenha.addEventListener("click", () => {
    if (senha.type === "password") {
      senha.type = "text";
      toggleSenha.textContent = "🙉";
    } else {
      senha.type = "password";
      toggleSenha.textContent = "🙈";
    }
  });

  toggleConfirmarSenha.addEventListener("click", () => {
    if (confirmarSenha.type === "password") {
      confirmarSenha.type = "text";
      toggleConfirmarSenha.textContent = "🙉";
    } else {
      confirmarSenha.type = "password";
      toggleConfirmarSenha.textContent = "🙈";
    }
  });

  validarFormulario();

  btn.addEventListener("click", async () => {
    esconderMensagem();
    limparErros(nome, email, whatsapp, senha, confirmarSenha);
    limparEstadoBotao();

    if (nome.value.trim().length < 2) {
      tremerInputs(nome);
      mostrarMensagem("Digite um nome válido.");
      return;
    }

    if (!validarEmail(email.value)) {
      tremerInputs(email);
      mostrarMensagem("Digite um e-mail válido.");
      return;
    }

    if (whatsapp.value.replace(/\D/g, "").length < 10) {
      tremerInputs(whatsapp);
      mostrarMensagem("Digite um WhatsApp válido.");
      return;
    }

    if (senha.value.trim().length < 6) {
      tremerInputs(senha);
      mostrarMensagem("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (senha.value !== confirmarSenha.value) {
      tremerInputs(senha, confirmarSenha);
      mostrarMensagem("As senhas não coincidem.");
      return;
    }

    try {
      btn.innerHTML = `<span class="spinner-emoji">⏳</span> Cadastrando...`;
      btn.disabled = true;
      btn.classList.add("btn-disabled");

      const resposta = await fetch(`${API_URL}/cadastro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nome: nome.value.trim(),
          email: email.value.trim(),
          senha: senha.value,
          whatsapp: whatsapp.value.trim(),
          tipo: "profissional"
        })
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro || "Erro ao cadastrar.");
      }

      mostrarMensagem("Cadastro realizado com sucesso 💅", "#2f9e63");

      btn.innerHTML = "✅ Sucesso";
      btn.classList.remove("btn-disabled", "btn-error");
      btn.classList.add("btn-success");

      localStorage.setItem("token", resultado.token);
      localStorage.setItem("usuario", JSON.stringify(resultado.usuario));

      setTimeout(() => {
        document.body.classList.add("page-exit");
        setTimeout(() => {
          window.location.href = "/html/criar-negocio.html";
        }, 350);
      }, 700);

    } catch (erro) {
      console.error("Erro no cadastro:", erro);

      mostrarMensagem(erro.message || "Erro na conexão com o servidor.");
      tremerInputs(nome, email, whatsapp, senha, confirmarSenha);

      btn.innerHTML = "❌ Erro";
      btn.classList.remove("btn-disabled", "btn-success");
      btn.classList.add("btn-error");

      setTimeout(() => {
        validarFormulario();
      }, 1400);
    }
  });
});