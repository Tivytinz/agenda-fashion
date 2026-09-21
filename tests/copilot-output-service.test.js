const {
  sanitizeCopilotShareOutput,
  buildFallbackShareOutput,
} = require("../src/services/copilot/copilotOutputService");

describe("copilotOutputService", () => {
  test("aceita texto simples sem alegações comerciais não autorizadas", () => {
    expect(
      sanitizeCopilotShareOutput({
        titulo: "Alongamento em destaque",
        texto:
          "Seu alongamento está em destaque. Veja os serviços e escolha o melhor horário para você.",
      })
    ).toEqual({
      titulo: "Alongamento em destaque",
      texto:
        "Seu alongamento está em destaque. Veja os serviços e escolha o melhor horário para você.",
    });
  });

  test.each([
    ["URL", "Conheça o perfil em https://example.com e escolha seu horário."],
    ["e-mail", "Fale com studio@example.com para reservar seu atendimento."],
    ["telefone", "Fale com a gente pelo número 62999999999 para agendar."],
    ["preço", "Alongamento por R$ 99 hoje. Escolha seu melhor horário."],
    ["percentual", "Aproveite 20% de desconto no alongamento e agende hoje."],
    ["promoção", "Promoção especial de alongamento. Garanta seu horário."],
    ["disponibilidade", "Temos horários disponíveis hoje para alongamento."],
    ["urgência", "Últimas vagas para alongamento. Reserve agora mesmo."],
    ["garantia", "Resultado garantido no seu alongamento. Agende agora."],
  ])("rejeita %s não autorizado", (_cenario, texto) => {
    expect(
      sanitizeCopilotShareOutput({
        titulo: "Sugestão",
        texto,
      })
    ).toBeNull();
  });

  test("valida também o título, não apenas o corpo", () => {
    expect(
      sanitizeCopilotShareOutput({
        titulo: "20% de desconto",
        texto:
          "Conheça nosso serviço de alongamento e escolha seu horário.",
      })
    ).toBeNull();
  });

  test("fallback permanece determinístico e sem alegações proibidas", () => {
    const resultado = buildFallbackShareOutput({
      negocio: {
        nome: "Studio Rosa",
      },
      servico_destaque: {
        nome: "Alongamento em gel",
      },
    });

    expect(resultado).toEqual({
      titulo: "Alongamento em gel em destaque",
      texto:
        "💅 Alongamento em gel está em destaque no Studio Rosa. Veja nossos serviços no Agenda Fashion e escolha o melhor horário para você.",
    });
    expect(
      sanitizeCopilotShareOutput(resultado)
    ).toEqual(resultado);
  });
});
