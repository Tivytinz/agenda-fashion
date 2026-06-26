document.addEventListener("DOMContentLoaded", async () => {
 

  const token = localStorage.getItem("token");
  const usuarioLocal = JSON.parse(localStorage.getItem("usuario") || "null");

  if (!token || !usuarioLocal) {
    window.location.href = "login-profissional.html";
    return;
  }

  const fotoUsuario = document.getElementById("fotoUsuario");
  const inputFotoUsuario = document.getElementById("inputFotoUsuario");
  const btnTrocarFoto = document.getElementById("btnTrocarFoto");

  const formConta = document.getElementById("formConta");
  const nomeUsuario = document.getElementById("nomeUsuario");
  const emailUsuario = document.getElementById("emailUsuario");
  const whatsappUsuario = document.getElementById("whatsappUsuario");

  const formSenha = document.getElementById("formSenha");
  const senhaAtual = document.getElementById("senhaAtual");
  const novaSenha = document.getElementById("novaSenha");

  const btnLogout = document.getElementById("btnLogout");
  const mensagemConfig = document.getElementById("mensagemConfig");

  function mostrarMensagem(texto, cor = "#2f9e63") {
    if (!mensagemConfig) {
      alert(texto);
      return;
    }

    mensagemConfig.textContent = texto;
    mensagemConfig.style.color = cor;
    mensagemConfig.classList.remove("hidden");

    setTimeout(() => {
      mensagemConfig.classList.add("hidden");
    }, 3000);
  }

  function avatarPadrao(nome) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(nome || "Usuário")}&background=f3b0d7&color=ffffff`;
  }

  async function carregarMinhaConta() {
    try {
      const resposta = await fetch(`${API_URL}/conta`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await resposta.json();

      if (!resposta.ok) {
        throw new Error(data.erro || "Erro ao carregar conta.");
      }

      const usuario = data.usuario;

      nomeUsuario.value = usuario.nome || "";
      emailUsuario.value = usuario.email || "";
      whatsappUsuario.value = usuario.whatsapp || "";

      if (fotoUsuario) {
        fotoUsuario.src = usuario.foto_url || avatarPadrao(usuario.nome);
      }

      localStorage.setItem("usuario", JSON.stringify(usuario));

    } catch (erro) {
      console.error("Erro minha conta:", erro);
      mostrarMensagem(erro.message || "Erro ao carregar conta.", "#e63946");
    }
  }

  async function salvarConta(e) {
    e.preventDefault();

    try {
      const resposta = await fetch(`${API_URL}/conta`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nome: nomeUsuario.value.trim(),
          whatsapp: whatsappUsuario.value.trim()
        })
      });

      const data = await resposta.json();

      if (!resposta.ok) {
        throw new Error(data.erro || "Erro ao salvar conta.");
      }

      localStorage.setItem("usuario", JSON.stringify(data.usuario));

      mostrarMensagem("Conta atualizada com sucesso 💅");

    } catch (erro) {
      console.error("Erro salvar conta:", erro);
      mostrarMensagem(erro.message || "Erro ao salvar conta.", "#e63946");
    }
  }

  async function alterarSenha(e) {
    e.preventDefault();

    try {
      const resposta = await fetch(`${API_URL}/conta/senha`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          senhaAtual: senhaAtual.value,
          novaSenha: novaSenha.value
        })
      });

      const data = await resposta.json();

      if (!resposta.ok) {
        throw new Error(data.erro || "Erro ao alterar senha.");
      }

      senhaAtual.value = "";
      novaSenha.value = "";

      mostrarMensagem("Senha alterada com sucesso 🔒");

    } catch (erro) {
      console.error("Erro senha:", erro);
      mostrarMensagem(erro.message || "Erro ao alterar senha.", "#e63946");
    }
  }

  async function enviarFotoUsuario() {
    try {
      const arquivo = inputFotoUsuario.files?.[0];

      if (!arquivo) return;

      const formData = new FormData();
      formData.append("foto", arquivo);

      const resposta = await fetch(`${API_URL}/conta/foto`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await resposta.json();

      if (!resposta.ok) {
        throw new Error(data.erro || "Erro ao enviar foto.");
      }

      fotoUsuario.src = data.foto;

      const usuarioAtualizado = {
        ...JSON.parse(localStorage.getItem("usuario") || "{}"),
        foto_url: data.foto
      };

      localStorage.setItem("usuario", JSON.stringify(usuarioAtualizado));

      mostrarMensagem("Foto atualizada com sucesso 📸");

    } catch (erro) {
      console.error("Erro foto:", erro);
      mostrarMensagem(erro.message || "Erro ao enviar foto.", "#e63946");
    }
  }

  function sair() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("negocio");

    window.location.href = "inicio.html";
  }

  btnTrocarFoto?.addEventListener("click", () => {
    inputFotoUsuario?.click();
  });

  inputFotoUsuario?.addEventListener("change", enviarFotoUsuario);

  formConta?.addEventListener("submit", salvarConta);

  formSenha?.addEventListener("submit", alterarSenha);

  btnLogout?.addEventListener("click", sair);

  await carregarMinhaConta();
});