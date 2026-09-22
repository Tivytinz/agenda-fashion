jest.mock("../src/db/db", () => ({
  query: jest.fn(),
}));

const db = require("../src/db/db");
const planoService = require(
  "../src/services/planoService"
);

function resolvedRow(overrides = {}) {
  return {
    negocio_id: 7,
    negocio_nome: "Studio Teste",
    plano_id: 1,
    plano_nome: "Grátis",
    plano_slug: "inicial",
    valor: "0.00",
    capacidade_agendamentos: 10,
    limite_profissionais: 1,
    limite_servicos: 2,
    destaque: false,
    plano_selecionado_id: 2,
    plano_selecionado_nome: "Autônoma",
    plano_selecionado_slug: "autonoma",
    plano_selecionado_valor: "49.90",
    assinatura_ativa_id: null,
    utilizados: 2,
    profissionais_utilizados: 1,
    servicos_utilizados: 2,
    ...overrides,
  };
}

describe("entitlement dos planos", () => {
  test("CA-PLN-01: catálogo mantém plano gratuito e ao menos uma vaga ativa por plano", async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          nome: "Grátis",
          slug: "inicial",
          valor: "0.00",
          limite_profissionais: 1,
          ativo: true,
        },
        {
          id: 2,
          nome: "Autônoma",
          slug: "autonoma",
          valor: "49.90",
          limite_profissionais: 1,
          ativo: true,
        },
        {
          id: 4,
          nome: "Salão",
          slug: "salao",
          valor: "199.90",
          limite_profissionais: 5,
          ativo: true,
        },
      ],
    });

    const planos = await planoService.listarPlanos();

    expect(planos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "inicial",
          valor: "0.00",
        }),
      ])
    );
    expect(
      planos.every(
        (plano) =>
          plano.limite_profissionais === null ||
          Number(plano.limite_profissionais) >= 1
      )
    ).toBe(true);
  });

  test("CA-PLN-02: checkout pendente não libera benefício pago", async () => {
    const executor = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [resolvedRow()] }),
    };

    const uso = await planoService.buscarUsoPlano(7, executor);

    expect(uso).toMatchObject({
      plano_id: 1,
      plano_slug: "inicial",
      capacidade_agendamentos: 10,
      limite_profissionais: 1,
      limite_servicos: 2,
      plano_selecionado_id: 2,
      plano_selecionado_slug: "autonoma",
      assinatura_ativa_id: null,
    });

    const sql = executor.query.mock.calls[1][0];
    expect(sql).toContain("FROM assinaturas a");
    expect(sql).toContain("a.ativo = TRUE");
    expect(sql).toContain("gratis.slug = 'inicial'");
  });

  test("mantém o plano pago quando existe assinatura ativa", async () => {
    const executor = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            resolvedRow({
              plano_id: 2,
              plano_nome: "Autônoma",
              plano_slug: "autonoma",
              valor: "49.90",
              capacidade_agendamentos: 20,
              limite_servicos: 4,
              assinatura_ativa_id: 91,
            }),
          ],
        }),
    };

    const uso = await planoService.buscarUsoPlano(7, executor);

    expect(uso).toMatchObject({
      plano_id: 2,
      plano_slug: "autonoma",
      capacidade_agendamentos: 20,
      limite_servicos: 4,
      plano_selecionado_id: 2,
      assinatura_ativa_id: 91,
    });
  });
});