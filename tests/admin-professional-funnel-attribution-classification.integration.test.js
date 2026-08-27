const crypto = require(
  "crypto"
);
const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/adminProfessionalFunnelRepository"
);

function suffix() {
  return crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "classificação da atribuição do funil profissional",
  () => {
    let usuarioId;

    afterEach(async () => {
      if (!usuarioId) return;

      await db.query(
        `DELETE FROM usuarios WHERE id = $1`,
        [usuarioId]
      );
      usuarioId = null;
    });

    test(
      "cadastro sem qualquer evidência não é rotulado como orgânico",
      async () => {
        const id = suffix();
        const usuario = await db.query(
          `
          INSERT INTO usuarios (
            nome,
            email,
            senha,
            whatsapp
          )
          VALUES (
            $1,
            $2,
            'hash-teste',
            '62999999999'
          )
          RETURNING id, created_at
          `,
          [
            `Sem Evidencia ${id}`,
            `sem-evidencia-${id}@example.com`,
          ]
        );

        usuarioId = Number(usuario.rows[0].id);

        await db.query(
          `
          INSERT INTO marketing_usuario_atribuicoes (
            usuario_id,
            intencao,
            atribuicao_em
          )
          VALUES ($1, 'profissional', $2)
          `,
          [usuarioId, usuario.rows[0].created_at]
        );

        const linhas =
          await repository.listarPorCampanha("today");

        const encontrada = linhas.find(
          (item) =>
            item.classificacao_atribuicao ===
              "rastreamento_incompleto" &&
            Number(item.cadastros) >= 1
        );

        expect(encontrada).toMatchObject({
          origem: "desconhecida",
          midia: "desconhecida",
          campanha: "(sem campanha)",
          classificacao_atribuicao:
            "rastreamento_incompleto",
        });
      }
    );
  }
);
