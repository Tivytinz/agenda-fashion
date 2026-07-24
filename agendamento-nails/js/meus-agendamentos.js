document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const elementos = {
      lista:
        document.getElementById(
          "listaAgendamentos"
        ),

      mensagem:
        document.getElementById(
          "mensagemAgendamentos"
        ),

      filtros:
        Array.from(
          document.querySelectorAll(
            ".filtro"
          )
        ),
    };

    if (
      !elementos.lista ||
      !elementos.mensagem
    ) {
      console.error(
        "Elementos da página de agendamentos não foram encontrados."
      );

      return;
    }

    if (
      !window.SessionGuard ||
      typeof window.SessionGuard
        .exigirConta !== "function"
    ) {
      console.error(
        "SessionGuard não foi carregado."
      );

      window.location.replace(
        "/html/login-cliente.html"
      );

      return;
    }

    if (
      !window.API ||
      typeof window.API.get !==
        "function" ||
      typeof window.API.patch !==
        "function"
    ) {
      mostrarMensagem(
        "O serviço da API não foi carregado."
      );

      return;
    }

    const estado = {
      contexto: null,
      agendamentos: [],
      filtroAtual:
        "agendado",
      carregando:
        false,
      acaoEmAndamento:
        null,
    };

    function normalizarStatus(
      status
    ) {
      const valor =
        String(status || "")
          .trim()
          .toLowerCase();

      const permitidos =
        new Set([
          "agendado",
          "realizado",
          "cancelado",
        ]);

      return permitidos.has(
        valor
      )
        ? valor
        : "agendado";
    }

    function obterNomeStatus(
      status
    ) {
      const nomes = {
        agendado:
          "Agendado",
        realizado:
          "Realizado",
        cancelado:
          "Cancelado",
      };

      return (
        nomes[
          normalizarStatus(
            status
          )
        ] || "Agendado"
      );
    }

    function obterNomeFiltro(
      status
    ) {
      const nomes = {
        agendado:
          "agendado",
        realizado:
          "realizado",
        cancelado:
          "cancelado",
      };

      return (
        nomes[status] ||
        "agendado"
      );
    }

    function formatarData(
      dataIso
    ) {
      const texto =
        String(dataIso || "")
          .slice(0, 10);

      const partes =
        texto.split("-");

      if (
        partes.length !== 3
      ) {
        return "Data não informada";
      }

      const [
        ano,
        mes,
        dia,
      ] = partes.map(Number);

      const data =
        new Date(
          ano,
          mes - 1,
          dia
        );

      if (
        Number.isNaN(
          data.getTime()
        )
      ) {
        return "Data não informada";
      }

      return data
        .toLocaleDateString(
          "pt-BR",
          {
            weekday:
              "long",
            day:
              "2-digit",
            month:
              "2-digit",
            year:
              "numeric",
          }
        );
    }

    function formatarHorario(valor) {
  const horario = String(
    valor ?? ""
  ).trim();

  if (!horario) {
    return "Horário não informado";
  }

  /*
   * Aceita:
   * 08:00
   * 08:00:00
   * 2026-07-18T08:00:00
   */
  const correspondencia = horario.match(
    /(?:T|\s|^)(\d{1,2}):(\d{2})/
  );

  if (!correspondencia) {
    return horario;
  }

  const horas = String(
    correspondencia[1]
  ).padStart(2, "0");

  const minutos = String(
    correspondencia[2]
  ).padStart(2, "0");

  return `${horas}:${minutos}`;
}

    function formatarMoeda(
      valor
    ) {
      const numero =
        Number(valor);

      return (
        Number.isFinite(numero)
          ? numero
          : 0
      ).toLocaleString(
        "pt-BR",
        {
          style:
            "currency",
          currency:
            "BRL",
        }
      );
    }

    function mostrarMensagem(
      texto,
      tipo = "erro"
    ) {
      elementos.mensagem
        .textContent =
          String(texto || "");

      elementos.mensagem
        .classList.remove(
          "hidden"
        );

      elementos.mensagem
        .dataset.tipo =
          tipo;

      elementos.mensagem
        .style.color =
          tipo === "sucesso"
            ? "#2f9e63"
            : "#e63946";
    }

    function esconderMensagem() {
      elementos.mensagem
        .textContent = "";

      elementos.mensagem
        .classList.add(
          "hidden"
        );

      elementos.mensagem
        .removeAttribute(
          "data-tipo"
        );

      elementos.mensagem
        .style.removeProperty(
          "color"
        );
    }

    function exibirEstadoLista(
      texto
    ) {
      elementos.lista
        .replaceChildren();

      const estadoVazio =
        document.createElement(
          "div"
        );

      estadoVazio.className =
        "estado-vazio";

      estadoVazio.textContent =
        texto;

      elementos.lista
        .appendChild(
          estadoVazio
        );
    }

    function redirecionarLogin() {
      window.AuthService
        ?.limparSessao?.();

      window.location.replace(
        "/html/login-cliente.html"
      );
    }

    function tratarErro(
      erro,
      mensagemPadrao
    ) {
      console.error(
        mensagemPadrao,
        erro
      );

      if (
        erro?.status === 401 ||
        erro?.status === 403
      ) {
        redirecionarLogin();

        return true;
      }

      mostrarMensagem(
        erro?.message ||
          mensagemPadrao
      );

      return false;
    }

    function criarElemento(
      tag,
      {
        classe,
        texto,
      } = {}
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
        texto !== undefined
      ) {
        elemento.textContent =
          texto;
      }

      return elemento;
    }

    function criarLinhaInfo(
      icone,
      texto
    ) {
      return criarElemento(
        "span",
        {
          texto:
            `${icone} ${texto}`,
        }
      );
    }

    function definirBotoesBloqueados(
      bloqueado
    ) {
      elementos.lista
        .querySelectorAll(
          "button"
        )
        .forEach(
          (botao) => {
            botao.disabled =
              bloqueado;
          }
        );
    }

    async function cancelarAgendamento(
      id
    ) {
      if (
        estado.acaoEmAndamento
      ) {
        return;
      }

      const confirmou =
        window.confirm(
          "Deseja cancelar este agendamento?"
        );

      if (!confirmou) {
        return;
      }

      esconderMensagem();

      estado.acaoEmAndamento =
        id;

      definirBotoesBloqueados(
        true
      );

      try {
        await window.API.patch(
          `/agendamentos/${encodeURIComponent(
            id
          )}/cancelar`,
          {}
        );

        mostrarMensagem(
          "Agendamento cancelado com sucesso.",
          "sucesso"
        );

        await carregarAgendamentos({
          preservarMensagem:
            true,
        });
      } catch (erro) {
        tratarErro(
          erro,
          "Não foi possível cancelar o agendamento."
        );
      } finally {
        estado.acaoEmAndamento =
          null;

        definirBotoesBloqueados(
          false
        );
      }
    }

    async function avaliarAgendamento(
      id,
      nota
    ) {
      if (
        estado.acaoEmAndamento
      ) {
        return;
      }

      estado.acaoEmAndamento =
        id;

      esconderMensagem();

      definirBotoesBloqueados(
        true
      );

      try {
        await window.API.patch(
          `/agendamentos/${encodeURIComponent(
            id
          )}/avaliar`,
          {
            avaliacao:
              nota,
          }
        );

        mostrarMensagem(
          "Avaliação enviada com sucesso 💅",
          "sucesso"
        );

        await carregarAgendamentos({
          preservarMensagem:
            true,
        });
      } catch (erro) {
        tratarErro(
          erro,
          "Não foi possível enviar sua avaliação."
        );
      } finally {
        estado.acaoEmAndamento =
          null;

        definirBotoesBloqueados(
          false
        );
      }
    }

    function criarAvaliacao(
      item,
      container
    ) {
      const notaAtual =
        Number(
          item.avaliacao
        );

      if (
        Number.isInteger(
          notaAtual
        ) &&
        notaAtual >= 1 &&
        notaAtual <= 5
      ) {
        const avaliado =
          criarElemento(
            "div",
            {
              classe:
                "avaliado",

              texto:
                `Sua avaliação: ` +
                "⭐".repeat(
                  notaAtual
                ),
            }
          );

        container.appendChild(
          avaliado
        );

        return;
      }

      const box =
        criarElemento(
          "div",
          {
            classe:
              "avaliacao-box",
          }
        );

      const titulo =
        criarElemento(
          "p",
          {
            texto:
              "Avalie esse atendimento:",
          }
        );

      const estrelas =
        criarElemento(
          "div",
          {
            classe:
              "estrelas",
          }
        );

      for (
        let nota = 1;
        nota <= 5;
        nota += 1
      ) {
        const estrela =
          criarElemento(
            "button",
            {
              classe:
                "estrela",
              texto:
                "⭐",
            }
          );

        estrela.type =
          "button";

        estrela.title =
          `${nota} estrela` +
          `${nota > 1 ? "s" : ""}`;

        estrela.setAttribute(
          "aria-label",
          `Avaliar com ${nota} ` +
          `${nota > 1
            ? "estrelas"
            : "estrela"}`
        );

        estrela.addEventListener(
          "click",
          () =>
            avaliarAgendamento(
              item.id,
              nota
            )
        );

        estrelas.appendChild(
          estrela
        );
      }

      box.append(
        titulo,
        estrelas
      );

      container.appendChild(
        box
      );
    }

    function criarCard(
      item
    ) {
      const status =
        normalizarStatus(
          item.status
        );

      const card =
        criarElemento(
          "article",
          {
            classe:
              "af-card card-agendamento",
          }
        );

      const topo =
        criarElemento(
          "div",
          {
            classe:
              "card-topo",
          }
        );

      const identificacao =
        criarElemento(
          "div"
        );

      const nomeNegocio =
        criarElemento(
          "h3",
          {
            texto:
              item.negocio ||
              "Negócio",
          }
        );

      const nomeServico =
        criarElemento(
          "span",
          {
            texto:
              item.servico ||
              "Serviço",
          }
        );

      identificacao.append(
        nomeNegocio,
        nomeServico
      );

      const statusElemento =
        criarElemento(
          "span",
          {
            classe:
              `status ${status}`,

            texto:
              obterNomeStatus(
                status
              ),
          }
        );

      topo.append(
        identificacao,
        statusElemento
      );

      const informacoes =
        criarElemento(
          "div",
          {
            classe:
              "info-agendamento",
          }
        );

      informacoes.append(
        criarLinhaInfo(
          "📅",
          formatarData(
            item.data
          )
        ),

        criarLinhaInfo(
          "⏰",
          formatarHorario(
            item.horario
          )
        ),

        criarLinhaInfo(
          "💅",
          `Profissional: ${
            item.profissional ||
            "Não informado"
          }`
        ),

        criarLinhaInfo(
          "💰",
          `Valor: ${formatarMoeda(
            item.valor
          )}`
        )
      );

      const acoes =
        criarElemento(
          "div",
          {
            classe:
              "acoes-agendamento",
          }
        );

      if (
        status === "agendado"
      ) {
        const botaoCancelar =
          criarElemento(
            "button",
            {
              classe:
                "btn-cancelar",

              texto:
                "Cancelar agendamento",
            }
          );

        botaoCancelar.type =
          "button";

        botaoCancelar.addEventListener(
          "click",
          () =>
            cancelarAgendamento(
              item.id
            )
        );

        acoes.appendChild(
          botaoCancelar
        );
      }

      if (
        status === "realizado"
      ) {
        criarAvaliacao(
          item,
          acoes
        );
      }

      card.append(
        topo,
        informacoes,
        acoes
      );

      return card;
    }

    function renderizar() {
      elementos.lista
        .replaceChildren();

      const filtrados =
        estado.agendamentos
          .filter(
            (item) =>
              normalizarStatus(
                item.status
              ) ===
              estado.filtroAtual
          );

      if (
        filtrados.length === 0
      ) {
        exibirEstadoLista(
          `Nenhum agendamento ` +
          `${obterNomeFiltro(
            estado.filtroAtual
          )} encontrado.`
        );

        return;
      }

      const fragmento =
        document.createDocumentFragment();

      filtrados.forEach(
        (item) => {
          fragmento.appendChild(
            criarCard(item)
          );
        }
      );

      elementos.lista
        .appendChild(
          fragmento
        );
    }

    function atualizarFiltroAtivo() {
      elementos.filtros
        .forEach(
          (botao) => {
            const ativo =
              botao.dataset
                .filtro ===
              estado.filtroAtual;

            botao.classList.toggle(
              "ativo",
              ativo
            );

            botao.setAttribute(
              "aria-pressed",
              String(ativo)
            );
          }
        );
    }

    async function carregarAgendamentos({
      preservarMensagem =
        false,
    } = {}) {
      if (
        estado.carregando
      ) {
        return;
      }

      estado.carregando =
        true;

      if (
        !preservarMensagem
      ) {
        esconderMensagem();
      }

      exibirEstadoLista(
        "Carregando agendamentos..."
      );

      try {
        const resultado =
          await window.API.get(
            "/meus-agendamentos"
          );

        estado.agendamentos =
          Array.isArray(
            resultado?.agendamentos
          )
            ? resultado.agendamentos
            : [];

        renderizar();
      } catch (erro) {
        const redirecionou =
          tratarErro(
            erro,
            "Não foi possível carregar seus agendamentos."
          );

        if (!redirecionou) {
          exibirEstadoLista(
            "Não foi possível carregar seus agendamentos."
          );
        }
      } finally {
        estado.carregando =
          false;
      }
    }

    elementos.filtros
      .forEach(
        (botao) => {
          botao.type =
            "button";

          botao.addEventListener(
            "click",
            () => {
              const filtro =
                normalizarStatus(
                  botao.dataset
                    .filtro
                );

              estado.filtroAtual =
                filtro;

              esconderMensagem();
              atualizarFiltroAtivo();
              renderizar();
            }
          );
        }
      );

    atualizarFiltroAtivo();

    try {
      estado.contexto =
        await window.SessionGuard
          .exigirConta({
            destinoLogin:
              "/html/login-cliente.html",
          });

      if (
        !estado.contexto
      ) {
        return;
      }

      await carregarAgendamentos();
    } catch (erro) {
      const redirecionou =
        tratarErro(
          erro,
          "Não foi possível validar sua sessão."
        );

      if (!redirecionou) {
        exibirEstadoLista(
          "Não foi possível carregar seus agendamentos."
        );
      }
    }
  }
);