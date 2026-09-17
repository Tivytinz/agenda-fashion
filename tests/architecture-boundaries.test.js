const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");

function arquivosJavaScript(pastaRelativa) {
  const pasta = path.join(raiz, pastaRelativa);
  const encontrados = [];

  function visitar(diretorio) {
    for (const entrada of fs.readdirSync(diretorio, { withFileTypes: true })) {
      const caminho = path.join(diretorio, entrada.name);
      if (entrada.isDirectory()) {
        visitar(caminho);
      } else if (entrada.name.endsWith(".js")) {
        encontrados.push({
          absoluto: caminho,
          arquivo: path.relative(raiz, caminho).split(path.sep).join("/"),
          conteudo: fs.readFileSync(caminho, "utf8"),
        });
      }
    }
  }

  visitar(pasta);
  return encontrados.sort((a, b) => a.arquivo.localeCompare(b.arquivo));
}

function arquivosQueCorrespondem(arquivos, padrao) {
  return arquivos
    .filter(({ conteudo }) => padrao.test(conteudo))
    .map(({ arquivo }) => arquivo)
    .sort();
}

function dependenciasLocais(arquivo, todosPorCaminho) {
  const dependencias = [];
  const padrao = /require\(\s*["']([^"']+)["']\s*\)/g;
  let resultado;

  while ((resultado = padrao.exec(arquivo.conteudo))) {
    const referencia = resultado[1];
    if (!referencia.startsWith(".")) continue;
    const base = path.resolve(path.dirname(arquivo.absoluto), referencia);
    const destino = [base, `${base}.js`, path.join(base, "index.js")]
      .find((candidato) => todosPorCaminho.has(candidato));
    if (destino) dependencias.push(destino);
  }

  return dependencias;
}

describe("fronteiras da arquitetura backend", () => {
  const src = arquivosJavaScript("src");
  const routes = src.filter(({ arquivo }) => arquivo.startsWith("src/routes/"));
  const controllers = src.filter(({ arquivo }) => arquivo.startsWith("src/controllers/"));
  const services = src.filter(({ arquivo }) => arquivo.startsWith("src/services/"));
  const repositories = src.filter(({ arquivo }) => arquivo.startsWith("src/repositories/"));

  test("routes e controllers não acessam banco ou repositories", () => {
    expect(
      arquivosQueCorrespondem(
        [...routes, ...controllers],
        /(?:db\/db|repositories\/|\.query\s*\()/
      )
    ).toEqual([]);
  });

  test("services e repositories não dependem das camadas HTTP", () => {
    expect(
      arquivosQueCorrespondem(
        [...services, ...repositories],
        /require\(\s*["'][^"']*(?:controllers|routes)\//
      )
    ).toEqual([]);
  });

  test("repositories não dependem de services", () => {
    expect(
      arquivosQueCorrespondem(
        repositories,
        /require\(\s*["'][^"']*services\//
      )
    ).toEqual([]);
  });

  test("SQL do runtime fica em repositories ou na sondagem de readiness", () => {
    const excecoes = new Set([
      "src/db/db.js",
      "src/services/readinessService.js",
    ]);
    const foraDaCamada = src.filter(({ arquivo }) =>
      !arquivo.startsWith("src/repositories/") && !excecoes.has(arquivo)
    );

    expect(
      arquivosQueCorrespondem(
        foraDaCamada,
        /\b(?:db|client|executor|pool|conexao)\.query\s*\(/
      )
    ).toEqual([]);
  });

  test("grafo de módulos locais não possui ciclos", () => {
    const todosPorCaminho = new Set(src.map(({ absoluto }) => absoluto));
    const porCaminho = new Map(src.map((arquivo) => [arquivo.absoluto, arquivo]));
    const visitando = new Set();
    const visitados = new Set();
    const pilha = [];
    const ciclos = [];

    function visitar(caminho) {
      if (visitando.has(caminho)) {
        const inicio = pilha.indexOf(caminho);
        ciclos.push(
          pilha.slice(inicio).concat(caminho)
            .map((item) => path.relative(raiz, item).split(path.sep).join("/"))
        );
        return;
      }
      if (visitados.has(caminho)) return;

      visitando.add(caminho);
      pilha.push(caminho);
      for (const dependencia of dependenciasLocais(
        porCaminho.get(caminho),
        todosPorCaminho
      )) {
        visitar(dependencia);
      }
      pilha.pop();
      visitando.delete(caminho);
      visitados.add(caminho);
    }

    for (const arquivo of src) visitar(arquivo.absoluto);
    expect(ciclos).toEqual([]);
  });
});
