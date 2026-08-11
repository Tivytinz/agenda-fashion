jest.mock(
  "../src/repositories/sessaoRepository",
  () => ({
    buscarUsuarioPorId:
      jest.fn(),
    buscarContextoAtivoPorUsuarioId:
      jest.fn(),
    buscarAdministradorAtivoPorUsuarioId:
      jest.fn(),
  })
);

const sessaoRepository = require(
  "../src/repositories/sessaoRepository"
);

const sessaoService = require(
  "../src/services/sessaoService"
);

describe(
  "contexto administrativo da sessão",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      sessaoRepository
        .buscarUsuarioPorId
        .mockResolvedValue({
          id: 7,
          nome: "Administrador AF",
          email: "admin@agenda.test",
          whatsapp: null,
          ativo: true,
          email_verificado_em: null,
          ultimo_login_em: null,
          senha_alterada_em: null,
          created_at: null,
          updated_at: null,
        });

      sessaoRepository
        .buscarContextoAtivoPorUsuarioId
        .mockResolvedValue(null);
    });

    test(
      "informa quando a conta é administradora sem colocar permissão no usuário",
      async () => {
        sessaoRepository
          .buscarAdministradorAtivoPorUsuarioId
          .mockResolvedValue({
            usuario_id: 7,
            papel: "admin",
          });

        const resultado =
          await sessaoService
            .obterMinhaSessao(7);

        expect(resultado)
          .toMatchObject({
            temNegocio: false,
            negocio: null,
            ehAdministrador: true,
            administrador: {
              papel: "admin",
              superadmin: false,
            },
          });

        expect(resultado.usuario)
          .not.toHaveProperty(
            "administrador"
          );
      }
    );

    test(
      "mantém conta comum sem contexto administrativo",
      async () => {
        sessaoRepository
          .buscarAdministradorAtivoPorUsuarioId
          .mockResolvedValue(null);

        const resultado =
          await sessaoService
            .obterMinhaSessao(7);

        expect(
          resultado.ehAdministrador
        ).toBe(false);

        expect(
          resultado.administrador
        ).toBeNull();
      }
    );
  }
);
