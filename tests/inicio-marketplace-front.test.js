/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"http://localhost/html/inicio.html"}
 */

function esperarRenderizacao() {
  return new Promise(
    (resolve, reject) => {
      let tentativas = 0;

      const verificar = () => {
        if (
          document.querySelector(
            ".card-servico-home"
          ) &&
          document.querySelector(
            ".card-negocio"
          )
        ) {
          resolve();
          return;
        }

        tentativas += 1;

        if (tentativas > 100) {
          reject(
            new Error(
              "A home não renderizou o catálogo."
            )
          );
          return;
        }

        setTimeout(
          verificar,
          5
        );
      };

      verificar();
    }
  );
}

describe(
  "home do marketplace",
  () => {
    beforeEach(
      () => {
        jest.resetModules();

        document.body.innerHTML = `
          <input id="campoBusca">
          <div id="filtrosCategorias">
            <button data-categoria="" class="ativo">Todos</button>
            <button data-categoria="unha">Unhas</button>
            <button data-categoria="cabelo">Cabelo</button>
          </div>
          <span id="totalServicos"></span>
          <span id="totalNegocios"></span>
          <div id="mensagemHome"></div>
          <div id="listaServicosHome"></div>
          <div id="listaNegocios"></div>
        `;

        window.API_URL =
          "https://api.teste";

        Object.defineProperty(
          navigator,
          "geolocation",
          {
            configurable: true,
            value: undefined,
          }
        );

        global.fetch =
          jest.fn()
            .mockResolvedValue({
              ok: true,
              status: 200,
              json:
                jest.fn()
                  .mockResolvedValue({
                    negocios: [
                      {
                        id: 1,
                        nome: "Studio Bella",
                        slug: "studio-bella",
                        cidade: "Goiânia",
                        bairro: "Centro",
                        servicos: [
                          {
                            id: 10,
                            nome: "Alongamento de unhas",
                            valor: "120.00",
                            duracao_minutos: 90,
                          },
                        ],
                      },
                      {
                        id: 2,
                        nome: "Espaço Hair",
                        slug: "espaco-hair",
                        cidade: "Goiânia",
                        bairro: "Bueno",
                        servicos: [
                          {
                            id: 20,
                            nome: "Corte de cabelo",
                            valor: "80.00",
                            duracao_minutos: 45,
                          },
                        ],
                      },
                    ],
                  }),
            });
      }
    );

    afterEach(
      () => {
        delete window.API_URL;
        delete global.fetch;
        localStorage.clear();
        jest.clearAllMocks();
      }
    );

    test(
      "mostra negócios e serviços com dados para agendamento",
      async () => {
        require(
          "../agendamento-nails/js/inicio.js"
        );

        document.dispatchEvent(
          new Event(
            "DOMContentLoaded"
          )
        );

        await esperarRenderizacao();

        expect(
          document.querySelectorAll(
            ".card-servico-home"
          )
        ).toHaveLength(2);

        expect(
          document.querySelectorAll(
            ".card-negocio"
          )
        ).toHaveLength(2);

        expect(
          document.getElementById(
            "listaServicosHome"
          ).textContent
        ).toContain(
          "Alongamento de unhas"
        );

        expect(
          document.getElementById(
            "listaServicosHome"
          ).textContent
        ).toContain(
          "R$ 120,00"
        );

        expect(
          document.getElementById(
            "totalServicos"
          ).textContent
        ).toBe(
          "2 serviços"
        );
      }
    );

    test(
      "filtra as duas fileiras pela categoria escolhida",
      async () => {
        require(
          "../agendamento-nails/js/inicio.js"
        );

        document.dispatchEvent(
          new Event(
            "DOMContentLoaded"
          )
        );

        await esperarRenderizacao();

        document.querySelector(
          '[data-categoria="unha"]'
        ).click();

        expect(
          document.querySelectorAll(
            ".card-servico-home"
          )
        ).toHaveLength(1);

        expect(
          document.getElementById(
            "listaServicosHome"
          ).textContent
        ).toContain(
          "Alongamento de unhas"
        );

        expect(
          document.getElementById(
            "listaNegocios"
          ).textContent
        ).toContain(
          "Studio Bella"
        );

        expect(
          document.getElementById(
            "listaNegocios"
          ).textContent
        ).not.toContain(
          "Espaço Hair"
        );
      }
    );
  }
);
