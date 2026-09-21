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
});
