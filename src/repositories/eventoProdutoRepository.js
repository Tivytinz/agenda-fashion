const db = require(
  "../db/db"
);

async function registrar({
  nome,
  pagina,
  missao,
  sessaoId,
  usuarioId,
  negocioId,
  propriedades,
}) {
  try {
    const resultado =
      await db.query(
        `
        INSERT INTO eventos_produto (
          nome,
          pagina,
          missao,
          sessao_id,
          usuario_id,
          negocio_id,
          propriedades
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          (
            SELECT id
            FROM usuarios
            WHERE id = $5
          ),
          (
            SELECT id
            FROM negocios
            WHERE id = $6
          ),
          $7::JSONB
        )

        RETURNING id
        `,
        [
          nome,
          pagina,
          missao,
          sessaoId,
          usuarioId,
          negocioId,
          JSON.stringify(
            propriedades
          ),
        ]
      );

    return resultado
      .rows[0];
  } catch (erro) {
    /*
     * Permite publicar o código antes
     * da migration sem afetar as telas.
     * Assim que a tabela existir, os
     * eventos passam a ser persistidos.
     */
    if (
      erro?.code ===
      "42P01"
    ) {
      return null;
    }

    throw erro;
  }
}

module.exports = {
  registrar,
};
