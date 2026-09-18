jest.mock(
  "../src/db/db",
  () => ({
    executarTransacao: jest.fn()
  })
);

jest.mock(
  "../src/repositories/assinaturaRepository",
  () => ({
    buscarNegocioDono: jest.fn(),
    expirarCancelamentoSeNecessario: jest.fn(),
    buscarAssinaturaAtivaPorNegocio: jest.fn(),
    buscarAssinaturaPendentePorNegocio: jest.fn(),
    buscarPlano: jest.fn(),
    listarPagamentos: jest.fn()
  })
);

jest.mock(
  "../src/services/asaasService",
  () => ({
    removerAssinaturaAsaas: jest.fn()
  })
);

jest.mock(
  "../src/services/planoService",
  () => ({
    buscarUsoPlano: jest.fn()
  })
);

const assinaturaRepository = require(
  "../src/repositories/assinaturaRepository"
);
const planoService = require(
  "../src/services/planoService"
);
const {
  buscarMinhaAssinatura
} = require(
  "../src/services/assinaturaContaService"
);

beforeEach(() => {
  jest.clearAllMocks();

  assinaturaRepository
    .expirarCancelamentoSeNecessario
    .mockResolvedValue(null);
  assinaturaRepository
    .listarPagamentos
    .mockResolvedValue([]);
  planoService
    .buscarUsoPlano
    .mockResolvedValue({});
});

test(
  "mantém assinatura ativa como estado atual quando há upgrade pendente",
  async () => {
    assinaturaRepository
      .buscarNegocioDono
      .mockResolvedValue({
        id: 7,
        plano_id: 2
      });
    assinaturaRepository
      .buscarAssinaturaAtivaPorNegocio
      .mockResolvedValue({
        id: 20,
        plano_id: 2,
        status: "ACTIVE",
        ativo: true
      });
    assinaturaRepository
      .buscarAssinaturaPendentePorNegocio
      .mockResolvedValue({
        id: 21,
        plano_id: 3,
        status: "PENDING",
        ativo: false
      });
    assinaturaRepository
      .buscarPlano
      .mockImplementation(
        async (id) =>
          id === 2
            ? {
                id: 2,
                nome: "Autônoma",
                slug: "autonoma",
                valor: 49.9
              }
            : {
                id: 3,
                nome: "Studio",
                slug: "studio",
                valor: 99.9
              }
      );

    const resultado =
      await buscarMinhaAssinatura({
        usuarioId: 5
      });

    expect(resultado.assinatura)
      .toMatchObject({
        id: 20,
        status: "ACTIVE",
        ativo: true
      });
    expect(resultado.assinatura_ativa.id)
      .toBe(20);
    expect(resultado.upgrade_pendente.id)
      .toBe(21);
    expect(resultado.plano.nome)
      .toBe("Autônoma");
    expect(resultado.plano_pendente.nome)
      .toBe("Studio");
    expect(
      assinaturaRepository.listarPagamentos
    ).toHaveBeenCalledWith(20);
  }
);

test(
  "expõe plano gratuito em uso e plano pago pendente separadamente",
  async () => {
    assinaturaRepository
      .buscarNegocioDono
      .mockResolvedValue({
        id: 8,
        plano_id: 1
      });
    assinaturaRepository
      .buscarAssinaturaAtivaPorNegocio
      .mockResolvedValue(null);
    assinaturaRepository
      .buscarAssinaturaPendentePorNegocio
      .mockResolvedValue({
        id: 30,
        plano_id: 2,
        status: "PENDING",
        ativo: false
      });
    assinaturaRepository
      .buscarPlano
      .mockImplementation(
        async (id) =>
          id === 1
            ? {
                id: 1,
                nome: "Grátis",
                slug: "inicial",
                valor: 0
              }
            : {
                id: 2,
                nome: "Autônoma",
                slug: "autonoma",
                valor: 49.9
              }
      );

    const resultado =
      await buscarMinhaAssinatura({
        usuarioId: 6
      });

    expect(resultado.assinatura.id)
      .toBe(30);
    expect(resultado.assinatura_ativa)
      .toBeNull();
    expect(resultado.upgrade_pendente.id)
      .toBe(30);
    expect(resultado.plano.nome)
      .toBe("Grátis");
    expect(resultado.plano_pendente.nome)
      .toBe("Autônoma");
    expect(
      assinaturaRepository.listarPagamentos
    ).toHaveBeenCalledWith(30);
  }
);
