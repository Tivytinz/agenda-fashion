document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  let usuario = null;

  try {
    usuario = JSON.parse(
      localStorage.getItem("usuario") || "null"
    );
  } catch (erro) {
    localStorage.removeItem("usuario");
  }

  if (!token || !usuario) {
    window.location.href =
      "login-profissional.html";

    return;
  }

  const apiUrl =
    typeof API_URL !== "undefined"
      ? API_URL
      : "";

  const form = document.getElementById(
    "formConfiguracaoAgenda"
  );

  const duracaoPadrao =
    document.getElementById(
      "duracaoPadrao"
    );

  const intervaloMinutos =
    document.getElementById(
      "intervaloMinutos"
    );

  const antecedenciaAgendamento =
    document.getElementById(
      "antecedenciaAgendamento"
    );

  const antecedenciaCancelamento =
    document.getElementById(
      "antecedenciaCancelamento"
    );

  const mensagemConfiguracao =
    document.getElementById(
      "mensagemConfiguracao"
    );

  const btnSalvar =
    document.getElementById(
      "btnSalvarConfiguracao"
    );

  const cardsDias = Array.from(
    document.querySelectorAll(
      ".dia-card"
    )
  );

  function mostrarMensagem(
    texto,
    cor = "#2f9e63"
  ) {
    mensagemConfiguracao.textContent =
      texto;

    mensagemConfiguracao.style.color =
      cor;

    mensagemConfiguracao.classList.remove(
      "hidden"
    );

    setTimeout(() => {
      mensagemConfiguracao.classList.add(
        "hidden"
      );
    }, 4000);
  }

  function atualizarEstadoCard(card) {
    const campoTrabalha =
      card.querySelector(
        ".campo-trabalha"
      );

    const status =
      card.querySelector(
        ".dia-status"
      );

    const campos =
      card.querySelectorAll(
        ".campo-inicio, .campo-fim, .campo-intervalo-inicio, .campo-intervalo-fim"
      );

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

    campos.forEach((campo) => {
      campo.disabled = !trabalha;
    });
  }

  function encontrarHorarioPorDia(
    horarios,
    diaSemana
  ) {
    return horarios.find(
      (horario) =>
        Number(
          horario.dia_semana
        ) === diaSemana
    );
  }

  function preencherHorarioCard(
    card,
    horario
  ) {
    const campoTrabalha =
      card.querySelector(
        ".campo-trabalha"
      );

    const campoInicio =
      card.querySelector(
        ".campo-inicio"
      );

    const campoFim =
      card.querySelector(
        ".campo-fim"
      );

    const campoIntervaloInicio =
      card.querySelector(
        ".campo-intervalo-inicio"
      );

    const campoIntervaloFim =
      card.querySelector(
        ".campo-intervalo-fim"
      );

    campoTrabalha.checked =
      Boolean(
        horario?.trabalha
      );

    campoInicio.value =
      horario?.hora_inicio || "";

    campoFim.value =
      horario?.hora_fim || "";

    campoIntervaloInicio.value =
      horario?.intervalo_inicio || "";

    campoIntervaloFim.value =
      horario?.intervalo_fim || "";

    atualizarEstadoCard(card);
  }

  async function carregarConfiguracao() {
    try {
      btnSalvar.disabled = true;

      btnSalvar.textContent =
        "Carregando...";

      const resposta = await fetch(
        `${apiUrl}/agenda-configuracao`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          data.erro ||
            "Erro ao carregar configuração da agenda."
        );
      }

      const configuracao =
        data.configuracao || {};

      const horarios =
        data.horarios || [];

      duracaoPadrao.value =
        String(
          configuracao.duracao_padrao ??
            60
        );

      intervaloMinutos.value =
        String(
          configuracao.intervalo_minutos ??
            0
        );

      antecedenciaAgendamento.value =
        String(
          configuracao
            .antecedencia_agendamento ??
            0
        );

      antecedenciaCancelamento.value =
        String(
          configuracao
            .antecedencia_cancelamento ??
            24
        );

      cardsDias.forEach((card) => {
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
      });
    } catch (erro) {
      console.error(
        "Erro ao carregar agenda:",
        erro
      );

      mostrarMensagem(
        erro.message ||
          "Erro ao carregar configuração.",
        "#e63946"
      );
    } finally {
      btnSalvar.disabled = false;

      btnSalvar.textContent =
        "Salvar horários";
    }
  }

  function montarHorarioDoCard(card) {
    const diaSemana =
      Number(
        card.dataset.dia
      );

    const trabalha =
      card.querySelector(
        ".campo-trabalha"
      ).checked;

    const horaInicio =
      card.querySelector(
        ".campo-inicio"
      ).value;

    const horaFim =
      card.querySelector(
        ".campo-fim"
      ).value;

    const intervaloInicio =
      card.querySelector(
        ".campo-intervalo-inicio"
      ).value;

    const intervaloFim =
      card.querySelector(
        ".campo-intervalo-fim"
      ).value;

    return {
      diaSemana,
      trabalha,

      horaInicio:
        trabalha
          ? horaInicio || null
          : null,

      horaFim:
        trabalha
          ? horaFim || null
          : null,

      intervaloInicio:
        trabalha
          ? intervaloInicio || null
          : null,

      intervaloFim:
        trabalha
          ? intervaloFim || null
          : null,
    };
  }

  async function salvarConfiguracao(
    evento
  ) {
    evento.preventDefault();

    try {
      btnSalvar.disabled = true;

      btnSalvar.textContent =
        "Salvando...";

      const horarios =
        cardsDias.map(
          montarHorarioDoCard
        );

      const resposta = await fetch(
        `${apiUrl}/agenda-configuracao`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify({
            duracaoPadrao:
              Number(
                duracaoPadrao.value
              ),

            intervaloMinutos:
              Number(
                intervaloMinutos.value
              ),

            antecedenciaAgendamento:
              Number(
                antecedenciaAgendamento.value
              ),

            antecedenciaCancelamento:
              Number(
                antecedenciaCancelamento.value
              ),

            horarios,
          }),
        }
      );

      const data =
        await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          data.erro ||
            "Erro ao salvar configuração da agenda."
        );
      }

      mostrarMensagem(
        data.mensagem ||
          "Horários atualizados com sucesso."
      );
    } catch (erro) {
      console.error(
        "Erro ao salvar agenda:",
        erro
      );

      mostrarMensagem(
        erro.message ||
          "Erro ao salvar configuração.",
        "#e63946"
      );
    } finally {
      btnSalvar.disabled = false;

      btnSalvar.textContent =
        "Salvar horários";
    }
  }

  cardsDias.forEach((card) => {
    const campoTrabalha =
      card.querySelector(
        ".campo-trabalha"
      );

    campoTrabalha.addEventListener(
      "change",
      () => {
        atualizarEstadoCard(card);
      }
    );
  });

  form.addEventListener(
    "submit",
    salvarConfiguracao
  );

  await carregarConfiguracao();
});