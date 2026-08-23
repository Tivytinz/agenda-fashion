const {
  consultarCepViaCep,
} = require("../src/providers/cepProvider");

describe("cepProvider", () => {
  test("consulta o ViaCEP no servidor", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        logradouro: "Rua 10",
        bairro: "Araguaia Acréscimo",
        localidade: "Aparecida de Goiânia",
        uf: "GO",
      }),
    });

    const result = await consultarCepViaCep("74981100", {
      fetchImpl,
      timeoutMs: 1000,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://viacep.com.br/ws/74981100/json/"
    );
    expect(fetchImpl.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        headers: { Accept: "application/json" },
        signal: expect.any(AbortSignal),
      })
    );
    expect(result.uf).toBe("GO");
  });

  test("traduz falha do provedor para erro temporário 503", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
    });

    await expect(
      consultarCepViaCep("74981100", {
        fetchImpl,
        timeoutMs: 1000,
      })
    ).rejects.toMatchObject({
      message: "Serviço de consulta de CEP indisponível.",
      statusCode: 503,
    });
  });
});
