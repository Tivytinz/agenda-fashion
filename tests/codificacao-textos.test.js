const fs = require("fs");
const path = require("path");

const DIRETORIOS = [
  "frontend",
  "public",
  "src",
];

const EXTENSOES_TEXTO = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
]);

const DIRETORIOS_IGNORADOS = new Set([
  "node_modules",
  "react-app",
  "coverage",
  ".git",
]);

const MARCADORES_CORROMPIDOS = [
  /\u00c3[\u00a1\u00a9\u00ad\u00b3\u00ba\u00a3\u00b5\u00a7\u00aa\u00b4]/u,
  /\u00f0\u0178/u,
  /\u00e2(?![a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00e3\u00f5\u00e7])/iu,
  /\u00ef\u00b8/u,
  /\uFFFD/u,
];

function listarArquivosTexto(diretorio) {
  if (!fs.existsSync(diretorio)) {
    return [];
  }

  return fs
    .readdirSync(
      diretorio,
      {
        withFileTypes: true,
      }
    )
    .flatMap((item) => {
      const caminho = path.join(
        diretorio,
        item.name
      );

      if (item.isDirectory()) {
        if (
          DIRETORIOS_IGNORADOS.has(
            item.name
          )
        ) {
          return [];
        }

        return listarArquivosTexto(
          caminho
        );
      }

      return EXTENSOES_TEXTO.has(
        path.extname(item.name)
      )
        ? [caminho]
        : [];
    });
}

describe(
  "codificacao dos textos",
  () => {
    test(
      "nao possui sinais conhecidos de texto UTF-8 corrompido",
      () => {
        const arquivosCorrompidos =
          DIRETORIOS
            .flatMap(
              listarArquivosTexto
            )
            .filter((arquivoAtual) => {
              const texto =
                fs.readFileSync(
                  arquivoAtual,
                  "utf8"
                );

              return MARCADORES_CORROMPIDOS.some(
                (marcador) =>
                  marcador.test(texto)
              );
            });

        expect(
          arquivosCorrompidos
        ).toEqual([]);
      }
    );
  }
);