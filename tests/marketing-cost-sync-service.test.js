const mockCampaignRepository = {
  buscarPorId: jest.fn()
};

const mockRepository = {
  listarVinculos: jest.fn(),
  listarUltimasSincronizacoes: jest.fn(),
  salvarVinculo: jest.fn(),
  buscarVinculosPorProvedor: jest.fn(),
  salvarGastoAutomatico: jest.fn(),
  iniciarSincronizacao: jest.fn(),
  finalizarSincronizacao: jest.fn()
};

const mockProviders = {
  status: jest.fn(),
  listarCustos: jest.fn(),
  listarCampanhas: jest.fn(),
  buscarCampanha: jest.fn(),
  testarConexao: jest.fn()
};

jest.mock(
  "../src/repositories/adminCampaignRepository",
  () => mockCampaignRepository
);

jest.mock(
  "../src/repositories/marketingCostSyncRepository",
  () => mockRepository
);

jest.mock(
  "../src/services/marketingCostProviders",
  () => mockProviders
);

const service = require(
  "../src/services/marketingCostSyncService"
);

describe("marketingCostSyncService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.iniciarSincronizacao.mockResolvedValue({ id: 10 });
    mockRepository.finalizarSincronizacao.mockResolvedValue();
    mockRepository.salvarGastoAutomatico.mockResolvedValue({ id: 1 });
    mockProviders.status.mockReturnValue([
      {
        provedor: "google_ads",
        configurado: true,
        contaExternaId: "6770207927"
      },
      {
        provedor: "meta_ads",
        configurado: true,
        contaExternaId: "1122334455"
      }
    ]);
  });

  test("sincroniza apenas campanhas explicitamente vinculadas", async () => {
    mockRepository.buscarVinculosPorProvedor.mockResolvedValue([
      {
        campanha_id: 7,
        conta_externa_id: "6770207927",
        campanha_externa_id: "123"
      }
    ]);
    mockProviders.listarCustos.mockResolvedValue([
      {
        contaExternaId: "6770207927",
        campanhaExternaId: "123",
        dataGasto: "2026-08-10",
        valorCentavos: 2500
      },
      {
        contaExternaId: "6770207927",
        campanhaExternaId: "999",
        dataGasto: "2026-08-10",
        valorCentavos: 900
      }
    ]);

    const result = await service.sincronizar({
      provedor: "google_ads",
      payload: {
        dataInicio: "2026-08-01",
        dataFim: "2026-08-10"
      },
      usuarioId: 3
    });

    expect(mockRepository.salvarGastoAutomatico).toHaveBeenCalledTimes(1);
    expect(mockRepository.salvarGastoAutomatico).toHaveBeenCalledWith({
      campanhaId: 7,
      dataGasto: "2026-08-10",
      valorCentavos: 2500,
      provedor: "google_ads"
    });
    expect(result).toMatchObject({
      status: "parcial",
      registrosImportados: 1,
      campanhasNaoVinculadas: 1
    });
    expect(mockRepository.finalizarSincronizacao).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 10,
        status: "parcial",
        importados: 1,
        naoVinculadas: 1
      })
    );
  });

  test("registra erro de sincronização sem engolir a falha", async () => {
    mockRepository.buscarVinculosPorProvedor.mockResolvedValue([]);
    mockProviders.listarCustos.mockRejectedValue(
      Object.assign(new Error("Credencial recusada"), { statusCode: 502 })
    );

    await expect(service.sincronizar({
      provedor: "meta_ads",
      payload: {
        dataInicio: "2026-08-01",
        dataFim: "2026-08-10"
      }
    })).rejects.toThrow("Credencial recusada");

    expect(mockRepository.finalizarSincronizacao).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 10,
        status: "erro",
        erroCodigo: "http_502"
      })
    );
  });

  test("recusa período maior que 90 dias", () => {
    expect(() => service.periodoPadrao({
      dataInicio: "2026-01-01",
      dataFim: "2026-08-10"
    })).toThrow("até 90 dias");
  });

  test("testa a integração e devolve apenas metadados seguros da conta", async () => {
    mockProviders.testarConexao.mockResolvedValue({
      provedor: "google_ads",
      conectado: true,
      contaExternaId: "6770207927",
      nomeConta: "Agenda Fashion Ads",
      moeda: "BRL",
      fusoHorario: "America/Sao_Paulo",
      apiVersion: "v25"
    });

    const result = await service.testarIntegracao({
      provedor: "google_ads"
    });

    expect(mockProviders.testarConexao).toHaveBeenCalledWith("google_ads");
    expect(result).toEqual({
      provedor: "google_ads",
      conectado: true,
      contaExternaId: "6770207927",
      nomeConta: "Agenda Fashion Ads",
      moeda: "BRL",
      fusoHorario: "America/Sao_Paulo",
      apiVersion: "v25"
    });
  });

  test("testa a integração Meta pelo mesmo contrato seguro", async () => {
    mockProviders.testarConexao.mockResolvedValue({
      provedor: "meta_ads",
      conectado: true,
      contaExternaId: "1122334455",
      nomeConta: "Agenda Fashion Meta",
      moeda: "BRL",
      fusoHorario: "America/Sao_Paulo",
      apiVersion: "v25.0"
    });

    const result = await service.testarIntegracao({
      provedor: "meta_ads"
    });

    expect(mockProviders.testarConexao).toHaveBeenCalledWith("meta_ads");
    expect(result).toEqual({
      provedor: "meta_ads",
      conectado: true,
      contaExternaId: "1122334455",
      nomeConta: "Agenda Fashion Meta",
      moeda: "BRL",
      fusoHorario: "America/Sao_Paulo",
      apiVersion: "v25.0"
    });
  });

  test("lista campanhas reais devolvidas pelo Google Ads", async () => {
    mockProviders.listarCampanhas.mockResolvedValue([
      {
        contaExternaId: "6770207927",
        campanhaExternaId: "555",
        campanhaExternaNome: "Aquisição Goiânia",
        status: "ENABLED",
        tipo: "SEARCH"
      }
    ]);

    const result = await service.listarCampanhasExternas({
      provedor: "google_ads"
    });

    expect(mockProviders.listarCampanhas).toHaveBeenCalledWith("google_ads");
    expect(result).toEqual({
      provedor: "google_ads",
      contaExternaId: "6770207927",
      campanhas: [
        {
          id: "555",
          nome: "Aquisição Goiânia",
          status: "ENABLED",
          tipo: "SEARCH"
        }
      ]
    });
  });

  test("lista campanhas reais devolvidas pelo Meta Ads", async () => {
    mockProviders.listarCampanhas.mockResolvedValue([
      {
        contaExternaId: "1122334455",
        campanhaExternaId: "901",
        campanhaExternaNome: "Profissionais Meta",
        status: "ACTIVE",
        tipo: "OUTCOME_TRAFFIC"
      }
    ]);

    const result = await service.listarCampanhasExternas({
      provedor: "meta_ads"
    });

    expect(mockProviders.listarCampanhas).toHaveBeenCalledWith("meta_ads");
    expect(result).toEqual({
      provedor: "meta_ads",
      contaExternaId: "1122334455",
      campanhas: [
        {
          id: "901",
          nome: "Profissionais Meta",
          status: "ACTIVE",
          tipo: "OUTCOME_TRAFFIC"
        }
      ]
    });
  });

  test("consulta o Google novamente antes de salvar um vínculo", async () => {
    mockCampaignRepository.buscarPorId.mockResolvedValue({
      id: 5,
      nome: "Teste",
      canal: "google"
    });
    mockProviders.buscarCampanha.mockResolvedValue({
      contaExternaId: "6770207927",
      campanhaExternaId: "555",
      campanhaExternaNome: "Aquisição real",
      status: "ENABLED",
      tipo: "SEARCH"
    });
    mockRepository.salvarVinculo.mockResolvedValue({ id: 9, campanha_id: 5 });

    const result = await service.vincularCampanha({
      payload: {
        campanhaId: 5,
        provedor: "google_ads",
        contaExternaId: "677-020-7927",
        campanhaExternaId: "555",
        campanhaExternaNome: "Nome adulterado no navegador"
      }
    });

    expect(mockProviders.buscarCampanha).toHaveBeenCalledWith(
      "google_ads",
      "555"
    );
    expect(mockRepository.salvarVinculo).toHaveBeenCalledWith({
      campanhaId: 5,
      provedor: "google_ads",
      contaExternaId: "6770207927",
      campanhaExternaId: "555",
      campanhaExternaNome: "Aquisição real"
    });
    expect(result).toMatchObject({
      vinculo: { id: 9 },
      campanhaExterna: {
        id: "555",
        nome: "Aquisição real",
        status: "ENABLED",
        tipo: "SEARCH"
      }
    });
  });

  test("consulta o Meta novamente e ignora nome adulterado antes de salvar", async () => {
    mockCampaignRepository.buscarPorId.mockResolvedValue({
      id: 8,
      nome: "Meta Agosto",
      canal: "meta"
    });
    mockProviders.buscarCampanha.mockResolvedValue({
      contaExternaId: "1122334455",
      campanhaExternaId: "901",
      campanhaExternaNome: "Profissionais Meta",
      status: "ACTIVE",
      tipo: "OUTCOME_TRAFFIC"
    });
    mockRepository.salvarVinculo.mockResolvedValue({ id: 10, campanha_id: 8 });

    const result = await service.vincularCampanha({
      payload: {
        campanhaId: 8,
        provedor: "meta_ads",
        contaExternaId: "act_1122334455",
        campanhaExternaId: "901",
        campanhaExternaNome: "Nome falso enviado pelo navegador"
      }
    });

    expect(mockProviders.buscarCampanha).toHaveBeenCalledWith("meta_ads", "901");
    expect(mockRepository.salvarVinculo).toHaveBeenCalledWith({
      campanhaId: 8,
      provedor: "meta_ads",
      contaExternaId: "1122334455",
      campanhaExternaId: "901",
      campanhaExternaNome: "Profissionais Meta"
    });
    expect(result.campanhaExterna).toEqual({
      id: "901",
      nome: "Profissionais Meta",
      status: "ACTIVE",
      tipo: "OUTCOME_TRAFFIC"
    });
  });

  test("impede vincular campanha AF de outro canal ao Google Ads", async () => {
    mockCampaignRepository.buscarPorId.mockResolvedValue({
      id: 8,
      nome: "Meta verão",
      canal: "meta"
    });

    await expect(service.vincularCampanha({
      payload: {
        campanhaId: 8,
        provedor: "google_ads",
        campanhaExternaId: "555"
      }
    })).rejects.toThrow("canal meta");

    expect(mockProviders.buscarCampanha).not.toHaveBeenCalled();
    expect(mockRepository.salvarVinculo).not.toHaveBeenCalled();
  });

  test("impede vincular campanha Google do AF ao Meta Ads", async () => {
    mockCampaignRepository.buscarPorId.mockResolvedValue({
      id: 5,
      nome: "Google Agosto",
      canal: "google"
    });

    await expect(service.vincularCampanha({
      payload: {
        campanhaId: 5,
        provedor: "meta_ads",
        campanhaExternaId: "901"
      }
    })).rejects.toThrow("canal google");

    expect(mockProviders.buscarCampanha).not.toHaveBeenCalled();
    expect(mockRepository.salvarVinculo).not.toHaveBeenCalled();
  });

  test("recusa conta Google diferente da configurada no backend", async () => {
    mockCampaignRepository.buscarPorId.mockResolvedValue({
      id: 5,
      nome: "Teste",
      canal: "google"
    });
    mockProviders.buscarCampanha.mockResolvedValue({
      contaExternaId: "6770207927",
      campanhaExternaId: "555",
      campanhaExternaNome: "Aquisição real",
      status: "PAUSED",
      tipo: "SEARCH"
    });

    await expect(service.vincularCampanha({
      payload: {
        campanhaId: 5,
        provedor: "google_ads",
        contaExternaId: "1112223334",
        campanhaExternaId: "555"
      }
    })).rejects.toThrow("não corresponde à conta configurada");

    expect(mockRepository.salvarVinculo).not.toHaveBeenCalled();
  });

  test("recusa conta Meta diferente da configurada no backend", async () => {
    mockCampaignRepository.buscarPorId.mockResolvedValue({
      id: 8,
      nome: "Meta Agosto",
      canal: "meta"
    });
    mockProviders.buscarCampanha.mockResolvedValue({
      contaExternaId: "1122334455",
      campanhaExternaId: "901",
      campanhaExternaNome: "Profissionais Meta",
      status: "ACTIVE",
      tipo: "OUTCOME_TRAFFIC"
    });

    await expect(service.vincularCampanha({
      payload: {
        campanhaId: 8,
        provedor: "meta_ads",
        contaExternaId: "9988776655",
        campanhaExternaId: "901"
      }
    })).rejects.toThrow("não corresponde à conta configurada do Meta Ads");

    expect(mockRepository.salvarVinculo).not.toHaveBeenCalled();
  });
});
