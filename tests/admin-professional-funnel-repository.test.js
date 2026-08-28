const mockQuery = jest.fn();

jest.mock(
  "../src/db/db",
  () => ({
    query: mockQuery,
  })
);

const repository = require(
  "../src/repositories/adminProfessionalFunnelRepository"
);

describe(
  "contrato SQL do funil profissional",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockQuery.mockResolvedValue({
        rows: [],
      });
    });

    test(
      "não transforma clique Google sem campanha em campanha oficial",
      async () => {
        await repository
          .listarPorCampanha("30");

        const [sql] =
          mockQuery.mock.calls[0];

        expect(sql).not.toMatch(
          /WITH\s+google_oficial/i
        );
        expect(sql).toContain(
          "THEN '(sem campanha)'"
        );
        expect(sql).toContain(
          "THEN 'rastreamento_incompleto'"
        );
        expect(sql).toContain(
          "THEN 'sem_evidencia'"
        );
        expect(sql).toMatch(
          /campanha_oficial\.id IS NOT NULL[\s\S]*THEN 'oficial'/i
        );
        expect(sql).toContain(
          "AS primeiros_agendamentos"
        );
        expect(sql).toMatch(
          /f\.primeiro_agendamento_em\s*<=\s*f\.atribuicao_em\s*\+/i
        );
        expect(sql).toMatch(
          /f\.primeiro_pagamento_em\s*<=[\s\S]*f\.atribuicao_em AT TIME ZONE/i
        );
        expect(
          mockQuery.mock.calls[0][1]
        ).toEqual([14, 21]);
      }
    );

    test(
      "reconhece somente campanha cadastrada com objetivo profissional",
      async () => {
        await repository
          .listarPorCampanha("today");

        const [sql] =
          mockQuery.mock.calls[0];

        expect(sql).toContain(
          "candidata.objetivo = 'profissional'"
        );
        expect(sql).not.toMatch(
          /candidata\.ativo\s*=\s*TRUE/i
        );
        expect(sql).toMatch(
          /NOW\(\) AT TIME ZONE 'America\/Sao_Paulo'/i
        );
      }
    );
  }
);
