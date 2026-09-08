jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn()
  })
);

const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/metaAdsRepository"
);

test(
  "perfil Meta do negócio exige dono e usuário ativos",
  async () => {
    db.query.mockResolvedValueOnce({
      rows: []
    });

    const perfil =
      await repository
        .buscarPerfilPorNegocio(7);

    expect(perfil).toBeNull();

    const [sql, parametros] =
      db.query.mock.calls[0];

    expect(sql).toContain(
      "un.papel = 'dono'"
    );
    expect(sql).toContain(
      "un.ativo = TRUE"
    );
    expect(sql).toContain(
      "u.ativo = TRUE"
    );
    expect(parametros).toEqual([7]);
  }
);
