const db = require(
  "../db/db"
);

function normalizarId(
  valor
) {
  const id =
    Number(valor);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

function obterExecutor(
  executor
) {
  if (
    executor &&
    typeof executor.query ===
      "function"
  ) {
    return executor;
  }

  return db;
}

/*
 * Procura um negócio pelo slug,
 * independentemente de estar publicado.
 *
 * Utilizado para garantir que a URL
 * pública não seja duplicada.
 */
async function buscarNegocioPorSlug(
  slug,
  executor = db
) {
  const slugLimpo =
    String(
      slug ?? ""
    )
      .trim()
      .toLowerCase();

  if (!slugLimpo) {
    return null;
  }

  const conexao =
    obterExecutor(
      executor
    );

  const resultado =
    await conexao.query(
      `
      SELECT
        id,
        nome,
        slug,
        ativo,
        publicado,
        created_at,
        updated_at

      FROM negocios

      WHERE slug = $1

      LIMIT 1
      `,
      [
        slugLimpo,
      ]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

/*
 * Verifica se a conta já possui
 * vínculo ativo como dona.
 *
 * Neste momento, o fluxo permite
 * somente um negócio principal
 * por conta.
 */
async function buscarNegocioDoDono(
  usuarioId,
  executor = db
) {
  const id =
    normalizarId(
      usuarioId
    );

  if (!id) {
    return null;
  }

  const conexao =
    obterExecutor(
      executor
    );

  const resultado =
    await conexao.query(
      `
      SELECT
        n.id,
        n.nome,
        n.slug,
        n.descricao,
        n.setor,
        COALESCE(
          n.areas,
          ARRAY[]::TEXT[]
        ) AS areas,
        n.whatsapp,
        n.foto_url,
        n.foto_public_id,
        n.cidade,
        n.estado,
        n.bairro,
        n.endereco,
        n.numero,
        n.complemento,
        n.cep,
        n.localizacao_url,
        n.latitude,
        n.longitude,
        n.fuso_horario,
        n.ativo,
        n.publicado,
        n.created_at,
        n.updated_at,

        un.id
          AS vinculo_id,

        un.papel,

        un.created_at
          AS vinculado_em

      FROM usuarios_negocios un

      INNER JOIN negocios n
        ON n.id = un.negocio_id

      WHERE un.usuario_id = $1
        AND un.papel = 'dono'
        AND un.ativo = TRUE
        AND n.ativo = TRUE

      ORDER BY
        un.created_at ASC,
        n.id ASC

      LIMIT 1
      `,
      [
        id,
      ]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

/*
 * Insere somente o negócio.
 *
 * Deve ser chamada dentro de uma
 * transação quando houver criação
 * simultânea do vínculo de dono.
 */
async function criarNegocio(
  dados,
  executor = db
) {
  const conexao =
    obterExecutor(
      executor
    );

  const resultado =
    await conexao.query(
      `
      INSERT INTO negocios (
        nome,
        slug,
        descricao,
        setor,
        whatsapp,
        foto_url,
        foto_public_id,
        cidade,
        estado,
        bairro,
        endereco,
        numero,
        complemento,
        cep,
        localizacao_url,
        latitude,
        longitude,
        fuso_horario,
        areas,
        ativo,
        publicado
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        TRUE,
        FALSE
      )

      RETURNING
        id,
        nome,
        slug,
        descricao,
        setor,
        whatsapp,
        foto_url,
        foto_public_id,
        cidade,
        estado,
        bairro,
        endereco,
        numero,
        complemento,
        cep,
        localizacao_url,
        latitude,
        longitude,
        fuso_horario,
        COALESCE(areas, ARRAY[]::TEXT[]) AS areas,
        ativo,
        publicado,
        created_at,
        updated_at
      `,
      [
        dados.nome,
        dados.slug,
        dados.descricao || null,
        dados.setor || null,
        dados.whatsapp || null,
        dados.foto_url || null,
        dados.foto_public_id || null,
        dados.cidade || null,
        dados.estado || null,
        dados.bairro || null,
        dados.endereco || null,
        dados.numero || null,
        dados.complemento || null,
        dados.cep || null,
        dados.localizacao_url || null,
        dados.latitude ?? null,
        dados.longitude ?? null,
        dados.fuso_horario ||
          "America/Sao_Paulo",
        dados.areas || [],
      ]
    );

  return resultado.rows[0];
}

/*
 * Cria o vínculo entre uma conta
 * e um negócio.
 */
async function criarVinculoDono(
  {
    usuarioId,
    negocioId,
  },
  executor = db
) {
  const idUsuario =
    normalizarId(
      usuarioId
    );

  const idNegocio =
    normalizarId(
      negocioId
    );

  if (
    !idUsuario ||
    !idNegocio
  ) {
    throw new TypeError(
      "Usuário ou negócio inválido para criação do vínculo."
    );
  }

  const conexao =
    obterExecutor(
      executor
    );

  const resultado =
    await conexao.query(
      `
      INSERT INTO usuarios_negocios (
        usuario_id,
        negocio_id,
        papel,
        ativo
      )
      VALUES (
        $1,
        $2,
        'dono',
        TRUE
      )

      RETURNING
        id,
        usuario_id,
        negocio_id,
        papel,
        ativo,
        created_at,
        updated_at
      `,
      [
        idUsuario,
        idNegocio,
      ]
    );

  return resultado.rows[0];
}

/*
 * Cria o negócio e o vínculo de dono
 * dentro da mesma transação.
 *
 * Se qualquer INSERT falhar,
 * nenhuma alteração permanece no banco.
 */
async function criarNegocioComDono({
  usuarioId,
  negocio,
}) {
  const idUsuario =
    normalizarId(
      usuarioId
    );

  if (!idUsuario) {
    throw new TypeError(
      "Usuário inválido para criação do negócio."
    );
  }

  return db.executarTransacao(
    async (
      client
    ) => {
      /*
       * Bloqueia a conta durante a
       * transação para reduzir risco
       * de criações simultâneas.
       */
      const usuarioResultado =
        await client.query(
          `
          SELECT
            id,
            ativo

          FROM usuarios

          WHERE id = $1

          FOR UPDATE
          `,
          [
            idUsuario,
          ]
        );

      const usuario =
        usuarioResultado
          .rows[0];

      if (!usuario) {
        const erro =
          new Error(
            "Usuário não encontrado."
          );

        erro.code =
          "USUARIO_NAO_ENCONTRADO";

        throw erro;
      }

      if (
        usuario.ativo === false
      ) {
        const erro =
          new Error(
            "Conta desativada."
          );

        erro.code =
          "USUARIO_INATIVO";

        throw erro;
      }

      const negocioExistente =
        await buscarNegocioDoDono(
          idUsuario,
          client
        );

      if (negocioExistente) {
        const erro =
          new Error(
            "Esta conta já possui um negócio."
          );

        erro.code =
          "DONO_JA_POSSUI_NEGOCIO";

        erro.negocio =
          negocioExistente;

        throw erro;
      }

      const negocioCriado =
        await criarNegocio(
          negocio,
          client
        );

      const vinculoCriado =
        await criarVinculoDono(
          {
            usuarioId:
              idUsuario,

            negocioId:
              negocioCriado.id,
          },
          client
        );

      return {
        negocio: {
          ...negocioCriado,

          papel:
            vinculoCriado.papel,

          vinculo_id:
            vinculoCriado.id,

          vinculado_em:
            vinculoCriado.created_at,
        },

        vinculo:
          vinculoCriado,
      };
    }
  );
}

module.exports = {
  buscarNegocioPorSlug,
  buscarNegocioDoDono,
  criarNegocio,
  criarVinculoDono,
  criarNegocioComDono,
};
