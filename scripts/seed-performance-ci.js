const { Client } = require("pg");
async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (process.env.NODE_ENV !== "test" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/agenda_fashion_test") {
    throw new Error("Seed de performance exige PostgreSQL local de testes.");
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    const plan = await client.query("SELECT id FROM planos WHERE ativo = TRUE ORDER BY id LIMIT 1");
    if (!plan.rowCount) throw new Error("Nenhum plano ativo no banco de teste.");
    const user = await client.query("INSERT INTO usuarios (nome,email,senha,whatsapp,ativo,email_verificado_em) VALUES ($1,$2,$3,$4,TRUE,NOW()) RETURNING id", ["Profissional Performance", "performance-ci@agendafashion.test", "ci-password-not-used", "11999990000"]);
    const business = await client.query("INSERT INTO negocios (nome,slug,descricao,setor,whatsapp,cidade,estado,ativo,publicado,areas,plano_id) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,TRUE,$8,$9) RETURNING id", ["Studio Performance", "performance-ci", "Estúdio de beleza para teste de desempenho", "Beleza", "11999990000", "São Paulo", "SP", ["Unhas"], plan.rows[0].id]);
    await client.query("INSERT INTO usuarios_negocios (usuario_id,negocio_id,papel,ativo) VALUES ($1,$2,'dono',TRUE)", [user.rows[0].id,business.rows[0].id]);
    await client.query("INSERT INTO servicos_negocio (negocio_id,nome,descricao,valor,duracao_minutos,ativo) VALUES ($1,'Manicure','Serviço de manicure',50,60,TRUE)", [business.rows[0].id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { await client.end(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
