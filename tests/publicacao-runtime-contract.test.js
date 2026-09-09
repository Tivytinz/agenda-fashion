const fs = require("fs");
const path = require("path");

function ler(relativo) {
  return fs.readFileSync(
    path.join(__dirname, "..", relativo),
    "utf8"
  );
}

describe("contrato canônico de publicação e ativação", () => {
  const runtime = ler(
    "src/repositories/servicosRepository.js"
  );
  const saude = ler(
    "src/repositories/adminSaasHealthRepository.js"
  );
  const migration = ler(
    "database/migrations/064_admin_analytics_v2.sql"
  );

  test("mantém dados essenciais alinhados entre runtime, saúde e backfill", () => {
    const criterios = [
      /COALESCE\([^\n]*whatsapp[^\n]*, ''\) ~ '\^\[0-9\]\{10,11\}\$'/i,
      /NULLIF\(BTRIM\([^\n]*cidade[^\n]*\), ''\) IS NOT NULL/i,
      /UPPER\(BTRIM\(COALESCE\([^\n]*estado[^\n]*, ''\)\)\) IN/i,
      /NULLIF\(BTRIM\([^\n]*bairro[^\n]*\), ''\) IS NOT NULL/i,
      /NULLIF\(BTRIM\([^\n]*endereco[^\n]*\), ''\) IS NOT NULL/i,
      /NULLIF\(BTRIM\([^\n]*numero[^\n]*\), ''\) IS NOT NULL/i,
      /COALESCE\([^\n]*cep[^\n]*, ''\) ~ '\^\[0-9\]\{8\}\$'/i,
      /NULLIF\(BTRIM\(COALESCE\([^\n]*localizacao_url[^\n]*, ''\)\), ''\) IS NOT NULL/i,
    ];

    for (const criterio of criterios) {
      expect(runtime).toMatch(criterio);
      expect(saude).toMatch(criterio);
      expect(migration).toMatch(criterio);
    }
  });

  test("não reintroduz agenda ou descrição como gate de publicação", () => {
    const blocoRuntime = runtime.match(
      /async function sincronizarPublicacaoAutomatica[\s\S]*?return result\.rows\[0\] \|\| null;/
    )?.[0] || "";

    expect(blocoRuntime).not.toMatch(/configurado_em/i);
    expect(blocoRuntime).not.toMatch(/agenda_configurada/i);
    expect(blocoRuntime).not.toMatch(/descricao/i);
    expect(blocoRuntime).not.toMatch(/publicacao_exige_agenda\s*=\s*TRUE/i);
  });

  test("saúde permanece em cinco etapas e termina no primeiro agendamento não cancelado", () => {
    expect(saude).toMatch(/etapas_concluidas\s*<\s*5/i);
    expect(saude).toMatch(/etapas_concluidas\s*=\s*5/i);
    expect(saude).not.toMatch(/etapas_concluidas\s*<\s*6/i);
    expect(saude).not.toMatch(/etapas_concluidas\s*=\s*6/i);
    expect(saude).toMatch(
      /COALESCE\(a\.status, 'agendado'\) <> 'cancelado'/i
    );
  });
});
