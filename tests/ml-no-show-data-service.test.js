const mockRepository = {
  capturarAmostrasPendentes: jest.fn(),
  rotularAmostrasPendentes: jest.fn(),
  obterProntidao: jest.fn(),
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
});
