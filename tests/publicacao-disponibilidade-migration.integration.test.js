const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("../src/db/db");
const { sincronizarPublicacaoAutomatica } = require("../src/repositories/servicosRepository");
const { avaliarPublicacao } = require("../src/services/configuracoesService");

function migration(name) {
  return fs.readFileSync(path.join(__dirname, "../database/migrations", name), "utf8");
}

describe("migração da publicação e disponibilidade automática", () => {
  afterAll(() => db.end());

  test("backfill e runtime concordam sem publicar localização inválida nem sobrescrever horários personalizados", async () => {
    const client = await db.connect();
    const schema = `af_publicacao_${crypto.randomBytes(8).toString("hex")}`;
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(`
        CREATE TABLE usuarios (id INT PRIMARY KEY, ativo BOOLEAN DEFAULT TRUE);
        CREATE TABLE negocios (
          id INT PRIMARY KEY, ativo BOOLEAN DEFAULT TRUE, publicado BOOLEAN DEFAULT FALSE,
          publicacao_exige_agenda BOOLEAN DEFAULT TRUE, primeira_publicacao_em TIMESTAMPTZ,
          updated_at TIMESTAMPTZ DEFAULT NOW(), nome TEXT DEFAULT 'Studio Teste',
          areas TEXT[] DEFAULT ARRAY['Unhas'], setor TEXT DEFAULT 'Unhas',
          whatsapp TEXT DEFAULT '62999999999', cidade TEXT DEFAULT 'Goiânia', estado TEXT DEFAULT 'GO',
          bairro TEXT DEFAULT 'Centro', endereco TEXT DEFAULT 'Rua das Flores', numero TEXT DEFAULT '10',
          cep TEXT DEFAULT '74000123', localizacao_url TEXT
        );
        CREATE TABLE servicos_negocio (negocio_id INT, ativo BOOLEAN DEFAULT TRUE);
        CREATE TABLE usuarios_negocios (usuario_id INT, negocio_id INT, ativo BOOLEAN DEFAULT TRUE, papel TEXT DEFAULT 'dono');
        CREATE TABLE agenda_configuracoes (
          profissional_id INT PRIMARY KEY, configurado_em TIMESTAMPTZ,
          duracao_padrao INT, intervalo_minutos INT, antecedencia_agendamento INT, antecedencia_cancelamento INT
        );
        CREATE TABLE agenda_horarios (
          profissional_id INT, dia_semana SMALLINT, trabalha BOOLEAN, hora_inicio TIME, hora_fim TIME,
          intervalo_inicio TIME, intervalo_fim TIME, PRIMARY KEY (profissional_id, dia_semana)
        );
      `);
      const cases = [
        ["https://maps.google.com/?q=studio", true],
        ["HTTP://maps.example.com/local", true],
        [" https://maps.app.goo.gl/abc ", true],
        ["valor-legado-nao-vazio", false],
        ["javascript:alert(1)", false],
        ["ftp://maps.example.com", false],
        ["https://", false],
        ["https:///sem-host", false],
        ["https://maps.example.com/local com espaco", false],
        [null, false]
      ];
      for (const [index, [url]] of cases.entries()) {
        const id = index + 1;
        await client.query("INSERT INTO usuarios (id) VALUES ($1)", [id]);
        await client.query("INSERT INTO negocios (id, localizacao_url) VALUES ($1, $2)", [id, url]);
        await client.query("INSERT INTO servicos_negocio (negocio_id) VALUES ($1)", [id]);
        await client.query("INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES ($1, $1)", [id]);
      }
      await client.query(`
        INSERT INTO agenda_configuracoes (profissional_id, configurado_em) VALUES (1, NULL), (2, '2026-08-01T12:00:00Z');
        INSERT INTO agenda_horarios (profissional_id, dia_semana, trabalha, hora_inicio, hora_fim)
        VALUES (1, 1, TRUE, '09:00', '17:00'), (2, 1, TRUE, '10:00', '16:00');
      `);
      // Executa o bloco real de onboarding da 064; a criação completa de analytics
      // também é executada pelo gate de migrations antes desta suíte.
      const onboarding = migration("064_admin_analytics_v2.sql").split("CREATE TABLE analytics_visitantes")[0];
      await client.query(`${onboarding}\nCOMMIT;`);
      await client.query(migration("065_disponibilidade_padrao_automatica.sql"));

      const backfill = await client.query("SELECT *, TRUE AS possui_servico_ativo FROM negocios ORDER BY id");
      for (const [index, row] of backfill.rows.entries()) {
        const expected = cases[index][1];
        expect({ url: row.localizacao_url, publicado: row.publicado }).toEqual({ url: cases[index][0], publicado: expected });
        expect(avaliarPublicacao(row).pode_publicar).toBe(expected);
        await client.query("UPDATE negocios SET publicado = FALSE WHERE id = $1", [row.id]);
        expect((await sincronizarPublicacaoAutomatica(row.id, client)).publicado).toBe(expected);
      }
      const horarios = await client.query("SELECT profissional_id, hora_inicio::TEXT FROM agenda_horarios WHERE dia_semana = 1 ORDER BY profissional_id");
      expect(horarios.rows.slice(0, 3)).toEqual([
        { profissional_id: 1, hora_inicio: "08:00:00" },
        { profissional_id: 2, hora_inicio: "10:00:00" },
        { profissional_id: 3, hora_inicio: "08:00:00" }
      ]);
      const configs = await client.query("SELECT COUNT(*)::INT AS total FROM agenda_configuracoes WHERE configurado_em IS NOT NULL");
      expect(configs.rows[0].total).toBe(cases.length);
    } finally {
      await client.query("ROLLBACK");
      await client.query("SET search_path TO public");
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      client.release();
    }
  });
});
