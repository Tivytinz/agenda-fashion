const fs = require("fs");
const path = require("path");

describe("migração da publicação sem descrição obrigatória", () => {
  test("publica somente negócios afetados que já podem ser descobertos", () => {
    const migration = fs.readFileSync(
      path.join(
        __dirname,
        "../database/migrations/047_publicacao_sem_descricao_obrigatoria.sql"
      ),
      "utf8"
    );

    expect(migration).toMatch(/n\.publicado\s*=\s*FALSE/i);
    expect(migration).toMatch(/n\.descricao[\s\S]*IS NULL/i);
    expect(migration).toMatch(/servicos_negocio[\s\S]*s\.ativo\s*=\s*TRUE/i);
    expect(migration).toMatch(/n\.whatsapp\s*~/i);
    expect(migration).toMatch(/n\.cidade/i);
    expect(migration).toMatch(/n\.estado/i);
  });
});
