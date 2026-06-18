document.addEventListener("DOMContentLoaded", async () => {
  const API_URL = "https://agenda-fashion-production.up.railway.app";

  const campoBusca = document.getElementById("campoBusca");
  const listaNegocios = document.getElementById("listaNegocios");
  const mensagemHome = document.getElementById("mensagemHome");
  const totalNegocios = document.getElementById("totalNegocios");

  let negocios = [];

  function mostrarMensagem(texto, cor = "#e63946") {
    if (!mensagemHome) return;
    mensagemHome.textContent = texto;
    mensagemHome.style.color = cor;
    mensagemHome.classList.remove("hidden");
  }

  function esconderMensagem() {
    if (!mensagemHome) return;
    mensagemHome.textContent = "";
    mensagemHome.classList.add("hidden");
  }

  function normalizarTexto(texto) {
    return String(texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function salvarLocalizacaoUsuario(lat, lon) {
    localStorage.setItem("user_lat", String(lat));
    localStorage.setItem("user_lon", String(lon));
  }

  function obterLocalizacaoSalva() {
    const lat = parseFloat(localStorage.getItem("user_lat"));
    const lon = parseFloat(localStorage.getItem("user_lon"));

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon };
    }

    return null;
  }

  function obterLocalizacaoUsuario() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(obterLocalizacaoSalva());
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;

          salvarLocalizacaoUsuario(lat, lon);
          resolve({ lat, lon });
        },
        () => {
          resolve(obterLocalizacaoSalva());
        },
        {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 1000 * 60 * 10
        }
      );
    });
  }

  function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function pegarFoto(item) {
  if (item.foto_url && item.foto_url.trim()) {
    return item.foto_url;
  }

  return "/public/img/negocio-padrao.png";

}
  function renderizarNegocios(lista) {
    listaNegocios.innerHTML = "";

    if (totalNegocios) {
      totalNegocios.textContent = negocios.length;
    }

    if (!lista.length) {
      listaNegocios.innerHTML = `
        <div class="estado-vazio">
          Nenhum negócio encontrado.
        </div>
      `;
      return;
    }

    lista.forEach((negocio) => {
      const card = document.createElement("div");
      card.className = "card-negocio";

      const areas = Array.isArray(negocio.areas) ? negocio.areas : [];

      card.innerHTML = `
  <img
  src="${pegarFoto(negocio)}"
  alt="${negocio.nome || "Negócio"}"
  onerror="this.onerror=null; this.src='/public/img/negocio-padrao.png';"
>

  <h3>${negocio.nome || "Negócio"}</h3>


        <span class="local">
          📍 ${negocio.cidade || "Cidade não informada"}
          ${
            negocio.distancia !== null && negocio.distancia !== undefined
              ? ` • ${negocio.distancia.toFixed(1)} km`
              : ""
          }
        </span>

        <p class="descricao">
          ${negocio.descricao || "Este negócio ainda não adicionou uma descrição."}
        </p>

        <div class="areas-card">
          ${
            areas.length
              ? areas.slice(0, 4).map((area) => `<span>${area}</span>`).join("")
              : `<span>Beleza</span>`
          }
        </div>

        <button class="btn-card-agendar" type="button">
          Ver horários
        </button>
      `;

      card.addEventListener("click", () => {
        window.location.href = `perfil-negocio.html?slug=${encodeURIComponent(negocio.slug)}`;
      });

      listaNegocios.appendChild(card);
    });
  }

  async function ordenarNegociosPorProximidade() {
    const user = await obterLocalizacaoUsuario();

    if (!user) {
      renderizarNegocios(negocios);
      return;
    }

    negocios = negocios.map((negocio) => {
      if (!negocio.latitude || !negocio.longitude) {
        return {
          ...negocio,
          distancia: null
        };
      }

      return {
        ...negocio,
        distancia: calcularDistancia(
          user.lat,
          user.lon,
          Number(negocio.latitude),
          Number(negocio.longitude)
        )
      };
    });

    negocios.sort((a, b) => {
      if (a.distancia === null) return 1;
      if (b.distancia === null) return -1;
      return a.distancia - b.distancia;
    });

    renderizarNegocios(negocios);
  }

  function filtrarNegocios() {
    const termo = normalizarTexto(campoBusca.value);

    if (!termo) {
      renderizarNegocios(negocios);
      return;
    }

    const filtrados = negocios.filter((item) => {
      const textoBusca = [
        item.nome,
        item.cidade,
        item.bairro,
        item.setor,
        item.descricao,
        Array.isArray(item.areas) ? item.areas.join(" ") : ""
      ].join(" ");

      return normalizarTexto(textoBusca).includes(termo);
    });

    renderizarNegocios(filtrados);
  }

  async function carregarNegocios() {
    try {
      esconderMensagem();

      listaNegocios.innerHTML = `
        <div class="estado-vazio">
          Carregando profissionais...
        </div>
      `;

      const resposta = await fetch(`${API_URL}/negocios-publicos`);
      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro || "Erro ao carregar negócios.");
      }

      negocios = resultado.negocios || [];
      await ordenarNegociosPorProximidade();

    } catch (erro) {
      console.error("Erro ao carregar negócios:", erro);
      mostrarMensagem(erro.message || "Erro na conexão com o servidor.");

      listaNegocios.innerHTML = `
        <div class="estado-vazio">
          Não foi possível carregar os negócios.
        </div>
      `;
    }
  }

  if (campoBusca) {
    campoBusca.addEventListener("input", filtrarNegocios);
  }

  await carregarNegocios();
});