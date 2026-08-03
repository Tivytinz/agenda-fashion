const express = require(
  "express"
);

const request = require(
  "supertest"
);

const {
  criarLimitador,
} = require(
  "../src/middlewares/rateLimits"
);

const upload = require(
  "../src/middlewares/upload"
);

describe(
  "Proteção contra abuso e uploads",
  () => {
    test(
      "bloqueia requisições acima do limite",
      async () => {
        const app =
          express();

        app.use(
          criarLimitador({
            limite: 2,
            janelaMs:
              60_000,
            mensagem:
              "Limite atingido.",
            ignorarEmTeste:
              false,
          })
        );

        app.get(
          "/teste",
          (_req, res) =>
            res.json({
              ok: true,
            })
        );

        expect(
          (
            await request(app)
              .get("/teste")
          ).status
        ).toBe(200);

        expect(
          (
            await request(app)
              .get("/teste")
          ).status
        ).toBe(200);

        const bloqueada =
          await request(app)
            .get("/teste");

        expect(
          bloqueada.status
        ).toBe(429);
      }
    );

    test(
      "aceita uma imagem permitida em memória",
      async () => {
        const app =
          express();

        app.post(
          "/upload",
          upload.single(
            "foto"
          ),
          (req, res) =>
            res.json({
              mimetype:
                req.file
                  ?.mimetype,
              tamanho:
                req.file
                  ?.size,
            })
        );

        const resposta =
          await request(app)
            .post("/upload")
            .attach(
              "foto",
              Buffer.from(
                [
                  0x89,
                  0x50,
                  0x4e,
                  0x47,
                  0x0d,
                  0x0a,
                  0x1a,
                  0x0a,
                  0x00,
                ]
              ),
              {
                filename:
                  "foto.png",
                contentType:
                  "image/png",
              }
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          resposta.body
        ).toEqual({
          mimetype:
            "image/png",
          tamanho: 9,
        });
      }
    );

    test(
      "recusa conteúdo falso disfarçado de imagem",
      async () => {
        const app =
          express();

        app.post(
          "/upload",
          upload.single(
            "foto"
          ),
          (_req, res) =>
            res.sendStatus(204)
        );

        app.use(
          (
            erro,
            _req,
            res,
            _next
          ) =>
            res
              .status(
                erro.statusCode ||
                500
              )
              .json({
                codigo:
                  erro.code,
              })
        );

        const resposta =
          await request(app)
            .post("/upload")
            .attach(
              "foto",
              Buffer.from(
                "não é uma imagem"
              ),
              {
                filename:
                  "foto.png",
                contentType:
                  "image/png",
              }
            );

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body
        ).toEqual({
          codigo:
            "INVALID_FILE_CONTENT",
        });
      }
    );

    test(
      "recusa tipo de arquivo não permitido",
      async () => {
        const app =
          express();

        app.post(
          "/upload",
          upload.single(
            "foto"
          ),
          (_req, res) =>
            res.sendStatus(204)
        );

        app.use(
          (
            erro,
            _req,
            res,
            _next
          ) =>
            res
              .status(
                erro.statusCode ||
                500
              )
              .json({
                erro:
                  erro.message,
              })
        );

        const resposta =
          await request(app)
            .post("/upload")
            .attach(
              "foto",
              Buffer.from(
                "texto"
              ),
              {
                filename:
                  "arquivo.txt",
                contentType:
                  "text/plain",
              }
            );

        expect(
          resposta.status
        ).toBe(400);
      }
    );
  }
);
