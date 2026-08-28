const db = require("../db/db");
const marketingCanonicalCleanupRepository = require(
  "../repositories/marketingCanonicalCleanupRepository"
);
const marketingAttributionRecoveryRepository = require(
  "../repositories/marketingAttributionRecoveryRepository"
);

const CAMPANHA_OFICIAL =
  "google_ads_profissionais";
const CAMPANHAS_LEGADAS = [
  ...marketingCanonicalCleanupRepository
    .CAMPANHAS_LEGADAS,
];
const CAMPANHAS_ACEITAS = [
  CAMPANHA_OFICIAL,
  ...CAMPANHAS_LEGADAS,
];

async function executarLimpezaGoogleProfissionais() {
  return db.executarTransacao(
    async (client) => {
      const oficial =
        await marketingCanonicalCleanupRepository
          .garantirCampanhaGoogleProfissionais({
            client,
            campanhaOficial:
              CAMPANHA_OFICIAL,
          });

      const campanhaOficialId =
        Number(
          oficial.rows[0]?.id
        );

      /*
       * Canonicalização é metadado de leitura, não mutação da evidência.
       * UTMs, click IDs, landing pages e eventos capturados permanecem
       * imutáveis. A única recuperação permitida aqui preenche first touch
       * vazio quando uma sessão/evento compatível ainda oferece evidência.
       */
      const atribuicoesRecuperadas =
        await marketingAttributionRecoveryRepository
          .recuperarGoogleProfissionaisPorEventos({
            client,
            campanhaOficial:
              CAMPANHA_OFICIAL,
            campanhasAceitas:
              CAMPANHAS_ACEITAS,
          });

      return {
        campanhaOficialId,
        campanhasApagadas: 0,
        gastosRemovidos: 0,
        vinculosRemovidos: 0,
        atribuicoesComGclidPreservadas: 0,
        atribuicoesLimpas: 0,
        atribuicoesRecuperadasDeEventos:
          atribuicoesRecuperadas.rowCount || 0,
        eventosComGclidPreservados: 0,
        eventosComSinalGooglePreservados: 0,
        eventosLimpos: 0,
      };
    }
  );
}

module.exports = {
  CAMPANHA_OFICIAL,
  CAMPANHAS_LEGADAS,
  CAMPANHAS_ACEITAS,
  executarLimpezaGoogleProfissionais,
};
