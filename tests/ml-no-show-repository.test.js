const mockQuery = jest.fn();

jest.mock("../src/db/db", () => ({
  query: mockQuery,
}));

const repository = require(
  "../src/repositories/mlNoShowRepository"
);

describe("repository de amostras de no-show", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("captura features com corte temporal e sem PII", async () => {
    mockQuery.mockResolvedValue({
      rowCount: 2,
      rows: [
        { agendamento_id: 10 },
        { agendamento_id: 11 },
      ],
    });

    await expect(
      repository.capturarAmostrasPendentes({ limite: 25 })
    ).resolves.toBe(2);

    const [sql, parametros] = mockQuery.mock.calls[0];

    expect(parametros).toEqual([25]);
    expect(sql).toContain(
      "historico.status_atendimento_em < candidato.created_at"
    );
    expect(sql).toContain(
      "primeiro_reagendamento.previous_data"
    );
    expect(sql).toContain(
      "historico.created_at ASC"
    );
    expect(sql).toContain(
      "atributo.status_atendimento_em IS NOT NULL"
    );
    expect(sql).toContain(
      "ON CONFLICT (agendamento_id)"
    );
    expect(sql).not.toMatch(
      /cliente_nome|cliente_whatsapp|observacoes|email/i
    );
  });

  test("rotula somente realizado ou falta com timestamp explícito", async () => {
    mockQuery.mockResolvedValue({ rowCount: 3 });

    await expect(
      repository.rotularAmostrasPendentes()
    ).resolves.toBe(3);

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain(
      "agendamento.status IN ('realizado', 'falta')"
    );
    expect(sql).toContain(
      "agendamento.status_atendimento_em IS NOT NULL"
    );
  });

  test("agrega maturidade por negócio sem consultar PII", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          negocios_com_amostras: 3,
          negocios_com_rotulos: 2,
          amostras_rotuladas: 80,
          maior_volume_rotulado: 50,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          negocio_id: 7,
          total_amostras: 60,
          amostras_rotuladas: 50,
          faltas: 10,
          realizados: 40,
          pendentes_vencidos: 5,
        }],
      });

    await expect(
      repository.obterResumoMaturidadeNegocios()
    ).resolves.toMatchObject({
      negocios_com_amostras: 3,
      negocios_com_rotulos: 2,
    });

    await expect(
      repository.listarMaturidadeNegocios({
        limite: 20,
      })
    ).resolves.toHaveLength(1);

    const [sqlResumo] = mockQuery.mock.calls[0];
    const [sqlLista, parametros] = mockQuery.mock.calls[1];

    expect(sqlResumo).toContain(
      "GROUP BY amostra.negocio_id"
    );
    expect(sqlLista).toContain(
      "ORDER BY"
    );
    expect(parametros).toEqual([20]);
    expect(
      `${sqlResumo}\n${sqlLista}`
    ).not.toMatch(
      /cliente_nome|cliente_whatsapp|email|observacoes/i
    );
  });

  test("separa conta e visitante e usa criação do booking na série mensal", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          cliente_tem_conta: true,
          total_amostras: 10,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          mes: "2026-09",
          total_amostras: 10,
        }],
      });

    await repository
      .listarMaturidadeSegmentosCliente();
    await repository
      .listarMaturidadeMensal({
        meses: 12,
      });

    const [sqlSegmentos] =
      mockQuery.mock.calls[0];
    const [sqlMensal, parametros] =
      mockQuery.mock.calls[1];

    expect(sqlSegmentos).toContain(
      "GROUP BY amostra.cliente_tem_conta"
    );
    expect(sqlMensal).toContain(
      "agendamento.created_at"
    );
    expect(sqlMensal).toContain(
      "date_trunc"
    );
    expect(parametros).toEqual([12]);
  });

});
