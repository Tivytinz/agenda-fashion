require("dotenv").config({ quiet: true });

const notificationService = require(
  "../src/services/notificationService"
);

async function executar() {
  const numeroDestino =
    process.argv[2] ||
    process.env.WHATSAPP_TEST_RECIPIENT;

  if (!numeroDestino) {
    throw new Error(
      "Informe o número no comando ou configure WHATSAPP_TEST_RECIPIENT no .env."
    );
  }

  console.log(
    "Enviando o modelo novo_agendamento..."
  );

  const resultado =
    await notificationService.novoAgendamento({
      whatsapp: numeroDestino,
      cliente: "Victor Souza",
      servico: "Alongamento de unhas",
      profissional: "Profissional Teste",
      data: "2026-07-15",
      horario: "14:00",
    });

  console.log(
    "Modelo enviado com sucesso."
  );

  console.log(
    JSON.stringify(
      resultado,
      null,
      2
    )
  );
}

executar()
  .then(() => {
    process.exit(0);
  })
  .catch((erro) => {
    console.error(
      "Falha ao testar o modelo:"
    );

    if (erro.response?.data) {
      console.error(
        JSON.stringify(
          erro.response.data,
          null,
          2
        )
      );
    } else {
      console.error(
        erro.message
      );
    }

    process.exit(1);
  });
