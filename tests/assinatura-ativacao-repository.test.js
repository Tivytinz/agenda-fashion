jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn()
  })
);

const db = require("../src/db/db");
const repository = require(
  "../src/repositories/assinaturaAtivacaoRepository"
);

function clientCom(rows = []) {
  return {
    query: jest.fn().mockResolvedValue({
      rows,
      rowCount: rows.length
    })
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test(
  "carrega e bloqueia o contexto financeiro quando solicitado",
  async () => {
    const client = clientCom([
      {
        id: 20,
        pagamento_id: 31
      }
    ]);

    const resultado =
      await repository
        .buscarContextoPagamento(
          client,
          "pay_1",
          {
            bloquear: true
          }
        );

    expect(resultado.id).toBe(20);
    expect(client.query)
      .toHaveBeenCalledWith(
        expect.stringContaining(
          "FOR UPDATE OF p, a"
        ),
        ["pay_1"]
      );
  }
);

test(
  "executa as mutações locais da finalização pelo repository",
  async () => {
    const client = clientCom([
      {
        id: 7,
        plano_id: 3,
        asaas_subscription_id:
          "sub_new"
      }
    ]);

    await repository.bloquearNegocio(
      client,
      7
    );
    await repository
      .buscarAssinaturaAtivaMaisNova(
        client,
        7,
        20
      );
    await repository
      .vincularRecorrenciaAsaas(
        client,
        20,
        "sub_new"
      );
    await repository
      .desativarAssinaturasConcorrentes(
        client,
        7,
        20
      );
    await repository.ativarAssinatura(
      client,
      {
        assinaturaId: 20,
        asaasSubscriptionId:
          "sub_new",
        dataProximaCobranca:
          "2026-10-13",
        observacoes: "ativa"
      }
    );
    await repository.atualizarPlanoNegocio(
      client,
      7,
      3
    );

    expect(client.query)
      .toHaveBeenCalledTimes(6);
    expect(
      client.query.mock.calls[0][0]
    ).toContain("FOR UPDATE");
    expect(
      client.query.mock.calls[3][0]
    ).toContain("Recorrência substituída");
  }
);

test(
  "lista recorrências substituídas sem duplicar ids vazios",
  async () => {
    const client = clientCom([
      {
        asaas_subscription_id:
          "sub_old_1"
      },
      {
        asaas_subscription_id:
          "sub_old_2"
      },
      {
        asaas_subscription_id: null
      }
    ]);

    const ids =
      await repository
        .listarRecorrenciasSubstituidas(
          client,
          7,
          20
        );

    expect(ids).toEqual([
      "sub_old_1",
      "sub_old_2"
    ]);
  }
);

test(
  "verifica vínculo local antes de compensar uma recorrência Asaas",
  async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ existe: 1 }]
      })
      .mockResolvedValueOnce({
        rows: []
      });

    await expect(
      repository
        .existeVinculoRecorrenciaAsaas(
          "sub_1"
        )
    ).resolves.toBe(true);

    await expect(
      repository
        .existeVinculoRecorrenciaAsaas(
          "sub_2"
        )
    ).resolves.toBe(false);

    await expect(
      repository
        .existeVinculoRecorrenciaAsaas("")
    ).resolves.toBe(false);
  }
);
