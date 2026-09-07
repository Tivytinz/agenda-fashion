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
      "usa somente agendamentos não cancelados como primeiro valor",
      async () => {
        await repository
          .listarPorCampanha("30");

        const [sql] =
          mockQuery.mock.calls[0];

        expect(sql).toMatch(
          /MIN\(ag\.created_at\)[\s\S]*COALESCE\([\s\S]*ag\.status[\s\S]*'agendado'[\s\S]*\)\s*<>\s*'cancelado'/i
        );
        expect(sql).toMatch(
          /ag\.negocio_id = dono\.negocio_id[\s\S]*ag\.status[\s\S]*<>\s*'cancelado'/i
        );
        expect(sql).toMatch(
          /ag_anterior\.status[\s\S]*<>\s*'cancelado'/i
        );
      }
    );

    test(
      "mantém a ativação cumulativa sem rebaixar a verdade financeira",
      async () => {
        await repository
          .listarPorCampanha("30");

        const [sql] =
          mockQuery.mock.calls[0];

        expect(sql).toMatch(
          /WHERE f\.negocio_criado\s+AND f\.servico_criado\s*\)\s*::INT AS servicos_criados/i
        );
        expect(sql).toMatch(
          /WHERE f\.negocio_criado\s+AND f\.servico_criado\s+AND f\.agenda_configurada\s*\)\s*::INT AS agendas_configuradas/i
        );
        expect(sql).toMatch(
          /WHERE f\.negocio_criado\s+AND f\.servico_criado\s+AND f\.agenda_configurada\s+AND f\.negocio_publicado\s*\)\s*::INT AS negocios_publicados/i
        );
        expect(sql).toMatch(
          /WHERE f\.negocio_criado[\s\S]*AND f\.primeiro_agendamento\s*\)\s*::INT AS primeiros_agendamentos/i
        );
        expect(sql).toMatch(
          /COUNT\(\*\) FILTER \(\s*WHERE f\.checkout_iniciado\s*\)::INT AS checkouts_iniciados/i
        );
        expect(sql).toMatch(
          /COUNT\(\*\) FILTER \(\s*WHERE f\.assinatura_ativada\s*\)::INT AS assinaturas_ativadas/i
        );
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