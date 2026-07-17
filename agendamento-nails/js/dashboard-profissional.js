document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const token =
      localStorage.getItem(
        "token"
      );

    if (!token) {
      window.location.href =
        "login-profissional.html";

      return;
    }

    const elementos = {
      nomeNegocio:
        document.getElementById(
          "nomeNegocio"
        ),

      mensagemDashboard:
        document.getElementById(
          "mensagemDashboard"
        ),

      agendamentosHoje:
        document.getElementById(
          "agendamentosHoje"
        ),

      faturamentoHoje:
        document.getElementById(
          "faturamentoHoje"
        ),

      realizadosHoje:
        document.getElementById(
          "realizadosHoje"
        ),

      pendentesHoje:
        document.getElementById(
          "pendentesHoje"
        ),

      cancelamentosHoje:
        document.getElementById(
          "cancelamentosHoje"
        ),

      clientesUnicos:
        document.getElementById(
          "clientesUnicos"
        ),

      totalAgendados:
        document.getElementById(
          "totalAgendados"
        ),

      faturamentoEstimado:
        document.getElementById(
          "faturamentoEstimado"
        ),

      proximoAtendimento:
        document.getElementById(
          "proximoAtendimento"
        ),

      listaProximosAtendimentos:
        document.getElementById(
          "listaProximosAtendimentos"
        ),

      listaServicos:
        document.getElementById(
          "listaServicos"
        ),

      btnAgenda:
        document.getElementById(
          "btnAgenda"
        ),

      btnAgendamentos:
        document.getElementById(
          "btnAgendamentos"
        ),

      btnHome:
        document.getElementById(
          "btnHome"
        ),

      btnSair:
        document.getElementById(
          "btnSair"
        ),
    };

    function converterNumero(
      valor
    ) {
      const numero =
        Number(valor);

      return Number.isFinite(numero)
        ? numero
        : 0;
    }

    function formatarMoeda(
      valor
    ) {
      return converterNumero(
        valor
      ).toLocaleString(
        "pt-BR",
        {
          style: "currency",
          currency: "BRL",
        }
      );
    }

    function formatarData(
      data
    ) {
      if (!data) {
        return "-";
      }

      const partes =
        String(data).split("-");

      if (
        partes.length !== 3
      ) {
        return String(data);
      }

      const [
        ano,
        mes,
        dia,
      ] = partes;

      return `${dia}/${mes}/${ano}`;
    }

    function formatarHorario(
      horario
    ) {
      if (!horario) {
        return "-";
      }

      return String(
        horario
      ).slice(0, 5);
    }

    function formatarStatus(
      status
    ) {
      const statusNormalizado =
        String(
          status || ""
        ).toLowerCase();

      const textos = {
        agendado: "Agendado",
        confirmado: "Confirmado",
        realizado: "Realizado",
        cancelado: "Cancelado",
      };

      return (
        textos[
          statusNormalizado
        ] ||
        status ||
        "Não informado"
      );
    }

    function criarElemento(
      tag,
      classe,
      texto
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
        texto !== undefined &&
        texto !== null
      ) {
        elemento.textContent =
          texto;
      }

      return elemento;
    }

    function exibirMensagem(
      mensagem,
      tipo = ""
    ) {
      elementos
        .mensagemDashboard
        .textContent = mensagem;

      elementos
        .mensagemDashboard
        .className =
          "mensagem-dashboard";

      if (tipo) {
        elementos
          .mensagemDashboard
          .classList.add(
            `mensagem-${tipo}`
          );
      }
    }

    function criarLinhaInformacao(
      titulo,
      valor
    ) {
      const linha =
        criarElemento(
          "div",
          "atendimento-informacao"
        );

      const rotulo =
        criarElemento(
          "span",
          "atendimento-rotulo",
          titulo
        );

      const conteudo =
        criarElemento(
          "strong",
          "atendimento-valor",
          valor
        );

      linha.append(
        rotulo,
        conteudo
      );

      return linha;
    }

    function criarCardAtendimento(
      atendimento,
      destaque = false
    ) {
      const card =
        criarElemento(
          "article",
          destaque
            ? "atendimento-card atendimento-destaque"
            : "atendimento-card"
        );

      const cabecalho =
        criarElemento(
          "div",
          "atendimento-cabecalho"
        );

      const horario =
        criarElemento(
          "strong",
          "atendimento-horario",
          formatarHorario(
            atendimento.horario
          )
        );

      const status =
        criarElemento(
          "span",
          `status-atendimento status-${atendimento.status || "agendado"}`,
          formatarStatus(
            atendimento.status
          )
        );

      cabecalho.append(
        horario,
        status
      );

      const clienteNome =
        atendimento.cliente?.nome ||
        "Cliente não informada";

      const servicoNome =
        atendimento.servico?.nome ||
        "Serviço não informado";

      const valorServico =
        formatarMoeda(
          atendimento.servico?.valor
        );

      const duracao =
        converterNumero(
          atendimento.servico
            ?.duracao_minutos
        );

      card.append(
        cabecalho,

        criarLinhaInformacao(
          "Data",
          formatarData(
            atendimento.data
          )
        ),

        criarLinhaInformacao(
          "Cliente",
          clienteNome
        ),

        criarLinhaInformacao(
          "Serviço",
          servicoNome
        ),

        criarLinhaInformacao(
          "Valor",
          valorServico
        ),

        criarLinhaInformacao(
          "Duração",
          duracao > 0
            ? `${duracao} minutos`
            : "-"
        )
      );

      const whatsapp =
        atendimento.cliente
          ?.whatsapp;

      if (whatsapp) {
        const linkWhatsapp =
          criarElemento(
            "a",
            "btn-whatsapp",
            "Falar com a cliente"
          );

        const numeroLimpo =
          String(
            whatsapp
          ).replace(
            /\D/g,
            ""
          );

        linkWhatsapp.href =
          `https://wa.me/${numeroLimpo}`;

        linkWhatsapp.target =
          "_blank";

        linkWhatsapp.rel =
          "noopener noreferrer";

        card.appendChild(
          linkWhatsapp
        );
      }

      return card;
    }

    function renderizarResumo(
      resumo = {}
    ) {
      elementos
        .agendamentosHoje
        .textContent =
          converterNumero(
            resumo
              .agendamentos_hoje ??
            resumo
              .agendados_hoje
          );

      elementos
        .faturamentoHoje
        .textContent =
          formatarMoeda(
            resumo
              .faturamento_previsto_hoje
          );

      elementos
        .realizadosHoje
        .textContent =
          converterNumero(
            resumo.realizados_hoje
          );

      elementos
        .pendentesHoje
        .textContent =
          converterNumero(
            resumo.pendentes_hoje
          );

      elementos
        .cancelamentosHoje
        .textContent =
          converterNumero(
            resumo
              .cancelamentos_hoje
          );

      elementos
        .clientesUnicos
        .textContent =
          converterNumero(
            resumo.clientes_unicos
          );

      elementos
        .totalAgendados
        .textContent =
          converterNumero(
            resumo.total_agendados
          );

      elementos
        .faturamentoEstimado
        .textContent =
          formatarMoeda(
            resumo
              .faturamento_estimado
          );
    }

    function renderizarProximoAtendimento(
      atendimento
    ) {
      elementos
        .proximoAtendimento
        .replaceChildren();

      if (!atendimento) {
        elementos
          .proximoAtendimento
          .appendChild(
            criarElemento(
              "p",
              "estado-vazio",
              "Nenhum atendimento futuro encontrado."
            )
          );

        return;
      }

      elementos
        .proximoAtendimento
        .appendChild(
          criarCardAtendimento(
            atendimento,
            true
          )
        );
    }

    function renderizarProximosAtendimentos(
      atendimentos
    ) {
      elementos
        .listaProximosAtendimentos
        .replaceChildren();

      if (
        !Array.isArray(
          atendimentos
        ) ||
        atendimentos.length === 0
      ) {
        elementos
          .listaProximosAtendimentos
          .appendChild(
            criarElemento(
              "p",
              "estado-vazio",
              "Nenhum atendimento futuro encontrado."
            )
          );

        return;
      }

      atendimentos.forEach(
        (atendimento) => {
          elementos
            .listaProximosAtendimentos
            .appendChild(
              criarCardAtendimento(
                atendimento
              )
            );
        }
      );
    }

    function renderizarServicos(
      servicos
    ) {
      elementos
        .listaServicos
        .replaceChildren();

      if (
        !Array.isArray(
          servicos
        ) ||
        servicos.length === 0
      ) {
        elementos
          .listaServicos
          .appendChild(
            criarElemento(
              "p",
              "estado-vazio",
              "Nenhum serviço vendido ainda."
            )
          );

        return;
      }

      servicos.forEach(
        (servico, indice) => {
          const item =
            criarElemento(
              "article",
              "item-servico"
            );

          const informacoes =
            criarElemento(
              "div",
              "servico-informacoes"
            );

          const posicao =
            criarElemento(
              "span",
              "servico-posicao",
              `${indice + 1}º`
            );

          const nome =
            criarElemento(
              "strong",
              "servico-nome",
              servico.nome ||
                "Serviço"
            );

          informacoes.append(
            posicao,
            nome
          );

          const resultados =
            criarElemento(
              "div",
              "servico-resultados"
            );

          const total =
            criarElemento(
              "span",
              "servico-total",
              `${converterNumero(
                servico.total
              )} agendamentos`
            );

          const faturamento =
            criarElemento(
              "strong",
              "servico-faturamento",
              formatarMoeda(
                servico.faturamento
              )
            );

          resultados.append(
            total,
            faturamento
          );

          item.append(
            informacoes,
            resultados
          );

          elementos
            .listaServicos
            .appendChild(
              item
            );
        }
      );
    }

    async function carregarDashboard() {
      exibirMensagem(
        "Carregando dashboard..."
      );

      try {
        const resposta =
          await fetch(
            `${API_URL}/dashboard-profissional`,
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${token}`,

                Accept:
                  "application/json",
              },
            }
          );

        const dados =
          await resposta
            .json()
            .catch(
              () => ({})
            );

        if (
          resposta.status === 401
        ) {
          localStorage.removeItem(
            "token"
          );

          localStorage.removeItem(
            "usuario"
          );

          localStorage.removeItem(
            "negocio"
          );

          window.location.href =
            "login-profissional.html";

          return;
        }

        if (!resposta.ok) {
          throw new Error(
            dados.erro ||
            dados.mensagem ||
            "Não foi possível carregar o dashboard."
          );
        }

        const resumo =
          dados.resumo || {};

        renderizarResumo(
          resumo
        );

        renderizarProximoAtendimento(
          dados.proximo_atendimento
        );

        renderizarProximosAtendimentos(
          dados.proximos_atendimentos ||
          []
        );

        /*
         * Mantém compatibilidade com a
         * resposta antiga e com a nova.
         */
        renderizarServicos(
          dados.servicos_mais_vendidos ||
          dados.servicosMaisVendidos ||
          []
        );

        if (
          dados.negocio?.nome
        ) {
          elementos
            .nomeNegocio
            .textContent =
              dados.negocio.nome;
        }

        exibirMensagem(
          "Dashboard atualizado.",
          "sucesso"
        );
      } catch (erro) {
        console.error(
          "Erro ao carregar dashboard:",
          erro
        );

        exibirMensagem(
          erro.message ||
          "Erro ao carregar o dashboard.",
          "erro"
        );
      }
    }

    elementos
      .btnAgenda
      ?.addEventListener(
        "click",
        () => {
          window.location.href =
            "painel-profissional.html";
        }
      );

    elementos
      .btnAgendamentos
      ?.addEventListener(
        "click",
        () => {
          window.location.href =
            "agendamentos-profissional.html";
        }
      );

    elementos
      .btnHome
      ?.addEventListener(
        "click",
        () => {
          window.location.href =
            "painel-profissional.html";
        }
      );

    elementos
      .btnSair
      ?.addEventListener(
        "click",
        () => {
          localStorage.removeItem(
            "token"
          );

          localStorage.removeItem(
            "usuario"
          );

          localStorage.removeItem(
            "negocio"
          );

          window.location.href =
            "login-profissional.html";
        }
      );

    await carregarDashboard();
  }
);