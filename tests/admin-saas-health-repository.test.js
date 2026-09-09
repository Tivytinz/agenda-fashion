const mockQuery = jest.fn();

jest.mock("../src/db/db", () => ({
  query: mockQuery,
}));

const repository = require(
  "../src/repositories/adminSaasHealthRepository"
);

describe("consulta da saúde do SaaS", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  test("usa 5 etapas e espelha os dados essenciais do runtime", async () => {
    await repository.buscarResumo();

    const [sql] = mockQuery.mock.calls[0];

    expect(sql).toMatch(/AS descricao_preenchida/i);
    expect(sql).toMatch(/AS perfil_basico_completo/i);
    expect(sql).toMatch(/BTRIM\(negocio_nome\)/i);
    expect(sql).toMatch(/BTRIM\(bairro\)/i);
    expect(sql).toMatch(/BTRIM\(endereco\)/i);
    expect(sql).toMatch(/BTRIM\(numero\)/i);
    expect(sql).toMatch(/COALESCE\(negocio_whatsapp, ''\) ~ '\^\[0-9\]\{10,11\}\$'/i);
    expect(sql).toMatch(/COALESCE\(cep, ''\) ~ '\^\[0-9\]\{8\}\$'/i);
    expect(sql).toMatch(
      /NULLIF\(BTRIM\(COALESCE\(localizacao_url, ''\)\), ''\) IS NOT NULL/i
    );
    expect(sql).not.toMatch(/REGEXP_REPLACE\(COALESCE\(cep/i);
    expect(sql).toMatch(
      /EXISTS[\s\S]*FROM agendamentos a[\s\S]*COALESCE\(a.status, 'agendado'\) <> 'cancelado'[\s\S]*AS primeiro_agendamento_valido/i
    );
    expect(sql).toMatch(/AS disponibilidade_inicializada/i);
    expect(sql).toMatch(/AS sem_disponibilidade_inicial/i);
    expect(sql).toMatch(/AS sem_primeiro_agendamento/i);
    expect(sql).toMatch(/AS sem_descricao/i);
    expect(sql).toMatch(/WHERE etapas_concluidas\s*<\s*5/i);
    expect(sql).toMatch(/WHERE etapas_concluidas\s*=\s*5/i);
    expect(sql).not.toMatch(/etapas_concluidas\s*<\s*6/i);
    expect(sql).not.toMatch(/etapas_concluidas\s*=\s*6/i);
    expect(sql).not.toMatch(/publicacao_exige_agenda/i);
    expect(sql).not.toMatch(/agenda_configurada/i);
    expect(sql).toMatch(
      /whatsapp_marketing_consentido_em IS NOT NULL[\s\S]*whatsapp_marketing_cancelado_em IS NULL/i
    );
  });

  test("filtra sem descrição e prioriza quem está mais perto de concluir", async () => {
    await repository.listarPerfisIncompletos({
      pendencia: "descricao",
    });

    const [sql] = mockQuery.mock.calls[0];

    expect(sql).toMatch(
      /WHERE descricao_preenchida\s*=\s*FALSE/i
    );
    expect(sql).toMatch(
      /AND tem_negocio\s*=\s*TRUE AND descricao_preenchida\s*=\s*FALSE/i
    );
    expect(sql).toMatch(
      /ORDER BY[\s\S]*\(etapas_concluidas\s*=\s*5\) ASC[\s\S]*etapas_concluidas DESC[\s\S]*ultima_atividade_em ASC NULLS LAST/i
    );
  });

  test("mantém perfis completos fora da fila padrão", async () => {
    await repository.listarPerfisIncompletos({ pendencia: "todos" });

    const [sql] = mockQuery.mock.calls[0];

    expect(sql).toMatch(/WHERE etapas_concluidas\s*<\s*5/i);
    expect(sql).not.toMatch(/WHERE descricao_preenchida\s*=\s*FALSE/i);
  });

  test("filtra publicados que ainda não conquistaram o primeiro agendamento válido", async () => {
    await repository.listarPerfisIncompletos({
      pendencia: "primeiro_agendamento",
    });

    const [sql] = mockQuery.mock.calls[0];

    expect(sql).toMatch(
      /AND tem_negocio\s*=\s*TRUE AND publicado\s*=\s*TRUE AND primeiro_agendamento_valido\s*=\s*FALSE/i
    );
  });

  test("trata disponibilidade como diagnóstico técnico fora da fila de ativação", async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          total: "26",
        },
      ],
    });

    const total =
      await repository
        .contarPerfisIncompletos({
          busca: "Ana",
          pendencia: "disponibilidade",
        });

    const [sql, parametros] =
      mockQuery.mock.calls[0];

    expect(total).toBe(26);
    expect(sql).toMatch(
      /SELECT\s+COUNT\(\*\)::INT AS total/i
    );
    expect(sql).toMatch(
      /WHERE tem_negocio\s*=\s*TRUE AND disponibilidade_inicializada\s*=\s*FALSE/i
    );
    expect(sql).toMatch(
      /AND tem_negocio\s*=\s*TRUE AND disponibilidade_inicializada\s*=\s*FALSE/i
    );
    expect(sql).not.toMatch(/etapas_concluidas\s*<\s*5[\s\S]*disponibilidade_inicializada/i);
    expect(parametros).toEqual([
      "Ana",
    ]);
  });
});
