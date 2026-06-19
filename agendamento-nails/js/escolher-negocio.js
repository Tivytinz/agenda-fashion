document.addEventListener("DOMContentLoaded", () => {
  const API_URL = "https://agenda-fashion-production.up.railway.app";

  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario"));

  const buscaNegocio = document.getElementById("buscaNegocio");
  const btnBuscarNegocio = document.getElementById("btnBuscarNegocio");
  const btnCriarNegocio = document.getElementById("btnCriarNegocio");
  const mensagem = document.getElementById("mensagemEscolhaNegocio");
  const listaNegocios = document.getElementById("listaNegocios");
  const linkVoltarLogin = document.getElementById("linkVoltarLogin");

  if (!token || !usuario || usuario.tipo !== "profissional") {
    window.location.href = "login-profissional.html";
    return;
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

  function renderizarNegocios(negocios = []) {
    listaNegocios.innerHTML = "";

    if (!negocios.length) {
      listaNegocios.innerHTML = `<p style="font-size:13px;color:#7e768f;text-align:left;">Nenhum negócio encontrado.</p>`;
      listaNegocios.classList.remove("hidden");
      return;
    }

    negocios.forEach((negocio) => {
      const item = document.createElement("div");
      item.className = "item-negocio";

      item.innerHTML = `
        <div class="item-negocio-info">
          <strong>${negocio.nome}</strong>
          <span>${negocio.slug || "Sem slug"}</span>
        </div>
        <button class="btn-negocio-entrar" type="button">Entrar</button>
      `;

      const btnEntrar = item.querySelector(".btn-negocio-entrar");

      btnEntrar.addEventListener("click", async () => {
        try {
          btnEntrar.disabled = true;
          btnEntrar.innerHTML = `<span class="spinner-emoji">⏳</span> Entrando...`;

          const resposta = await fetch(`${API_URL}/entrar-negocio`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              negocio_id: negocio.negocio_id || negocio.id
            })
          });

          const resultado = await resposta.json();

          if (!resposta.ok) {
            throw new Error(resultado.erro || "Erro ao entrar no negócio.");
          }

          mostrarMensagem("Você entrou no negócio com sucesso 💅", "#2f9e63");

          setTimeout(() => {
            document.body.classList.add("page-exit");
            setTimeout(() => {
              window.location.href = "painel-profissional.html";
            }, 350);
          }, 700);

        } catch (erro) {
          console.error("Erro ao entrar no negócio:", erro);
          mostrarMensagem(erro.message || "Erro na conexão com o servidor.");
        }
      });

      listaNegocios.appendChild(item);
    });

    listaNegocios.classList.remove("hidden");
  }

  btnBuscarNegocio.addEventListener("click", async () => {
    esconderMensagem();
    limparErros(buscaNegocio);
    listaNegocios.classList.add("hidden");
    listaNegocios.innerHTML = "";

    if (!buscaNegocio.value.trim()) {
      tremerInputs(buscaNegocio);
      mostrarMensagem("Digite o nome do negócio para buscar.");
      return;
    }

    try {
      btnBuscarNegocio.disabled = true;
      btnBuscarNegocio.classList.add("btn-disabled");
      btnBuscarNegocio.innerHTML = `<span class="spinner-emoji">⏳</span> Buscando...`;

      const resposta = await fetch(
        `${API_URL}/negocios/buscar?termo=${encodeURIComponent(buscaNegocio.value.trim())}`,
        {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        }
      );

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro || "Erro ao buscar negócios.");
      }

      renderizarNegocios(resultado.negocios || []);

      btnBuscarNegocio.disabled = false;
      btnBuscarNegocio.classList.remove("btn-disabled");
      btnBuscarNegocio.innerHTML = "Buscar negócio";

    } catch (erro) {
      console.error("Erro ao buscar negócio:", erro);
      mostrarMensagem(erro.message || "Erro na conexão com o servidor.");

      btnBuscarNegocio.disabled = false;
      btnBuscarNegocio.classList.remove("btn-disabled");
      btnBuscarNegocio.innerHTML = "Buscar negócio";
    }
  });

  btnCriarNegocio.addEventListener("click", () => {
    document.body.classList.add("page-exit");
    setTimeout(() => {
      window.location.href = "criar-negocio.html";
    }, 350);
  });

  linkVoltarLogin.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "login-profissional.html";
  });
});