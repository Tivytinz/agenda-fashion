function gerarIdentificador(prefixo) {
  return [
    prefixo,
    process.pid,
    Date.now(),
    Math.floor(Math.random() * 1000000),
  ]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
}

async function criarCenarioAgendamento(
  db,
  {
    prefixo = "teste-agendamento",
  } = {}
) {
  const identificador =
    gerarIdentificador(prefixo);

  const client =
    await db.connect();

  try {
    await client.query("BEGIN");

    const planoResultado =
      await client.query(
        `
          SELECT id
          FROM planos
          WHERE slug = 'inicial'
            AND ativo = TRUE
          LIMIT 1
        `
      );

    const planoId =
      planoResultado.rows[0]?.id;

    if (!planoId) {
      throw new Error(
        "Plano inicial não encontrado para criar o cenário de teste."
      );
    }

    const usuarioResultado =
      await client.query(
        `
          INSERT INTO usuarios (
            nome,
            email,
            senha,
            whatsapp
          )
          VALUES ($1, $2, $3, $4)
          RETURNING id, nome, email, whatsapp
        `,
        [
          "Profissional Teste CI",
          `${identificador}@teste.local`,
          "hash-exclusivo-de-teste",
          `629${String(
            Date.now()
          ).slice(-8)}`,
        ]
      );

    const profissional =
      usuarioResultado.rows[0];

    const negocioResultado =
      await client.query(
        `
          INSERT INTO negocios (
            nome,
            slug,
            descricao,
            setor,
            whatsapp,
            publicado,
            plano_id
          )
          VALUES (
            $1,
            $2,
            $3,
            'Beleza',
            $4,
            TRUE,
            $5
          )
          RETURNING id, nome, slug
        `,
        [
          "Studio Teste CI",
          identificador,
          "Negócio isolado criado por teste automatizado.",
          profissional.whatsapp,
          planoId,
        ]
      );

    const negocio =
      negocioResultado.rows[0];

    await client.query(
      `
        INSERT INTO usuarios_negocios (
          usuario_id,
          negocio_id,
          papel
        )
        VALUES ($1, $2, 'dono')
      `,
      [
        profissional.id,
        negocio.id,
      ]
    );

    const servicoResultado =
      await client.query(
        `
          INSERT INTO servicos_negocio (
            negocio_id,
            nome,
            descricao,
            valor,
            duracao_minutos
          )
          VALUES (
            $1,
            'Serviço Teste CI',
            'Serviço isolado criado por teste automatizado.',
            50,
            60
          )
          RETURNING
            id,
            nome,
            valor,
            duracao_minutos
        `,
        [
          negocio.id,
        ]
      );

    const servico =
      servicoResultado.rows[0];

    await client.query(
      `
        INSERT INTO agenda_configuracoes (
          profissional_id,
          duracao_padrao,
          intervalo_minutos,
          antecedencia_agendamento,
          antecedencia_cancelamento
        )
        VALUES ($1, 60, 0, 0, 0)
      `,
      [
        profissional.id,
      ]
    );

    await client.query(
      `
        INSERT INTO agenda_horarios (
          profissional_id,
          dia_semana,
          trabalha,
          hora_inicio,
          hora_fim
        )
        SELECT
          $1,
          dia_semana,
          TRUE,
          '08:00'::TIME,
          '20:00'::TIME
        FROM generate_series(
          0,
          6
        ) AS dia_semana
      `,
      [
        profissional.id,
      ]
    );

    await client.query("COMMIT");

    return {
      negocioId:
        Number(negocio.id),
      slug:
        negocio.slug,
      servico: {
        ...servico,
        id:
          Number(servico.id),
      },
      profissional: {
        ...profissional,
        id:
          Number(profissional.id),
      },
    };
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  } finally {
    client.release();
  }
}

async function removerCenarioAgendamento(
  db,
  cenario
) {
  if (!cenario) {
    return;
  }

  const client =
    await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        DELETE FROM agendamentos
        WHERE negocio_id = $1
      `,
      [
        cenario.negocioId,
      ]
    );

    await client.query(
      `
        DELETE FROM negocios
        WHERE id = $1
      `,
      [
        cenario.negocioId,
      ]
    );

    await client.query(
      `
        DELETE FROM usuarios
        WHERE id = $1
      `,
      [
        cenario.profissional.id,
      ]
    );

    await client.query("COMMIT");
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  } finally {
    client.release();
  }
}

module.exports = {
  criarCenarioAgendamento,
  removerCenarioAgendamento,
};
