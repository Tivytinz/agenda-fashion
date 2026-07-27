document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const elementos = {
      form:
        document.getElementById(
          "formConfiguracaoAgenda"
        ),

      duracaoPadrao:
        document.getElementById(
          "duracaoPadrao"
        ),

      intervaloMinutos:
        document.getElementById(
          "intervaloMinutos"
        ),

      antecedenciaAgendamento:
        document.getElementById(
          "antecedenciaAgendamento"
        ),

      antecedenciaCancelamento:
        document.getElementById(
          "antecedenciaCancelamento"
        ),

      mensagem:
        document.getElementById(
          "mensagemConfiguracao"
        ),

      btnSalvar:
        document.getElementById(
          "btnSalvarConfiguracao"
        ),

      cardsDias:
        Array.from(
          document.querySelectorAll(
            ".dia-card"
          )
        ),
    };

    const elementosObrigatorios = [
      elementos.form,
      elementos.duracaoPadrao,
      elementos.intervaloMinutos,
      elementos.antecedenciaAgendamento,
      elementos.antecedenciaCancelamento,
      elementos.mensagem,
      elementos.btnSalvar,
    ];

    if (
      elementosObrigatorios.some(
        (elemento) => !elemento
      ) ||
      elementos.cardsDias.length !== 7
    ) {
      console.error(
        "A estrutura necessária da configuração da agenda não foi encontrada."
      );

      return;
    }

    const estado = {
      contexto: null,
      token: null,
      carregando: false,
      salvando: false,
      alteracoesPendentes: false,
      mensagemTimer: null,
    };

    /*
     * =====================================================
     * SERVIÇOS
     * =====================================================
     */

    if (
  !window.SessionGuard ||
  typeof window.SessionGuard
    .exigirVinculo !==
    "function"
) {
  console.error(
    "SessionGuard não foi carregado."
  );

  window.location.replace(
    "/html/login-profissional.html"
  );

  return;
}

try {
  estado.contexto =
    await window.SessionGuard
      .exigirVinculo({
        destinoLogin:
          "/html/login-profissional.html",

        destinoSemNegocio:
          "/html/criar-negocio.html",
      });
} catch (erro) {

      mostrarMensagem(
        erro?.message ||
          "Não foi possível validar sua sessão.",
        "erro"
      );

      return;
    }

    if (!estado.contexto) {
      return;
    }

    estado.token =
      window.AuthService &&
      typeof window.AuthService
        .getToken === "function"
        ? window.AuthService
            .getToken()
        : localStorage.getItem(
            "token"
          );

    if (
      !estado.token ||
      !estado.contexto?.usuario?.id ||
      !estado.contexto?.negocio?.id
    ) {
      redirecionarLogin();

      return;
    }

    /*
     * =====================================================
     * UTILITÁRIOS
     * =====================================================
     */

    function normalizarTexto(
      valor
    ) {
      return String(
        valor ?? ""
      ).trim();
    }

    function normalizarNumero(
      valor,
      valorPadrao = 0
    ) {
      const numero =
        Number(valor);

      return Number.isFinite(
        numero
      )
        ? numero
        : valorPadrao;
    }

    function normalizarBooleano(
      valor
    ) {
      if (
        valor === true ||
        valor === 1 ||
        valor === "1"
      ) {
        return true;
      }

      if (
        typeof valor === "string"
      ) {
        return (
          valor.toLowerCase() ===
          "true"
        );
      }

      return false;
    }

    function obterCampo(
      card,
      seletor
    ) {
      return card.querySelector(
        seletor
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

    function redirecionarLogin() {
      limparSessao();

      window.location.replace(
        "/html/login-profissional.html"
      );
    }

    function tratarErroSessao(
      erro
    ) {
      if (
        erro?.status !== 401 &&
        erro?.status !== 403
      ) {
        return false;
      }

      redirecionarLogin();

      return true;
    }

    /*
     * =====================================================
     * MENSAGENS
     * =====================================================
     */

    function esconderMensagem() {
      window.clearTimeout(
        estado.mensagemTimer
      );

      elementos.mensagem
        .textContent = "";

      elementos.mensagem
        .className =
          "mensagem-configuracao hidden";

      delete elementos.mensagem
        .dataset.tipo;
    }

    function mostrarMensagem(
      texto,
      tipo = "sucesso",
      ocultarDepois = 4000
    ) {
      window.clearTimeout(
        estado.mensagemTimer
      );

      elementos.mensagem
        .textContent =
          normalizarTexto(texto) ||
          "Ocorreu um erro.";

      elementos.mensagem
        .className =
          "mensagem-configuracao";

      elementos.mensagem
        .classList.add(
          tipo
        );

      elementos.mensagem
        .dataset.tipo =
          tipo;

      if (
        ocultarDepois > 0
      ) {
        estado.mensagemTimer =
          window.setTimeout(
            esconderMensagem,
            ocultarDepois
          );
      }
    }

    /*
     * =====================================================
     * BOTÃO
     * =====================================================
     */

    function definirTextoBotao(
      texto,
      icone = "✓"
    ) {
      elementos.btnSalvar
        .replaceChildren();

      const span =
        document.createElement(
          "span"
        );

      span.textContent =
        icone;

      span.setAttribute(
        "aria-hidden",
        "true"
      );

      elementos.btnSalvar.append(
        span,
        document.createTextNode(
          ` ${texto}`
        )
      );
    }

    function definirCarregando(
      carregando
    ) {
      estado.carregando =
        Boolean(carregando);

      elementos.btnSalvar.disabled =
        estado.carregando ||
        estado.salvando;

      if (estado.carregando) {
        definirTextoBotao(
          "Carregando...",
          "⏳"
        );

        return;
      }

      definirTextoBotao(
        "Salvar horários",
        "✓"
      );
    }

    function definirSalvando(
      salvando
    ) {
      estado.salvando =
        Boolean(salvando);

      elementos.btnSalvar.disabled =
        estado.salvando ||
        estado.carregando;

      if (estado.salvando) {
        definirTextoBotao(
          "Salvando...",
          "⏳"
        );

        return;
      }

      definirTextoBotao(
        "Salvar horários",
        "✓"
      );
    }

    /*
     * =====================================================
     * API
     * =====================================================
     */

    async function requisicao(
      caminho,
      {
        method = "GET",
        body,
      } = {}
    ) {
      const apiUrl =
        typeof window.API_URL ===
        "string"
          ? window.API_URL
          : typeof API_URL ===
              "string"
            ? API_URL
            : "";

      const resposta =
        await fetch(
          `${apiUrl}${caminho}`,
          {
            method,

            headers: {
              Authorization:
                `Bearer ${estado.token}`,

              ...(body
                ? {
                    "Content-Type":
                      "application/json",
                  }
                : {}),
            },

            ...(body
              ? {
                  body:
                    JSON.stringify(
                      body
                    ),
                }
              : {}),
          }
        );

      let dados = {};

      try {
        dados =
          await resposta.json();
      } catch {
        dados = {};
      }

      if (!resposta.ok) {
        const erro =
          new Error(
            dados?.erro ||
            dados?.mensagem ||
            "Não foi possível concluir a solicitação."
          );

        erro.status =
          resposta.status;

        erro.dados =
          dados;

        throw erro;
      }

      return dados;
    }

    async function apiGet(
      caminho
    ) {
      if (
        window.API &&
        typeof window.API.get ===
          "function"
      ) {
        return window.API.get(
          caminho
        );
      }

      return requisicao(
        caminho
      );
    }

    async function apiPut(
      caminho,
      dados
    ) {
      if (
        window.API &&
        typeof window.API.put ===
          "function"
      ) {
        return window.API.put(
          caminho,
          dados
        );
      }

      return requisicao(
        caminho,
        {
          method: "PUT",
          body: dados,
        }
      );
    }

    /*
     * =====================================================
     * ESTADO DOS DIAS
     * =====================================================
     */

    function atualizarEstadoCard(
      card
    ) {
      const campoTrabalha =
        obterCampo(
          card,
          ".campo-trabalha"
        );

      const status =
        obterCampo(
          card,
          ".dia-status"
        );

      const camposHorario =
        card.querySelectorAll(
          [
            ".campo-inicio",
            ".campo-fim",
            ".campo-intervalo-inicio",
            ".campo-intervalo-fim",
          ].join(", ")
        );

      if (
        !campoTrabalha ||
        !status
      ) {
        return;
      }

      const trabalha =
        campoTrabalha.checked;

      card.classList.toggle(
        "ativo",
        trabalha
      );

      card.classList.toggle(
        "inativo",
        !trabalha
      );

      status.textContent =
        trabalha
          ? "Atende"
          : "Não atende";

      status.setAttribute(
        "aria-label",
        trabalha
          ? "Dia de atendimento ativo"
          : "Dia sem atendimento"
      );

      camposHorario.forEach(
        (campo) => {
          campo.disabled =
            !trabalha;
        }
      );
    }

    function encontrarHorarioPorDia(
      horarios,
      diaSemana
    ) {
      return horarios.find(
        (horario) =>
          Number(
            horario?.dia_semana ??
            horario?.diaSemana
          ) === diaSemana
      );
    }

    function preencherHorarioCard(
      card,
      horario
    ) {
      const campoTrabalha =
        obterCampo(
          card,
          ".campo-trabalha"
        );

      const campoInicio =
        obterCampo(
          card,
          ".campo-inicio"
        );

      const campoFim =
        obterCampo(
          card,
          ".campo-fim"
        );

      const campoIntervaloInicio =
        obterCampo(
          card,
          ".campo-intervalo-inicio"
        );

      const campoIntervaloFim =
        obterCampo(
          card,
          ".campo-intervalo-fim"
        );

      campoTrabalha.checked =
        normalizarBooleano(
          horario?.trabalha
        );

      campoInicio.value =
        normalizarTexto(
          horario?.hora_inicio ??
          horario?.horaInicio
        );

      campoFim.value =
        normalizarTexto(
          horario?.hora_fim ??
          horario?.horaFim
        );

      campoIntervaloInicio.value =
        normalizarTexto(
          horario?.intervalo_inicio ??
          horario?.intervaloInicio
        );

      campoIntervaloFim.value =
        normalizarTexto(
          horario?.intervalo_fim ??
          horario?.intervaloFim
        );

      atualizarEstadoCard(
        card
      );
    }

    /*
     * =====================================================
     * CARREGAMENTO
     * =====================================================
     */

    async function carregarConfiguracao() {
      definirCarregando(
        true
      );

      esconderMensagem();

      try {
        const dados =
          await apiGet(
            "/agenda-configuracao"
          );

        const configuracao =
          dados?.configuracao ||
          {};

        const horarios =
          Array.isArray(
            dados?.horarios
          )
            ? dados.horarios
            : [];

        elementos.duracaoPadrao.value =
          String(
            configuracao
              .duracao_padrao ??
            configuracao
              .duracaoPadrao ??
            60
          );

        elementos.intervaloMinutos.value =
          String(
            configuracao
              .intervalo_minutos ??
            configuracao
              .intervaloMinutos ??
            0
          );

        elementos
          .antecedenciaAgendamento
          .value =
            String(
              configuracao
                .antecedencia_agendamento ??
              configuracao
                .antecedenciaAgendamento ??
              0
            );

        elementos
          .antecedenciaCancelamento
          .value =
            String(
              configuracao
                .antecedencia_cancelamento ??
              configuracao
                .antecedenciaCancelamento ??
              24
            );

        elementos.cardsDias.forEach(
          (card) => {
            const diaSemana =
              Number(
                card.dataset.dia
              );

            const horario =
              encontrarHorarioPorDia(
                horarios,
                diaSemana
              );

            preencherHorarioCard(
              card,
              horario
            );
          }
        );

        estado.alteracoesPendentes =
          false;
      } catch (erro) {
        console.error(
          "Erro ao carregar configuração da agenda:",
          erro
        );

        if (
          tratarErroSessao(
            erro
          )
        ) {
          return;
        }

        mostrarMensagem(
          erro?.message ||
            "Não foi possível carregar a configuração da agenda.",
          "erro",
          0
        );
      } finally {
        definirCarregando(
          false
        );
      }
    }

    /*
     * =====================================================
     * VALIDAÇÃO DOS HORÁRIOS
     * =====================================================
     */

    function horarioParaMinutos(
      horario
    ) {
      const correspondencia =
        /^(\d{2}):(\d{2})$/
          .exec(
            normalizarTexto(
              horario
            )
          );

      if (!correspondencia) {
        return null;
      }

      const horas =
        Number(
          correspondencia[1]
        );

      const minutos =
        Number(
          correspondencia[2]
        );

      if (
        horas < 0 ||
        horas > 23 ||
        minutos < 0 ||
        minutos > 59
      ) {
        return null;
      }

      return (
        horas * 60 +
        minutos
      );
    }

    function obterNomeDia(
      diaSemana
    ) {
      const nomes = [
        "domingo",
        "segunda-feira",
        "terça-feira",
        "quarta-feira",
        "quinta-feira",
        "sexta-feira",
        "sábado",
      ];

      return (
        nomes[diaSemana] ||
        "dia selecionado"
      );
    }

    function validarHorarioCard(
      horario
    ) {
      if (!horario.trabalha) {
        return;
      }

      const nomeDia =
        obterNomeDia(
          horario.diaSemana
        );

      if (
        !horario.horaInicio ||
        !horario.horaFim
      ) {
        throw new Error(
          `Informe o início e o fim do atendimento de ${nomeDia}.`
        );
      }

      const inicio =
        horarioParaMinutos(
          horario.horaInicio
        );

      const fim =
        horarioParaMinutos(
          horario.horaFim
        );

      if (
        inicio === null ||
        fim === null
      ) {
        throw new Error(
          `Existe um horário inválido em ${nomeDia}.`
        );
      }

      if (inicio >= fim) {
        throw new Error(
          `Em ${nomeDia}, o horário final precisa ser posterior ao horário inicial.`
        );
      }

      const possuiInicioIntervalo =
        Boolean(
          horario.intervaloInicio
        );

      const possuiFimIntervalo =
        Boolean(
          horario.intervaloFim
        );

      if (
        possuiInicioIntervalo !==
        possuiFimIntervalo
      ) {
        throw new Error(
          `Preencha o início e o fim do intervalo de ${nomeDia}, ou deixe os dois vazios.`
        );
      }

      if (
        !possuiInicioIntervalo
      ) {
        return;
      }

      const intervaloInicio =
        horarioParaMinutos(
          horario.intervaloInicio
        );

      const intervaloFim =
        horarioParaMinutos(
          horario.intervaloFim
        );

      if (
        intervaloInicio === null ||
        intervaloFim === null
      ) {
        throw new Error(
          `Existe um intervalo inválido em ${nomeDia}.`
        );
      }

      if (
        intervaloInicio >=
        intervaloFim
      ) {
        throw new Error(
          `Em ${nomeDia}, o fim do intervalo precisa ser posterior ao início.`
        );
      }

      if (
        intervaloInicio <= inicio ||
        intervaloFim >= fim
      ) {
        throw new Error(
          `O intervalo de ${nomeDia} precisa ficar dentro do horário de atendimento.`
        );
      }
    }

    function montarHorarioDoCard(
      card
    ) {
      const diaSemana =
        Number(
          card.dataset.dia
        );

      const trabalha =
        Boolean(
          obterCampo(
            card,
            ".campo-trabalha"
          )?.checked
        );

      const horaInicio =
        normalizarTexto(
          obterCampo(
            card,
            ".campo-inicio"
          )?.value
        );

      const horaFim =
        normalizarTexto(
          obterCampo(
            card,
            ".campo-fim"
          )?.value
        );

      const intervaloInicio =
        normalizarTexto(
          obterCampo(
            card,
            ".campo-intervalo-inicio"
          )?.value
        );

      const intervaloFim =
        normalizarTexto(
          obterCampo(
            card,
            ".campo-intervalo-fim"
          )?.value
        );

      return {
        diaSemana,
        trabalha,

        horaInicio:
          trabalha
            ? horaInicio ||
              null
            : null,

        horaFim:
          trabalha
            ? horaFim ||
              null
            : null,

        intervaloInicio:
          trabalha
            ? intervaloInicio ||
              null
            : null,

        intervaloFim:
          trabalha
            ? intervaloFim ||
              null
            : null,
      };
    }

    function montarPayload() {
      const horarios =
        elementos.cardsDias.map(
          montarHorarioDoCard
        );

      horarios.forEach(
        validarHorarioCard
      );

      const diasAtivos =
        horarios.filter(
          (horario) =>
            horario.trabalha
        );

      if (!diasAtivos.length) {
        throw new Error(
          "Ative pelo menos um dia de atendimento."
        );
      }

      return {
        duracaoPadrao:
          normalizarNumero(
            elementos
              .duracaoPadrao
              .value,
            60
          ),

        intervaloMinutos:
          normalizarNumero(
            elementos
              .intervaloMinutos
              .value,
            0
          ),

        antecedenciaAgendamento:
          normalizarNumero(
            elementos
              .antecedenciaAgendamento
              .value,
            0
          ),

        antecedenciaCancelamento:
          normalizarNumero(
            elementos
              .antecedenciaCancelamento
              .value,
            24
          ),

        horarios,
      };
    }

    /*
     * =====================================================
     * SALVAMENTO
     * =====================================================
     */

    async function salvarConfiguracao(
      evento
    ) {
      evento.preventDefault();

      if (
        estado.salvando ||
        estado.carregando
      ) {
        return;
      }

      esconderMensagem();

      try {
        const payload =
          montarPayload();

        definirSalvando(
          true
        );

        const dados =
          await apiPut(
            "/agenda-configuracao",
            payload
          );

        estado.alteracoesPendentes =
          false;

        mostrarMensagem(
          dados?.mensagem ||
            "Horários atualizados com sucesso.",
          "sucesso",
          4500
        );
      } catch (erro) {
        console.error(
          "Erro ao salvar configuração da agenda:",
          erro
        );

        if (
          tratarErroSessao(
            erro
          )
        ) {
          return;
        }

        mostrarMensagem(
          erro?.message ||
            "Não foi possível salvar a configuração.",
          "erro",
          0
        );
      } finally {
        definirSalvando(
          false
        );
      }
    }

    /*
     * =====================================================
     * ALTERAÇÕES
     * =====================================================
     */

    function registrarAlteracao() {
      if (
        estado.carregando
      ) {
        return;
      }

      estado.alteracoesPendentes =
        true;

      esconderMensagem();
    }

    elementos.cardsDias.forEach(
      (card) => {
        const campoTrabalha =
          obterCampo(
            card,
            ".campo-trabalha"
          );

        campoTrabalha
          ?.addEventListener(
            "change",
            () => {
              atualizarEstadoCard(
                card
              );

              registrarAlteracao();
            }
          );

        card.querySelectorAll(
          [
            ".campo-inicio",
            ".campo-fim",
            ".campo-intervalo-inicio",
            ".campo-intervalo-fim",
          ].join(", ")
        ).forEach(
          (campo) => {
            campo.addEventListener(
              "change",
              registrarAlteracao
            );
          }
        );
      }
    );

    [
      elementos.duracaoPadrao,
      elementos.intervaloMinutos,
      elementos.antecedenciaAgendamento,
      elementos.antecedenciaCancelamento,
    ].forEach(
      (campo) => {
        campo.addEventListener(
          "change",
          registrarAlteracao
        );
      }
    );

    elementos.form.addEventListener(
      "submit",
      salvarConfiguracao
    );

    window.addEventListener(
      "beforeunload",
      (evento) => {
        window.clearTimeout(
          estado.mensagemTimer
        );

        if (
          estado.alteracoesPendentes &&
          !estado.salvando
        ) {
          evento.preventDefault();

          evento.returnValue =
            "";
        }
      }
    );

    /*
     * =====================================================
     * INICIALIZAÇÃO
     * =====================================================
     */

    await carregarConfiguracao();
  }
);