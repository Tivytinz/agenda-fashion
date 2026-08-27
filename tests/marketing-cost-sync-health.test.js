const mockCampaignRepository = {
  buscarPorId: jest.fn()
};

const mockRepository = {
  listarVinculos: jest.fn(),
  listarUltimasSincronizacoes: jest.fn()
};

const mockProviders = {
  status: jest.fn()
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

const config = require(
  "../src/config/marketingCostSync"
);

describe("saúde das integrações de custos", () => {
  const envOriginal = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envOriginal };
    delete process.env.MARKETING_COST_SYNC_SCHEDULE_ENABLED;
    process.env.MARKETING_COST_SYNC_INTERVAL_HOURS = "6";
  });

  afterEach(() => {
    process.env = envOriginal;
  });

  test("expõe agendamento desligado e janela manual de vinte e quatro horas", () => {
    expect(config.statusAgendamento()).toEqual({
      habilitado: false,
      intervaloHoras: 6,
      primeiraExecucaoSegundos: 60,
      limiteDesatualizadoHoras: 24
    });
  });

  test("quando automático está ativo usa duas janelas do intervalo para detectar atraso", () => {
    process.env.MARKETING_COST_SYNC_SCHEDULE_ENABLED = "true";
    process.env.MARKETING_COST_SYNC_INTERVAL_HOURS = "4";

    expect(config.statusAgendamento()).toMatchObject({
      habilitado: true,
      intervaloHoras: 4,
      limiteDesatualizadoHoras: 8
    });
  });

  test("classifica erro, parcial, desatualizado e saudável sem consultar a plataforma", () => {
    const schedule = {
      habilitado: true,
      intervaloHoras: 6,
      limiteDesatualizadoHoras: 12
    };
    const now = new Date("2026-08-13T00:00:00Z");
    const provider = {
      habilitado: true,
      configurado: true
    };

    expect(service.saudeIntegracao(
      provider,
      {
        status: "erro",
        erro_mensagem: "Token recusado",
        finished_at: "2026-08-12T23:00:00Z"
      },
      schedule,
      now
    )).toMatchObject({
      codigo: "erro",
      rotulo: "Erro",
      detalhe: "Token recusado"
    });

    expect(service.saudeIntegracao(
      provider,
      {
        status: "parcial",
        campanhas_nao_vinculadas: 2,
        finished_at: "2026-08-12T23:00:00Z"
      },
      schedule,
      now
    )).toMatchObject({
      codigo: "parcial",
      rotulo: "Parcial"
    });

    expect(service.saudeIntegracao(
      provider,
      {
        status: "sucesso",
        registros_importados: 12,
        reconciliacao_campanhas_completa: true,
        finished_at: "2026-08-12T10:00:00Z"
      },
      schedule,
      now
    )).toMatchObject({
      codigo: "desatualizado",
      rotulo: "Desatualizado",
      desatualizado: true
    });

    expect(service.saudeIntegracao(
      provider,
      {
        status: "sucesso",
        registros_importados: 12,
        reconciliacao_campanhas_completa: true,
        finished_at: "2026-08-12T23:00:00Z"
      },
      schedule,
      now
    )).toMatchObject({
      codigo: "saudavel",
      rotulo: "Saudável",
      desatualizado: false
    });

    expect(service.saudeIntegracao(
      provider,
      {
        status: "sucesso",
        registros_importados: 12,
        reconciliacao_campanhas_completa: false,
        finished_at: "2026-08-12T23:00:00Z"
      },
      schedule,
      now
    )).toMatchObject({
      codigo: "reconciliacao_pendente",
      rotulo: "Reconciliar",
      nivel: "aviso"
    });
  });

  test("diferencia integração desativada, incompleta e ainda não sincronizada", () => {
    const schedule = config.statusAgendamento();

    expect(service.saudeIntegracao(
      { habilitado: false, configurado: false },
      null,
      schedule
    ).codigo).toBe("desativado");

    expect(service.saudeIntegracao(
      { habilitado: true, configurado: false },
      null,
      schedule
    ).codigo).toBe("configuracao_incompleta");

    expect(service.saudeIntegracao(
      { habilitado: true, configurado: true },
      null,
      schedule
    ).codigo).toBe("nao_sincronizado");
  });

  test("status administrativo reúne saúde, última execução, vínculos e agenda do worker", async () => {
    process.env.MARKETING_COST_SYNC_SCHEDULE_ENABLED = "true";
    process.env.MARKETING_COST_SYNC_INTERVAL_HOURS = "6";

    mockProviders.status.mockReturnValue([
      {
        provedor: "google_ads",
        nome: "Google Ads",
        habilitado: true,
        configurado: true,
        contaExternaId: "6770207927"
      },
      {
        provedor: "meta_ads",
        nome: "Meta Ads",
        habilitado: true,
        configurado: false,
        contaExternaId: "1122334455"
      }
    ]);
    mockRepository.listarVinculos.mockResolvedValue([
      { id: 1, provedor: "google_ads" }
    ]);
    mockRepository.listarUltimasSincronizacoes.mockResolvedValue([
      {
        id: 10,
        provedor: "google_ads",
        status: "parcial",
        registros_importados: 8,
        campanhas_nao_vinculadas: 1,
        finished_at: new Date().toISOString()
      }
    ]);

    const result = await service.statusIntegracoes();

    expect(result.sincronizacaoAutomatica).toMatchObject({
      habilitado: true,
      intervaloHoras: 6,
      limiteDesatualizadoHoras: 12
    });
    expect(result.provedores[0]).toMatchObject({
      provedor: "google_ads",
      vinculos: 1,
      saude: {
        codigo: "parcial",
        rotulo: "Parcial"
      }
    });
    expect(result.provedores[1]).toMatchObject({
      provedor: "meta_ads",
      saude: {
        codigo: "configuracao_incompleta"
      }
    });
  });
});
