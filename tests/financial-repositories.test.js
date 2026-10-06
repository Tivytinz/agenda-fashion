jest.mock("../src/db/db", () => ({
  query: jest.fn(),
}));

const db = require("../src/db/db");
const checkoutRepository = require("../src/repositories/checkoutRepository");
const assinaturaRepository = require("../src/repositories/assinaturaRepository");
const pagamentoRepository = require("../src/repositories/pagamentoRepository");

function executorCom(rows = [{ id: 1 }]) {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
  };
}

beforeEach(() => {
  db.query.mockReset();
});

describe("repositories financeiros críticos", () => {
  describe("checkoutRepository", () => {
    test("resolve negócio de dona e plano pelo banco", async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 10, publicado: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 3, valor: "49.90" }] });

      await expect(
        checkoutRepository.buscarNegocioDono(null, 7)
      ).resolves.toMatchObject({ id: 10 });

      await expect(
        checkoutRepository.buscarPlano(null, 3)
      ).resolves.toMatchObject({ id: 3 });

      expect(db.query.mock.calls[0][1]).toEqual([7]);
      expect(db.query.mock.calls[1][1]).toEqual([3]);
    });

    test("serializa checkout e consulta pendência/dados do cliente", async () => {
      const client = executorCom([{ id: 20 }]);

      await checkoutRepository.bloquearCheckoutDoNegocio(client, "10");
      await checkoutRepository.buscarAssinaturaPendenteDoNegocio(client, 10);
      await checkoutRepository.buscarDadosClienteAsaas(client, 10, 7);

      expect(client.query.mock.calls[0][1]).toEqual([10]);
      expect(client.query.mock.calls[1][1]).toEqual([10]);
      expect(client.query.mock.calls[2][1]).toEqual([10, 7]);
    });

    test("salva customer Asaas somente quando ausente", async () => {
      const client = executorCom([
        { asaas_customer_id: "cus_novo" },
      ]);

      await expect(
        checkoutRepository.salvarClienteAsaasSeAusente(
          client,
          10,
          "cus_novo"
        )
      ).resolves.toBe("cus_novo");

      expect(client.query).toHaveBeenCalledTimes(1);
    });

    test("reaproveita customer persistido por outra execução concorrente", async () => {
      const client = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ asaas_customer_id: "cus_existente" }],
          }),
      };

      await expect(
        checkoutRepository.salvarClienteAsaasSeAusente(
          client,
          10,
          "cus_descartado"
        )
      ).resolves.toBe("cus_existente");

      expect(client.query).toHaveBeenCalledTimes(2);
    });

    test("isola status de checkout pela dona e consulta estado do webhook", async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: "PENDING" }],
        })
        .mockResolvedValueOnce({
          rows: [{ status: "FAILED", falha_terminal: true }],
        });

      await expect(
        checkoutRepository.buscarPagamentoCheckout("pay_1", 7)
      ).resolves.toMatchObject({ id: 1 });

      await expect(
        checkoutRepository.buscarEstadoAtivacaoPagamento("pay_1")
      ).resolves.toMatchObject({ falha_terminal: true });

      expect(db.query.mock.calls[0][1]).toEqual(["pay_1", 7]);
      expect(db.query.mock.calls[1][1]).toEqual(["pay_1"]);
    });

    test("retorna null quando registros de checkout não existem", async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(
        checkoutRepository.buscarPagamentoCheckout("inexistente", 7)
      ).resolves.toBeNull();

      await expect(
        checkoutRepository.buscarEstadoAtivacaoPagamento("inexistente")
      ).resolves.toBeNull();
    });
  });

  describe("pagamentoRepository", () => {
    test("cria pagamento com defaults seguros e upsert idempotente", async () => {
      const client = executorCom([{ id: 30 }]);

      await expect(
        pagamentoRepository.criarPagamento(client, {
          assinatura_id: 4,
          valor: 49.9,
        })
      ).resolves.toMatchObject({ id: 30 });

      expect(client.query.mock.calls[0][1]).toEqual([
        4,
        null,
        49.9,
        null,
        "PENDING",
        null,
        null,
        null,
        null,
        null,
      ]);
    });

    test("busca pagamento e retorna null quando ausente", async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        pagamentoRepository.buscarPorPaymentId("pay_1")
      ).resolves.toMatchObject({ id: 1 });

      await expect(
        pagamentoRepository.buscarPorPaymentId("pay_missing")
      ).resolves.toBeNull();
    });

    test("atualiza status respeitando ordenação do evento Asaas", async () => {
      const client = executorCom([{ id: 1, status: "CONFIRMED" }]);

      await expect(
        pagamentoRepository.atualizarStatusPagamento(
          client,
          "pay_1",
          {
            status: "CONFIRMED",
            data_pagamento: "2026-09-26",
            invoice_url: "https://www.asaas.com/i/1",
            evento_criado_em: "2026-09-26T12:00:00Z",
            evento_id: "evt_1",
          }
        )
      ).resolves.toMatchObject({ status: "CONFIRMED" });

      expect(client.query.mock.calls[0][1]).toEqual([
        "CONFIRMED",
        "2026-09-26",
        null,
        "https://www.asaas.com/i/1",
        "2026-09-26T12:00:00Z",
        "evt_1",
        "pay_1",
      ]);
    });

    test("lista pagamentos de uma assinatura com limite explícito", async () => {
      db.query.mockResolvedValue({ rows: [{ id: 2 }, { id: 1 }] });

      await expect(
        pagamentoRepository.listarPorAssinatura(4, 6)
      ).resolves.toHaveLength(2);

      expect(db.query.mock.calls[0][1]).toEqual([4, 6]);
    });
  });

  describe("assinaturaRepository", () => {
    test("cria assinatura com defaults financeiros explícitos", async () => {
      const client = executorCom([{ id: 40 }]);

      await expect(
        assinaturaRepository.criarAssinatura(client, {
          negocio_id: 10,
          plano_id: 3,
          valor: 49.9,
        })
      ).resolves.toMatchObject({ id: 40 });

      expect(client.query.mock.calls[0][1]).toEqual([
        10,
        3,
        null,
        null,
        "PENDING",
        null,
        "MONTHLY",
        49.9,
        null,
        false,
        null,
      ]);
    });

    test("cobre consultas unitárias do ciclo da assinatura", async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await expect(
        assinaturaRepository.buscarAssinaturaAtivaPorNegocio(10)
      ).resolves.toMatchObject({ id: 1 });
      await expect(
        assinaturaRepository.buscarPorSubscriptionId("sub_1")
      ).resolves.toMatchObject({ id: 1 });
      await expect(
        assinaturaRepository.buscarNegocioDono(7)
      ).resolves.toMatchObject({ id: 1 });
      await expect(
        assinaturaRepository.buscarAssinaturaPendentePorNegocio(10)
      ).resolves.toMatchObject({ id: 1 });
      await expect(
        assinaturaRepository.buscarUltimaAssinaturaPorNegocio(10)
      ).resolves.toMatchObject({ id: 1 });
      await expect(
        assinaturaRepository.buscarPlano(3)
      ).resolves.toMatchObject({ id: 1 });
      await expect(
        assinaturaRepository.buscarUltimoPagamentoPendente(40)
      ).resolves.toMatchObject({ id: 1 });
      await expect(
        assinaturaRepository.listarPagamentos(40)
      ).resolves.toEqual([{ id: 1 }]);
    });

    test("cobre mutações com executor transacional", async () => {
      const client = executorCom([{ id: 40 }]);

      await expect(
        assinaturaRepository.ativarAssinatura(client, 40)
      ).resolves.toMatchObject({ id: 40 });

      await expect(
        assinaturaRepository.desativarAssinaturasDoNegocio(client, 10)
      ).resolves.toBeUndefined();

      await expect(
        assinaturaRepository.buscarPorId(40, client)
      ).resolves.toMatchObject({ id: 40 });

      await expect(
        assinaturaRepository.expirarCheckoutsPendentes(10, client)
      ).resolves.toEqual([{ id: 40 }]);

      await expect(
        assinaturaRepository.registrarCancelamento(client, {
          assinaturaId: 40,
          negocioId: 10,
          acessoAte: "2026-10-26",
          observacoes: "Cancelamento solicitado",
        })
      ).resolves.toMatchObject({ id: 40 });

      await expect(
        assinaturaRepository.expirarCancelamentoSeNecessario(10, client)
      ).resolves.toMatchObject({ id: 40 });
    });

    test("normaliza limites da reconciliação de inadimplência", async () => {
      const executor = executorCom([{ pagamento_id: 1 }]);

      await assinaturaRepository.listarPagamentosInadimplentesMaduros(
        999,
        0,
        executor
      );
      expect(executor.query.mock.calls[0][1]).toEqual([500, 1]);

      await assinaturaRepository.listarPagamentosInadimplentesMaduros(
        "invalido",
        "invalido",
        executor
      );
      expect(executor.query.mock.calls[1][1]).toEqual([100, 14]);

      await assinaturaRepository.buscarPagamentoInadimplenteMaduroParaAtualizar(
        1,
        999,
        executor
      );
      expect(executor.query.mock.calls[2][1]).toEqual([1, 90]);

      await assinaturaRepository.listarNegociosComCancelamentoExpirado(
        0,
        executor
      );
      expect(executor.query.mock.calls[3][1]).toEqual([1]);
    });

    test("retorna null quando assinatura consultada não existe", async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(
        assinaturaRepository.buscarAssinaturaAtivaPorNegocio(10)
      ).resolves.toBeNull();

      const executor = executorCom([]);
      await expect(
        assinaturaRepository.buscarPagamentoInadimplenteMaduroParaAtualizar(
          1,
          14,
          executor
        )
      ).resolves.toBeNull();
    });
  });
});
