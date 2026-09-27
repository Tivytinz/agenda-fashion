const {
  randomInt
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
        const assinaturaId =
          randomInt(
            100000,
            999999
          );
        chaveEvento =
          `assinatura:${assinaturaId}`;

        const dados = {
          provedor: "meta",
          tipoEvento:
            "SUBSCRIPTION_ACTIVATED",
          chaveEvento,
          payload: {
            negocioId: 1,
            assinaturaId,
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
        expect(segunda.rearmado)
          .toBe(false);
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
