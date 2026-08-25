const fs = require("fs");
const path = require("path");

describe("migration de consentimento auditável do Google", () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      "../database/migrations/056_consentimento_google_auditavel.sql"
    ),
    "utf8"
  );

  test("registra estado explícito, revogação e histórico append-only", () => {
    expect(sql).toContain(
      "google_consentimento_status BOOLEAN"
    );
    expect(sql).toContain(
      "google_revogado_em TIMESTAMPTZ"
    );
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS\n  marketing_google_consentimentos"
    );
    expect(sql).toContain(
      "texto_versao VARCHAR(60)"
    );
    expect(sql).toContain(
      "marketing_google_consentimentos_usuario_data_idx"
    );
    expect(sql).toContain(
      "marketing_usuario_atribuicoes_google_estado_coerente"
    );
    expect(sql).not.toContain(
      "client_id VARCHAR(120)"
    );
  });
});
