document.addEventListener("DOMContentLoaded", async () => {

  // ===== LOADING =====
  const loadingScreen = document.getElementById("loadingScreen");

  function mostrarLoading() {
    loadingScreen.classList.remove("hidden");
  }

  function esconderLoading() {
    loadingScreen.classList.add("hidden");
  }

  // ===== POPUP =====
  const popup = document.getElementById("popupSucesso");

  window.fecharPopup = function () {
    popup.classList.add("hidden");
  };

  function abrirPopup() {
    popup.classList.remove("hidden");
  }

  // ===== LOGIN =====
  const usuario = JSON.parse(localStorage.getItem("usuario"));
  const token = localStorage.getItem("token");

  if (!usuario || !token) {
    alert("Faça login primeiro!");
    window.location.href = "/html/login-cliente.html";
    return;
  }

  // ===== VARIÁVEIS =====
  let diaSelecionado = null;
  let horarioSelecionado = null;
  let agendamentos = [];

  const diasContainer = document.getElementById("dias");
  const horariosContainer = document.getElementById("horarios");
  const botao = document.getElementById("btnAgendar");
  const lista = document.getElementById("listaAgendamentos");

  // botão inicia desativado
  botao.disabled = true;

  // ===== FORMATAR DATA =====
  function formatarData(data) {
    return data.toISOString().split("T")[0];
  }

  // ===== GERAR DIAS =====
  function gerarDias() {
    diasContainer.innerHTML = "";

    const hoje = new Date();

    for (let i = 0; i < 7; i++) {
      const data = new Date();
      data.setDate(hoje.getDate() + i);

      const btn = document.createElement("button");

      const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "short" });
      const diaNumero = data.getDate();

      btn.innerHTML = `${diaSemana}<br>${diaNumero}`;

      // HOJE (AZUL)
      if (
        data.getDate() === hoje.getDate() &&
        data.getMonth() === hoje.getMonth() &&
        data.getFullYear() === hoje.getFullYear()
      ) {
        btn.classList.add("dia-hoje");
        btn.classList.add("ativo");
        diaSelecionado = data;
      }

      btn.onclick = () => {
        document.querySelectorAll("#dias button").forEach(b => b.classList.remove("ativo"));
        btn.classList.add("ativo");

        diaSelecionado = data;
        horarioSelecionado = null;

        botao.disabled = true;

        gerarHorarios();
      };

      diasContainer.appendChild(btn);
    }
  }

  // ===== GERAR HORÁRIOS =====
  function gerarHorarios() {
  horariosContainer.innerHTML = "";
  horarioSelecionado = null;
  validarBotao();

  if (!diaSelecionado) return;

  const disponibilidade = disponibilidadeDoDia(diaSelecionado);

  if (!disponibilidade) {
    const aviso = document.createElement("p");
    aviso.textContent = "Essa profissional não atende nesse dia.";
    aviso.style.color = "#7e768f";
    aviso.style.fontWeight = "700";
    horariosContainer.appendChild(aviso);
    return;
  }

  const horaInicio = disponibilidade.hora_inicio.slice(0, 5);
  const horaFim = disponibilidade.hora_fim.slice(0, 5);

  const horariosGerados = gerarHorariosIntervalo(horaInicio, horaFim, 60);
  const ocupados = horariosOcupadosDoDia(diaSelecionado);

  const agora = new Date();
  const hojeStr = formatarDataLocal(agora);
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  let horariosValidos = horariosGerados;

  // se for hoje, remove horários passados
  if (diaSelecionado === hojeStr) {
    horariosValidos = horariosGerados.filter(hora => {
      const [h, m] = hora.split(":").map(Number);
      const minutosHorario = h * 60 + m;

      return minutosHorario > minutosAgora;
    });
  }

  if (!horariosValidos.length) {
    const aviso = document.createElement("p");
    aviso.textContent = "Não há mais horários disponíveis para este dia.";
    aviso.style.color = "#7e768f";
    aviso.style.fontWeight = "700";
    horariosContainer.appendChild(aviso);
    return;
  }

  horariosValidos.forEach(hora => {
    const btn = document.createElement("button");
    btn.textContent = hora;
    btn.className = "horario-btn";

    if (ocupados.includes(hora)) {
      btn.classList.add("horario-ocupado");
      btn.disabled = true;
    } else {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".horario-btn").forEach(el => {
          el.classList.remove("horario-ativo");
        });

        btn.classList.add("horario-ativo");
        horarioSelecionado = hora;
        validarBotao();
      });
    }

    horariosContainer.appendChild(btn);
  });
}

      // verifica ocupado
      const ocupado = agendamentos.some(a =>
        a.data.startsWith(dataFormatada) && a.horario === hora
      );

      if (ocupado) {
        btn.classList.add("ocupado");
        btn.disabled = true;
      } else {
        btn.onclick = () => {
          document.querySelectorAll("#horarios button").forEach(b => b.classList.remove("ativo"));
          btn.classList.add("ativo");

          horarioSelecionado = hora;
          botao.disabled = false;
        };
      }

      horariosContainer.appendChild(btn);
    });

  // ===== CARREGAR AGENDAMENTOS =====
  async function carregarAgendamentos() {
    try {
      const res = await fetch("http://localhost:3000/agendamentos", {
        headers: {
          "Authorization": "Bearer " + token
        }
      });

      const dados = await res.json();
      agendamentos = dados;

      lista.innerHTML = "";

      if (dados.length === 0) {
        lista.innerHTML = "<p>Nenhum agendamento</p>";
        return;
      }

      dados.forEach(a => {
        const div = document.createElement("div");
        div.classList.add("item-agendamento");

        const data = new Date(a.data);

        div.innerHTML = `
          <p>📅 ${data.toLocaleDateString("pt-BR")}</p>
          <p>⏰ ${a.horario}</p>
        `;

        lista.appendChild(div);
      });

    } catch (err) {
      console.error(err);
    }
  }

  // ===== VALIDAR BOTÃO =====
  function validar() {
    botao.disabled = !(diaSelecionado && horarioSelecionado);
  }

  // ===== AGENDAR =====
  botao.addEventListener("click", async () => {

    if (!diaSelecionado || !horarioSelecionado) {
      alert("Data e hora são obrigatórias");
      return;
    }

    try {
      mostrarLoading();

      const res = await fetch("http://localhost:3000/agendamentos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          data: formatarData(diaSelecionado),
          horario: horarioSelecionado
        })
      });

      const resposta = await res.json();

      if (resposta.erro) {
        alert(resposta.erro);
        esconderLoading();
        return;
      }

      abrirPopup();

      horarioSelecionado = null;
      botao.disabled = true;

      await carregarAgendamentos();
      gerarHorarios();

    } catch (err) {
      console.error(err);
      alert("Erro ao agendar");
    } finally {
      esconderLoading();
    }

  });

  // ===== INICIAR =====
  mostrarLoading();

  await carregarAgendamentos();
  gerarDias();
  gerarHorarios();
  validar();

  esconderLoading();