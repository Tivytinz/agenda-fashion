const fs = require("fs");
const path = require("path");

const DIRETORIOS = ["agendamento-nails", "public", "src"];
const EXTENSOES_TEXTO = new Set([".css", ".html", ".js", ".json"]);
const MARCADORES_CORROMPIDOS = [
  /Ã[¡©­³º£µ§ª´]/u,
  /ðŸ/u,
  /â(?![a-záéíóúãõç])/iu,
  /ï¸/u,
  /\uFFFD/u,
];

function listarArquivosTexto(diretorio) {
  return fs.readdirSync(diretorio, { withFileTypes: true }).flatMap((item) => {
    const caminho = path.join(diretorio, item.name);

    if (item.isDirectory()) {
      return listarArquivosTexto(caminho);
    }

    return EXTENSOES_TEXTO.has(path.extname(item.name)) ? [caminho] : [];
  });
}

describe("codificação dos textos", () => {
  test("não possui sinais conhecidos de texto UTF-8 corrompido", () => {
    const arquivosCorrompidos = DIRETORIOS.flatMap(listarArquivosTexto).filter(
      (arquivo) => {
        const conteudo = fs.readFileSync(arquivo, "utf8");
        return MARCADORES_CORROMPIDOS.some((marcador) =>
          marcador.test(conteudo)
        );
      }
    );

    expect(arquivosCorrompidos).toEqual([]);
  });
});
