const db = require("../db/db");
const assinaturaRepository =
    require("../repositories/assinaturaRepository");
const {
    reconciliarReativacaoAbandonada
} = require("./assinaturaReativacaoService");
const planoRepository = require(
    "../repositories/planoRepository"
);
const UnauthorizedError = require(
    "../errors/UnauthorizedError"
);
const NotFoundError = require(
    "../errors/NotFoundError"
);

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

    await planoRepository.bloquearUsoPlano(
        negocioId,
        client
    );
}

async function listarPlanos() {
    return planoRepository.listarPlanosAtivos();
}

async function buscarMeuPlano(usuarioId) {
    if (!usuarioId) {
        throw new UnauthorizedError(
            "Usuário não autenticado."
        );
    }

    const vinculo = await planoRepository
        .buscarNegocioDonoAtivoPorUsuario(
            usuarioId
        );

    if (!vinculo) {
        throw new NotFoundError(
            "Negócio não encontrado."
        );
    }

    return buscarUsoPlano(
        vinculo.negocio_id
    );
}

async function buscarUsoPlano(
    negocioId,
    executor = db,
    dataReferencia = null
) {
    if (executor === db) {
        await reconciliarReativacaoAbandonada(
            negocioId
        );
    }

    await assinaturaRepository
        .expirarCancelamentoSeNecessario(
            negocioId,
            executor
        );

    const plano = await planoRepository.buscarUsoPlano(
        negocioId,
        dataReferencia,
        executor
    );

    if (!plano) {
        return null;
    }

    const capacidade = plano.capacidade_agendamentos;
    const utilizados = Number(plano.utilizados || 0);
    const ilimitado = capacidade === null;
    const servicosUtilizados = Number(
        plano.servicos_utilizados || 0
    );

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
        servicos_utilizados: servicosUtilizados,
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
    listarPlanos,
    buscarMeuPlano,
    buscarUsoPlano,
    bloquearUsoPlano,
    verificarCapacidadePlano,
    criarErroLimite
};
