const {
  randomUUID
} = require("node:crypto");

const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/marketingConversionDeliveryRepository"
);

describe(
  "Persistência das conversões de marketing",
  () => {
    let chaveEvento;

    afterEach(async () => {
      if (!chaveEvento) {
        return;
      }

      await db.query(
        `
        DELETE FROM marketing_conversoes_entregas
        WHERE chave_evento = $1
        `,
        [chaveEvento]
      );

      chaveEvento = null;
    });

    test(
      "a mesma conversão por provedor é enfileirada uma única vez",
      async () => {
        chaveEvento =
          `assinatura:test:${randomUUID()}`;

        const dados = {
          provedor: "meta",
          tipoEvento:
            "SUBSCRIPTION_ACTIVATED",
          chaveEvento,
          payload: {
            negocioId: 1,
            assinaturaId: 2,
            pagamentoId: "pay_test",
            valor: 49.9
          }
        };

        const primeira =
          await repository
            .enfileirar(dados);
        const segunda =
          await repository
            .enfileirar(dados);

        expect(primeira.novo)
          .toBe(true);
        expect(segunda.novo)
          .toBe(false);
        expect(segunda.entrega.id)
          .toBe(primeira.entrega.id);
        expect(primeira.entrega)
          .toMatchObject({
            provedor: "meta",
            status: "PENDING",
            tentativas: 0
          });
      }
    );
  }
);
