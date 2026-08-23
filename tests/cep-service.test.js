jest.mock("../src/providers/cepProvider", () => ({
  consultarCepViaCep: jest.fn(),
}));

const {
  consultarCepViaCep,
} = require("../src/providers/cepProvider");
const cepService = require("../src/services/cepService");

describe("cepService", () => {
  beforeEach(() => {
    consultarCepViaCep.mockReset();
  });

  test("normaliza o CEP e devolve apenas os campos usados pelo cadastro", async () => {
    consultarCepViaCep.mockResolvedValue({
      cep: "74981-100",
      logradouro: "Rua 10",
      complemento: "",
      bairro: "Araguaia Acréscimo",
      localidade: "Aparecida de Goiânia",
      uf: "GO",
    });

    await expect(
      cepService.buscarCep("74981-100")
    ).resolves.toEqual({
      cep: "74981100",
      endereco: "Rua 10",
      bairro: "Araguaia Acréscimo",
      cidade: "Aparecida de Goiânia",
      estado: "GO",
    });

    expect(consultarCepViaCep).toHaveBeenCalledWith("74981100");
  });

  test("rejeita CEP com quantidade inválida de dígitos", async () => {
    await expect(
      cepService.buscarCep("74981")
    ).rejects.toMatchObject({
      message: "Informe um CEP com 8 dígitos.",
      statusCode: 400,
    });

    expect(consultarCepViaCep).not.toHaveBeenCalled();
  });

  test("transforma a resposta de CEP inexistente em 404", async () => {
    consultarCepViaCep.mockResolvedValue({ erro: true });

    await expect(
      cepService.buscarCep("00000000")
    ).rejects.toMatchObject({
      message: "CEP não encontrado.",
      statusCode: 404,
    });
  });
});
