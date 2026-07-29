/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://app.agendafashion.com.br/html/inicio.html"}
 */

const fs = require(
  "fs"
);

const path = require(
  "path"
);

const CAMINHO =
  path.resolve(
    __dirname,
    "../agendamento-nails/js/analytics.js"
  );

function executarAnalytics() {
  const codigo =
    fs.readFileSync(
      CAMINHO,
      "utf8"
    );

  const executar =
    new Function(
      "window",
      "document",
      "sessionStorage",
      "localStorage",
      "CustomEvent",
      codigo
    );

  executar(
    window,
    document,
    sessionStorage,
    localStorage,
    window.CustomEvent
  );
}

async function aguardarFetch() {
  for (
    let tentativa = 0;
    tentativa < 50;
    tentativa += 1
  ) {
    if (
      window.fetch
        .mock
        .calls
        .length > 0
    ) {
      return;
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          2
        )
    );
  }

  throw new Error(
    "O evento não foi enviado."
  );
}

describe(
  "analytics do frontend",
  () => {
    beforeEach(
      () => {
        document.body.innerHTML =
          "<main></main>";

        document.body.dataset
          .afTela =
            "inicio";

        document.body.dataset
          .afMissao =
            "descobrir_servico";

        sessionStorage.clear();
        localStorage.clear();

        window.AF_CONFIG = {
          API_URL:
            "https://app.agendafashion.com.br",
        };

        window.fetch =
          jest.fn(
            async () => ({
              ok:
                true,
              status:
                202,
            })
          );
      }
    );

    afterEach(
      () => {
        delete window
          .AFAnalytics;

        delete window
          .AF_CONFIG;
      }
    );

    test(
      "registra a missão da tela sem enviar o termo pesquisado",
      async () => {
        executarAnalytics();

        document.dispatchEvent(
          new window.Event(
            "DOMContentLoaded"
          )
        );

        window.AFAnalytics
          .registrar(
            "busca_realizada",
            {
              propriedades: {
                termo_presente:
                  true,
                resultados:
                  8,
                termo_digitado:
                  "manicure perto de casa",
              },
            }
          );

        await aguardarFetch();

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              5
            )
        );

        const corpos =
          window.fetch
            .mock
            .calls
            .map(
              ([
                ,
                opcoes,
              ]) =>
                JSON.parse(
                  opcoes.body
                )
            );

        expect(
          corpos
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              nome:
                "tela_visualizada",
              pagina:
                "inicio",
              missao:
                "descobrir_servico",
            }),
            expect.objectContaining({
              nome:
                "busca_realizada",
              propriedades:
                expect.objectContaining({
                  termo_presente:
                    true,
                  resultados:
                    8,
                }),
            }),
          ])
        );

        expect(
          JSON.stringify(
            corpos
          )
        ).not.toContain(
          "manicure perto de casa"
        );
      }
    );
  }
);
