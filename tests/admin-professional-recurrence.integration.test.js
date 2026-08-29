const crypto = require(
  "crypto"
);

const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/adminProfessionalRecurrenceRepository"
);

function idCurto() {
  return crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "adminProfessionalRecurrenceRepository",
  () => {
    let usuarioId;
    let negocioId;
    let servicoId;

    beforeEach(async () => {
      const suffix = idCurto();

      const usuario = await db.query(
        `
        INSERT INTO usuarios (
          nome,
          email,
          senha,
          whatsapp
        )
        VALUES (
          $1,
          $2,
          'hash-teste',
          '62999999999'
        )
        RETURNING id
        `,
        [
          `Recorrência ${suffix}`,
          `recorrencia-${suffix}@example.com`,
        ]
      );

      usuarioId = Number(usuario.rows[0].id);

      await db.query(
        `
        INSERT INTO marketing_usuario_atribuicoes (
          usuario_id,
          intencao,
          sessao_id,
          utm_source,
          utm_medium,
          utm_campaign,
          landing_page,
          atribuicao_em
        )
        VALUES (
          $1,
          'profissional',
          $2,
          'organico',
          'none',
          'organico',
          '/para-profissionais',
          NOW()
        )
        `,
        [
          usuarioId,
          `rec_${suffix}`,
        ]
      );

      const negocio = await db.query(
        `
        INSERT INTO negocios (
          nome,
          slug,
          setor,
          whatsapp,
          cidade,
          estado,
          publicado
        )
        VALUES (
          $1,
          $2,
          'unhas',
          '62999999999',
          'Goiânia',
          'GO',
          TRUE
        )
        RETURNING id
        `,
        [
          `Studio recorrência ${suffix}`,
          `studio-recorrencia-${suffix}`,
        ]
      );

      negocioId = Number(negocio.rows[0].id);

      await db.query(
        `
        INSERT INTO usuarios_negocios (
          usuario_id,
          negocio_id,
          papel,
          ativo
        )
        VALUES ($1, $2, 'dono', TRUE)
        `,
        [usuarioId, negocioId]
      );

      const servico = await db.query(
        `
        INSERT INTO servicos_negocio (
          negocio_id,
          nome,
          valor,
          duracao_minutos,
          ativo
        )
        VALUES (
          $1,
          'Manicure',
          60,
          60,
          TRUE
        )
        RETURNING id
        `,
        [negocioId]
      );

      servicoId = Number(servico.rows[0].id);

      await db.query(
        `
        INSERT INTO agendamentos (
          negocio_id,
          servico_id,
          profissional_id,
          cliente_id,
          data,
          horario,
          status
        )
        VALUES
          ($1, $2, $3, $3, CURRENT_DATE + 1, '09:00', 'agendado'),
          ($1, $2, $3, $3, CURRENT_DATE + 2, '10:00', 'agendado'),
          ($1, $2, $3, $3, CURRENT_DATE + 3, '11:00', 'agendado')
        `,
        [
          negocioId,
          servicoId,
          usuarioId,
        ]
      );
    });

    afterEach(async () => {
      if (negocioId) {
        await db.query(
          "DELETE FROM agendamentos WHERE negocio_id = $1",
          [negocioId]
        );
        await db.query(
          "DELETE FROM servicos_negocio WHERE negocio_id = $1",
          [negocioId]
        );
        await db.query(
          "DELETE FROM usuarios_negocios WHERE negocio_id = $1",
          [negocioId]
        );
      }

      if (usuarioId) {
        await db.query(
          "DELETE FROM marketing_usuario_atribuicoes WHERE usuario_id = $1",
          [usuarioId]
        );
      }

      if (negocioId) {
        await db.query(
          "DELETE FROM negocios WHERE id = $1",
          [negocioId]
        );
      }

      if (usuarioId) {
        await db.query(
          "DELETE FROM usuarios WHERE id = $1",
          [usuarioId]
        );
      }
    });

    test(
      "conta o terceiro agendamento do profissional sem depender da agregacao global",
      async () => {
        const resultado =
          await repository
            .listarRecorrencia("today");

        const linha =
          resultado.linhas.find(
            (item) =>
              Number(item.usuario_id) === usuarioId
          );

        expect(linha).toMatchObject({
          negocio_id: String(negocioId),
          total_agendamentos: 3,
        });
      }
    );
  }
);
