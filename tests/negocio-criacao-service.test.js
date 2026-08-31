jest.mock(
  "../src/services/negocioService",
  () => ({
    criar: jest.fn(),
  })
);

const negocioService = require(
  "../src/services/negocioService"
);
const negocioCriacaoService = require(
  "../src/services/negocioCriacaoService"
);

function dadosCompletos(
  alteracoes = {}
) {
  return {
    usuarioId: 1,
    nome: "Studio Aurora",
    descricao:
      "Atendimento especializado em beleza e estética.",
    especialidades: [
      "Unhas",
    ],
    whatsapp:
      "62999999999",
    cidade:
      "Goiânia",
    estado:
      "GO",
    bairro:
      "Centro",
    endereco:
      "Rua das Flores",
    numero:
      "100",
    complemento:
      "Sala 2",
    cep:
      "74000000",
    localizacao_url:
      "https://maps.google.com/?q=goiania",
    ...alteracoes,
  };
}

describe(
  "negocioCriacaoService",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      negocioService.criar
        .mockResolvedValue({
          temNegocio: true,
        });
    });

    test(
      "delega a criação sem exigir foto, descrição ou complemento",
      async () => {
        const dados =
          dadosCompletos({
            descricao: "",
            complemento: "",
          });

        await expect(
          negocioCriacaoService.criar(
            dados
          )
        ).resolves.toEqual({
          temNegocio: true,
        });

        expect(
          negocioService.criar
        ).toHaveBeenCalledWith(
          dados
        );
        expect(dados)
          .not.toHaveProperty(
            "foto_url"
          );
      }
    );

    test(
      "permite criação sem complemento",
      async () => {
        const dados = dadosCompletos({
          complemento: "",
        });

        await expect(
          negocioCriacaoService.criar(
            dados
          )
        ).resolves.toEqual({
          temNegocio: true,
        });

        expect(
          negocioService.criar
        ).toHaveBeenCalledWith(
          dados
        );
      }
    );

    test.each([
      ["nome", "Nome do negócio"],
      ["whatsapp", "WhatsApp"],
      ["cidade", "Cidade"],
      ["estado", "Estado"],
      ["bairro", "Bairro"],
      ["endereco", "Endereço"],
      ["numero", "Número"],
      ["cep", "CEP"],
      ["localizacao_url", "Link do Google Maps"],
    ])(
      "rejeita criação sem %s",
      async (
        campo,
        rotulo
      ) => {
        await expect(
          negocioCriacaoService.criar(
            dadosCompletos({
              [campo]: "  ",
            })
          )
        ).rejects.toMatchObject({
          message:
            `Preencha todas as informações do negócio antes de continuar. Campo pendente: ${rotulo}.`,
          statusCode: 400,
        });

        expect(
          negocioService.criar
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "rejeita criação sem especialidades",
      async () => {
        await expect(
          negocioCriacaoService.criar(
            dadosCompletos({
              especialidades: [],
            })
          )
        ).rejects.toMatchObject({
          message:
            "Preencha todas as informações do negócio antes de continuar. Campo pendente: Especialidades.",
          statusCode: 400,
        });

        expect(
          negocioService.criar
        ).not.toHaveBeenCalled();
      }
    );
  }
);
