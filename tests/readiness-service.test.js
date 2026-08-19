const fs = require("fs");
const os = require("os");
const path = require("path");

const readinessService = require(
  "../src/services/readinessService"
);

describe("readiness do banco", () => {
  test("descobre a migration mais recente sem valor fixo", () => {
    const pasta = fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "af-readiness-"
      )
    );

    fs.writeFileSync(
      path.join(pasta, "001_inicial.sql"),
      "SELECT 1;"
    );
    fs.writeFileSync(
      path.join(pasta, "041_nova.sql"),
      "SELECT 1;"
    );
    fs.writeFileSync(
      path.join(pasta, "README.md"),
      "ignorar"
    );

    expect(
      readinessService
        .obterVersaoEsperada(pasta)
    ).toBe(41);

    fs.rmSync(pasta, {
      recursive: true,
      force: true,
    });
  });

  test("recusa banco com migration pendente", async () => {
    const db = {
      query: jest.fn()
        .mockResolvedValue({
          rows: [
            {
              migration_atual: 39,
            },
          ],
        }),
    };

    await expect(
      readinessService
        .verificarBanco(db, 40)
    ).resolves.toEqual({
      pronto: false,
      migrationAtual: 39,
      versaoEsperada: 40,
    });
  });
});
