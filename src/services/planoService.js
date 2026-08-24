const db = require("../db/db");
const assinaturaRepository =
    require("../repositories/assinaturaRepository");

function criarErroLimite(mensagem, codigo, uso = null) {
    const erro = new Error(mensagem);
    erro.status = 409;
    erro.statusCode = 409;
    erro.codigo = codigo;
    erro.uso = uso;
    return erro;
}

async function bloquearUsoPlano(client, negocioId) {
    if (!client || typeof client.query !== "function") {
        throw new Error("Conexão transacional inválida.");
    }

    await client.query(
        `
        SELECT pg_advisory_xact_lock(
          hashtext('agenda_fashion_limite_plano'),
          $1::integer
        )
        `,
        [Number(negocioId)]
    );
}

async function buscarUsoPlano(
    negocioId,
    executor = db,
    dataReferencia = null
) {
    await assinaturaRepository
        .expirarCancelamentoSeNecessario(
            negocioId,
            executor
        );

    const result = await executor.query(
        `
    SELECT
      n.id AS negocio_id,
      n.nome AS negocio_nome,

      p.id AS plano_id,
      p.nome AS plano_nome,
      p.slug AS plano_slug,
      p.valor,
      p.capacidade_agendamentos,
      p.limite_profissionais,
      p.limite_servicos,
      p.destaque,

      plano_selecionado.id AS plano_selecionado_id,
      plano_selecionado.nome AS plano_selecionado_nome,
      plano_selecionado.slug AS plano_selecionado_slug,
      plano_selecionado.valor AS plano_selecionado_valor,
      assinatura_ativa.id AS assinatura_ativa_id,

      (
        SELECT COUNT(*)::int
        FROM agendamentos a
        WHERE a.negocio_id = n.id
          AND a.status IN (
            'agendado',
            'confirmado',
            'realizado'
          )
          AND a.data >= date_trunc(
            'month',
            COALESCE($2::date, CURRENT_DATE)
          )
          AND a.data < date_trunc(
            'month',
            COALESCE($2::date, CURRENT_DATE)
          ) + INTERVAL '1 month'
      ) AS utilizados,

      (
        SELECT COUNT(*)::int
        FROM usuarios_negocios un
        WHERE un.negocio_id = n.id
          AND un.ativo = TRUE
          AND un.papel IN ('dono', 'profissional')
      ) AS profissionais_utilizados,

      (
        SELECT COUNT(*)::int
        FROM servicos_negocio sn
        WHERE sn.negocio_id = n.id
          AND sn.ativo = TRUE
      ) AS servicos_utilizados

    FROM negocios n
    INNER JOIN planos plano_selecionado
      ON plano_selecionado.id = n.plano_id
    LEFT JOIN LATERAL (
      SELECT
        a.id,
        a.plano_id
      FROM assinaturas a
      WHERE a.negocio_id = n.id
        AND a.ativo = TRUE
      ORDER BY a.id DESC
      LIMIT 1
    ) assinatura_ativa ON TRUE
    LEFT JOIN LATERAL (
      SELECT gratis.id
      FROM planos gratis
      WHERE gratis.slug = 'inicial'
        AND gratis.ativo = TRUE
      ORDER BY gratis.id ASC
      LIMIT 1
    ) plano_gratis ON TRUE
    INNER JOIN planos p
      ON p.id = COALESCE(
        assinatura_ativa.plano_id,
        CASE
          WHEN plano_selecionado.valor <= 0
            THEN plano_selecionado.id
          ELSE plano_gratis.id
        END
      )
    WHERE n.id = $1
    LIMIT 1
    `,
        [negocioId, dataReferencia]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const plano = result.rows[0];

    const capacidade = plano.capacidade_agendamentos;
    const utilizados = Number(plano.utilizados || 0);
    const ilimitado = capacidade === null;

    const restantes = ilimitado
        ? null
        : Math.max(Number(capacidade || 0) - utilizados, 0);

    const percentual = ilimitado
        ? null
        : Math.min(
            Math.round((utilizados / Number(capacidade || 1)) * 100),
            100
        );

    let status = "normal";

    if (ilimitado) {
        status = "ilimitado";
    } else if (utilizados >= Number(capacidade || 0)) {
        status = "limite_atingido";
    } else if (percentual >= 90) {
        status = "upgrade_recomendado";
    } else if (percentual >= 80) {
        status = "alerta_capacidade";
    } else if (percentual >= 50) {
        status = "crescendo";
    }

    return {
        negocio_id: plano.negocio_id,
        negocio_nome: plano.negocio_nome,

        plano_id: plano.plano_id,
        plano_nome: plano.plano_nome,
        plano_slug: plano.plano_slug,
        valor: plano.valor,
        capacidade_agendamentos: capacidade,
        limite_profissionais: plano.limite_profissionais,
        limite_servicos: plano.limite_servicos,
        destaque: plano.destaque,

        plano_selecionado_id:
            plano.plano_selecionado_id,
        plano_selecionado_nome:
            plano.plano_selecionado_nome,
        plano_selecionado_slug:
            plano.plano_selecionado_slug,
        plano_selecionado_valor:
            plano.plano_selecionado_valor,
        assinatura_ativa_id:
            plano.assinatura_ativa_id || null,

        utilizados,
        profissionais_utilizados: Number(plano.profissionais_utilizados || 0),
        servicos_utilizados: Number(plano.servicos_utilizados || 0),
        restantes,
        percentual,
        ilimitado,
        status,

        mensagem:
            status === "limite_atingido"
                ? "🎉 Sua agenda atingiu a capacidade do plano. Faça upgrade para continuar recebendo novas clientes."
                : status === "upgrade_recomendado"
                    ? `🚀 Faltam apenas ${restantes} agendamento(s). Compare seu plano com a próxima opção.`
                    : status === "alerta_capacidade"
                    ? `Seu negócio está crescendo: você já utilizou ${percentual}% da agenda mensal.`
                    : status === "crescendo"
                        ? "Seu negócio está crescendo no Agenda Fashion."
                        : status === "ilimitado"
                            ? "Seu negócio possui capacidade ilimitada de agendamentos."
                            : "Acompanhe aqui o crescimento da sua agenda este mês."
    };
}

async function verificarCapacidadePlano(
    negocioId,
    executor = db,
    {
        bloquear = false,
        dataReferencia = null
    } = {}
) {
    if (bloquear) {
        await bloquearUsoPlano(executor, negocioId);
    }

    const uso = await buscarUsoPlano(
        negocioId,
        executor,
        dataReferencia
    );

    if (!uso) {
        const erro = new Error("Negócio não encontrado.");
        erro.codigo = "NEGOCIO_NAO_ENCONTRADO";
        erro.status = 404;
        erro.statusCode = 404;
        throw erro;
    }

    if (uso.ilimitado) {
        return uso;
    }

    if (uso.utilizados >= Number(uso.capacidade_agendamentos || 0)) {
        throw criarErroLimite(
            "Novos horários em breve.",
            "LIMITE_AGENDAMENTOS",
            uso
        );
    }

    return uso;
}

module.exports = {
    buscarUsoPlano,
    bloquearUsoPlano,
    verificarCapacidadePlano,
    criarErroLimite
};