require("dotenv").config({ quiet: true });

const db = require("../src/db/db");

async function executar() {
  const negocioId = 1;
  const nomeServico = "Alongamento de cílios";

  const insercao = await db.query(
    `
      INSERT INTO servicos_negocio (
        negocio_id,
        nome,
        descricao,
        valor,
        duracao_minutos,
        ativo
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        TRUE
      )
      ON CONFLICT DO NOTHING
      RETURNING
        id,
        negocio_id,
        nome,
        valor,
        duracao_minutos,
        ativo
    `,
    [
      negocioId,
      nomeServico,
      "Serviço criado para validar o fluxo de agendamento.",
      80,
      60,
    ]
  );

  let servicos = insercao.rows;

  if (servicos.length === 0) {
    const existente = await db.query(
      `
        SELECT
          id,
          negocio_id,
          nome,
          valor,
          duracao_minutos,
          ativo
        FROM servicos_negocio
        WHERE negocio_id = $1
          AND LOWER(nome) = LOWER($2)
        LIMIT 1
      `,
      [
        negocioId,
        nomeServico,
      ]
    );

    servicos = existente.rows;
  }

  if (servicos.length === 0) {
    throw new Error(
      "O serviço não foi criado nem localizado."
    );
  }

  console.log(
    "Serviço disponível para o teste:"
  );

  console.table(servicos);
}

executar()
  .catch((erro) => {
    console.error(
      "Erro ao criar serviço de teste:",
      erro
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
