document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const elementos = {
      titulo:
        document.getElementById(
          "tituloFinalizar"
        ),

      mensagem:
        document.getElementById(
          "mensagemFinalizar"
        ),

      icone:
        document.querySelector(
          ".finalizar-icon"
        ),

      spinner:
        document.querySelector(
          ".finalizar-spinner"
        ),

      progresso:
        document.querySelector(
          ".finalizar-progresso span"
        ),

      passos:
        Array.from(
          document.querySelectorAll(
            ".finalizar-passo"
          )
        ),

      aviso:
        document.querySelector(
          ".finalizar-aviso p"
        ),
    };

    if (
      !elementos.mensagem
    ) {
      console.error(
        "O elemento mensagemFinalizar não foi encontrado."
      );

      return;
    }

    if (
      !window.API ||
      typeof window.API.post !==
        "function"
    ) {
      mostrarEstado({
        tipo: "erro",
        titulo:
          "Não foi possível iniciar",
        mensagem:
          "O serviço da API não foi carregado.",
        etapa: 0,
      });

      return;
    }

    const estado = {
      finalizando: false,
      redirecionando: false,
      temporizador: null,
    };

    function obterToken() {
      if (
        window.AuthService &&
        typeof window.AuthService
          .getToken ===
          "function"
      ) {
        return window.AuthService
          .getToken();
      }

      return localStorage.getItem(
        "token"
      );
    }

    function limparSessao() {
      if (
        window.AuthService &&
        typeof window.AuthService
          .limparSessao ===
          "function"
      ) {
        window.AuthService
          .limparSessao();

        return;
      }

      localStorage.removeItem(
        "token"
      );

      localStorage.removeItem(
        "usuario"
      );

      localStorage.removeItem(
        "negocio"
      );
    }

    function normalizarTexto(
      valor
    ) {
      return String(
        valor ?? ""
      ).trim();
    }

    function normalizarId(
      valor
    ) {
      const id =
        Number(valor);

      return (
        Number.isInteger(id) &&
        id > 0
      )
        ? id
        : null;
    }

    function dataValida(
      valor
    ) {
      const texto =
        normalizarTexto(valor);

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          texto
        )
      ) {
        return false;
      }

      const data =
        new Date(
          `${texto}T00:00:00`
        );

      return !Number.isNaN(
        data.getTime()
      );
    }

    function horarioValido(
      valor
    ) {
      return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(
        normalizarTexto(valor)
      );
    }

    function obterAgendamentoPendente() {
      const conteudo =
        localStorage.getItem(
          "agendamentoPendente"
        );

      if (!conteudo) {
        return null;
      }

      try {
        const dados =
          JSON.parse(conteudo);

        if (
          !dados ||
          typeof dados !==
            "object" ||
          Array.isArray(dados)
        ) {
          return null;
        }

        return dados;
      } catch {
        return null;
      }
    }

    function validarAgendamento(
      dados
    ) {
      if (
        !dados ||
        typeof dados !==
          "object"
      ) {
        return null;
      }

      const negocioId =
        normalizarId(
          dados.negocio_id ??
          dados.negocioId
        );

      const slug =
        normalizarTexto(
          dados.slug ??
          dados.negocio_slug ??
          dados.negocioSlug
        );

      const servicoId =
        normalizarId(
          dados.servico_id ??
          dados.servicoId
        );

      const profissionalId =
        normalizarId(
          dados.profissional_id ??
          dados.profissionalId
        );

      const data =
        normalizarTexto(
          dados.data
        );

      const horario =
        normalizarTexto(
          dados.horario ??
          dados.hora
        );

      /*
       * O negócio pode ser identificado
       * pelo ID antigo ou pelo slug atual.
       */
      if (
        (!negocioId && !slug) ||
        !servicoId ||
        !profissionalId ||
        !dataValida(data) ||
        !horarioValido(horario)
      ) {
        return null;
      }

      const payload = {
        ...dados,

        servico_id:
          servicoId,

        profissional_id:
          profissionalId,

        data,

        horario,
      };

      if (negocioId) {
        payload.negocio_id =
          negocioId;
      }

      if (slug) {
        payload.slug =
          slug;
      }

      delete payload.negocioId;
      delete payload.negocioSlug;
      delete payload.servicoId;
      delete payload.profissionalId;
      delete payload.hora;

      return payload;
    }

    function atualizarPassos(
      etapaAtual
    ) {
      elementos.passos
        .forEach(
          (
            passo,
            indice
          ) => {
            const numeroEtapa =
              indice + 1;

            passo.classList.remove(
              "concluido",
              "ativo"
            );

            if (
              numeroEtapa <
              etapaAtual
            ) {
              passo.classList.add(
                "concluido"
              );

              const marcador =
                passo.querySelector(
                  ":scope > span"
                );

              if (marcador) {
                marcador.textContent =
                  "✓";
              }

              return;
            }

            if (
              numeroEtapa ===
              etapaAtual
            ) {
              passo.classList.add(
                "ativo"
              );

              const marcador =
                passo.querySelector(
                  ":scope > span"
                );

              if (marcador) {
                marcador.textContent =
                  String(
                    numeroEtapa
                  );
              }

              return;
            }

            const marcador =
              passo.querySelector(
                ":scope > span"
              );

            if (marcador) {
              marcador.textContent =
                String(
                  numeroEtapa
                );
            }
          }
        );
    }

    function definirProcessando(
      processando
    ) {
      elementos.spinner
        ?.classList.toggle(
          "hidden",
          !processando
        );

      if (
        elementos.progresso
      ) {
        elementos.progresso
          .style.animationPlayState =
            processando
              ? "running"
              : "paused";
      }
    }

    function mostrarEstado({
      tipo = "aviso",
      titulo,
      mensagem,
      etapa = 2,
      processando = false,
      icone,
    }) {
      if (
        titulo &&
        elementos.titulo
      ) {
        elementos.titulo
          .textContent =
            titulo;
      }

      elementos.mensagem
        .textContent =
          String(
            mensagem ||
            ""
          );

      elementos.mensagem
        .classList.remove(
          "hidden",
          "erro",
          "sucesso",
          "aviso"
        );

      elementos.mensagem
        .classList.add(
          tipo
        );

      elementos.mensagem
        .dataset.tipo =
          tipo;

      if (
        icone &&
        elementos.icone
      ) {
        elementos.icone
          .textContent =
            icone;
      }

      atualizarPassos(
        etapa
      );

      definirProcessando(
        processando
      );
    }

    function redirecionar(
      destino,
      atraso = 0
    ) {
      if (
        estado.redirecionando
      ) {
        return;
      }

      estado.redirecionando =
        true;

      window.clearTimeout(
        estado.temporizador
      );

      estado.temporizador =
        window.setTimeout(
          () => {
            window.location.replace(
              destino
            );
          },
          atraso
        );
    }

    function obterDestinoPerfil(
      dados
    ) {
      const slug =
        normalizarTexto(
          dados?.slug
        );

      if (!slug) {
        return "/html/inicio.html";
      }

      return (
        "/html/perfil-negocio.html?slug=" +
        encodeURIComponent(
          slug
        )
      );
    }

    function redirecionarLogin() {
      localStorage.setItem(
        "voltarDepoisLogin",
        "/html/finalizar-agendamento.html"
      );

      limparSessao();

      mostrarEstado({
        tipo: "aviso",
        titulo:
          "Entre para continuar",
        mensagem:
          "Você será direcionado para o login.",
        etapa: 1,
        processando: false,
        icone: "🔐",
      });

      redirecionar(
        "/html/login-cliente.html",
        500
      );
    }

    function tratarErroSessao(
      erro
    ) {
      if (
        erro?.status === 401 ||
        erro?.status === 403
      ) {
        redirecionarLogin();

        return true;
      }

      return false;
    }

    async function finalizarAgendamento() {
      if (
        estado.finalizando ||
        estado.redirecionando
      ) {
        return;
      }

      if (!obterToken()) {
        redirecionarLogin();

        return;
      }

      const pendente =
        obterAgendamentoPendente();

      if (!pendente) {
        localStorage.removeItem(
          "agendamentoPendente"
        );

        mostrarEstado({
          tipo: "aviso",
          titulo:
            "Nenhum agendamento pendente",
          mensagem:
            "Você será direcionado para a página inicial.",
          etapa: 1,
          processando: false,
          icone: "📅",
        });

        redirecionar(
          "/html/inicio.html",
          1400
        );

        return;
      }

      const dados =
        validarAgendamento(
          pendente
        );

      if (!dados) {
        localStorage.removeItem(
          "agendamentoPendente"
        );

        localStorage.removeItem(
          "voltarDepoisLogin"
        );

        mostrarEstado({
          tipo: "erro",
          titulo:
            "Dados do agendamento inválidos",
          mensagem:
            "Volte ao perfil do negócio e escolha o horário novamente.",
          etapa: 1,
          processando: false,
          icone: "⚠️",
        });

        redirecionar(
          obterDestinoPerfil(
            pendente
          ),
          1800
        );

        return;
      }

      estado.finalizando =
        true;

      mostrarEstado({
        tipo: "aviso",
        titulo:
          "Estamos confirmando seu agendamento",
        mensagem:
          "Verificando a disponibilidade do horário selecionado.",
        etapa: 2,
        processando: true,
        icone: "💅",
      });

      if (
        elementos.aviso
      ) {
        elementos.aviso
          .textContent =
            "Não feche esta página enquanto a confirmação estiver sendo processada.";
      }

      try {
        const resultado =
          await window.API.post(
            "/agendamentos",
            dados
          );

        window.AFAnalytics
          ?.registrar?.(
            "agendamento_concluido",
            {
              propriedades: {
                origem:
                  "finalizar_agendamento",
                servico_id:
                  Number(
                    dados
                      .servico_id
                  ) ||
                  0,
                status:
                  "sucesso",
              },
            }
          );

        localStorage.removeItem(
          "agendamentoPendente"
        );

        localStorage.removeItem(
          "voltarDepoisLogin"
        );

        mostrarEstado({
          tipo: "sucesso",
          titulo:
            "Agendamento confirmado",
          mensagem:
            resultado?.mensagem ||
            "Seu horário foi reservado com sucesso.",
          etapa: 3,
          processando: false,
          icone: "✅",
        });

        /*
         * Deixa todos os passos concluídos.
         */
        elementos.passos
          .forEach(
            (passo) => {
              passo.classList.remove(
                "ativo"
              );

              passo.classList.add(
                "concluido"
              );

              const marcador =
                passo.querySelector(
                  ":scope > span"
                );

              if (marcador) {
                marcador.textContent =
                  "✓";
              }
            }
          );

        if (
          elementos.progresso
        ) {
          elementos.progresso
            .style.width =
              "100%";

          elementos.progresso
            .style.transform =
              "none";

          elementos.progresso
            .style.animation =
              "none";
        }

        if (
          elementos.aviso
        ) {
          elementos.aviso
            .textContent =
              "Abrindo sua agenda...";
        }

        redirecionar(
          "/html/meus-agendamentos.html",
          1100
        );
      } catch (erro) {
        console.error(
          "Erro ao finalizar agendamento:",
          erro
        );

        if (
          tratarErroSessao(
            erro
          )
        ) {
          return;
        }

        const mensagemErro =
          erro?.message ||
          "Não foi possível finalizar o agendamento.";

        if (
          erro?.status === 409
        ) {
          localStorage.removeItem(
            "agendamentoPendente"
          );

          localStorage.removeItem(
            "voltarDepoisLogin"
          );

          mostrarEstado({
            tipo: "aviso",
            titulo:
              "Horário indisponível",
            mensagem:
              mensagemErro ||
              "Outra pessoa reservou esse horário.",
            etapa: 2,
            processando: false,
            icone: "🕒",
          });

          if (
            elementos.aviso
          ) {
            elementos.aviso
              .textContent =
                "Você será direcionado para escolher outro horário.";
          }

          redirecionar(
            obterDestinoPerfil(
              dados
            ),
            1900
          );

          return;
        }

        mostrarEstado({
          tipo: "erro",
          titulo:
            "Não foi possível confirmar",
          mensagem:
            mensagemErro,
          etapa: 2,
          processando: false,
          icone: "⚠️",
        });

        if (
          elementos.aviso
        ) {
          elementos.aviso
            .textContent =
              "Seus dados continuam salvos. Atualize a página para tentar novamente.";
        }

        estado.finalizando =
          false;
      }
    }

    window.addEventListener(
      "beforeunload",
      () => {
        window.clearTimeout(
          estado.temporizador
        );
      }
    );

    await finalizarAgendamento();
  }
);
