document.addEventListener(
  "DOMContentLoaded",
  () => {
    const elementos = {
      campoBusca:
        document.getElementById(
          "campoBusca"
        ),

      listaNegocios:
        document.getElementById(
          "listaNegocios"
        ),

      listaServicos:
        document.getElementById(
          "listaServicosHome"
        ),

      filtrosCategorias:
        document.getElementById(
          "filtrosCategorias"
        ),

      mensagemHome:
        document.getElementById(
          "mensagemHome"
        ),

      totalNegocios:
        document.getElementById(
          "totalNegocios"
        ),

      totalServicos:
        document.getElementById(
          "totalServicos"
        ),
    };

    const estado = {
      negocios: [],
      carregando: false,
      termoBusca: "",
      categoria: "",
      controlador: null,
      temporizadorBusca: null,
    };

    function criarElemento(
      tag,
      classe = "",
      texto = null
    ) {
      const elemento =
        document.createElement(
          tag
        );

      if (classe) {
        elemento.className =
          classe;
      }

      if (
        texto !== null &&
        texto !== undefined
      ) {
        elemento.textContent =
          String(texto);
      }

      return elemento;
    }

    function obterApiUrl() {
      const valor =
        window.API_URL ||
        globalThis.API_URL ||
        "";

      return String(valor)
        .trim()
        .replace(/\/$/, "");
    }

    function registrarComportamento(
      nome,
      {
        negocioId,
        propriedades = {},
      } = {}
    ) {
      window.AFAnalytics
        ?.registrar?.(
          nome,
          {
            negocioId,
            propriedades,
          }
        );
    }

    function normalizarTexto(
      texto
    ) {
      return String(
        texto || ""
      )
        .toLocaleLowerCase(
          "pt-BR"
        )
        .normalize(
          "NFD"
        )
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .trim();
    }

    function normalizarNumero(
      valor
    ) {
      const numero =
        Number(valor);

      return Number.isFinite(
        numero
      )
        ? numero
        : null;
    }

    function formatarMoeda(
      valor
    ) {
      const numero =
        normalizarNumero(
          valor
        ) || 0;

      return new Intl.NumberFormat(
        "pt-BR",
        {
          style: "currency",
          currency: "BRL",
        }
      ).format(numero);
    }

    function obterIniciais(
      nome
    ) {
      const partes =
        String(
          nome || "Negócio"
        )
          .trim()
          .split(/\s+/)
          .filter(Boolean);

      if (
        partes.length === 0
      ) {
        return "N";
      }

      if (
        partes.length === 1
      ) {
        return partes[0]
          .slice(0, 2)
          .toUpperCase();
      }

      return (
        partes[0][0] +
        partes[
          partes.length - 1
        ][0]
      ).toUpperCase();
    }

    function mostrarMensagem(
      texto,
      tipo = "erro"
    ) {
      const elemento =
        elementos.mensagemHome;

      if (!elemento) {
        return;
      }

      elemento.textContent =
        String(texto || "");

      elemento.className =
        "mensagem-home";

      elemento.classList.add(
        `mensagem-${tipo}`
      );

      elemento.classList.remove(
        "hidden"
      );
    }

    function esconderMensagem() {
      const elemento =
        elementos.mensagemHome;

      if (!elemento) {
        return;
      }

      elemento.textContent =
        "";

      elemento.className =
        "mensagem-home hidden";
    }

    function definirCarregando(
      carregando
    ) {
      estado.carregando =
        carregando;

      elementos.listaNegocios
        ?.setAttribute(
          "aria-busy",
          String(carregando)
        );

      elementos.listaServicos
        ?.setAttribute(
          "aria-busy",
          String(carregando)
        );

      if (
        elementos.campoBusca
      ) {
        elementos.campoBusca
          .disabled =
          carregando;
      }
    }

    function criarEstadoCarregando() {
      const estadoVazio =
        criarElemento(
          "div",
          "estado-vazio"
        );

      const loading =
        criarElemento(
          "span",
          "af-loading"
        );

      const spinner =
        criarElemento(
          "span",
          "af-spinner"
        );

      spinner.setAttribute(
        "aria-hidden",
        "true"
      );

      const texto =
        criarElemento(
          "span",
          "",
          "Carregando profissionais..."
        );

      loading.append(
        spinner,
        texto
      );

      estadoVazio.appendChild(
        loading
      );

      return estadoVazio;
    }

    function criarEstadoVazio(
      titulo,
      descricao = ""
    ) {
      const container =
        criarElemento(
          "div",
          "estado-vazio"
        );

      const conteudo =
        criarElemento(
          "div",
          "estado-vazio-conteudo"
        );

      const icone =
        criarElemento(
          "div",
          "estado-vazio-icone",
          "🔎"
        );

      icone.setAttribute(
        "aria-hidden",
        "true"
      );

      const tituloElemento =
        criarElemento(
          "strong",
          "",
          titulo
        );

      conteudo.append(
        icone,
        tituloElemento
      );

      if (descricao) {
        conteudo.appendChild(
          criarElemento(
            "p",
            "",
            descricao
          )
        );
      }

      container.appendChild(
        conteudo
      );

      return container;
    }

    function criarEstadoErro() {
      const container =
        criarElemento(
          "div",
          "estado-vazio"
        );

      const conteudo =
        criarElemento(
          "div",
          "estado-vazio-conteudo"
        );

      const icone =
        criarElemento(
          "div",
          "estado-vazio-icone",
          "⚠️"
        );

      icone.setAttribute(
        "aria-hidden",
        "true"
      );

      const titulo =
        criarElemento(
          "strong",
          "",
          "Não foi possível carregar os negócios."
        );

      const descricao =
        criarElemento(
          "p",
          "",
          "Verifique sua conexão e tente novamente."
        );

      const botao =
        criarElemento(
          "button",
          "af-btn-secondary",
          "Tentar novamente"
        );

      botao.type =
        "button";

      botao.addEventListener(
        "click",
        () => {
          void carregarNegocios();
        }
      );

      conteudo.append(
        icone,
        titulo,
        descricao,
        botao
      );

      container.appendChild(
        conteudo
      );

      return container;
    }

    function criarAvatar(
      negocio
    ) {
      return criarElemento(
        "div",
        "avatar-negocio-card",
        obterIniciais(
          negocio.nome
        )
      );
    }

    function criarImagemNegocio(
      negocio
    ) {
      const fotoUrl =
        String(
          negocio.foto_url ||
          ""
        ).trim();

      if (!fotoUrl) {
        return criarAvatar(
          negocio
        );
      }

      const imagem =
        document.createElement(
          "img"
        );

      imagem.className =
        "foto-card-negocio";

      imagem.src =
        fotoUrl;

      imagem.alt =
        `Foto de ${
          negocio.nome ||
          "negócio"
        }`;

      imagem.loading =
        "lazy";

      imagem.decoding =
        "async";

      imagem.addEventListener(
        "error",
        () => {
          imagem.replaceWith(
            criarAvatar(
              negocio
            )
          );
        },
        {
          once: true,
        }
      );

      return imagem;
    }

    function formatarLocal(
      negocio
    ) {
      const localizacao = [
        negocio.bairro,
        negocio.cidade,
      ]
        .map(
          (item) =>
            String(
              item || ""
            ).trim()
        )
        .filter(Boolean)
        .join(", ");

      const textoLocal =
        localizacao ||
        "Localização não informada";

      const distancia =
        normalizarNumero(
          negocio.distancia
        );

      if (
        distancia === null
      ) {
        return `📍 ${textoLocal}`;
      }

      const distanciaFormatada =
        new Intl.NumberFormat(
          "pt-BR",
          {
            minimumFractionDigits:
              distancia < 10
                ? 1
                : 0,

            maximumFractionDigits:
              1,
          }
        ).format(
          distancia
        );

      return (
        `📍 ${textoLocal} · ` +
        `${distanciaFormatada} km`
      );
    }

    function obterAreas(
      negocio
    ) {
      if (
        !Array.isArray(
          negocio.areas
        )
      ) {
        return [
          "Beleza",
        ];
      }

      const areas =
        negocio.areas
          .map(
            (area) =>
              String(
                area || ""
              ).trim()
          )
          .filter(Boolean);

      return areas.length
        ? areas
        : [
            "Beleza",
          ];
    }

    function obterServicos(
      negocio
    ) {
      return Array.isArray(
        negocio.servicos
      )
        ? negocio.servicos
        : [];
    }

    function abrirPerfil(
      negocio,
      servicoId = null
    ) {
      const slug =
        String(
          negocio.slug || ""
        ).trim();

      if (!slug) {
        mostrarMensagem(
          "Este perfil ainda não está disponível.",
          "aviso"
        );

        return;
      }

      const parametros =
        new URLSearchParams({
          slug,
        });

      if (servicoId) {
        parametros.set(
          "servico",
          String(servicoId)
        );
      }

      registrarComportamento(
        servicoId
          ? "servico_selecionado"
          : "negocio_selecionado",
        {
          negocioId:
            negocio.id,
          propriedades: {
            origem:
              "inicio",
            servico_id:
              servicoId ||
              undefined,
          },
        }
      );

      window.location.href =
        `/html/perfil-negocio.html?${parametros.toString()}`;
    }

    function criarImagemServico(
      servico,
      negocio
    ) {
      const fotoUrl =
        String(
          servico.foto_url ||
          negocio.foto_url ||
          ""
        ).trim();

      if (!fotoUrl) {
        return criarElemento(
          "div",
          "servico-home-imagem servico-home-sem-foto",
          "💅"
        );
      }

      const imagem =
        document.createElement(
          "img"
        );

      imagem.className =
        "servico-home-imagem";

      imagem.src =
        fotoUrl;

      imagem.alt =
        `Foto de ${
          servico.nome ||
          "serviço"
        }`;

      imagem.loading =
        "lazy";

      imagem.decoding =
        "async";

      imagem.addEventListener(
        "error",
        () => {
          imagem.replaceWith(
            criarElemento(
              "div",
              "servico-home-imagem servico-home-sem-foto",
              "💅"
            )
          );
        },
        {
          once: true,
        }
      );

      return imagem;
    }

    function criarCardServico({
      servico,
      negocio,
    }) {
      const card =
        criarElemento(
          "article",
          "card-servico-home af-fade-in"
        );

      const imagem =
        criarImagemServico(
          servico,
          negocio
        );

      const conteudo =
        criarElemento(
          "div",
          "servico-home-conteudo"
        );

      const nome =
        criarElemento(
          "h3",
          "",
          servico.nome ||
          "Serviço de beleza"
        );

      const negocioNome =
        criarElemento(
          "button",
          "servico-home-negocio",
          negocio.nome ||
          "Negócio"
        );

      negocioNome.type =
        "button";

      negocioNome.addEventListener(
        "click",
        () => {
          abrirPerfil(
            negocio
          );
        }
      );

      const meta =
        criarElemento(
          "div",
          "servico-home-meta"
        );

      meta.append(
        criarElemento(
          "strong",
          "",
          formatarMoeda(
            servico.valor
          )
        ),
        criarElemento(
          "span",
          "",
          `⏱ ${Number(
            servico.duracao_minutos ||
            0
          )} min`
        )
      );

      const botao =
        criarElemento(
          "button",
          "servico-home-agendar",
          "Agendar"
        );

      botao.type =
        "button";

      botao.setAttribute(
        "aria-label",
        `Agendar ${
          servico.nome ||
          "serviço"
        } em ${
          negocio.nome ||
          "negócio"
        }`
      );

      botao.addEventListener(
        "click",
        () => {
          abrirPerfil(
            negocio,
            servico.id
          );
        }
      );

      conteudo.append(
        nome,
        negocioNome,
        meta,
        botao
      );

      card.append(
        imagem,
        conteudo
      );

      return card;
    }

    function criarCardNegocio(
      negocio
    ) {
      const card =
        criarElemento(
          "article",
          "card-negocio af-fade-in"
        );

      card.tabIndex =
        0;

      card.setAttribute(
        "role",
        "link"
      );

      card.setAttribute(
        "aria-label",
        `Abrir perfil de ${
          negocio.nome ||
          "negócio"
        }`
      );

      const imagem =
        criarImagemNegocio(
          negocio
        );

      const nome =
        criarElemento(
          "h3",
          "",
          negocio.nome ||
          "Negócio"
        );

      const local =
        criarElemento(
          "span",
          "local",
          formatarLocal(
            negocio
          )
        );

      const descricao =
        criarElemento(
          "p",
          "descricao",
          negocio.descricao ||
          "Este negócio ainda não adicionou uma descrição."
        );

      const areas =
        criarElemento(
          "div",
          "areas-card"
        );

      obterAreas(
        negocio
      )
        .slice(
          0,
          4
        )
        .forEach(
          (area) => {
            areas.appendChild(
              criarElemento(
                "span",
                "",
                area
              )
            );
          }
        );

      const botao =
        criarElemento(
          "button",
          "btn-card-agendar",
          "Ver horários"
        );

      botao.type =
        "button";

      botao.setAttribute(
        "aria-label",
        `Ver horários de ${
          negocio.nome ||
          "negócio"
        }`
      );

      botao.addEventListener(
        "click",
        (evento) => {
          evento.stopPropagation();

          abrirPerfil(
            negocio
          );
        }
      );

      card.addEventListener(
        "click",
        () => {
          abrirPerfil(
            negocio
          );
        }
      );

      card.addEventListener(
        "keydown",
        (evento) => {
          if (
            evento.key !==
              "Enter" &&
            evento.key !==
              " "
          ) {
            return;
          }

          evento.preventDefault();

          abrirPerfil(
            negocio
          );
        }
      );

      card.append(
        imagem,
        nome,
        local,
        descricao,
        areas,
        botao
      );

      return card;
    }

    function atualizarTotal() {
      if (
        elementos.totalNegocios
      ) {
        const total =
          obterNegociosFiltrados()
            .length;

        elementos.totalNegocios
          .textContent =
          `${total} ${
            total === 1
              ? "negócio"
              : "negócios"
          }`;
      }
    }

    function obterServicosFiltrados() {
      const termo =
        normalizarTexto(
          estado.termoBusca
        );

      const categoria =
        normalizarTexto(
          estado.categoria
        );

      const servicos = [];

      estado.negocios
        .forEach(
          (negocio) => {
            obterServicos(
              negocio
            ).forEach(
              (servico) => {
                const textoBusca =
                  normalizarTexto(
                    [
                      servico.nome,
                      servico.descricao,
                      negocio.nome,
                      negocio.cidade,
                      negocio.bairro,
                    ].join(" ")
                  );

                if (
                  termo &&
                  !textoBusca.includes(
                    termo
                  )
                ) {
                  return;
                }

                if (
                  categoria &&
                  !textoBusca.includes(
                    categoria
                  )
                ) {
                  return;
                }

                servicos.push({
                  servico,
                  negocio,
                });
              }
            );
          }
        );

      return servicos;
    }

    function obterNegociosFiltrados() {
      const termo =
        normalizarTexto(
          estado.termoBusca
        );

      const categoria =
        normalizarTexto(
          estado.categoria
        );

      if (
        !termo &&
        !categoria
      ) {
        return [
          ...estado.negocios,
        ];
      }

      return estado.negocios
        .filter(
          (negocio) => {
            const textoBusca = [
              negocio.nome,
              negocio.cidade,
              negocio.bairro,
              negocio.setor,
              negocio.descricao,
              ...obterAreas(
                negocio
              ),
              ...obterServicos(
                negocio
              ).flatMap(
                (servico) => [
                  servico.nome,
                  servico.descricao,
                ]
              ),
            ].join(
              " "
            );

            const textoNormalizado =
              normalizarTexto(
              textoBusca
            );

            return (
              (
                !termo ||
                textoNormalizado.includes(
                  termo
                )
              ) &&
              (
                !categoria ||
                textoNormalizado.includes(
                  categoria
                )
              )
            );
          }
        );
    }

    function renderizarServicos() {
      const lista =
        elementos.listaServicos;

      if (!lista) {
        return;
      }

      const servicos =
        obterServicosFiltrados();

      if (
        elementos.totalServicos
      ) {
        elementos.totalServicos
          .textContent =
          `${servicos.length} ${
            servicos.length === 1
              ? "serviço"
              : "serviços"
          }`;
      }

      lista.replaceChildren();

      if (
        servicos.length === 0
      ) {
        lista.appendChild(
          criarEstadoVazio(
            "Nenhum serviço encontrado",
            "Tente outra busca ou categoria."
          )
        );

        lista.setAttribute(
          "aria-busy",
          "false"
        );

        return;
      }

      const fragmento =
        document.createDocumentFragment();

      servicos.forEach(
        (item) => {
          fragmento.appendChild(
            criarCardServico(
              item
            )
          );
        }
      );

      lista.appendChild(
        fragmento
      );

      lista.setAttribute(
        "aria-busy",
        "false"
      );
    }

    function renderizarNegocios() {
      const lista =
        elementos.listaNegocios;

      if (!lista) {
        return;
      }

      atualizarTotal();

      const negociosFiltrados =
        obterNegociosFiltrados();

      lista.replaceChildren();

      if (
        negociosFiltrados.length ===
        0
      ) {
        const possuiBusca =
          Boolean(
            normalizarTexto(
              estado.termoBusca
            )
          );

        lista.appendChild(
          criarEstadoVazio(
            possuiBusca
              ? "Nenhum resultado encontrado"
              : "Nenhum negócio disponível",

            possuiBusca
              ? "Tente buscar por outro nome, cidade, bairro ou serviço."
              : "Novos profissionais aparecerão aqui quando estiverem disponíveis."
          )
        );

        lista.setAttribute(
          "aria-busy",
          "false"
        );

        return;
      }

      const fragmento =
        document.createDocumentFragment();

      negociosFiltrados
        .forEach(
          (negocio) => {
            fragmento.appendChild(
              criarCardNegocio(
                negocio
              )
            );
          }
        );

      lista.appendChild(
        fragmento
      );

      lista.setAttribute(
        "aria-busy",
        "false"
      );
    }

    function renderizarConteudo() {
      renderizarServicos();
      renderizarNegocios();
    }

    function salvarLocalizacaoUsuario(
      latitude,
      longitude
    ) {
      localStorage.setItem(
        "user_lat",
        String(latitude)
      );

      localStorage.setItem(
        "user_lon",
        String(longitude)
      );
    }

    function obterLocalizacaoSalva() {
      const latitude =
        normalizarNumero(
          localStorage.getItem(
            "user_lat"
          )
        );

      const longitude =
        normalizarNumero(
          localStorage.getItem(
            "user_lon"
          )
        );

      if (
        latitude === null ||
        longitude === null
      ) {
        return null;
      }

      return {
        latitude,
        longitude,
      };
    }

    function obterLocalizacaoUsuario() {
      return new Promise(
        (resolve) => {
          const localizacaoSalva =
            obterLocalizacaoSalva();

          if (
            !navigator.geolocation
          ) {
            resolve(
              localizacaoSalva
            );

            return;
          }

          navigator.geolocation
            .getCurrentPosition(
              (posicao) => {
                const latitude =
                  posicao.coords
                    .latitude;

                const longitude =
                  posicao.coords
                    .longitude;

                salvarLocalizacaoUsuario(
                  latitude,
                  longitude
                );

                resolve({
                  latitude,
                  longitude,
                });
              },

              () => {
                resolve(
                  localizacaoSalva
                );
              },

              {
                enableHighAccuracy:
                  false,

                timeout:
                  6000,

                maximumAge:
                  1000 *
                  60 *
                  15,
              }
            );
        }
      );
    }

    function calcularDistancia(
      latitudeUsuario,
      longitudeUsuario,
      latitudeNegocio,
      longitudeNegocio
    ) {
      const raioTerra =
        6371;

      const paraRadianos =
        (valor) =>
          (
            valor *
            Math.PI
          ) / 180;

      const diferencaLatitude =
        paraRadianos(
          latitudeNegocio -
          latitudeUsuario
        );

      const diferencaLongitude =
        paraRadianos(
          longitudeNegocio -
          longitudeUsuario
        );

      const latitude1 =
        paraRadianos(
          latitudeUsuario
        );

      const latitude2 =
        paraRadianos(
          latitudeNegocio
        );

      const calculo =
        Math.sin(
          diferencaLatitude / 2
        ) ** 2 +
        Math.cos(
          latitude1
        ) *
          Math.cos(
            latitude2
          ) *
          Math.sin(
            diferencaLongitude / 2
          ) ** 2;

      return (
        raioTerra *
        2 *
        Math.atan2(
          Math.sqrt(
            calculo
          ),

          Math.sqrt(
            1 - calculo
          )
        )
      );
    }

    async function aplicarProximidade() {
      const usuario =
        await obterLocalizacaoUsuario();

      if (!usuario) {
        return;
      }

      estado.negocios =
        estado.negocios
          .map(
            (
              negocio,
              indice
            ) => {
              const latitude =
                normalizarNumero(
                  negocio.latitude
                );

              const longitude =
                normalizarNumero(
                  negocio.longitude
                );

              if (
                latitude === null ||
                longitude === null
              ) {
                return {
                  ...negocio,

                  distancia:
                    null,

                  ordemOriginal:
                    negocio
                      .ordemOriginal ??
                    indice,
                };
              }

              return {
                ...negocio,

                distancia:
                  calcularDistancia(
                    usuario.latitude,
                    usuario.longitude,
                    latitude,
                    longitude
                  ),

                ordemOriginal:
                  negocio
                    .ordemOriginal ??
                  indice,
              };
            }
          )
          .sort(
            (negocioA, negocioB) => {
              const distanciaA =
                normalizarNumero(
                  negocioA.distancia
                );

              const distanciaB =
                normalizarNumero(
                  negocioB.distancia
                );

              if (
                distanciaA === null &&
                distanciaB === null
              ) {
                return (
                  negocioA
                    .ordemOriginal -
                  negocioB
                    .ordemOriginal
                );
              }

              if (
                distanciaA === null
              ) {
                return 1;
              }

              if (
                distanciaB === null
              ) {
                return -1;
              }

              return (
                distanciaA -
                distanciaB
              );
            }
          );

      renderizarConteudo();
    }

    async function lerRespostaJson(
      resposta
    ) {
      try {
        return await resposta.json();
      } catch {
        return {};
      }
    }

    async function buscarNegocios(
      signal
    ) {
      const apiUrl =
        obterApiUrl();

      if (!apiUrl) {
        throw new Error(
          "A conexão com o servidor não está configurada."
        );
      }

      const resposta =
        await fetch(
          `${apiUrl}/negocios-publicos`,
          {
            method:
              "GET",

            headers: {
              Accept:
                "application/json",
            },

            cache:
              "no-store",

            signal,
          }
        );

      const resultado =
        await lerRespostaJson(
          resposta
        );

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ||
          resultado.mensagem ||
          "Erro ao carregar negócios."
        );
      }

      return Array.isArray(
        resultado.negocios
      )
        ? resultado.negocios
        : [];
    }

    async function carregarNegocios() {
      estado.controlador
        ?.abort();

      estado.controlador =
        new AbortController();

      definirCarregando(
        true
      );

      esconderMensagem();

      elementos.listaNegocios
        ?.replaceChildren(
          criarEstadoCarregando()
        );

      try {
        const negocios =
          await buscarNegocios(
            estado.controlador
              .signal
          );

        estado.negocios =
          negocios.map(
            (
              negocio,
              indice
            ) => ({
              ...negocio,

              distancia:
                null,

              ordemOriginal:
                indice,
            })
          );

        renderizarConteudo();

        /*
         * A lista aparece imediatamente.
         * A localização é aplicada depois,
         * sem segurar o carregamento inicial.
         */
        void aplicarProximidade();
      } catch (erro) {
        if (
          erro?.name ===
          "AbortError"
        ) {
          return;
        }

        console.error(
          "Erro ao carregar negócios:",
          erro
        );

        mostrarMensagem(
          erro?.message ||
          "Erro na conexão com o servidor.",
          "erro"
        );

        elementos.listaNegocios
          ?.replaceChildren(
            criarEstadoErro()
          );
      } finally {
        definirCarregando(
          false
        );
      }
    }

    function filtrarNegocios() {
      estado.termoBusca =
        elementos.campoBusca
          ?.value ||
        "";

      renderizarConteudo();

      const termoPresente =
        normalizarTexto(
          estado.termoBusca
        ).length >= 2;

      if (termoPresente) {
        registrarComportamento(
          "busca_realizada",
          {
            propriedades: {
              termo_presente:
                true,
              resultados:
                obterNegociosFiltrados()
                  .length +
                obterServicosFiltrados()
                  .length,
            },
          }
        );
      }
    }

    function configurarEventos() {
      elementos.campoBusca
        ?.addEventListener(
          "input",
          () => {
            window.clearTimeout(
              estado
                .temporizadorBusca
            );

            estado.temporizadorBusca =
              window.setTimeout(
                filtrarNegocios,
                160
              );
          }
        );

      elementos.filtrosCategorias
        ?.addEventListener(
          "click",
          (evento) => {
            const botao =
              evento.target.closest(
                "[data-categoria]"
              );

            if (!botao) {
              return;
            }

            estado.categoria =
              botao.dataset
                .categoria ||
              "";

            registrarComportamento(
              "categoria_selecionada",
              {
                propriedades: {
                  categoria:
                    estado.categoria ||
                    "todas",
                },
              }
            );

            elementos
              .filtrosCategorias
              .querySelectorAll(
                "[data-categoria]"
              )
              .forEach(
                (item) => {
                  item.classList
                    .toggle(
                      "ativo",
                      item === botao
                    );
                }
              );

            renderizarConteudo();
          }
        );

      window.addEventListener(
        "beforeunload",
        () => {
          estado.controlador
            ?.abort();

          window.clearTimeout(
            estado
              .temporizadorBusca
          );
        }
      );
    }

    async function iniciar() {
      configurarEventos();

      await carregarNegocios();
    }

    void iniciar();
  }
);
