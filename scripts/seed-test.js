const path = require("path");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const { Client } = require("pg");

dotenv.config({
  path: path.resolve(__dirname, "../.env.test"),
  override: true,
  quiet: true
});

const HOST_TESTE = "sakura.proxy.rlwy.net";

if (process.env.NODE_ENV !== "test") {
  throw new Error("Seed bloqueado: NODE_ENV não é test.");
}

const banco = new URL(process.env.DATABASE_URL);

if (banco.hostname !== HOST_TESTE) {
  throw new Error(
    `Seed bloqueado: host não autorizado (${banco.hostname}).`
  );
}

async function executar() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  await client.connect();

  try {
    await client.query("BEGIN");

    const planoResultado = await client.query(`
      SELECT id
      FROM planos
      WHERE slug = 'inicial'
        AND ativo = TRUE
      LIMIT 1
    `);

    if (planoResultado.rowCount === 0) {
      throw new Error("Plano inicial não encontrado.");
    }

    const planoId = planoResultado.rows[0].id;
    const senhaHash = await bcrypt.hash("AgendaTeste123!", 10);

    let usuarioResultado = await client.query(
      `
        UPDATE usuarios
        SET
          nome = 'Victor Teste',
          senha = $2,
          whatsapp = '11999990000',
          ativo = TRUE,
          email_verificado_em = NOW(),
          updated_at = NOW()
        WHERE email = $1
        RETURNING id
      `,
      ["victor.teste@agendafashion.test", senhaHash]
    );

    if (usuarioResultado.rowCount === 0) {
      usuarioResultado = await client.query(
        `
          INSERT INTO usuarios (
            nome,
            email,
            senha,
            whatsapp,
            ativo,
            email_verificado_em
          )
          VALUES (
            'Victor Teste',
            $1,
            $2,
            '11999990000',
            TRUE,
            NOW()
          )
          RETURNING id
        `,
        ["victor.teste@agendafashion.test", senhaHash]
      );
    }

    const profissionalId = usuarioResultado.rows[0].id;

    let negocioResultado = await client.query(
      `
        UPDATE negocios
        SET
          nome = 'Agenda Fashion Teste',
          descricao = 'Negócio exclusivo para testes automatizados',
          setor = 'Beleza',
          whatsapp = '11999990000',
          cidade = 'São Paulo',
          estado = 'SP',
          ativo = TRUE,
          publicado = TRUE,
          areas = ARRAY['Unhas'],
          plano_id = $1,
          updated_at = NOW()
        WHERE slug = 'victor'
        RETURNING id
      `,
      [planoId]
    );

    if (negocioResultado.rowCount === 0) {
      negocioResultado = await client.query(
        `
          INSERT INTO negocios (
            nome,
            slug,
            descricao,
            setor,
            whatsapp,
            cidade,
            estado,
            ativo,
            publicado,
            areas,
            plano_id
          )
          VALUES (
            'Agenda Fashion Teste',
            'victor',
            'Negócio exclusivo para testes automatizados',
            'Beleza',
            '11999990000',
            'São Paulo',
            'SP',
            TRUE,
            TRUE,
            ARRAY['Unhas'],
            $1
          )
          RETURNING id
        `,
        [planoId]
      );
    }

    const negocioId = negocioResultado.rows[0].id;

    const vinculo = await client.query(
      `
        SELECT id
        FROM usuarios_negocios
        WHERE usuario_id = $1
          AND negocio_id = $2
        LIMIT 1
      `,
      [profissionalId, negocioId]
    );

    if (vinculo.rowCount === 0) {
      await client.query(
        `
          INSERT INTO usuarios_negocios (
            usuario_id,
            negocio_id,
            papel,
            ativo
          )
          VALUES ($1, $2, 'dono', TRUE)
        `,
        [profissionalId, negocioId]
      );
    } else {
      await client.query(
        `
          UPDATE usuarios_negocios
          SET
            papel = 'dono',
            ativo = TRUE,
            updated_at = NOW()
          WHERE id = $1
        `,
        [vinculo.rows[0].id]
      );
    }

    let servicoResultado = await client.query(
      `
        UPDATE servicos_negocio
        SET
          descricao = 'Serviço criado para testes',
          valor = 50,
          duracao_minutos = 60,
          ativo = TRUE,
          updated_at = NOW()
        WHERE negocio_id = $1
          AND nome = 'Manicure Teste'
        RETURNING id
      `,
      [negocioId]
    );

    if (servicoResultado.rowCount === 0) {
      servicoResultado = await client.query(
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
            'Manicure Teste',
            'Serviço criado para testes',
            50,
            60,
            TRUE
          )
          RETURNING id
        `,
        [negocioId]
      );
    }

    const configuracao = await client.query(
      `
        SELECT id
        FROM agenda_configuracoes
        WHERE profissional_id = $1
        LIMIT 1
      `,
      [profissionalId]
    );

    if (configuracao.rowCount === 0) {
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
        [profissionalId]
      );
    } else {
      await client.query(
        `
          UPDATE agenda_configuracoes
          SET
            duracao_padrao = 60,
            intervalo_minutos = 0,
            antecedencia_agendamento = 0,
            antecedencia_cancelamento = 0,
            updated_at = NOW()
          WHERE id = $1
        `,
        [configuracao.rows[0].id]
      );
    }

    for (let diaSemana = 0; diaSemana <= 6; diaSemana += 1) {
      const horario = await client.query(
        `
          SELECT id
          FROM agenda_horarios
          WHERE profissional_id = $1
            AND dia_semana = $2
          LIMIT 1
        `,
        [profissionalId, diaSemana]
      );

      if (horario.rowCount === 0) {
        await client.query(
          `
            INSERT INTO agenda_horarios (
              profissional_id,
              dia_semana,
              trabalha,
              hora_inicio,
              hora_fim
            )
            VALUES ($1, $2, TRUE, '08:00', '22:00')
          `,
          [profissionalId, diaSemana]
        );
      } else {
        await client.query(
          `
            UPDATE agenda_horarios
            SET
              trabalha = TRUE,
              hora_inicio = '08:00',
              hora_fim = '22:00',
              intervalo_inicio = NULL,
              intervalo_fim = NULL,
              updated_at = NOW()
            WHERE id = $1
          `,
          [horario.rows[0].id]
        );
      }
    }

    await client.query("COMMIT");

    console.log({
      sucesso: true,
      slug: "victor",
      negocioId,
      profissionalId,
      servicoId: servicoResultado.rows[0].id
    });
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  } finally {
    await client.end();
  }
}

executar().catch((erro) => {
  console.error("ERRO:", erro.message);
  process.exit(1);
});