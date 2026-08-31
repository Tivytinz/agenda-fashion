const fs = require("fs");
const path = require("path");

describe("migration do gate de publicação dos novos negócios", () => {
  test("preserva negócios existentes e permite marcar somente novos cadastros", () => {
    const migration = fs.readFileSync(
      path.join(
        __dirname,
        "../database/migrations/060_publicacao_novos_negocios_com_agenda.sql"
      ),
      "utf8"
    );
    const repository = fs.readFileSync(
      path.join(
        __dirname,
        "../src/repositories/negocioRepository.js"
      ),
      "utf8"
    );

    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS\s+publicacao_exige_agenda\s+BOOLEAN\s+NOT NULL\s+DEFAULT FALSE/i
    );
    expect(migration).not.toMatch(
      /UPDATE\s+negocios[\s\S]*publicacao_exige_agenda\s*=\s*TRUE/i
    );
    expect(repository).toMatch(
      /publicacao_exige_agenda[\s\S]*FALSE,\s*TRUE\s*\)/i
    );
  });
});
