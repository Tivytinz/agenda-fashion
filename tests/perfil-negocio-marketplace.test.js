jest.mock(
  "../src/repositories/perfilNegocioRepository"
);

const repository = require(
  "../src/repositories/perfilNegocioRepository"
);

const service = require(
  "../src/services/perfilNegocioService"
);

describe(
  "catálogo público do marketplace",
  () => {
    afterEach(
      () => {
        jest.clearAllMocks();
      }
    );

    beforeEach(() => {
      repository
        .listarLocalidadesPublicas
        .mockResolvedValue([]);
    });

    test(
      "entrega os serviços junto de cada negócio",
      async () => {
        repository
          .listarNegociosPublicos
          .mockResolvedValue([
            {
              id: 1,
              nome: "Studio Bella",
              areas: null,
              servicos: [
                {
                  id: 10,
                  nome: "Alongamento em gel",
                  valor: "120.00",
                },
              ],
            },
          ]);

        const resultado =
          await service
            .listarNegociosPublicos({
              busca: "unhas",
              pagina: "2",
              limite: "6"
            });

        expect(
          repository.listarNegociosPublicos
        ).toHaveBeenCalledWith({
          busca: "unhas",
          categoria: "",
          categoriaTermos: [],
          cidade: "",
          estado: "",
          limite: 6,
          offset: 6
        });

        expect(
          resultado.negocios[0]
            .servicos
        ).toEqual([
          expect.objectContaining({
            id: 10,
            nome:
              "Alongamento em gel",
          }),
        ]);
      }
    );

    test(
      "expande categorias para nomes usados pelos profissionais",
      async () => {
        repository
          .listarNegociosPublicos
          .mockResolvedValue([]);

        await service.listarNegociosPublicos({
          categoria: "unha"
        });

        expect(
          repository.listarNegociosPublicos
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            busca: "",
            categoria: "unha",
            categoriaTermos: expect.arrayContaining([
              "unha",
              "manicure",
              "pedicure",
              "esmalta",
              "nail",
              "alongamento"
            ]),
            cidade: "",
            estado: ""
          })
        );
      }
    );

    test(
      "expande a busca de bronzeamento sem misturar com Outro",
      async () => {
        repository
          .listarNegociosPublicos
          .mockResolvedValue([]);

        await service.listarNegociosPublicos({
          categoria: "bronzeamento"
        });

        expect(
          repository.listarNegociosPublicos
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            categoria: "bronzeamento",
            categoriaTermos: expect.arrayContaining([
              "bronzeamento",
              "bronze artificial",
              "bronze natural",
              "marquinha",
              "spray tan"
            ])
          })
        );
      }
    );

    test(
      "encaminha cidade e UF como filtros dedicados sem misturar com a busca",
      async () => {
        repository
          .listarNegociosPublicos
          .mockResolvedValue([]);

        await service.listarNegociosPublicos({
          busca: "escova",
          categoria: "cabelo",
          cidade: "Goiânia",
          estado: "go"
        });

        expect(
          repository.listarNegociosPublicos
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            busca: "escova",
            categoria: "cabelo",
            cidade: "Goiânia",
            estado: "GO"
          })
        );
      }
    );

    test(
      "descarta UF inválida em vez de ampliar um filtro ambíguo",
      async () => {
        repository
          .listarNegociosPublicos
          .mockResolvedValue([]);

        await service.listarNegociosPublicos({
          cidade: "Goiânia",
          estado: "Goiás"
        });

        expect(
          repository.listarNegociosPublicos
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            cidade: "Goiânia",
            estado: ""
          })
        );
      }
    );

    test(
      "limita pagina e informa se existem mais resultados",
      async () => {
        repository
          .listarNegociosPublicos
          .mockResolvedValue([
            {
              id: 3,
              nome: "Studio Aurora",
              total_resultados: 30,
              servicos: []
            }
          ]);

        const resultado =
          await service.listarNegociosPublicos({
            pagina: "1",
            limite: "999"
          });

        expect(resultado.paginacao).toEqual({
          pagina: 1,
          limite: 24,
          total: 30,
          tem_mais: true
        });
        expect(resultado.negocios[0])
          .not.toHaveProperty("total_resultados");
      }
    );

    test(
      "entrega apenas localidades publicadas e normalizadas na primeira página",
      async () => {
        repository
          .listarNegociosPublicos
          .mockResolvedValue([]);
        repository
          .listarLocalidadesPublicas
          .mockResolvedValue([
            {
              cidade: " Goiânia ",
              estado: "go",
              total_negocios: "3"
            },
            {
              cidade: "Cidade inválida",
              estado: "Goiás",
              total_negocios: "1"
            }
          ]);

        const resultado =
          await service.listarNegociosPublicos();

        expect(resultado.localidades).toEqual([
          {
            cidade: "Goiânia",
            estado: "GO",
            total_negocios: 3
          }
        ]);
      }
    );

    test(
      "não repete a consulta de localidades ao carregar páginas seguintes",
      async () => {
        repository
          .listarNegociosPublicos
          .mockResolvedValue([]);

        const resultado = await service.listarNegociosPublicos({
          pagina: "2"
        });

        expect(repository.listarLocalidadesPublicas)
          .not.toHaveBeenCalled();
        expect(resultado).not.toHaveProperty("localidades");
      }
    );

    test(
      "limita pagina extrema para proteger o banco",
      async () => {
        repository
          .listarNegociosPublicos
          .mockResolvedValue([]);

        await service.listarNegociosPublicos({
          pagina: "999999",
          limite: "24"
        });

        expect(
          repository.listarNegociosPublicos
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            limite: 24,
            offset: 23976
          })
        );
      }
    );

    test(
      "normaliza negócios antigos sem serviços",
      async () => {
        repository
          .listarNegociosPublicos
          .mockResolvedValue([
            {
              id: 2,
              nome: "Espaço Hair",
              servicos: null,
            },
          ]);

        const resultado =
          await service
            .listarNegociosPublicos();

        expect(
          resultado.negocios[0]
            .servicos
        ).toEqual([]);
      }
    );

    test(
      "responde 404 para perfil inexistente ou não publicado",
      async () => {
        repository
          .buscarNegocioPorSlug
          .mockResolvedValue(null);

        await expect(
          service.buscarPerfilPublico({
            slug: "negocio-privado"
          })
        ).rejects.toMatchObject({
          statusCode: 404,
          message:
            "Negócio não encontrado."
        });
      }
    );
  }
);
