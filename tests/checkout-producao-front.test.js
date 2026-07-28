const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(
  path.join(
    __dirname,
    "../agendamento-nails/html/checkout.html"
  ),
  "utf8"
);

const javascript = fs.readFileSync(
  path.join(
    __dirname,
    "../agendamento-nails/js/checkout.js"
  ),
  "utf8"
);

describe("checkout de produção no frontend", () => {
  test("solicita CPF/CNPJ e o envia ao backend", () => {
    expect(html).toContain('id="cpfCnpj"');
    expect(html).toContain('inputmode="numeric"');
    expect(javascript).toContain("validarDocumentoCobranca()");
    expect(javascript).toMatch(
      /cpf_cnpj:\s+cpfCnpj/
    );
  });

  test("mantém cartão indisponível na interface", () => {
    expect(html).toMatch(
      /name="formaPagamento"\s+value="cartao"\s+disabled/
    );
    expect(html).toContain(
      "Em breve, após a validação de segurança."
    );
  });

  test("acompanha o banco local sem polling agressivo", () => {
    expect(javascript).toMatch(
      /tentativasStatus\s*>=\s*24/
    );
    expect(javascript).toContain(
      "? 5000"
    );
    expect(javascript).toContain(
      "? 10000"
    );
    expect(javascript).toContain(
      ": 20000"
    );
  });
});
