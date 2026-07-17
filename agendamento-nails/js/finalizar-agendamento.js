document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const mensagem =
      document.getElementById(
        "mensagemFinalizar"
      );

    const estado = {
      finalizando:
        false,

      redirecionando:
        false,

      temporizador:
        null,
    };

    if (!mensagem) {
      console.error(
        "O elemento mensagemFinalizar não foi encontrado."
      );

      return;
    }

    /*
     * =====================================================
     * SERVIÇOS
     * =====================================================
     */

    if (
      !window.API ||
      typeof window.API.post !==
        "function"
    ) {
      mostrarMensagem(
        "O serviço da API não foi carregado.",
        "erro"
      );

      return;
    }

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

    /*
     * =====================================================
     * UTILITÁRIOS
     * =====================================================
     */

    function mostrarMensagem(
      texto,
      tipo = "erro"
    ) {
      mensagem.textContent =
        String(
          texto ||
          "Ocorreu um erro."
        );

      mensagem.classList.remove(
        "hidden",
        "erro",
        "sucesso",
        "aviso"
      );

      mensagem.classList.add(
        tipo
      );

      mensagem.dataset.tipo =
        tipo;

      mensagem.style.color =
        tipo === "sucesso"
          ? "#2f9e63"
          : tipo === "aviso"
            ? "#b76a12"
            : "#e63946";
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

    function normalizarTexto(
      valor
    ) {
      return String(
        valor ?? ""
      ).trim();
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
      const negocioId =
        normalizarId(
          dados.negocio_id ??
          dados.negocioId
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
          dados.horario
        );

      if (
        !negocioId ||
        !servicoId ||
        !profissionalId ||
        !data ||
        !horario
      ) {
        return null;
      }

      return {
        ...dados,

        negocio_id:
          negocioId,

        servico_id:
          servicoId,

        profissional_id:
          profissionalId,

        data,

        horario,
      };
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

    function redirecionarLogin() {
      /*
       * O agendamento pendente é preservado.
       * Após o próximo login, o usuário poderá
       * finalizar o mesmo agendamento.
       */
      localStorage.setItem(
        "voltarDepoisLogin",
        "/html/finalizar-agendamento.html"
      );

      limparSessao();

      redirecionar(
        "/html/login-cliente.html"
      );
    }

    function tratarErroSessao(
      erro
    ) {
      if (
        erro?.status === 401
      ) {
        redirecionarLogin();

        return true;
      }

      return false;
    }

    /*
     * =====================================================
     * FINALIZAÇÃO
     * =====================================================
     */

    async function finalizarAgendamento() {
      if (
        estado.finalizando ||
        estado.redirecionando
      ) {
        return;
      }

      const token =
        obterToken();

      if (!token) {
        redirecionarLogin();

        return;
      }

      const pendente =
        obterAgendamentoPendente();

      if (!pendente) {
        localStorage.removeItem(
          "agendamentoPendente"
        );

        mostrarMensagem(
          "Nenhum agendamento pendente foi encontrado.",
          "aviso"
        );

        redirecionar(
          "/html/inicio.html",
          1200
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

        mostrarMensagem(
          "Os dados do agendamento pendente são inválidos.",
          "erro"
        );

        redirecionar(
          "/html/inicio.html",
          1600
        );

        return;
      }

      estado.finalizando =
        true;

      mostrarMensagem(
        "Confirmando seu agendamento...",
        "aviso"
      );

      try {
        const resultado =
          await window.API.post(
            "/agendamentos",
            dados
          );

        /*
         * O agendamento pendente só é apagado
         * depois que o backend confirma a criação.
         */
        localStorage.removeItem(
          "agendamentoPendente"
        );

        localStorage.removeItem(
          "voltarDepoisLogin"
        );

        mostrarMensagem(
          resultado?.mensagem ||
            "Agendamento confirmado com sucesso 💅",
          "sucesso"
        );

        redirecionar(
          "/html/meus-agendamentos.html",
          900
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

        /*
         * Em falhas temporárias, conflitos de horário
         * ou indisponibilidade do servidor, os dados
         * permanecem salvos para o usuário tentar
         * novamente ou escolher outro horário.
         */
        const mensagemErro =
          erro?.message ||
          "Não foi possível finalizar o agendamento.";

        mostrarMensagem(
          mensagemErro,
          "erro"
        );

        if (
          erro?.status === 409
        ) {
          localStorage.removeItem(
            "agendamentoPendente"
          );

          localStorage.removeItem(
            "voltarDepoisLogin"
          );

          mostrarMensagem(
            mensagemErro ||
              "Esse horário não está mais disponível.",
            "aviso"
          );

          redirecionar(
            "/html/inicio.html",
            1800
          );

          return;
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