const crypto = require("crypto");
const db = require("../src/db/db");
const syncRepository = require("../src/repositories/marketingCostSyncRepository");
const costRepository = require("../src/repositories/adminMarketingCostRepository");

function suffix() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

describe("custos automáticos integrados", () => {
  let campanhaId;
  let hoje;

  beforeEach(async () => {
    const id = suffix();
    const data = await db.query(
      "SELECT (NOW() AT TIME ZONE 'America/Sao_Paulo')::date::text AS hoje"
    );
    hoje = data.rows[0].hoje;

    const campanha = await db.query(`
      INSERT INTO marketing_campanhas (
        nome, canal, utm_source, utm_medium, utm_campaign, destino_path, ativo
      ) VALUES ($1, 'google', 'google', 'cpc', $2, '/', TRUE)
      RETURNING id
    `, [`Custo sync ${id}`, `sync_${id}`]);
    campanhaId = Number(campanha.rows[0].id);
  });

  afterEach(async () => {
    await db.query("DELETE FROM marketing_campanha_gastos WHERE campanha_id = $1", [campanhaId]);
    await db.query("DELETE FROM marketing_campanha_vinculos WHERE campanha_id = $1", [campanhaId]);
    await db.query("DELETE FROM marketing_campanhas WHERE id = $1", [campanhaId]);
  });

  test("custo automático substitui o manual do mesmo dia sem somar duas fontes", async () => {
    await costRepository.salvarGastoManual({
      campanhaId,
      dataGasto: hoje,
      valorCentavos: 1000,
      observacao: "estimativa",
      usuarioId: null
    });

    await syncRepository.salvarGastoAutomatico({
      campanhaId,
      dataGasto: hoje,
      valorCentavos: 1250,
      provedor: "google_ads"
    });

    const result = await db.query(`
      SELECT fonte, valor_centavos
      FROM marketing_campanha_gastos
      WHERE campanha_id = $1 AND data_gasto = $2::date
    `, [campanhaId, hoje]);

    expect(result.rows).toEqual([
      expect.objectContaining({
        fonte: "google_ads",
        valor_centavos: "1250"
      })
    ]);
  });

  test("correção manual posterior vira a fonte efetiva do dia", async () => {
    await syncRepository.salvarGastoAutomatico({
      campanhaId,
      dataGasto: hoje,
      valorCentavos: 1250,
      provedor: "google_ads"
    });

    await costRepository.salvarGastoManual({
      campanhaId,
      dataGasto: hoje,
      valorCentavos: 1300,
      observacao: "ajuste confirmado",
      usuarioId: null
    });

    const result = await db.query(`
      SELECT fonte, valor_centavos, observacao
      FROM marketing_campanha_gastos
      WHERE campanha_id = $1 AND data_gasto = $2::date
    `, [campanhaId, hoje]);

    expect(result.rows).toEqual([
      expect.objectContaining({
        fonte: "manual",
        valor_centavos: "1300",
        observacao: "ajuste confirmado"
      })
    ]);
  });
});
