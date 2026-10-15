// RN50: vínculo preservado autoriza somente reservas atribuídas à própria
// pessoa durante esse vínculo. Remoção e novo convite não recuperam o histórico
// de um vínculo anterior. Os aliases a/un/n/u são obrigatórios nos consumidores.
const VINCULO_RESTRITO_SQL = `
  un.papel = 'profissional'
  AND un.ativo = FALSE
  AND u.ativo = TRUE
  AND u.encerrado_definitivo_em IS NULL
  AND n.ativo = TRUE
  AND n.arquivado_em IS NULL
  AND a.profissional_id = un.usuario_id
  AND a.negocio_id = un.negocio_id
  AND a.created_at >= un.created_at
  AND (
    un.motivo_inatividade IS NULL
    OR un.motivo_inatividade IN (
      'aguardando_vaga_plano', 'excedente_limite_plano'
    )
  )
`;

module.exports = { VINCULO_RESTRITO_SQL };
