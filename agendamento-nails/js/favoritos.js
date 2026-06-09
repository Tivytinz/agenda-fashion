document.addEventListener("DOMContentLoaded", async () => {
  const API_URL = "http://localhost:3000";

  const lista = document.getElementById("listaFavoritos");
  const mensagem = document.getElementById("mensagemFavoritos");

  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");

  if (!token || usuario?.tipo !== "cliente") {
    window.location.href = "login-cliente.html";
    return;
  }

  function mostrarMensagem(texto) {
    if (!mensagem) return;
    mensagem.textContent = texto;
    mensagem.classList.remove("hidden");
  }

  function fotoFavorito(item) {
    return item.foto_url
      ? item.foto_url
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.nome || "Negócio")}&background=f3b0d7&color=ffffff`;
  }

  async function removerFavorito(id) {
    try {
      const res = await fetch(`${API_URL}/favoritos/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.erro || "Erro ao remover favorito.");
      }

      await carregarFavoritos();
    } catch (erro) {
      mostrarMensagem(erro.message || "Erro ao remover favorito.");
    }
  }

  function renderizar(favoritos) {
    lista.innerHTML = "";

    if (!favoritos.length) {
      lista.innerHTML = `
        <div class="estado-vazio">
          Você ainda não tem favoritos 💅
        </div>
      `;
      return;
    }

    favoritos.forEach((item) => {
      const foto = fotoFavorito(item);

      const card = document.createElement("div");
      card.className = "af-card card-favorito";

      card.innerHTML = `
        <img src="${foto}" alt="${item.nome || "Negócio"}">

        <h3>${item.nome || "Negócio"}</h3>

        <span>📍 ${item.cidade || "Cidade não informada"}</span>

        <div class="favorito-acoes">
          <button class="btn-ver" type="button">
            Ver perfil
          </button>

          <button class="btn-remover" type="button">
            Remover
          </button>
        </div>
      `;

      card.querySelector(".btn-ver").addEventListener("click", () => {
        window.location.href =
          `perfil-negocio.html?slug=${encodeURIComponent(item.slug)}`;
      });

      card.querySelector(".btn-remover").addEventListener("click", () => {
        removerFavorito(item.id);
      });

      lista.appendChild(card);
    });
  }

  async function carregarFavoritos() {
    try {
      lista.innerHTML = `
        <div class="estado-vazio">
          Carregando favoritos...
        </div>
      `;

      const res = await fetch(`${API_URL}/favoritos`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || "Erro ao carregar favoritos.");
      }

      renderizar(data.favoritos || []);
    } catch (err) {
      mostrarMensagem(err.message || "Erro na conexão.");
    }
  }

  await carregarFavoritos();
});