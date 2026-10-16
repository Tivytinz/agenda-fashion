const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("../src/db/db");

afterAll(() => db.end());

test("migration 115 unifica papéis sem reativar vínculos nem reescrever auditoria", async () => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    // Reconstitui o contrato anterior dentro de uma transação descartável.
    await client.query("ALTER TABLE usuarios_administradores DROP CONSTRAINT usuarios_administradores_papel_check");
    await client.query("ALTER TABLE usuarios_administradores ADD CONSTRAINT usuarios_administradores_papel_check CHECK (papel IN ('admin','superadmin'))");
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const user = await client.query(
        "INSERT INTO usuarios (nome,email,senha,ativo) VALUES ('Migração admin',$1,'hash-teste',TRUE) RETURNING id",
        [`admin-migration-${crypto.randomUUID()}@agenda.test`]
      );
      ids.push(user.rows[0].id);
      await client.query("INSERT INTO usuarios_administradores (usuario_id,papel,ativo) VALUES ($1,$2,$3)",
        [ids[i], i === 0 ? "admin" : "superadmin", i !== 2]);
    }
    const attempt = crypto.randomUUID();
    await client.query(`INSERT INTO admin_auditoria_eventos
      (tentativa_id,fase,ator_usuario_id,papel_admin,acao,alvo_tipo)
      VALUES ($1,'INICIADA',$2,'superadmin','campanha_criar','campanha')`, [attempt, ids[1]]);
    const sql = fs.readFileSync(path.join(__dirname, "../database/migrations/115_papel_administrativo_unico.sql"), "utf8")
      .replace(/^BEGIN;\s*/m, "").replace(/^COMMIT;\s*/m, "");
    await client.query(sql);
    const result = await client.query("SELECT usuario_id,papel,ativo FROM usuarios_administradores WHERE usuario_id=ANY($1::int[]) ORDER BY usuario_id", [ids]);
    expect(result.rows.map((row) => [row.papel, row.ativo])).toEqual([
      ["admin", true], ["admin", true], ["admin", false],
    ]);
    const event = await client.query("SELECT papel_admin FROM admin_auditoria_eventos WHERE tentativa_id=$1", [attempt]);
    expect(event.rows[0].papel_admin).toBe("superadmin");
    await client.query("SAVEPOINT invalid_role");
    await expect(client.query("UPDATE usuarios_administradores SET papel='superadmin' WHERE usuario_id=$1", [ids[0]]))
      .rejects.toMatchObject({ code: "23514" });
    await client.query("ROLLBACK TO SAVEPOINT invalid_role");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
