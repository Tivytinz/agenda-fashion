const repository = require(
  "../src/repositories/mlNoShowRepository"
);
const db = require("../src/db/db");
const { avaliarProntidao } = require(
  "../src/services/mlNoShowDataService"
);

describe(
  "diagnóstico integrado de maturidade ML no-show",
  () => {
    test(
      "executa agregações somente leitura sobre o schema real",
      async () => {
        const captura = await repository.obterCoberturaCaptura();
        expect(captura).toEqual(expect.objectContaining({
          total_elegiveis: expect.any(Number),
          total_capturados: expect.any(Number),
          amostras_reagendadas_legadas: expect.any(Number),
        }));
        const auditoria = await db.query(`
          SELECT COUNT(*)::INT AS total
          FROM ml_agendamento_no_show_amostras amostra
          WHERE EXISTS (
            SELECT 1
            FROM agendamento_reagendamentos reagendamento
            WHERE reagendamento.agendamento_id = amostra.agendamento_id
          )
        `);
        expect(captura.amostras_reagendadas_legadas)
          .toBe(auditoria.rows[0].total);
        if (captura.amostras_reagendadas_legadas > 0) {
          const prontidao = avaliarProntidao({
            total_amostras: 500,
            amostras_rotuladas: 450,
            faltas: 100,
            realizados: 350,
            pendentes_vencidos: 0,
          }, captura);
          expect(prontidao.pronta_para_treinamento).toBe(false);
          expect(prontidao.motivos)
            .toContain("amostras_reagendadas_legadas");
        }
        expect(captura.total_capturados).toBeLessThanOrEqual(captura.total_elegiveis);
        const resumo =
          await repository
            .obterResumoMaturidadeNegocios();
        const negocios =
          await repository
            .listarMaturidadeNegocios({
              limite: 20,
            });
        const segmentos =
          await repository
            .listarMaturidadeSegmentosCliente();
        const mensal =
          await repository
            .listarMaturidadeMensal({
              meses: 12,
            });

        expect(resumo)
          .toEqual(
            expect.objectContaining({
              negocios_com_amostras:
                expect.any(Number),
              negocios_com_rotulos:
                expect.any(Number),
            })
          );
        expect(Array.isArray(negocios))
          .toBe(true);
        expect(Array.isArray(segmentos))
          .toBe(true);
        expect(Array.isArray(mensal))
          .toBe(true);

        expect(
          JSON.stringify({
            resumo,
            negocios,
            segmentos,
            mensal,
          })
        ).not.toMatch(
          /cliente_nome|cliente_whatsapp|email|observacoes/i
        );
      },
      20_000
    );
  }
);
