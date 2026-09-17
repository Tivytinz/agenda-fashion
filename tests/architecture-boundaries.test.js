const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");

function arquivosJavaScript(pastaRelativa) {
  const pasta = path.join(raiz, pastaRelativa);

  return fs.readdirSync(pasta)
    .filter((arquivo) => arquivo.endsWith(".js"))
    .map((arquivo) => ({
      arquivo: path.join(pastaRelativa, arquivo),
      conteudo: fs.readFileSync(
        path.join(pasta, arquivo),
        "utf8"
      ),
    }));
}

function arquivosQueCorrespondem(arquivos, padrao) {
  return arquivos
    .filter(({ conteudo }) => padrao.test(conteudo))
    .map(({ arquivo }) => arquivo)
    .sort();
}

describe("fronteiras da arquitetura backend", () => {
  const routes = arquivosJavaScript("src/routes");
  const controllers = arquivosJavaScript("src/controllers");
  const services = arquivosJavaScript("src/services");

  test("routes e controllers não acessam banco ou repositories", () => {
    expect(
      arquivosQueCorrespondem(
        [...routes, ...controllers],
        /(?:db\/db|repositories\/|\.query\s*\()/
      )
    ).toEqual([]);
  });

  test("não aumenta o SQL legado mantido temporariamente em services", () => {
    expect(
      arquivosQueCorrespondem(
        services,
        /\b(?:db|client|executor)\.query\s*\(/
      )
    ).toEqual([
      "src/services/assinaturaServiceCore.js",
      "src/services/checkoutService.js",
      "src/services/readinessService.js",
      "src/services/servicoAtivacaoService.js",
    ]);
  });
});
