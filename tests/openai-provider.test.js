const mockInformacao = jest.fn();
const mockAviso = jest.fn();

jest.mock("axios", () => ({
  post: jest.fn(),
}));

jest.mock("../src/utils/registrador", () => ({
  informacao: mockInformacao,
  aviso: mockAviso,
}));

const axios = require("axios");
const openaiProvider = require("../src/services/copilot/openaiProvider");

describe("openaiProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COPILOT_AI_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-secret-key";
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_API_URL;
    delete process.env.OPENAI_TIMEOUT_MS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("usa Responses API sem armazenamento e exige Structured Outputs", async () => {
    axios.post.mockResolvedValue({
      data: {
        usage: {
          input_tokens: 120,
          output_tokens: 28,
        },
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  titulo: "Alongamento em destaque",
                  texto: "Seu alongamento está em destaque. Veja os serviços e escolha seu horário.",
                }),
              },
            ],
          },
        ],
      },
    });

    const contexto = {
      finalidade: "divulgacao_perfil",
      negocio: { nome: "Studio Rosa" },
    };

    const resultado = await openaiProvider.generateShareCopy(contexto);

    expect(resultado.titulo).toBe("Alongamento em destaque");
    expect(axios.post).toHaveBeenCalledTimes(1);

    const [url, body, config] = axios.post.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(body.model).toBe("gpt-5.6-luna");
    expect(body.store).toBe(false);
    expect(body.text.format).toEqual(expect.objectContaining({
      type: "json_schema",
      strict: true,
    }));
    expect(body.input).toBe(JSON.stringify(contexto));
    expect(config.headers.Authorization).toBe("Bearer test-secret-key");
    expect(JSON.stringify(body)).not.toContain("test-secret-key");

    expect(mockInformacao).toHaveBeenCalledWith(
      "Copilot OpenAI: geração concluída.",
      expect.objectContaining({
        provider: "openai",
        modelo: "gpt-5.6-luna",
        input_tokens: 120,
        output_tokens: 28,
      })
    );

    const logs = JSON.stringify(mockInformacao.mock.calls);
    expect(logs).not.toContain("Studio Rosa");
    expect(logs).not.toContain("test-secret-key");
  });

  it.each(["1", "true", "yes", "on"])(
    "usa o mesmo parser de flags do runtime para %s",
    (valor) => {
      process.env.COPILOT_AI_ENABLED = valor;
      expect(openaiProvider.isEnabled()).toBe(true);
    }
  );

  it("permanece desligado sem flag ativa ou sem chave", () => {
    process.env.COPILOT_AI_ENABLED = "false";
    expect(openaiProvider.isEnabled()).toBe(false);

    process.env.COPILOT_AI_ENABLED = "true";
    delete process.env.OPENAI_API_KEY;
    expect(openaiProvider.isEnabled()).toBe(false);
  });

  it("registra timeout sem prompt, resposta ou segredo e propaga a falha", async () => {
    const erro = new Error("timeout contendo detalhe interno");
    erro.code = "ECONNABORTED";
    axios.post.mockRejectedValue(erro);

    const contexto = {
      finalidade: "divulgacao_perfil",
      negocio: { nome: "Studio Rosa" },
    };

    await expect(
      openaiProvider.generateShareCopy(contexto)
    ).rejects.toBe(erro);

    expect(mockAviso).toHaveBeenCalledWith(
      "Copilot OpenAI: falha na geração.",
      expect.objectContaining({
        provider: "openai",
        modelo: "gpt-5.6-luna",
        tipo_erro: "timeout",
        codigo: "ECONNABORTED",
        status_http: null,
      })
    );

    const logs = JSON.stringify(mockAviso.mock.calls);
    expect(logs).not.toContain("Studio Rosa");
    expect(logs).not.toContain("timeout contendo detalhe interno");
    expect(logs).not.toContain("test-secret-key");
  });

  it("classifica resposta inválida sem persistir conteúdo retornado", async () => {
    axios.post.mockResolvedValue({
      data: {
        output_text: "{json quebrado",
      },
    });

    await expect(
      openaiProvider.generateShareCopy({
        finalidade: "divulgacao_perfil",
      })
    ).rejects.toMatchObject({
      code: "COPILOT_INVALID_JSON",
    });

    expect(mockAviso).toHaveBeenCalledWith(
      "Copilot OpenAI: falha na geração.",
      expect.objectContaining({
        tipo_erro: "invalid_response",
        codigo: "COPILOT_INVALID_JSON",
      })
    );
    expect(JSON.stringify(mockAviso.mock.calls)).not.toContain(
      "{json quebrado"
    );
  });
});
