const Busboy = require("busboy");

const {
  correspondeAoTipo,
} = require(
  "../utils/validarImagem"
);

const TAMANHO_MAXIMO =
  5 * 1024 * 1024;

const TIPOS_PERMITIDOS =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

function criarErro(
  mensagem,
  codigo,
  statusCode = 400
) {
  const erro =
    new Error(mensagem);

  erro.name =
    "UploadError";
  erro.code =
    codigo;
  erro.status =
    statusCode;
  erro.statusCode =
    statusCode;

  return erro;
}

function single(
  campoEsperado
) {
  return function processarUpload(
    req,
    _res,
    next
  ) {
    if (
      !String(
        req.headers[
          "content-type"
        ] || ""
      ).toLowerCase()
        .startsWith(
          "multipart/form-data"
        )
    ) {
      return next();
    }

    let finalizado =
      false;
    let arquivo =
      null;
    let erroUpload =
      null;
    let quantidadeArquivos =
      0;

    const concluir =
      (erro = null) => {
        if (finalizado) {
          return;
        }

        finalizado =
          true;

        if (erro) {
          return next(erro);
        }

        req.file =
          arquivo;

        return next();
      };

    let parser;

    try {
      parser =
        Busboy({
          headers:
            req.headers,
          limits: {
            fileSize:
              TAMANHO_MAXIMO,
            files:
              1,
            fields:
              10,
            parts:
              11,
          },
        });
    } catch {
      return concluir(
        criarErro(
          "Formulário de upload inválido.",
          "INVALID_MULTIPART"
        )
      );
    }

    parser.on(
      "file",
      (
        nomeCampo,
        stream,
        informacoes
      ) => {
        quantidadeArquivos +=
          1;

        const nomeArquivo =
          String(
            informacoes
              ?.filename || ""
          ).slice(
            0,
            255
          );

        const mimetype =
          String(
            informacoes
              ?.mimeType || ""
          ).toLowerCase();

        if (
          nomeCampo !==
            campoEsperado ||
          !TIPOS_PERMITIDOS
            .has(mimetype)
        ) {
          erroUpload =
            criarErro(
              nomeCampo !==
                campoEsperado
                ? "Campo de arquivo inválido."
                : "Apenas JPG, PNG ou WEBP são permitidos.",
              "INVALID_FILE"
            );

          stream.resume();
          return;
        }

        const partes =
          [];
        let tamanho =
          0;

        stream.on(
          "data",
          (parte) => {
            tamanho +=
              parte.length;

            if (
              tamanho <=
              TAMANHO_MAXIMO
            ) {
              partes.push(
                parte
              );
            }
          }
        );

        stream.on(
          "limit",
          () => {
            erroUpload =
              criarErro(
                "A imagem deve ter no máximo 5 MB.",
                "LIMIT_FILE_SIZE",
                413
              );
          }
        );

        stream.on(
          "end",
          () => {
            if (!erroUpload) {
              const buffer =
                Buffer.concat(
                  partes
                );

              if (
                !correspondeAoTipo(
                  buffer,
                  mimetype
                )
              ) {
                erroUpload =
                  criarErro(
                    "O conteúdo do arquivo não corresponde a uma imagem válida.",
                    "INVALID_FILE_CONTENT"
                  );

                return;
              }

              arquivo = {
                fieldname:
                  nomeCampo,
                originalname:
                  nomeArquivo,
                encoding:
                  informacoes
                    ?.encoding,
                mimetype,
                size:
                  tamanho,
                buffer,
              };
            }
          }
        );
      }
    );

    parser.on(
      "filesLimit",
      () => {
        erroUpload =
          criarErro(
            "Envie apenas uma imagem.",
            "LIMIT_FILE_COUNT"
          );
      }
    );

    parser.on(
      "fieldsLimit",
      () => {
        erroUpload =
          criarErro(
            "O formulário possui campos demais.",
            "LIMIT_FIELD_COUNT"
          );
      }
    );

    parser.on(
      "partsLimit",
      () => {
        erroUpload =
          criarErro(
            "O formulário possui partes demais.",
            "LIMIT_PART_COUNT"
          );
      }
    );

    parser.on(
      "error",
      () => {
        concluir(
          criarErro(
            "Não foi possível processar a imagem enviada.",
            "INVALID_MULTIPART"
          )
        );
      }
    );

    parser.on(
      "close",
      () => {
        if (
          quantidadeArquivos >
          1
        ) {
          erroUpload =
            criarErro(
              "Envie apenas uma imagem.",
              "LIMIT_FILE_COUNT"
            );
        }

        concluir(
          erroUpload
        );
      }
    );

    req.on(
      "aborted",
      () => {
        parser.destroy();
      }
    );

    req.pipe(parser);
  };
}

module.exports = {
  single,
};
