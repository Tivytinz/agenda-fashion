jest.mock(
  "../src/services/assinaturaService",
  () => ({
    buscarMinhaAssinatura: jest.fn(),
    cancelarMinhaAssinatura: jest.fn(),
    reativarMinhaAssinatura: jest.fn()
  })
);

jest.mock(
  "../src/utils/registrador",
  () => ({
    erro: jest.fn()
  })
);

const assinaturaService = require(
  "../src/services/assinaturaService"
);
const registrador = require(
  "../src/utils/registrador"
);
const controller = require(
  "../src/controllers/assinaturaController"
);

function contextoController() {
  return {
    req: {
      user: {
        id: 10
      }
    },
    res: {
      json: jest.fn()
    },
    next: jest.fn()
  };
}

describe(
  "Logs seguros da assinatura",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "cancelamento não registra payload nem URL do Asaas",
      async () => {
        const erro = Object.assign(
          new Error(
            "Falha ao cancelar"
          ),
          {
            code: "ERR_BAD_RESPONSE",
            response: {
              status: 422,
              data: {
                customer:
                  "cus_sensivel",
                cpfCnpj:
                  "12345678901"
              }
            },
            config: {
              method: "delete",
              url:
                "/subscriptions/sub_sensivel"
            }
          }
        );

        assinaturaService
          .cancelarMinhaAssinatura
          .mockRejectedValue(
            erro
          );

        const {
          req,
          res,
          next
        } = contextoController();

        await controller
          .cancelarMinhaAssinatura(
            req,
            res,
            next
          );

        expect(registrador.erro)
          .toHaveBeenCalledWith(
            "Não foi possível cancelar a assinatura.",
            {
              mensagem:
                "Falha ao cancelar",
              status_asaas:
                422,
              codigo:
                "ERR_BAD_RESPONSE"
            }
          );

        const contexto =
          registrador.erro
            .mock.calls[0][1];

        expect(
          JSON.stringify(
            contexto
          )
        ).not.toContain(
          "cus_sensivel"
        );
        expect(
          JSON.stringify(
            contexto
          )
        ).not.toContain(
          "12345678901"
        );
        expect(
          JSON.stringify(
            contexto
          )
        ).not.toContain(
          "sub_sensivel"
        );
        expect(next)
          .toHaveBeenCalledWith(
            erro
          );
      }
    );
  }
);
