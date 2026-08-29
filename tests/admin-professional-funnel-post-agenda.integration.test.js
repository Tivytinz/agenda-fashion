const crypto = require(
  "crypto"
);

const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/adminProfessionalFunnelRepository"
);

function idCurto() {
  return crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

async function inserirEvento({
  nome,
  pagina,
  missao,
  sessaoId,
  usuarioId,
  negocioId,
  propriedades = {},
  intervalo,
}) {
  await db.query(
    `
    INSERT INTO eventos_produto (
      nome,
      pagina,
      missao,
      sessao_id,
      usuario_id,
      negocio_id,
      propriedades,
      created_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7::jsonb,
      NOW() - $8::INTERVAL
    )
    `,
    [
      nome,
      pagina,
      missao,
      sessaoId,
      usuarioId || null,
      negocioId,
      JSON.stringify(propriedades),
      intervalo,
    ]
  );
}

describe(
  "adminProfessionalFunnelRepository jornada pós-agenda",
  () => {
    let usuarioId;
    let negocioId;
    let servicoId;
    let campanhaId;
    let utmCampaign;

    beforeEach(async () => {
      const suffix = idCurto();
      utmCampaign = `pos_agenda_${suffix}`;

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
          `Profissional ${suffix}`,
          `pos-agenda-${suffix}@example.com`,
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
          'meta',
          'cpc',
          $3,
          '/para-profissionais',
          NOW()
        )
        `,
        [
          usuarioId,
          `acq_${suffix}`,
          utmCampaign,
        ]
      );

      const campanha = await db.query(
        `
        INSERT INTO marketing_campanhas (
          nome,
          canal,
          objetivo,
          utm_source,
          utm_medium,
          utm_campaign,
          destino_path,
          ativo
        )
        VALUES (
          $1,
          'meta',
          'profissional',
          'meta',
          'cpc',
          $2,
          '/para-profissionais',
          TRUE
        )
        RETURNING id
        `,
        [
          `Pós-agenda ${suffix}`,
          utmCampaign,
        ]
      );

      campanhaId = Number(campanha.rows[0].id);

      const negocio = await db.query(
        `
        INSERT INTO negocios (
          nome,
          slug,
          descricao,
          setor,
          whatsapp,
          cidade,
          estado,
          publicado
        )
        VALUES (
          $1,
          $2,
          'Negócio do teste pós-agenda.',
          'cilios',
          '62999999999',
          'Goiânia',
          'GO',
          TRUE
        )
        RETURNING id
        `,
        [
          `Studio ${suffix}`,
          `studio-pos-agenda-${suffix}`,
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
          'Extensão de cílios',
          120,
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
        INSERT INTO agenda_configuracoes (
          profissional_id,
          duracao_padrao,
          intervalo_minutos,
          antecedencia_agendamento,
          antecedencia_cancelamento,
          configurado_em
        )
        VALUES (
          $1,
          60,
          0,
          0,
          24,
          NOW() - INTERVAL '10 minutes'
        )
        `,
        [usuarioId]
      );

      const ownerSession = `owner_${suffix}`;
      const ownerOtherSession = `owner_alt_${suffix}`;
      const bounceSession = `bounce_${suffix}`;
      const convertSession = `convert_${suffix}`;
      const wrongSession = `wrong_${suffix}`;

      await inserirEvento({
        nome: "link_negocio_compartilhado",
        pagina: "dashboard_dono",
        missao: "gerenciar_crescimento",
        sessaoId: ownerSession,
        usuarioId,
        negocioId,
        intervalo: "11 minutes",
      });

      await inserirEvento({
        nome: "link_negocio_compartilhado",
        pagina: "dashboard_dono",
        missao: "gerenciar_crescimento",
        sessaoId: ownerSession,
        usuarioId,
        negocioId,
        intervalo: "8 minutes",
      });

      await inserirEvento({
        nome: "perfil_visualizado",
        pagina: "perfil_negocio",
        missao: "descobrir_compartilhar_agendar",
        sessaoId: ownerSession,
        usuarioId,
        negocioId,
        intervalo: "7 minutes",
      });

      await inserirEvento({
        nome: "perfil_visualizado",
        pagina: "perfil_negocio",
        missao: "descobrir_compartilhar_agendar",
        sessaoId: ownerOtherSession,
        usuarioId,
        negocioId,
        intervalo: "6 minutes 30 seconds",
      });

      await inserirEvento({
        nome: "perfil_visualizado",
        pagina: "perfil_negocio",
        missao: "descobrir_compartilhar_agendar",
        sessaoId: bounceSession,
        negocioId,
        intervalo: "6 minutes",
      });

      await inserirEvento({
        nome: "perfil_visualizado",
        pagina: "perfil_negocio",
        missao: "descobrir_compartilhar_agendar",
        sessaoId: convertSession,
        negocioId,
        intervalo: "5 minutes",
      });

      await inserirEvento({
        nome: "agendamento_iniciado",
        pagina: "perfil_negocio",
        missao: "escolher_e_agendar",
        sessaoId: wrongSession,
        negocioId,
        propriedades: {
          servico_id: servicoId,
        },
        intervalo: "4 minutes 30 seconds",
      });

      await inserirEvento({
        nome: "agendamento_iniciado",
        pagina: "perfil_negocio",
        missao: "escolher_e_agendar",
        sessaoId: convertSession,
        negocioId,
        propriedades: {
          servico_id: servicoId,
        },
        intervalo: "4 minutes",
      });

      const agendamento = await db.query(
        `
        INSERT INTO agendamentos (
          negocio_id,
          servico_id,
          profissional_id,
          cliente_id,
          data,
          horario,
          status,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $3,
          CURRENT_DATE + 1,
          '10:00',
          'agendado',
          NOW() - INTERVAL '3 minutes'
        )
        RETURNING id
        `,
        [
          negocioId,
          servicoId,
          usuarioId,
        ]
      );

      const agendamentoId = Number(
        agendamento.rows[0].id
      );

      await inserirEvento({
        nome: "agendamento_concluido",
        pagina: "finalizar_agendamento",
        missao: "confirmar_agendamento",
        sessaoId: convertSession,
        negocioId,
        propriedades: {
          agendamento_id: 2147483647,
          servico_id: servicoId,
          status: "sucesso",
        },
        intervalo: "2 minutes 30 seconds",
      });

      await inserirEvento({
        nome: "agendamento_concluido",
        pagina: "finalizar_agendamento",
        missao: "confirmar_agendamento",
        sessaoId: convertSession,
        negocioId,
        propriedades: {
          agendamento_id: agendamentoId,
          servico_id: servicoId,
          status: "sucesso",
        },
        intervalo: "2 minutes",
      });
    });

    afterEach(async () => {
      if (negocioId) {
        await db.query(
          "DELETE FROM eventos_produto WHERE negocio_id = $1",
          [negocioId]
        );
        await db.query(
          "DELETE FROM agendamentos WHERE negocio_id = $1",
          [negocioId]
        );
        await db.query(
          "DELETE FROM servicos_negocio WHERE negocio_id = $1",
          [negocioId]
        );
      }

      if (usuarioId) {
        await db.query(
          "DELETE FROM agenda_configuracoes WHERE profissional_id = $1",
          [usuarioId]
        );
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

      if (campanhaId) {
        await db.query(
          "DELETE FROM marketing_campanhas WHERE id = $1",
          [campanhaId]
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
      "liga divulgação, visita externa, início e conclusão ao primeiro agendamento real",
      async () => {
        const linhas = await repository
          .listarPorCampanha("today");

        const encontrada = linhas.find(
          (item) => item.campanha === utmCampaign
        );

        expect(encontrada).toMatchObject({
          perfis_divulgados: 1,
          visitas_pos_divulgacao: 1,
          agendamentos_iniciados_pos_divulgacao: 1,
          primeiros_agendamentos_via_divulgacao: 1,
          primeiros_agendamentos: 1,
        });
      }
    );

    test(
      "não promove uma conclusão posterior quando o negócio já tinha primeiro agendamento",
      async () => {
        await db.query(
          `
          INSERT INTO agendamentos (
            negocio_id,
            servico_id,
            profissional_id,
            cliente_id,
            data,
            horario,
            status,
            created_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $3,
            CURRENT_DATE + 1,
            '11:00',
            'agendado',
            NOW() - INTERVAL '9 minutes'
          )
          `,
          [
            negocioId,
            servicoId,
            usuarioId,
          ]
        );

        const linhas = await repository
          .listarPorCampanha("today");

        const encontrada = linhas.find(
          (item) => item.campanha === utmCampaign
        );

        expect(encontrada).toMatchObject({
          perfis_divulgados: 1,
          visitas_pos_divulgacao: 1,
          agendamentos_iniciados_pos_divulgacao: 1,
          primeiros_agendamentos_via_divulgacao: 0,
          primeiros_agendamentos: 1,
        });
      }
    );
  }
);
