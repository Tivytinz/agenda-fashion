const mockRepository = {
  capturarAmostrasPendentes: jest.fn(),
  rotularAmostrasPendentes: jest.fn(),
  obterProntidao: jest.fn(),
  obterResumoMaturidadeNegocios: jest.fn(),
  listarMaturidadeNegocios: jest.fn(),
  listarMaturidadeSegmentosCliente: jest.fn(),
  listarMaturidadeMensal: jest.fn(),
};

jest.mock(
  "../src/repositories/mlNoShowRepository",
  () => mockRepository
);

const service = require(
  "../src/services/mlNoShowDataService"
);

describe("fundação de dados de ML para no-show", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.obterResumoMaturidadeNegocios
      .mockResolvedValue({
        negocios_com_amostras: 0,
        negocios_com_rotulos: 0,
        amostras_rotuladas: 0,
        maior_volume_rotulado: 0,
      });
    mockRepository.listarMaturidadeNegocios
      .mockResolvedValue([]);
    mockRepository.listarMaturidadeSegmentosCliente
      .mockResolvedValue([]);
    mockRepository.listarMaturidadeMensal
      .mockResolvedValue([]);
  });

  test("bloqueia treinamento enquanto a base ou uma classe é insuficiente", () => {
    expect(service.avaliarProntidao({
      total_amostras: 180,
      amostras_rotuladas: 180,
      faltas: 12,
      realizados: 168,
      pendentes_vencidos: 0,
    })).toMatchObject({
      pronta_para_treinamento: false,
      motivos: [
        "amostras_rotuladas_insuficientes",
        "faltas_insuficientes",
      ],
    });
  });

  test("libera somente uma base rotulada com as duas classes representadas", () => {
    expect(service.avaliarProntidao({
      total_amostras: "250",
      amostras_rotuladas: "220",
      faltas: "25",
      realizados: "195",
      pendentes_vencidos: "20",
    })).toMatchObject({
      pronta_para_treinamento: true,
      motivos: [],
      dados: {
        total_amostras: 250,
        amostras_rotuladas: 220,
        faltas: 25,
        realizados: 195,
        pendentes_vencidos: 20,
        cobertura_desfecho: 0.9167,
      },
    });
  });

  test("bloqueia treino quando muitos compromissos vencidos não têm desfecho", () => {
    expect(service.avaliarProntidao({
      total_amostras: 350,
      amostras_rotuladas: 210,
      faltas: 30,
      realizados: 180,
      pendentes_vencidos: 90,
    })).toMatchObject({
      pronta_para_treinamento: false,
      motivos: ["cobertura_desfecho_insuficiente"],
      dados: {
        cobertura_desfecho: 0.7,
      },
    });
  });

  test("coleta, rotula e devolve prontidão agregada sem PII", async () => {
    mockRepository.capturarAmostrasPendentes.mockResolvedValue(40);
    mockRepository.rotularAmostrasPendentes.mockResolvedValue(8);
    mockRepository.obterProntidao.mockResolvedValue({
      total_amostras: 240,
      amostras_rotuladas: 205,
      faltas: 22,
      realizados: 183,
      pendentes_vencidos: 10,
      primeiro_rotulo_em: "2026-01-01T00:00:00.000Z",
      ultimo_rotulo_em: "2026-09-21T00:00:00.000Z",
    });

    const resultado = await service.coletar({ limite: 40 });

    expect(
      mockRepository.capturarAmostrasPendentes
    ).toHaveBeenCalledWith({ limite: 40 });
    expect(
      mockRepository.rotularAmostrasPendentes
    ).toHaveBeenCalledTimes(1);
    expect(resultado).toMatchObject({
      amostras_capturadas: 40,
      amostras_rotuladas_nesta_execucao: 8,
      prontidao: {
        pronta_para_treinamento: true,
      },
    });
    expect(JSON.stringify(resultado)).not.toMatch(
      /nome|telefone|whatsapp/i
    );
  });

  test("diagnostica concentração, segmento e tendência sem PII", async () => {
    mockRepository.obterProntidao.mockResolvedValue({
      total_amostras: 300,
      amostras_rotuladas: 240,
      faltas: 40,
      realizados: 200,
      pendentes_vencidos: 20,
    });
    mockRepository.obterResumoMaturidadeNegocios
      .mockResolvedValue({
        negocios_com_amostras: 4,
        negocios_com_rotulos: 3,
        amostras_rotuladas: 240,
        maior_volume_rotulado: 120,
      });
    mockRepository.listarMaturidadeNegocios
      .mockResolvedValue([
        {
          negocio_id: "9",
          total_amostras: 145,
          amostras_rotuladas: 120,
          faltas: 30,
          realizados: 90,
          pendentes_vencidos: 5,
        },
      ]);
    mockRepository.listarMaturidadeSegmentosCliente
      .mockResolvedValue([
        {
          cliente_tem_conta: true,
          total_amostras: 180,
          amostras_rotuladas: 150,
          faltas: 20,
          realizados: 130,
          pendentes_vencidos: 10,
        },
        {
          cliente_tem_conta: false,
          total_amostras: 120,
          amostras_rotuladas: 90,
          faltas: 20,
          realizados: 70,
          pendentes_vencidos: 10,
        },
      ]);
    mockRepository.listarMaturidadeMensal
      .mockResolvedValue([
        {
          mes: "2026-09",
          total_amostras: 100,
          amostras_rotuladas: 80,
          faltas: 16,
          realizados: 64,
          pendentes_vencidos: 10,
        },
      ]);

    const resultado =
      await service.obterDiagnosticoMaturidade();

    expect(resultado).toMatchObject({
      feature_version: "v1",
      prontidao: {
        pronta_para_treinamento: true,
      },
      diagnosticos: {
        negocios: {
          negocios_com_amostras: 4,
          negocios_com_rotulos: 3,
          maior_participacao_rotulada: 0.5,
          mais_representados: [
            {
              negocio_id: 9,
              amostras_rotuladas: 120,
              faltas: 30,
              realizados: 90,
              cobertura_desfecho: 0.96,
              taxa_falta: 0.25,
              participacao_rotulada: 0.5,
            },
          ],
        },
        segmentos_cliente: [
          {
            segmento: "com_conta",
            cobertura_desfecho: 0.9375,
            taxa_falta: 0.1333,
          },
          {
            segmento: "visitante",
            cobertura_desfecho: 0.9,
            taxa_falta: 0.2222,
          },
        ],
        mensal: [
          {
            mes: "2026-09",
            cobertura_desfecho: 0.8889,
            taxa_falta: 0.2,
          },
        ],
      },
    });

    expect(JSON.stringify(resultado)).not.toMatch(
      /nome|telefone|whatsapp|email/i
    );
  });

});
