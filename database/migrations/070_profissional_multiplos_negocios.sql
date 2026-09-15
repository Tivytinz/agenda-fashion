BEGIN;

/*
 * O domínio atual permite que uma mesma profissional atue em um ou mais
 * negócios. A unicidade do vínculo continua garantida por
 * usuarios_negocios_vinculo_unico (usuario_id, negocio_id).
 *
 * Este índice parcial vinha da modelagem inicial e impedia mais de um vínculo
 * ativo com papel profissional para a mesma conta, mesmo em negócios distintos.
 */
DROP INDEX IF EXISTS usuarios_negocios_profissional_ativo_unique;

COMMENT ON TABLE usuarios_negocios IS
  'Vínculos contextuais entre contas e negócios. Uma mesma conta pode possuir vínculos ativos em mais de um negócio.';

COMMIT;
