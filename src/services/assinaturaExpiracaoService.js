const { dataValida } = require("./assinaturaCalculos");
const db = require("../db/db");
const assinaturaRepository = require("../repositories/assinaturaRepository");
const equipePlanoService = require("./equipePlanoService");
const assinaturaLifecycleService = require("./assinaturaLifecycleService");
const renovacaoRepository = require("../repositories/assinaturaRenovacaoRepository");

async function expirarCancelamentoComReconciliacao(
    negocioId,
    executor = db
) {
    const executar = async (client) => {
        if (!await assinaturaRepository.bloquearNegocioSePeriodoVencido(negocioId, client)) return null;
        await renovacaoRepository.garantirOperacaoLegada(negocioId, client);
        const expirada = await assinaturaRepository
            .expirarCancelamentoSeNecessario(
                negocioId,
                client
            );

        if (
            expirada &&
            expirada.negocio_saiu_base_paga === true
        ) {
            await assinaturaLifecycleService
                .registrarEncerramentoAcesso({
                    client,
                    assinatura: expirada,
                    origem: "sistema",
                    referenciaIdempotencia:
                        dataValida(expirada.acesso_pago_ate ?? expirada.data_proxima_cobranca) ||
                        "fim-periodo-pago"
                });

            await equipePlanoService
                .reconciliarLimiteProfissionais(
                    negocioId,
                    client
                );
        }

        return expirada;
    };

    if (executor === db) {
        return db.executarTransacao(executar);
    }

    return executar(executor);
}

module.exports = { expirarCancelamentoComReconciliacao };
