describe("provedor de e-mail de recuperação", () => {
  const configuracaoOriginal = {
    habilitado: process.env.PASSWORD_RESET_EMAIL_ENABLED,
    apiKey: process.env.RESEND_API_KEY,
    remetente: process.env.PASSWORD_RESET_EMAIL_FROM,
  };

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: "email-1" }),
    });
    process.env.PASSWORD_RESET_EMAIL_ENABLED = "true";
    process.env.RESEND_API_KEY = "resend-chave-teste";
    process.env.PASSWORD_RESET_EMAIL_FROM =
      "Agenda Fashion <contato@agendafashion.com.br>";
  });

  afterAll(() => {
    const restaurar = (chave, valor) => {
      if (valor === undefined) {
        delete process.env[chave];
        return;
      }

      process.env[chave] = valor;
    };

    restaurar(
      "PASSWORD_RESET_EMAIL_ENABLED",
      configuracaoOriginal.habilitado
    );
    restaurar("RESEND_API_KEY", configuracaoOriginal.apiKey);
    restaurar(
      "PASSWORD_RESET_EMAIL_FROM",
      configuracaoOriginal.remetente
    );
    delete global.fetch;
  });

  test("envia pelo endpoint oficial sem expor a chave no corpo", async () => {
    const provider = require("../src/providers/emailProvider");

    await provider.enviarRedefinicaoSenha({
      destinatario: "ana@example.com",
      nome: "Ana <Teste>",
      link: "https://app.agendafashion.com.br/redefinir-senha?token=seguro",
    });

    const [url, request] = global.fetch.mock.calls[0];
    const body = JSON.parse(request.body);

    expect(url).toBe("https://api.resend.com/emails");
    expect(request.headers.Authorization).toBe("Bearer resend-chave-teste");
    expect(body.to).toEqual(["ana@example.com"]);
    expect(body.html).toContain("Ana");
    expect(body.html).not.toContain("<Teste>");
    expect(request.body).not.toContain("resend-chave-teste");
  });

  test("falha de forma explícita quando o envio está desativado", async () => {
    process.env.PASSWORD_RESET_EMAIL_ENABLED = "false";
    const provider = require("../src/providers/emailProvider");

    await expect(provider.enviarRedefinicaoSenha({
      destinatario: "ana@example.com",
      nome: "Ana",
      link: "https://app.agendafashion.com.br/redefinir-senha?token=seguro",
    })).rejects.toMatchObject({ code: "EMAIL_CONFIGURATION_ERROR" });
  });
});
