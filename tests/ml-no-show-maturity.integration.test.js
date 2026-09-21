const repository = require(
  "../src/repositories/mlNoShowRepository"
);

describe(
  "diagnóstico integrado de maturidade ML no-show",
  () => {
    test(
      "executa agregações somente leitura sobre o schema real",
      async () => {
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
