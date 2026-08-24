jest.mock("../src/db/db", () => ({
  query: jest.fn(),
}));

const planoService = require(
  "../src/services/planoService"
);

function criarPlano({
  capacidade = 10,
  utilizados = 0,
  servicosUtilizados = 1,
} = {}) {
  return {
    negocio_id: 1,
    negocio_nome: "Negócio Teste",
    plano_id: 1,
    plano_nome: "Grátis",
    plano_slug: "inicial",
    valor: "0.00",
    capacidade_agendamentos: capacidade,
    limite_profissionais: 1,
    limite_servicos: 2,
    destaque: false,
    utilizados,
    profissionais_utilizados: 1,
    servicos_utilizados: servicosUtilizados,
  };
}

describe("Limites dos planos", () => {
  test.each([
    [8, "alerta_capacidade"],
    [9, "upgrade_recomendado"],
    [10, "limite_atingido"],
  ])(
    "%i de 10 agendamentos retorna %s",
    async (utilizados, statusEsperado) => {
      const executor = {
        query: jest
          .fn()
          /*
           * Consulta realizada por
           * expirarCancelamentoSeNecessario.
           */
          .mockResolvedValueOnce({
            rows: [],
          })
          /*
           * Consulta principal de buscarUsoPlano.
           */
          .mockResolvedValueOnce({
            rows: [
              criarPlano({
                utilizados,
              }),
            ],
          }),
      };

      const uso = await planoService.buscarUsoPlano(
        1,
        executor,
        "2026-07-20"
      );

      expect(uso.status).toBe(statusEsperado);
      expect(uso.utilizados).toBe(utilizados);

      expect(executor.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "COALESCE($2::date, CURRENT_DATE)"
        ),
        [1, "2026-07-20"]
      );
    }
  );

  test(
    "plano Grátis mantém somente dois serviços ativos",
    async () => {
      const executor = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [
              criarPlano({
                servicosUtilizados: 4,
              }),
            ],
          })
          .mockResolvedValueOnce({
            rows: [{ total: 2 }],
          }),
      };

      const uso = await planoService.buscarUsoPlano(
        1,
        executor
      );

      expect(uso.servicos_utilizados).toBe(2);
      expect(executor.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining(
          "UPDATE servicos_negocio"
        ),
        [1, 2]
      );
    }
  );

  test(
    "plano Salão aceita agendamentos ilimitados",
    async () => {
      const executor = {
        query: jest
          .fn()
          /*
           * Consulta de expiração do cancelamento.
           */
          .mockResolvedValueOnce({
            rows: [],
          })
          /*
           * Consulta principal do plano.
           */
          .mockResolvedValueOnce({
            rows: [
              criarPlano({
                capacidade: null,
                utilizados: 500,
              }),
            ],
          }),
      };

      const uso =
        await planoService.verificarCapacidadePlano(
          1,
          executor
        );

      expect(uso.ilimitado).toBe(true);
      expect(uso.status).toBe("ilimitado");
    }
  );

  test(
    "bloqueia atomicamente quando a capacidade foi atingida",
    async () => {
      const executor = {
        query: jest
          .fn()
          /*
           * Primeira consulta:
           * bloqueio transacional advisory.
           */
          .mockResolvedValueOnce({
            rows: [],
          })
          /*
           * Segunda consulta:
           * expirarCancelamentoSeNecessario.
           */
          .mockResolvedValueOnce({
            rows: [],
          })
          /*
           * Terceira consulta:
           * busca do uso atual do plano.
           */
          .mockResolvedValueOnce({
            rows: [
              criarPlano({
                utilizados: 10,
              }),
            ],
          }),
      };

      await expect(
        planoService.verificarCapacidadePlano(
          1,
          executor,
          {
            bloquear: true,
            dataReferencia: "2026-07-20",
          }
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        codigo: "LIMITE_AGENDAMENTOS",
        message: "Novos horários em breve.",
      });

      expect(
        executor.query
      ).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(
          "pg_advisory_xact_lock"
        ),
        [1]
      );

      expect(executor.query).toHaveBeenCalledTimes(3);
    }
  );
});