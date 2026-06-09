document.addEventListener("DOMContentLoaded", () => {
  const nome = document.getElementById("nome");
  const sobrenome = document.getElementById("sobrenome");
  const email = document.getElementById("email");
  const whatsapp = document.getElementById("whatsapp");
  const senha = document.getElementById("senha");
  const confirmarSenha = document.getElementById("confirmarSenha");

  const btn = document.getElementById("btnCadastroCliente");
  const mensagem = document.getElementById("mensagemCadastro");

  const toggleSenha = document.getElementById("toggleSenha");
  const toggleConfirmarSenha = document.getElementById("toggleConfirmarSenha");

  if (
    !nome || !sobrenome || !email || !whatsapp ||
    !senha || !confirmarSenha || !btn || !mensagem ||
    !toggleSenha || !toggleConfirmarSenha
  ) {
    console.error("Elementos do cadastro cliente não encontrados.");
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

  function validarNome(valor) {
    return /^[A-Za-zÀ-ÿ\s]{2,}$/.test(valor.trim());
  }

  function validarWhatsapp(valor) {
    return valor.replace(/\D/g, "").length === 11;
  }

  function mascaraWhatsapp(valor) {
    let numeros = valor.replace(/\D/g, "");
    numeros = numeros.slice(0, 11);

    if (numeros.length <= 2) return numeros;
    if (numeros.length <= 7) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    }
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  }

  function formularioValido() {
    return (
      validarNome(nome.value) &&
      validarNome(sobrenome.value) &&
      validarEmail(email.value) &&
      validarWhatsapp(whatsapp.value) &&
      senha.value.trim().length >= 6 &&
      confirmarSenha.value.trim() !== "" &&
      senha.value === confirmarSenha.value
    );
  }

  function validarFormulario() {
    esconderMensagem();
    limparErros(nome, sobrenome, email, whatsapp, senha, confirmarSenha);
    limparEstadoBotao();

    if (formularioValido()) {
      ativarBotao();
      btn.innerHTML = "Cadastrar";
    } else {
      desativarBotao();
      btn.innerHTML = "Cadastrar";
    }
  }

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

  whatsapp.addEventListener("input", () => {
    whatsapp.value = mascaraWhatsapp(whatsapp.value);
    validarFormulario();
  });

  [nome, sobrenome, email, senha, confirmarSenha].forEach((campo) => {
    campo.addEventListener("input", validarFormulario);
  });

  validarFormulario();

  btn.addEventListener("click", async () => {
    esconderMensagem();
    limparErros(nome, sobrenome, email, whatsapp, senha, confirmarSenha);
    limparEstadoBotao();

    if (!validarNome(nome.value)) {
      tremerInputs(nome);
      mostrarMensagem("Digite um nome válido.");
      return;
    }

    if (!validarNome(sobrenome.value)) {
      tremerInputs(sobrenome);
      mostrarMensagem("Digite um sobrenome válido.");
      return;
    }

    if (!validarEmail(email.value)) {
      tremerInputs(email);
      mostrarMensagem("Digite um e-mail válido.");
      return;
    }

    if (!validarWhatsapp(whatsapp.value)) {
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

    const dados = {
      nome: `${nome.value.trim()} ${sobrenome.value.trim()}`,
      email: email.value.trim(),
      senha: senha.value,
      whatsapp: whatsapp.value.trim(),
      tipo: "cliente"
    };

    try {
      btn.innerHTML = `<span class="spinner-emoji">⏳</span> Cadastrando...`;
      btn.disabled = true;
      btn.classList.add("btn-disabled");

      const resposta = await fetch("https://agenda-fashion-production.up.railway.app/cadastro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dados)
      });

      const resultado = await resposta.json();

      if (resposta.ok) {
        mostrarMensagem("Cadastro realizado com sucesso 💅", "#2f9e63");

        btn.innerHTML = "✅ Sucesso";
        btn.classList.remove("btn-disabled", "btn-error");
        btn.classList.add("btn-success");

        setTimeout(() => {
          document.body.classList.add("page-exit");
          setTimeout(() => {
            window.location.href = "login-cliente.html";
          }, 350);
        }, 700);

      } else {
        mostrarMensagem(resultado.erro || "Erro ao cadastrar.");
        tremerInputs(nome, sobrenome, email, whatsapp, senha, confirmarSenha);

        btn.innerHTML = "❌ Erro";
        btn.classList.remove("btn-disabled", "btn-success");
        btn.classList.add("btn-error");

        setTimeout(() => {
          validarFormulario();
        }, 1400);
      }

    } catch (erro) {
      mostrarMensagem("Erro na conexão com o servidor.");
      tremerInputs(nome, sobrenome, email, whatsapp, senha, confirmarSenha);

      btn.innerHTML = "❌ Erro";
      btn.classList.remove("btn-disabled", "btn-success");
      btn.classList.add("btn-error");

      setTimeout(() => {
        validarFormulario();
      }, 1400);
    }
  });
});