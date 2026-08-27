const mockCampaignRepository = {
  buscarPorId: jest.fn()
};

const mockRepository = {
  listarVinculos: jest.fn(),
  listarUltimasSincronizacoes: jest.fn(),
  salvarVinculo: jest.fn(),
  buscarVinculosPorProvedor: jest.fn(),
  executarComLockSincronizacao: jest.fn(),
  salvarGastoAutomatico: jest.fn(),
  reconciliarGastosAutomaticos: jest.fn(),
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
    mockRepository.reconciliarGastosAutomaticos.mockResolvedValue({
      removidos: 0,
      salvos: 0
    });
    mockRepository.executarComLockSincronizacao
      .mockImplementation(async (_provedor, callback) => ({
        executado: true,
        resultado: await callback()
      }));
    mockProviders.testarConexao.mockResolvedValue({
      conectado: true,
      moeda: "BRL"
    });
    mockProviders.listarCampanhas.mockResolvedValue([]);
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

  test("sincroniza apenas campanhas explicitamente vinculadas e reconcilia o período", async () => {
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

    expect(mockProviders.testarConexao).toHaveBeenCalledWith("google_ads");
    expect(mockRepository.salvarGastoAutomatico).not.toHaveBeenCalled();
    expect(mockRepository.reconciliarGastosAutomaticos).toHaveBeenCalledWith({
      provedor: "google_ads",
      dataInicio: "2026-08-01",
      dataFim: "2026-08-10",
      campanhaIds: [7],
      gastos: [
        {
          campanhaId: 7,
          dataGasto: "2026-08-10",
          valorCentavos: 2500
        }
      ]
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
        naoVinculadas: 1,
        reconciliacaoCampanhasCompleta: true
      })
    );
  });

  test("recusa sincronização de conta que não esteja em BRL", async () => {
    mockProviders.testarConexao.mockResolvedValue({
      conectado: true,
      moeda: "USD"
    });

    await expect(service.sincronizar({
      provedor: "google_ads",
      payload: {
        dataInicio: "2026-08-01",
        dataFim: "2026-08-10"
      }
    })).rejects.toThrow("só importa custos automáticos em BRL");

    expect(mockProviders.listarCustos).not.toHaveBeenCalled();
    expect(mockRepository.reconciliarGastosAutomaticos).not.toHaveBeenCalled();
    expect(mockRepository.finalizarSincronizacao).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 10,
        status: "erro",
        reconciliacaoCampanhasCompleta: false,
        erroCodigo: "http_422"
      })
    );
  });

  test("audita campanha externa ativa mesmo quando ela ainda não possui gasto", async () => {
    mockRepository.buscarVinculosPorProvedor.mockResolvedValue([
      {
        campanha_id: 7,
        conta_externa_id: "6770207927",
        campanha_externa_id: "123"
      }
    ]);
    mockProviders.listarCustos.mockResolvedValue([]);
    mockProviders.listarCampanhas.mockResolvedValue([
      {
        contaExternaId: "6770207927",
        campanhaExternaId: "123",
        status: "ENABLED"
      },
      {
        contaExternaId: "6770207927",
        campanhaExternaId: "999",
        status: "ENABLED"
      },
      {
        contaExternaId: "6770207927",
        campanhaExternaId: "888",
        status: "PAUSED"
      }
    ]);

    const result = await service.sincronizar({
      provedor: "google_ads",
      payload: {
        dataInicio: "2026-08-01",
        dataFim: "2026-08-10"
      }
    });

    expect(result).toMatchObject({
      status: "parcial",
      registrosImportados: 0,
      campanhasNaoVinculadas: 1
    });
    expect(mockRepository.finalizarSincronizacao)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          status: "parcial",
          naoVinculadas: 1,
          reconciliacaoCampanhasCompleta: true
        })
      );
  });

  test("conclui a reconciliação quando todas as campanhas operacionais estão vinculadas", async () => {
    mockRepository.buscarVinculosPorProvedor.mockResolvedValue([
      {
        campanha_id: 7,
        conta_externa_id: "6770207927",
        campanha_externa_id: "123"
      },
      {
        campanha_id: 8,
        conta_externa_id: "6770207927",
        campanha_externa_id: "999"
      }
    ]);
    mockProviders.listarCustos.mockResolvedValue([
      {
        contaExternaId: "6770207927",
        campanhaExternaId: "123",
        dataGasto: "2026-08-10",
        valorCentavos: 2500
      }
    ]);
    mockProviders.listarCampanhas.mockResolvedValue([
      {
        contaExternaId: "6770207927",
        campanhaExternaId: "123",
        status: "ENABLED"
      },
      {
        contaExternaId: "6770207927",
        campanhaExternaId: "999",
        status: "ENABLED"
      },
      {
        contaExternaId: "6770207927",
        campanhaExternaId: "888",
        status: "PAUSED"
      }
    ]);

    const result = await service.sincronizar({
      provedor: "google_ads",
      payload: {
        dataInicio: "2026-08-01",
        dataFim: "2026-08-10"
      }
    });

    expect(result).toMatchObject({
      status: "sucesso",
      registrosImportados: 1,
      campanhasNaoVinculadas: 0,
      reconciliacaoCampanhasCompleta: true
    });
    expect(mockRepository.finalizarSincronizacao)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          status: "sucesso",
          naoVinculadas: 0,
          reconciliacaoCampanhasCompleta: true
        })
      );
  });

  test("normaliza a identidade externa e classifica estados sem entrega", () => {
    expect(service.chaveCampanhaExterna({
      contaExternaId: "act_677-020-7927",
      campanhaExternaId: "123-456"
    })).toBe("6770207927:123456");

    expect(service.campanhaExternaOperacional({
      status: "ACTIVE"
    })).toBe(true);
    expect(service.campanhaExternaOperacional({
      status: "PAUSED"
    })).toBe(false);
    expect(service.campanhaExternaOperacional({
      status: "ARCHIVED"
    })).toBe(false);
    expect(service.campanhaExternaOperacional({
      status: "REMOVED"
    })).toBe(false);
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
        reconciliacaoCampanhasCompleta: false,
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

  test("aceita exatamente 90 dias inclusivos e recusa 91", () => {
    expect(service.periodoPadrao({
      dataInicio: "2026-05-27",
      dataFim: "2026-08-24"
    })).toEqual({
      dataInicio: "2026-05-27",
      dataFim: "2026-08-24"
    });

    expect(() => service.periodoPadrao({
      dataInicio: "2026-05-26",
      dataFim: "2026-08-24"
    })).toThrow("até 90 dias");
  });

  test("impede duas sincronizações simultâneas do mesmo provedor", async () => {
    mockRepository.executarComLockSincronizacao
      .mockResolvedValue({
        executado: false,
        resultado: null
      });

    await expect(service.sincronizar({
      provedor: "google_ads",
      payload: {
        dataInicio: "2026-08-01",
        dataFim: "2026-08-10"
      }
    })).rejects.toMatchObject({
      statusCode: 409
    });

    expect(mockRepository.iniciarSincronizacao)
      .not.toHaveBeenCalled();
  });

  test("recusa data futura", () => {
    expect(() => service.periodoPadrao({
      dataInicio: "2999-01-01",
      dataFim: "2999-01-30"
    })).toThrow("data futura");
  });

  test("calcula hoje pelo fuso de São Paulo e não pelo dia UTC", () => {
    expect(
      service.hojeNoFusoRelatorio(
        new Date("2026-08-13T00:30:00Z")
      )
    ).toBe("2026-08-12");
  });

  test("recusa custo devolvido fora do período solicitado", () => {
    expect(() => service.gastoVinculadoSeguro(
      {
        dataGasto: "2026-08-11",
        valorCentavos: 1000
      },
      { campanha_id: 7 },
      {
        dataInicio: "2026-08-01",
        dataFim: "2026-08-10"
      }
    )).toThrow("fora do período");
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

  test("teste da integração rejeita moeda diferente de BRL", async () => {
    mockProviders.testarConexao.mockResolvedValue({
      conectado: true,
      contaExternaId: "6770207927",
      moeda: "EUR"
    });

    await expect(service.testarIntegracao({
      provedor: "google_ads"
    })).rejects.toThrow("moeda EUR");
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
      canal: "google",
      objetivo: "profissional",
      ativo: true
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

    expect(mockProviders.testarConexao).toHaveBeenCalledWith("google_ads");
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

  test("não cria vínculo de custos se a conta não estiver em BRL", async () => {
    mockCampaignRepository.buscarPorId.mockResolvedValue({
      id: 5,
      nome: "Teste",
      canal: "google",
      objetivo: "profissional",
      ativo: true
    });
    mockProviders.testarConexao.mockResolvedValue({
      conectado: true,
      moeda: "USD"
    });

    await expect(service.vincularCampanha({
      payload: {
        campanhaId: 5,
        provedor: "google_ads",
        campanhaExternaId: "555"
      }
    })).rejects.toThrow("moeda USD");

    expect(mockProviders.buscarCampanha).not.toHaveBeenCalled();
    expect(mockRepository.salvarVinculo).not.toHaveBeenCalled();
  });

  test.each([
    [
      "arquivada",
      {
        id: 5,
        nome: "Google antiga",
        canal: "google",
        objetivo: "profissional",
        ativo: false
      }
    ],
    [
      "sem objetivo classificado",
      {
        id: 5,
        nome: "Google indefinida",
        canal: "google",
        objetivo: "indefinido",
        ativo: true
      }
    ]
  ])("impede vínculo com campanha %s", async (_cenario, campanha) => {
    mockCampaignRepository.buscarPorId.mockResolvedValue(campanha);

    await expect(service.vincularCampanha({
      payload: {
        campanhaId: 5,
        provedor: "google_ads",
        campanhaExternaId: "555"
      }
    })).rejects.toMatchObject({
      statusCode: 409
    });

    expect(mockProviders.testarConexao).not.toHaveBeenCalled();
    expect(mockProviders.buscarCampanha).not.toHaveBeenCalled();
    expect(mockRepository.salvarVinculo).not.toHaveBeenCalled();
  });

  test("consulta o Meta novamente e ignora nome adulterado antes de salvar", async () => {
    mockCampaignRepository.buscarPorId.mockResolvedValue({
      id: 8,
      nome: "Meta Agosto",
      canal: "meta",
      objetivo: "profissional",
      ativo: true
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
      canal: "meta",
      objetivo: "profissional",
      ativo: true
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
      canal: "google",
      objetivo: "profissional",
      ativo: true
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
      canal: "google",
      objetivo: "profissional",
      ativo: true
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
      canal: "meta",
      objetivo: "profissional",
      ativo: true
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
