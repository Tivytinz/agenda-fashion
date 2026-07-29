const fs = require("fs");
const path = require("path");

const DIRETORIO_HTML = path.resolve(
  __dirname,
  "../agendamento-nails/html"
);

const CAMINHO_REFRESH = path.resolve(
  __dirname,
  "../agendamento-nails/css/refresh.css"
);

function listarPaginas() {
  return fs
    .readdirSync(DIRETORIO_HTML)
    .filter((arquivo) =>
      arquivo.endsWith(".html")
    )
    .sort();
}

describe(
  "design system do frontend",
  () => {
    test(
      "aplica a experiência compartilhada em todas as páginas",
      () => {
        const paginas =
          listarPaginas();

        expect(paginas).toHaveLength(
          22
        );

        paginas.forEach(
          (pagina) => {
            const html =
              fs.readFileSync(
                path.join(
                  DIRETORIO_HTML,
                  pagina
                ),
                "utf8"
              );

            expect(
              html
            ).toContain(
              'href="../css/refresh.css?v=2026.1"'
            );

            expect(
              html
            ).toContain(
              'name="theme-color"'
            );

            expect(
              html
            ).toContain(
              'content="#d92f7f"'
            );

            expect(
              html
            ).toMatch(
              /data-af-tela="[a-z0-9_]+"/
            );

            expect(
              html
            ).toMatch(
              /data-af-missao="[a-z0-9_]+"/
            );

            expect(
              html
            ).toContain(
              'src="../js/analytics.js"'
            );
          }
        );
      }
    );

    test(
      "mantém identidade, responsividade e acessibilidade",
      () => {
        const css =
          fs.readFileSync(
            CAMINHO_REFRESH,
            "utf8"
          );

        expect(css).toContain(
          "--af-primary: #d92f7f"
        );

        expect(css).toContain(
          "--af-gradient:"
        );

        expect(css).toContain(
          "@media (max-width: 820px)"
        );

        expect(css).toContain(
          "prefers-reduced-motion: reduce"
        );

        expect(css).toContain(
          ":focus-visible"
        );
      }
    );
  }
);
