/*
 * Fachada pública do domínio de assinaturas.
 *
 * O núcleo existente permanece isolado em assinaturaServiceCore para preservar
 * os fluxos estáveis, enquanto a ativação financeira do Asaas usa uma saga
 * própria sem manter locks PostgreSQL durante chamadas HTTP externas.
 */
const assinaturaServiceCore = require(
  "./assinaturaServiceCore"
);
const {
  ativarAssinaturaPorPagamento
} = require(
  "./assinaturaAtivacaoAsaasService"
);

module.exports = {
  ...assinaturaServiceCore,
  ativarAssinaturaPorPagamento
};
