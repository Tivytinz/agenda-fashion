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
