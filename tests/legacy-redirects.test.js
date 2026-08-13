const request = require("supertest");
const app = require("../src/server");

describe(
  "redirecionamentos legados",
  () => {
    it.each([
      ["/app", "/"],
      ["/app/painel", "/painel"],
      [
        "/app/painel/agenda",
        "/painel/agenda",
      ],
      ["/login", "/entrar"],
      ["/admin.html", "/painel"],
      [
        "/agenda-geral.html",
        "/painel/agenda",
      ],
      ["/inicio.html", "/"],
      [
        "/dashboard-profissional.html",
        "/profissional/agenda",
      ],
      [
        "/dashboard-dono.html",
        "/painel",
      ],
    ])(
      "redireciona %s para %s",
      async (
        origem,
        destino
      ) => {
        const resposta =
          await request(app)
            .get(origem);

        expect(
          resposta.status
        ).toBe(301);

        expect(
          resposta.headers.location
        ).toBe(destino);
      }
    );

    it(
      "preserva parâmetros de atribuição em rota /app aninhada",
      async () => {
        const resposta =
          await request(app).get(
            "/app/painel/agenda?utm_source=google&utm_campaign=lancamento&gclid=abc123"
          );

        expect(
          resposta.status
        ).toBe(301);

        expect(
          resposta.headers.location
        ).toBe(
          "/painel/agenda?utm_source=google&utm_campaign=lancamento&gclid=abc123"
        );
      }
    );

    it(
      "preserva parâmetros de atribuição em links html antigos",
      async () => {
        const resposta =
          await request(app).get(
            "/agenda-geral.html?utm_source=meta&utm_medium=cpc"
          );

        expect(
          resposta.headers.location
        ).toBe(
          "/painel/agenda?utm_source=meta&utm_medium=cpc"
        );
      }
    );

    it(
      "não transforma segmento codificado em redirecionamento externo",
      async () => {
        const resposta =
          await request(app).get(
            "/app/%2F%2Fexample.com"
          );

        expect(
          resposta.status
        ).toBe(301);

        expect(
          resposta.headers.location
        ).toBe(
          "/%2F%2Fexample.com"
        );
      }
    );
  }
);
