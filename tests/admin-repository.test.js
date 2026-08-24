const mockQuery = jest.fn();

jest.mock(
  "../src/db/db",
  () => ({
    query: mockQuery,
  })
);

const repository = require(
  "../src/repositories/adminRepository"
);

describe(
  "consultas do administrador global",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockQuery.mockResolvedValue({
        rows: [
          {},
        ],
      });
    });

    test(
      "calcula hoje pelo fuso oficial do AF",
      async () => {
        await repository
          .buscarIndicadoresHoje();

        const [sql] =
          mockQuery.mock.calls[0];

        expect(sql).toMatch(
          /NOW\(\) AT TIME ZONE 'America\/Sao_Paulo'/i
        );
        expect(sql).not.toMatch(
          /CURRENT_DATE/i
        );
        expect(
          sql.match(
            /America\/Sao_Paulo/g
          )
        ).toHaveLength(6);
      }
    );

    test(
      "usa dias de calendário e ignora vínculos profissionais inativos",
      async () => {
        await repository
          .buscarIndicadoresGerais(
            "7"
          );

        const [sql] =
          mockQuery.mock.calls[0];

        expect(sql).toMatch(
          /INTERVAL '6 days'/i
        );
        expect(sql).not.toMatch(
          /INTERVAL '7 days'/i
        );
        expect(sql).toMatch(
          /AND un\.ativo = TRUE/i
        );
        expect(sql).toMatch(
          /AND u\.ativo = TRUE/i
        );
      }
    );

    test(
      "avalia qualidade apenas em negócios e serviços ativos",
      async () => {
        await repository
          .buscarQualidadeNegocios();

        const [sql] =
          mockQuery.mock.calls[0];

        expect(
          sql.match(
            /AND s\.ativo = TRUE/gi
          )
        ).toHaveLength(2);
        expect(sql).toMatch(
          /FROM negocios n\s+WHERE n\.ativo = TRUE/i
        );
      }
    );

    test(
      "não apresenta papéis antigos como vínculos atuais",
      async () => {
        await repository
          .listarUsuariosRecentes();

        const [sql] =
          mockQuery.mock.calls[0];

        expect(sql).toMatch(
          /LEFT JOIN usuarios_negocios un[\s\S]*AND un\.ativo = TRUE/i
        );
      }
    );

    test(
      "conta somente equipe ativa nos negócios",
      async () => {
        await repository
          .listarNegocios();

        const [sql] =
          mockQuery.mock.calls[0];

        expect(sql).toMatch(
          /INNER JOIN usuarios u[\s\S]*u\.ativo = TRUE/i
        );
        expect(sql).toMatch(
          /WHERE un\.negocio_id = n\.id[\s\S]*AND un\.ativo = TRUE/i
        );
      }
    );
  }
);
