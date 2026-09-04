jest.mock("axios", () => ({
  post: jest.fn(),
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
  });

  it("permanece desligado sem flag e chave", () => {
    process.env.COPILOT_AI_ENABLED = "false";
    expect(openaiProvider.isEnabled()).toBe(false);

    process.env.COPILOT_AI_ENABLED = "true";
    delete process.env.OPENAI_API_KEY;
    expect(openaiProvider.isEnabled()).toBe(false);
  });
});
