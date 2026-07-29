document.addEventListener(
  "DOMContentLoaded",
  async () => {
    /*
     * =====================================================
     * ELEMENTOS
     * =====================================================
     *
     * Alguns nomes alternativos são aceitos para manter
     * compatibilidade com versões anteriores do admin.html.
     */

    function buscarElemento(...ids) {
      for (const id of ids) {
        const elemento =
          document.getElementById(id);

        if (elemento) {
          return elemento;
        }
      }

      return null;
    }

    const elementos = {
      pagina:
        buscarElemento(
          "adminPage",
          "paginaAdmin",
          "painelAdmin"
        ),

      mensagem:
        buscarElemento(
          "mensagemAdmin",
          "adminMensagem",
          "mensagemDashboard"
        ),

      filtroPeriodo:
        buscarElemento(
          "filtroPeriodo",
          "periodoAdmin"
        ),

      btnAtualizar:
        buscarElemento(
          "btnAtualizarAdmin",
          "btnAtualizarDashboard",
          "btnAtualizar"
        ),

      btnLogout:
        buscarElemento(
          "btnLogout",
          "btnSairAdmin"
        ),

      /*
       * Indicadores gerais.
       */
      totalNegocios:
        buscarElemento(
          "totalNegocios"
        ),

      totalClientes:
        buscarElemento(
          "totalClientes"
        ),

      totalProfissionais:
        buscarElemento(
          "totalProfissionais"
        ),

      totalAgendamentos:
        buscarElemento(
          "totalAgendamentos"
        ),

      /*
       * Indicadores do dia.
       */
      usuariosHoje:
        buscarElemento(
          "usuariosHoje"
        ),

      negociosHoje:
        buscarElemento(
          "negociosHoje"
        ),

      agendamentosHoje:
        buscarElemento(
          "agendamentosHoje"
        ),

      taxaConversaoGeral:
        buscarElemento(
          "taxaConversaoGeral",
          "taxaConversao"
        ),

      /*
       * Métricas da plataforma.
       */
      visitasPlataforma:
        buscarElemento(
          "visitasPlataforma"
        ),

      cliquesWhatsapp:
        buscarElemento(
          "cliquesWhatsapp"
        ),

      cliquesMaps:
        buscarElemento(
          "cliquesMaps"
        ),

      favoritosTotais:
        buscarElemento(
          "favoritosTotais"
        ),

      funilDescobriram:
        buscarElemento(
          "funilDescobriram"
        ),

      funilAvaliaram:
        buscarElemento(
          "funilAvaliaram"
        ),

      funilIniciaram:
        buscarElemento(
          "funilIniciaram"
        ),

      funilConcluiram:
        buscarElemento(
          "funilConcluiram"
        ),

      funilConversao:
        buscarElemento(
          "funilConversao"
        ),

      acoesDashboard:
        buscarElemento(
          "acoesDashboard"
        ),

      /*
       * Destaques.
       */
      cidadeTop:
        buscarElemento(
          "cidadeTop"
        ),

      setorTop:
        buscarElemento(
          "setorTop"
        ),

      /*
       * Qualidade dos negócios.
       */
      negociosSemServico:
        buscarElemento(
          "negociosSemServico"
        ),

      negociosSemMaps:
        buscarElemento(
          "negociosSemMaps"
        ),

      negociosSemWhatsapp:
        buscarElemento(
          "negociosSemWhatsapp"
        ),

      negociosCompletos:
        buscarElemento(
          "negociosCompletos"
        ),

      /*
       * Listagens.
       */
      listaNegocios:
        buscarElemento(
          "listaNegocios",
          "negociosAdmin"
        ),

      listaAgendamentos:
        buscarElemento(
          "listaAgendamentos",
          "agendamentosAdmin"
        ),

      negociosMaisAgendados:
        buscarElemento(
          "negociosMaisAgendados"
        ),

      negociosMaisVistos:
        buscarElemento(
          "negociosMaisVistos"
        ),

      cidadesTop:
        buscarElemento(
          "cidadesTop",
          "listaCidadesTop"
        ),

      usuariosRecentes:
        buscarElemento(
          "usuariosRecentes",
          "listaUsuariosRecentes"
        ),
    };

    const estado = {
      carregando:
        false,

      periodo:
        "all",

      temporizadorMensagem:
        null,

      requisicaoId:
        0,
    };

    const PERIODOS = new Map([
      [
        "todos",
        "all",
      ],

      [
        "all",
        "all",
      ],

      [
        "hoje",
        "today",
      ],

      [
        "today",
        "today",
      ],

      [
        "7dias",
        "7",
      ],

      [
        "7",
        "7",
      ],

      [
        "30dias",
        "30",
      ],

      [
        "30",
        "30",
      ],

      [
        "mes",
        "month",
      ],

      [
        "mês",
        "month",
      ],

      [
        "month",
        "month",
      ],
    ]);

    const formatadorMoeda =
      new Intl.NumberFormat(
        "pt-BR",
        {
          style:
            "currency",

          currency:
            "BRL",
        }
      );

    const formatadorData =
      new Intl.DateTimeFormat(
        "pt-BR",
        {
          dateStyle:
            "short",

          timeStyle:
            "short",
        }
      );

    /*
     * =====================================================
     * SERVIÇOS OBRIGATÓRIOS
     * =====================================================
     */

    if (
      !window.API ||
      typeof window.API.get !==
        "function"
    ) {
      console.error(
        "API não foi carregada na página administrativa."
      );

      mostrarMensagem(
        "O serviço da API não foi carregado."
      );

      return;
    }

    if (
      !window.AuthService ||
      typeof window.AuthService
        .getToken !==
        "function" ||
      typeof window.AuthService
        .limparSessao !==
        "function"
    ) {
      console.error(
        "AuthService não foi carregado na página administrativa."
      );

      mostrarMensagem(
        "O serviço de autenticação não foi carregado."
      );

      return;
    }

    /*
     * =====================================================
     * UTILITÁRIOS
     * =====================================================
     */

    function converterNumero(
      valor
    ) {
      const numero =
        Number(valor);

      return Number.isFinite(
        numero
      )
        ? numero
        : 0;
    }

    function converterInteiro(
      valor
    ) {
      return Math.trunc(
        converterNumero(valor)
      );
    }

    function normalizarTexto(
      valor,
      padrao = ""
    ) {
      const texto =
        String(
          valor ?? ""
        ).trim();

      return texto || padrao;
    }

    function normalizarPeriodo(
      valor
    ) {
      const chave =
        normalizarTexto(
          valor,
          "all"
        ).toLocaleLowerCase(
          "pt-BR"
        );

      return (
        PERIODOS.get(chave) ||
        "all"
      );
    }

    function formatarMoeda(
      valor
    ) {
      return formatadorMoeda
        .format(
          converterNumero(
            valor
          )
        );
    }

    function formatarData(
      valor
    ) {
      if (!valor) {
        return "-";
      }

      const data =
        new Date(valor);

      if (
        Number.isNaN(
          data.getTime()
        )
      ) {
        return String(valor);
      }

      return formatadorData
        .format(data);
    }

    function formatarDataAgendamento(
      data,
      horario
    ) {
      if (!data) {
        return "-";
      }

      const textoData =
        String(data)
          .slice(0, 10);

      const partes =
        textoData.split("-");

      const dataFormatada =
        partes.length === 3
          ? `${partes[2]}/${partes[1]}/${partes[0]}`
          : textoData;

      const hora =
        normalizarTexto(
          horario
        ).slice(0, 5);

      return hora
        ? `${dataFormatada} às ${hora}`
        : dataFormatada;
    }

    function formatarWhatsapp(
      valor
    ) {
      const numeros =
        String(
          valor ?? ""
        ).replace(
          /\D/g,
          ""
        );

      if (
        numeros.length === 11
      ) {
        return (
          `(${numeros.slice(0, 2)}) ` +
          `${numeros.slice(2, 7)}-` +
          numeros.slice(7)
        );
      }

      if (
        numeros.length === 10
      ) {
        return (
          `(${numeros.slice(0, 2)}) ` +
          `${numeros.slice(2, 6)}-` +
          numeros.slice(6)
        );
      }

      return numeros || "-";
    }

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

    function definirTexto(
      elemento,
      valor
    ) {
      if (!elemento) {
        return;
      }

      elemento.textContent =
        String(
          valor ?? ""
        );
    }

    function limparElemento(
      elemento
    ) {
      elemento?.replaceChildren();
    }

    function renderizarVazio(
      elemento,
      texto
    ) {
      if (!elemento) {
        return;
      }

      elemento.replaceChildren(
        criarElemento(
          "div",
          "estado-vazio",
          texto
        )
      );
    }

    /*
     * =====================================================
     * MENSAGENS E CARREGAMENTO
     * =====================================================
     */

    function mostrarMensagem(
      texto,
      tipo = "erro",
      removerDepois = false
    ) {
      if (!elementos.mensagem) {
        return;
      }

      window.clearTimeout(
        estado.temporizadorMensagem
      );

      elementos.mensagem
        .textContent =
          String(texto || "");

      elementos.mensagem
        .classList.remove(
          "hidden",
          "erro",
          "sucesso",
          "aviso"
        );

      elementos.mensagem
        .classList.add(tipo);

      elementos.mensagem
        .dataset.tipo =
          tipo;

      if (
        removerDepois
      ) {
        estado.temporizadorMensagem =
          window.setTimeout(
            esconderMensagem,
            3500
          );
      }
    }

    function esconderMensagem() {
      if (!elementos.mensagem) {
        return;
      }

      window.clearTimeout(
        estado.temporizadorMensagem
      );

      elementos.mensagem
        .textContent = "";

      elementos.mensagem
        .classList.add(
          "hidden"
        );

      elementos.mensagem
        .classList.remove(
          "erro",
          "sucesso",
          "aviso"
        );

      elementos.mensagem
        .removeAttribute(
          "data-tipo"
        );
    }

    function definirCarregando(
      ativo
    ) {
      estado.carregando =
        ativo;

      elementos.pagina
        ?.setAttribute(
          "aria-busy",
          String(ativo)
        );

      elementos.pagina
        ?.classList.toggle(
          "carregando",
          ativo
        );

      if (
        elementos.filtroPeriodo
      ) {
        elementos.filtroPeriodo
          .disabled =
            ativo;
      }

      if (
        elementos.btnAtualizar
      ) {
        elementos.btnAtualizar
          .disabled =
            ativo;

        elementos.btnAtualizar
          .textContent =
            ativo
              ? "Atualizando..."
              : "Atualizar";
      }
    }

    /*
     * =====================================================
     * SESSÃO E PERMISSÃO
     * =====================================================
     */

    function redirecionarLogin() {
      window.AuthService
        .limparSessao();

      window.location.replace(
        "/html/login-profissional.html"
      );
    }

    function redirecionarInicio() {
      window.location.replace(
        "/html/inicio.html"
      );
    }

    function tratarErroAcesso(
      erro
    ) {
      if (
        erro?.status === 401
      ) {
        redirecionarLogin();

        return true;
      }

      if (
        erro?.status === 403
      ) {
        mostrarMensagem(
          erro?.message ||
            "Sua conta não possui acesso administrativo.",
          "aviso"
        );

        window.setTimeout(
          redirecionarInicio,
          1200
        );

        return true;
      }

      return false;
    }

    /*
     * =====================================================
     * DASHBOARD
     * =====================================================
     */

    function renderizarDashboard(
      dados = {}
    ) {
      definirTexto(
        elementos.totalNegocios,
        converterInteiro(
          dados.totalNegocios ??
          dados.indicadores
            ?.totalNegocios
        )
      );

      definirTexto(
        elementos.totalClientes,
        converterInteiro(
          dados.totalClientes ??
          dados.indicadores
            ?.totalClientes
        )
      );

      definirTexto(
        elementos.totalProfissionais,
        converterInteiro(
          dados.totalProfissionais ??
          dados.indicadores
            ?.totalProfissionais
        )
      );

      definirTexto(
        elementos.totalAgendamentos,
        converterInteiro(
          dados.totalAgendamentos ??
          dados.indicadores
            ?.totalAgendamentos
        )
      );

      definirTexto(
        elementos.usuariosHoje,
        converterInteiro(
          dados.usuariosHoje ??
          dados.hoje
            ?.usuariosHoje
        )
      );

      definirTexto(
        elementos.negociosHoje,
        converterInteiro(
          dados.negociosHoje ??
          dados.hoje
            ?.negociosHoje
        )
      );

      definirTexto(
        elementos.agendamentosHoje,
        converterInteiro(
          dados.agendamentosHoje ??
          dados.hoje
            ?.agendamentosHoje
        )
      );

      definirTexto(
        elementos.taxaConversaoGeral,
        `${
          converterNumero(
            dados.taxaConversaoGeral ??
            dados.metricas
              ?.taxaConversaoGeral
          )
        }%`
      );

      definirTexto(
        elementos.visitasPlataforma,
        converterInteiro(
          dados.visitasPlataforma ??
          dados.metricas
            ?.visitasPlataforma
        )
      );

      definirTexto(
        elementos.cliquesWhatsapp,
        converterInteiro(
          dados.cliquesWhatsapp ??
          dados.metricas
            ?.cliquesWhatsapp
        )
      );

      definirTexto(
        elementos.cliquesMaps,
        converterInteiro(
          dados.cliquesMaps ??
          dados.metricas
            ?.cliquesMaps
        )
      );

      definirTexto(
        elementos.favoritosTotais,
        converterInteiro(
          dados.favoritosTotais ??
          dados.metricas
            ?.favoritosTotais
        )
      );

      definirTexto(
        elementos.funilDescobriram,
        converterInteiro(
          dados.comportamento
            ?.descobriram
        )
      );

      definirTexto(
        elementos.funilAvaliaram,
        converterInteiro(
          dados.comportamento
            ?.avaliaram
        )
      );

      definirTexto(
        elementos.funilIniciaram,
        converterInteiro(
          dados.comportamento
            ?.iniciaram
        )
      );

      definirTexto(
        elementos.funilConcluiram,
        converterInteiro(
          dados.comportamento
            ?.concluiram
        )
      );

      definirTexto(
        elementos.funilConversao,
        `${
          converterNumero(
            dados.comportamento
              ?.conversaoAgendamento
          )
        }%`
      );

      definirTexto(
        elementos.acoesDashboard,
        converterInteiro(
          dados.comportamento
            ?.acoesDashboard
        )
      );

      definirTexto(
        elementos.cidadeTop,
        normalizarTexto(
          dados.cidadeTop ??
          dados.destaques
            ?.cidadeTop,
          "-"
        )
      );

      definirTexto(
        elementos.setorTop,
        normalizarTexto(
          dados.setorTop ??
          dados.destaques
            ?.setorTop,
          "-"
        )
      );

      definirTexto(
        elementos.negociosSemServico,
        converterInteiro(
          dados.negociosSemServico ??
          dados.qualidade
            ?.negociosSemServico
        )
      );

      definirTexto(
        elementos.negociosSemMaps,
        converterInteiro(
          dados.negociosSemMaps ??
          dados.qualidade
            ?.negociosSemMaps
        )
      );

      definirTexto(
        elementos.negociosSemWhatsapp,
        converterInteiro(
          dados.negociosSemWhatsapp ??
          dados.qualidade
            ?.negociosSemWhatsapp
        )
      );

      definirTexto(
        elementos.negociosCompletos,
        converterInteiro(
          dados.negociosCompletos ??
          dados.qualidade
            ?.negociosCompletos
        )
      );
    }

    /*
     * =====================================================
     * NEGÓCIOS
     * =====================================================
     */

    function criarCardNegocio(
      negocio
    ) {
      const card =
        criarElemento(
          "article",
          "admin-item admin-negocio-item"
        );

      const cabecalho =
        criarElemento(
          "div",
          "admin-item-topo"
        );

      const informacoes =
        criarElemento(
          "div",
          "admin-item-info"
        );

      const nome =
        criarElemento(
          "strong",
          "",
          normalizarTexto(
            negocio?.nome,
            "Negócio sem nome"
          )
        );

      const local =
        [
          negocio?.bairro,
          negocio?.cidade,
        ]
          .filter(Boolean)
          .join(" • ");

      const subtitulo =
        criarElemento(
          "span",
          "",
          local ||
          normalizarTexto(
            negocio?.setor,
            "Localização não informada"
          )
        );

      informacoes.append(
        nome,
        subtitulo
      );

      const status =
        criarElemento(
          "span",
          negocio?.ativo === false
            ? "admin-status inativo"
            : "admin-status ativo",
          negocio?.ativo === false
            ? "Inativo"
            : "Ativo"
        );

      cabecalho.append(
        informacoes,
        status
      );

      const detalhes =
        criarElemento(
          "div",
          "admin-item-detalhes"
        );

      const whatsapp =
        normalizarTexto(
          negocio?.whatsapp ??
          negocio?.whatsapp_negocio
        );

      const dados = [
        `📞 ${
          formatarWhatsapp(
            whatsapp
          )
        }`,

        `👥 ${
          converterInteiro(
            negocio
              ?.total_profissionais
          )
        } profissionais`,

        `💅 ${
          converterInteiro(
            negocio
              ?.total_servicos
          )
        } serviços`,

        `📅 ${
          converterInteiro(
            negocio
              ?.total_agendamentos
          )
        } agendamentos`,
      ];

      dados.forEach(
        (texto) => {
          detalhes.appendChild(
            criarElemento(
              "span",
              "",
              texto
            )
          );
        }
      );

      card.append(
        cabecalho,
        detalhes
      );

      if (
        negocio?.slug
      ) {
        const link =
          criarElemento(
            "a",
            "admin-item-link",
            "Abrir perfil"
          );

        link.href =
          `/html/perfil-negocio.html?slug=${
            encodeURIComponent(
              negocio.slug
            )
          }`;

        card.appendChild(
          link
        );
      }

      return card;
    }

    function renderizarNegocios(
      negocios
    ) {
      if (!elementos.listaNegocios) {
        return;
      }

      limparElemento(
        elementos.listaNegocios
      );

      if (
        !Array.isArray(negocios) ||
        negocios.length === 0
      ) {
        renderizarVazio(
          elementos.listaNegocios,
          "Nenhum negócio cadastrado."
        );

        return;
      }

      const fragmento =
        document.createDocumentFragment();

      negocios.forEach(
        (negocio) => {
          fragmento.appendChild(
            criarCardNegocio(
              negocio
            )
          );
        }
      );

      elementos.listaNegocios
        .appendChild(
          fragmento
        );
    }

    /*
     * =====================================================
     * AGENDAMENTOS
     * =====================================================
     */

    function criarCardAgendamento(
      agendamento
    ) {
      const card =
        criarElemento(
          "article",
          "admin-item admin-agendamento-item"
        );

      const cabecalho =
        criarElemento(
          "div",
          "admin-item-topo"
        );

      const informacoes =
        criarElemento(
          "div",
          "admin-item-info"
        );

      informacoes.append(
        criarElemento(
          "strong",
          "",
          normalizarTexto(
            agendamento
              ?.cliente_nome,
            "Cliente não informado"
          )
        ),

        criarElemento(
          "span",
          "",
          formatarDataAgendamento(
            agendamento?.data,
            agendamento?.horario
          )
        )
      );

      const statusTexto =
        normalizarTexto(
          agendamento?.status,
          "agendado"
        );

      const status =
        criarElemento(
          "span",
          `admin-status ${statusTexto.toLowerCase()}`,
          statusTexto
        );

      cabecalho.append(
        informacoes,
        status
      );

      const detalhes =
        criarElemento(
          "div",
          "admin-item-detalhes"
        );

      [
        `🏢 ${
          normalizarTexto(
            agendamento?.negocio,
            "Negócio não informado"
          )
        }`,

        `💅 ${
          normalizarTexto(
            agendamento?.servico,
            "Serviço não informado"
          )
        }`,

        `👤 ${
          normalizarTexto(
            agendamento
              ?.profissional,
            "Profissional não informado"
          )
        }`,

        `💰 ${
          formatarMoeda(
            agendamento?.valor
          )
        }`,

        `📞 ${
          formatarWhatsapp(
            agendamento
              ?.cliente_whatsapp
          )
        }`,
      ].forEach(
        (texto) => {
          detalhes.appendChild(
            criarElemento(
              "span",
              "",
              texto
            )
          );
        }
      );

      card.append(
        cabecalho,
        detalhes
      );

      return card;
    }

    function renderizarAgendamentos(
      agendamentos
    ) {
      if (
        !elementos.listaAgendamentos
      ) {
        return;
      }

      limparElemento(
        elementos.listaAgendamentos
      );

      if (
        !Array.isArray(
          agendamentos
        ) ||
        agendamentos.length === 0
      ) {
        renderizarVazio(
          elementos.listaAgendamentos,
          "Nenhum agendamento encontrado."
        );

        return;
      }

      const fragmento =
        document.createDocumentFragment();

      agendamentos.forEach(
        (agendamento) => {
          fragmento.appendChild(
            criarCardAgendamento(
              agendamento
            )
          );
        }
      );

      elementos.listaAgendamentos
        .appendChild(
          fragmento
        );
    }

    /*
     * =====================================================
     * MARKETING
     * =====================================================
     */

    function renderizarRanking(
      elemento,
      lista,
      criarDescricao
    ) {
      if (!elemento) {
        return;
      }

      limparElemento(
        elemento
      );

      if (
        !Array.isArray(lista) ||
        lista.length === 0
      ) {
        renderizarVazio(
          elemento,
          "Nenhum dado encontrado."
        );

        return;
      }

      const fragmento =
        document.createDocumentFragment();

      lista.forEach(
        (
          item,
          indice
        ) => {
          const card =
            criarElemento(
              "article",
              "admin-ranking-item"
            );

          const posicao =
            criarElemento(
              "strong",
              "admin-ranking-posicao",
              `${indice + 1}º`
            );

          const informacoes =
            criarElemento(
              "div",
              "admin-ranking-info"
            );

          informacoes.append(
            criarElemento(
              "strong",
              "",
              normalizarTexto(
                item?.nome ??
                item?.cidade,
                "Não informado"
              )
            ),

            criarElemento(
              "span",
              "",
              criarDescricao(item)
            )
          );

          card.append(
            posicao,
            informacoes
          );

          fragmento.appendChild(
            card
          );
        }
      );

      elemento.appendChild(
        fragmento
      );
    }

    function renderizarUsuariosRecentes(
      usuarios
    ) {
      if (
        !elementos.usuariosRecentes
      ) {
        return;
      }

      limparElemento(
        elementos.usuariosRecentes
      );

      if (
        !Array.isArray(usuarios) ||
        usuarios.length === 0
      ) {
        renderizarVazio(
          elementos.usuariosRecentes,
          "Nenhum usuário recente."
        );

        return;
      }

      const fragmento =
        document.createDocumentFragment();

      usuarios.forEach(
        (usuario) => {
          const card =
            criarElemento(
              "article",
              "admin-item admin-usuario-item"
            );

          const informacoes =
            criarElemento(
              "div",
              "admin-item-info"
            );

          informacoes.append(
            criarElemento(
              "strong",
              "",
              normalizarTexto(
                usuario?.nome,
                "Usuário sem nome"
              )
            ),

            criarElemento(
              "span",
              "",
              normalizarTexto(
                usuario?.email,
                "E-mail não informado"
              )
            )
          );

          const perfil =
            normalizarTexto(
              usuario?.perfil ??
              usuario?.tipo,
              "usuario"
            );

          const badge =
            criarElemento(
              "span",
              "admin-status",
              perfil
            );

          const rodape =
            criarElemento(
              "small",
              "",
              `Cadastrado em ${
                formatarData(
                  usuario?.created_at
                )
              }`
            );

          card.append(
            informacoes,
            badge,
            rodape
          );

          fragmento.appendChild(
            card
          );
        }
      );

      elementos.usuariosRecentes
        .appendChild(
          fragmento
        );
    }

    function renderizarMarketing(
      dados = {}
    ) {
      renderizarRanking(
        elementos
          .negociosMaisAgendados,

        dados
          .negociosMaisAgendados,

        (item) =>
          `${
            converterInteiro(
              item?.total
            )
          } agendamentos • ${
            formatarMoeda(
              item?.faturamento
            )
          }`
      );

      renderizarRanking(
        elementos
          .negociosMaisVistos,

        dados
          .negociosMaisVistos,

        (item) =>
          `${
            converterInteiro(
              item?.visitas
            )
          } visitas • ${
            converterInteiro(
              item
                ?.cliques_whatsapp
            )
          } cliques no WhatsApp`
      );

      renderizarRanking(
        elementos.cidadesTop,

        dados.cidades,

        (item) =>
          `${
            converterInteiro(
              item?.total
            )
          } negócios`
      );

      renderizarUsuariosRecentes(
        dados.usuariosRecentes
      );
    }

    /*
     * =====================================================
     * REQUISIÇÕES
     * =====================================================
     */

    async function carregarDashboard() {
      const periodo =
        normalizarPeriodo(
          elementos.filtroPeriodo
            ?.value ||
          estado.periodo
        );

      estado.periodo =
        periodo;

      return window.API.get(
        `/admin/dashboard?periodo=${
          encodeURIComponent(
            periodo
          )
        }`
      );
    }

    async function carregarTudo() {
      if (
        estado.carregando
      ) {
        return;
      }

      const token =
        window.AuthService
          .getToken();

      if (!token) {
        redirecionarLogin();

        return;
      }

      const requisicaoAtual =
        ++estado.requisicaoId;

      definirCarregando(
        true
      );

      esconderMensagem();

      try {
        /*
         * A primeira chamada também confirma se
         * o usuário é administrador no backend.
         */
        const dashboard =
          await carregarDashboard();

        if (
          requisicaoAtual !==
          estado.requisicaoId
        ) {
          return;
        }

        renderizarDashboard(
          dashboard
        );

        const resultados =
          await Promise.allSettled([
            window.API.get(
              "/admin/negocios"
            ),

            window.API.get(
              "/admin/agendamentos"
            ),

            window.API.get(
              "/admin/marketing"
            ),
          ]);

        if (
          requisicaoAtual !==
          estado.requisicaoId
        ) {
          return;
        }

        const [
          negociosResultado,
          agendamentosResultado,
          marketingResultado,
        ] = resultados;

        if (
          negociosResultado.status ===
          "fulfilled"
        ) {
          renderizarNegocios(
            negociosResultado
              .value
              ?.negocios
          );
        } else {
          console.error(
            "Erro ao carregar negócios administrativos:",
            negociosResultado.reason
          );

          renderizarVazio(
            elementos.listaNegocios,
            "Não foi possível carregar os negócios."
          );
        }

        if (
          agendamentosResultado.status ===
          "fulfilled"
        ) {
          renderizarAgendamentos(
            agendamentosResultado
              .value
              ?.agendamentos
          );
        } else {
          console.error(
            "Erro ao carregar agendamentos administrativos:",
            agendamentosResultado.reason
          );

          renderizarVazio(
            elementos.listaAgendamentos,
            "Não foi possível carregar os agendamentos."
          );
        }

        if (
          marketingResultado.status ===
          "fulfilled"
        ) {
          renderizarMarketing(
            marketingResultado.value
          );
        } else {
          console.error(
            "Erro ao carregar marketing administrativo:",
            marketingResultado.reason
          );

          renderizarVazio(
            elementos
              .negociosMaisAgendados,
            "Não foi possível carregar este ranking."
          );

          renderizarVazio(
            elementos
              .negociosMaisVistos,
            "Não foi possível carregar este ranking."
          );

          renderizarVazio(
            elementos.cidadesTop,
            "Não foi possível carregar as cidades."
          );

          renderizarVazio(
            elementos.usuariosRecentes,
            "Não foi possível carregar os usuários."
          );
        }

        mostrarMensagem(
          "Painel administrativo atualizado.",
          "sucesso",
          true
        );
      } catch (erro) {
        console.error(
          "Erro ao carregar painel administrativo:",
          erro
        );

        if (
          tratarErroAcesso(
            erro
          )
        ) {
          return;
        }

        mostrarMensagem(
          erro?.message ||
            "Não foi possível carregar o painel administrativo."
        );
      } finally {
        if (
          requisicaoAtual ===
          estado.requisicaoId
        ) {
          definirCarregando(
            false
          );
        }
      }
    }

    /*
     * =====================================================
     * EVENTOS
     * =====================================================
     */

    elementos.filtroPeriodo
      ?.addEventListener(
        "change",
        () => {
          estado.periodo =
            normalizarPeriodo(
              elementos
                .filtroPeriodo
                .value
            );

          sessionStorage.setItem(
            "adminPeriodo",
            estado.periodo
          );

          carregarTudo();
        }
      );

    elementos.btnAtualizar
      ?.addEventListener(
        "click",
        carregarTudo
      );

    elementos.btnLogout
      ?.addEventListener(
        "click",
        () => {
          window.AuthService
            .limparSessao();

          window.location.replace(
            "/html/login-profissional.html"
          );
        }
      );

    window.addEventListener(
      "online",
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          carregarTudo();
        }
      }
    );

    window.addEventListener(
      "beforeunload",
      () => {
        window.clearTimeout(
          estado.temporizadorMensagem
        );

        estado.requisicaoId +=
          1;
      }
    );

    /*
     * =====================================================
     * INICIALIZAÇÃO
     * =====================================================
     */

    const periodoSalvo =
      normalizarPeriodo(
        sessionStorage.getItem(
          "adminPeriodo"
        ) ||
        elementos.filtroPeriodo
          ?.value ||
        "all"
      );

    estado.periodo =
      periodoSalvo;

    if (
      elementos.filtroPeriodo
    ) {
      const opcoes =
        Array.from(
          elementos
            .filtroPeriodo
            .options
        );

      const opcaoCompativel =
        opcoes.find(
          (opcao) =>
            normalizarPeriodo(
              opcao.value
            ) ===
            periodoSalvo
        );

      if (
        opcaoCompativel
      ) {
        elementos.filtroPeriodo
          .value =
            opcaoCompativel.value;
      }
    }

    await carregarTudo();
  }
);
