const fs = require("fs");
const path = require("path");

describe("migration da fundação de ML no-show", () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      "../database/migrations/082_ml_no_show_data_foundation.sql"
    ),
    "utf8"
  );

  test("armazena atributos operacionais auditáveis e rótulo explícito", () => {
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS ml_agendamento_no_show_amostras"
    );
    expect(sql).toContain("rotulo_falta BOOLEAN");
    expect(sql).toContain(
      "ml_no_show_rotulo_timestamp_check"
    );
    expect(sql).toContain(
      "REFERENCES agendamentos(id)"
    );
  });

  test("não cria colunas com PII ou texto livre", () => {
    const definicaoTabela = sql
      .split("CREATE TABLE IF NOT EXISTS ml_agendamento_no_show_amostras")[1]
      .split("CREATE INDEX IF NOT EXISTS")[0];

    expect(definicaoTabela).not.toMatch(
      /cliente_nome|whatsapp|telefone|email|observacoes/i
    );
  });
});
