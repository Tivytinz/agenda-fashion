const fs = require("fs");
const path = require("path");

describe("migração da categoria Bronzeamento", () => {
  test("libera a categoria e reclassifica somente serviços compatíveis", () => {
    const migration = fs.readFileSync(
      path.join(
        __dirname,
        "../database/migrations/049_categoria_bronzeamento.sql"
      ),
      "utf8"
    );

    expect(migration).toMatch(
      /categoria IN \([\s\S]*'bronzeamento'/i
    );
    expect(migration).toMatch(
      /WHERE \(\s*categoria IS NULL\s*OR categoria = 'outro'\s*\)[\s\S]*bronzeamento/i
    );
    expect(migration).toMatch(
      /SET categoria = 'bronzeamento'/i
    );
    expect(migration).toMatch(
      /ARRAY_APPEND\([\s\S]*'Bronzeamento'/i
    );
  });
});
