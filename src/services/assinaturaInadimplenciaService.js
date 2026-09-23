const db = require("../db/db");
const assinaturaRepository = require(
  "../repositories/assinaturaRepository"
);
const assinaturaLifecycleService = require(
  "./assinaturaLifecycleService"
);

async function reconciliarInadimplenciaTerminal({
  pagamentoId,
  janelaDias,
}) {
  if (!pagamentoId) {
    throw new Error("Pagamento não informado.");
  }

  return db.executarTransacao(async (client) => {
    const contexto = await assinaturaRepository
      .buscarPagamentoInadimplenteMaduroParaAtualizar(
        pagamentoId,
        janelaDias,
        client
      );

    if (!contexto) {
      return null;
    }

    return assinaturaLifecycleService
      .registrarEncerramentoAcesso({
        client,
        assinatura: contexto,
        pagamentoId: contexto.pagamento_id,
        motivo: "INADIMPLENCIA_NAO_RECUPERADA",
        origem: "sistema",
        detalhes: {
          regra: "inadimplencia_v1",
          janela_recuperacao_dias: Number(janelaDias),
          data_vencimento:
            contexto.data_vencimento || null,
        },
      });
  });
}

module.exports = {
  reconciliarInadimplenciaTerminal,
};
