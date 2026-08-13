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
  let ontem;

  beforeEach(async () => {
    const id = suffix();
    const data = await db.query(`
      SELECT
        (NOW() AT TIME ZONE 'America/Sao_Paulo')::date::text AS hoje,
        ((NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 1)::text AS ontem
    `);
    hoje = data.rows[0].hoje;
    ontem = data.rows[0].ontem;

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

  test("reconciliação remove custo automático antigo que não veio mais da plataforma", async () => {
    await syncRepository.salvarGastoAutomatico({
      campanhaId,
      dataGasto: ontem,
      valorCentavos: 700,
      provedor: "google_ads"
    });
    await syncRepository.salvarGastoAutomatico({
      campanhaId,
      dataGasto: hoje,
      valorCentavos: 1250,
      provedor: "google_ads"
    });

    const resumo = await syncRepository.reconciliarGastosAutomaticos({
      provedor: "google_ads",
      dataInicio: ontem,
      dataFim: hoje,
      campanhaIds: [campanhaId],
      gastos: [
        {
          campanhaId,
          dataGasto: hoje,
          valorCentavos: 1500
        }
      ]
    });

    expect(resumo).toEqual({
      removidos: 2,
      salvos: 1
    });

    const result = await db.query(`
      SELECT data_gasto::text AS data_gasto, fonte, valor_centavos, moeda
      FROM marketing_campanha_gastos
      WHERE campanha_id = $1
      ORDER BY data_gasto ASC
    `, [campanhaId]);

    expect(result.rows).toEqual([
      {
        data_gasto: hoje,
        fonte: "google_ads",
        valor_centavos: "1500",
        moeda: "BRL"
      }
    ]);
  });

  test("falha no meio da reconciliação faz rollback e preserva o retrato anterior", async () => {
    await syncRepository.salvarGastoAutomatico({
      campanhaId,
      dataGasto: hoje,
      valorCentavos: 1250,
      provedor: "google_ads"
    });

    await expect(
      syncRepository.reconciliarGastosAutomaticos({
        provedor: "google_ads",
        dataInicio: ontem,
        dataFim: hoje,
        campanhaIds: [campanhaId],
        gastos: [
          {
            campanhaId,
            dataGasto: hoje,
            valorCentavos: 1500
          },
          {
            campanhaId,
            dataGasto: "data-invalida",
            valorCentavos: 800
          }
        ]
      })
    ).rejects.toThrow();

    const result = await db.query(`
      SELECT fonte, valor_centavos, moeda
      FROM marketing_campanha_gastos
      WHERE campanha_id = $1 AND data_gasto = $2::date
    `, [campanhaId, hoje]);

    expect(result.rows).toEqual([
      {
        fonte: "google_ads",
        valor_centavos: "1250",
        moeda: "BRL"
      }
    ]);
  });
});
