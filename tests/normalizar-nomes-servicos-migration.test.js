const fs = require("fs");
const path = require("path");

describe("migração dos nomes de serviços", () => {
  test("remove apenas marcadores iniciais e preserva nomes válidos", () => {
    const migration = fs.readFileSync(
      path.join(
        __dirname,
        "../database/migrations/050_normalizar_nomes_servicos.sql"
      ),
      "utf8"
    );

    expect(migration).toMatch(/UPDATE servicos_negocio/i);
    expect(migration).toMatch(/REGEXP_REPLACE[\s\S]*\^\[\[:space:\]•·▪◦\]\+/i);
    expect(migration).toMatch(/CHAR_LENGTH[\s\S]*BETWEEN 2 AND 120/i);
  });
});
