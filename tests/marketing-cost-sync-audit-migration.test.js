const fs = require("fs");
const path = require("path");

describe("migration de reconciliação auditável das campanhas externas", () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      "../database/migrations/057_reconciliacao_campanhas_custos.sql"
    ),
    "utf8"
  );

  test("mantém execuções antigas sem prova de cobertura completa", () => {
    expect(sql).toContain(
      "reconciliacao_campanhas_completa BOOLEAN NOT NULL DEFAULT FALSE"
    );
    expect(sql).toContain(
      "campanhas externas operacionais"
    );
    expect(sql).not.toMatch(
      /UPDATE\s+marketing_custo_sincronizacoes/i
    );
  });
});
