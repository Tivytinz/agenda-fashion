jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn(),
}));

jest.mock(
  "../src/repositories/profissionaisRepository"
);

/*
 * Este mock precisa aparecer antes da importação de
 * profissionaisService, pois o service importa essas
 * funções por desestruturação.
 */
jest.mock("../src/services/planoService", () => ({
  buscarUsoPlano: jest.fn(),

  criarErroLimite: jest.fn(
    (mensagem, codigo, uso = null) => {
      const erro = new Error(mensagem);

      erro.status = 409;
      erro.statusCode = 409;
      erro.codigo = codigo;
      erro.uso = uso;

      return erro;
    }
  ),
}));

const db = require("../src/db/db");

const profissionaisRepository = require(
  "../src/repositories/profissionaisRepository"
);

const planoService = require(
  "../src/services/planoService"
);

const profissionaisService = require(
  "../src/services/profissionaisService"
);

describe("Limite de profissionais", () => {
  const client = {
    query: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    db.executarTransacao.mockImplementation(
      async (callback) => callback(client)
    );

    /*
     * Impede que o teste unitário execute o SQL real
     * de buscarUsoPlano.
     */
    planoService.buscarUsoPlano.mockResolvedValue({
      negocio_id: 7,
      plano_nome: "Plano de teste",
      profissionais_utilizados: 1,
    });

    profissionaisRepository
      .buscarNegocioDono
      .mockResolvedValue({
        negocio_id: 7,
      });

    profissionaisRepository
      .buscarProfissionalPorEmailWhatsapp
      .mockResolvedValue({
        id: 20,
        nome: "Profissional Teste",
      });

    profissionaisRepository
      .bloquearCadastroProfissional
      .mockResolvedValue();

    profissionaisRepository
      .verificarVinculo
      .mockResolvedValue(null);
  });

  test(
    "plano Grátis não permite adicionar um segundo profissional",
    async () => {
      profissionaisRepository
        .buscarPlanoDoNegocio
        .mockResolvedValue({
          nome: "Grátis",
          limite_profissionais: 1,
        });

      profissionaisRepository
        .contarProfissionaisAtivos
        .mockResolvedValue(1);

      await expect(
        profissionaisService.vincularProfissional({
          usuarioDonoId: 1,
          emailOuWhatsapp:
            "profissional@teste.com",
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        codigo: "LIMITE_PROFISSIONAIS",
      });

      expect(
        planoService.buscarUsoPlano
      ).toHaveBeenCalledWith(
        7,
        client
      );

      expect(
        profissionaisRepository.criarVinculo
      ).not.toHaveBeenCalled();
    }
  );

  test(
    "lista a equipe pela rota interna sem expor WhatsApp",
    async () => {
      profissionaisRepository
        .listarProfissionaisDoNegocio
        .mockResolvedValue([
          {
            id: 1,
            nome: "Dona",
            foto_url: null,
            papel: "dono"
          }
        ]);

      const resultado =
        await profissionaisService
          .listarProfissionais({
            usuarioId: 1
          });

      expect(
        profissionaisRepository
          .listarProfissionaisDoNegocio
      ).toHaveBeenCalledWith(7);
      expect(resultado.profissionais)
        .toEqual([
          expect.not.objectContaining({
            whatsapp: expect.anything()
          })
        ]);
    }
  );

  test(
    "plano Salão permite até cinco profissionais",
    async () => {
      profissionaisRepository
        .buscarPlanoDoNegocio
        .mockResolvedValue({
          nome: "Salão",
          limite_profissionais: 5,
        });

      profissionaisRepository
        .contarProfissionaisAtivos
        .mockResolvedValue(4);

      profissionaisRepository
        .criarVinculo
        .mockResolvedValue();

      const resultado =
        await profissionaisService.vincularProfissional({
          usuarioDonoId: 1,
          emailOuWhatsapp:
            "profissional@teste.com",
        });

      expect(resultado.profissional.id).toBe(20);

      expect(
        planoService.buscarUsoPlano
      ).toHaveBeenCalledWith(
        7,
        client
      );

      expect(
        profissionaisRepository.criarVinculo
      ).toHaveBeenCalledWith(
        20,
        7,
        client
      );
    }
  );

  test(
    "edição normaliza nome e WhatsApp antes de atualizar",
    async () => {
      profissionaisRepository
        .verificarProfissionalNoNegocio
        .mockResolvedValue({
          id: 30,
        });

      profissionaisRepository
        .atualizarProfissional
        .mockResolvedValue({
          id: 20,
          nome: "Profissional Teste",
          whatsapp: "62999991234",
        });

      await profissionaisService.editarProfissional({
        usuarioId: 1,
        profissionalId: 20,
        nome: "  Profissional Teste  ",
        whatsapp: "(62) 99999-1234",
      });

      expect(
        profissionaisRepository.atualizarProfissional
      ).toHaveBeenCalledWith(
        20,
        "Profissional Teste",
        "62999991234"
      );
    }
  );

  test(
    "identificador inválido não procura uma conta aleatória",
    async () => {
      await expect(
        profissionaisService.vincularProfissional({
          usuarioDonoId: 1,
          emailOuWhatsapp:
            "email-invalido1234567890@",
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message:
          "Informe um e-mail ou WhatsApp válido.",
      });

      expect(
        profissionaisRepository
          .buscarProfissionalPorEmailWhatsapp
      ).not.toHaveBeenCalled();
    }
  );
});
