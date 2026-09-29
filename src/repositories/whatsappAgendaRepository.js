const db = require("../db/db");
const {
  sqlPossuiDisponibilidadeAgendavel,
  sqlPossuiPrimeiroAgendamentoValido,
} = require("./ativacaoSql");

async function negocioTemAgendaConfigurada(
  negocioId
) {
  const id = Number(
    negocioId
  );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return false;
  }

  const result = await db.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM usuarios_negocios un
        INNER JOIN usuarios u
          ON u.id = un.usuario_id
        INNER JOIN agenda_configuracoes ac
          ON ac.profissional_id =
            un.usuario_id
          AND ac.negocio_id =
            un.negocio_id
        WHERE un.negocio_id = $1
          AND un.ativo = TRUE
          AND u.ativo = TRUE
          AND un.papel IN (
            'dono',
            'profissional'
          )
          AND ac.origem_horarios =
            'personalizado'
      ) AS configurada
    `,
    [id]
  );

  return Boolean(
    result.rows[0]?.configurada
  );
}

async function negocioPodeDivulgarParaPrimeiroAgendamento(
  negocioId
) {
  const id = Number(
    negocioId
  );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return false;
  }

  const result = await db.query(
    `
      SELECT (
        n.ativo = TRUE
        AND n.publicado = TRUE
        AND EXISTS (
          SELECT 1
          FROM servicos_negocio s
          WHERE s.negocio_id = n.id
            AND s.ativo = TRUE
        )
        AND ${sqlPossuiDisponibilidadeAgendavel(
          "n.id"
        )}
        AND NOT ${sqlPossuiPrimeiroAgendamentoValido(
          "n.id"
        )}
      ) AS pode_divulgar
      FROM negocios n
      WHERE n.id = $1
      LIMIT 1
    `,
    [id]
  );

  return Boolean(
    result.rows[0]
      ?.pode_divulgar
  );
}

module.exports = {
  negocioTemAgendaConfigurada,
  negocioPodeDivulgarParaPrimeiroAgendamento,
};
