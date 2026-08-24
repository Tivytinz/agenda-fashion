const db = require("../db/db");
const servicosRepository = require("../repositories/servicosRepository");
const {
  buscarUsoPlano,
  criarErroLimite,
} = require("./planoService");

function criarErro(mensagem, statusCode) {
  const erro = new Error(mensagem);
  erro.status = statusCode;
  erro.statusCode = statusCode;
  return erro;
}

async function alterarAtivoServico({ usuarioId, id, ativo }) {
  if (typeof ativo !== "boolean") {
    throw criarErro("Informe se o serviço deve ficar ativo ou inativo.", 400);
  }

  const vinculo = await servicosRepository.buscarNegocioDono(usuarioId);

  if (!vinculo) {
    throw criarErro("Apenas o dono pode alterar a disponibilidade do serviço.", 403);
  }

  const servico = await db.executarTransacao(async (client) => {
    const atual = await servicosRepository.buscarServicoDoNegocio(
      id,
      vinculo.negocio_id,
      client
    );

    if (!atual) return null;
    if ((atual.ativo !== false) === ativo) return atual;

    if (ativo) {
      await servicosRepository.bloquearCadastroServico(
        client,
        vinculo.negocio_id
      );

      const uso = await buscarUsoPlano(
        vinculo.negocio_id,
        client
      );

      if (!uso) {
        throw criarErro("Plano do negócio não encontrado.", 404);
      }

      const utilizados = await servicosRepository.contarServicosAtivos(
        vinculo.negocio_id,
        client
      );
      const limite = uso.limite_servicos;

      if (limite !== null && utilizados >= Number(limite)) {
        const limiteNumerico = Number(limite);
        throw criarErroLimite(
          `Você atingiu o limite de ${limiteNumerico} serviço(s) do plano ${uso.plano_nome || "atual"}. Desative um serviço ativo para escolher outro ou faça upgrade.`,
          "LIMITE_SERVICOS",
          {
            plano_nome: uso.plano_nome || "plano atual",
            utilizados,
            limite: limiteNumerico,
            acima_do_limite: Math.max(0, utilizados - limiteNumerico),
          }
        );
      }
    }

    const resultado = await client.query(
      `
      UPDATE servicos_negocio
      SET ativo = $1
      WHERE id = $2
        AND negocio_id = $3
      RETURNING *
      `,
      [ativo, id, vinculo.negocio_id]
    );

    const atualizado = resultado.rows[0] || null;

    if (atualizado) {
      await servicosRepository.sincronizarPublicacaoAutomatica(
        vinculo.negocio_id,
        client
      );
    }

    return atualizado;
  });

  if (!servico) {
    throw criarErro("Serviço não encontrado.", 404);
  }

  return {
    mensagem: servico.ativo
      ? "Serviço ativado e visível para novas clientes."
      : "Serviço desativado e oculto para novas clientes.",
    servico,
  };
}

module.exports = {
  alterarAtivoServico,
};