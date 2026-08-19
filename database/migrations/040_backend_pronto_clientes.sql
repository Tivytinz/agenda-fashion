BEGIN;

/*
 * Consultas do dashboard filtram sempre negocio, evento e periodo.
 * O indice anterior cobria negocio e data, mas ainda precisava filtrar
 * o nome do evento depois de localizar todas as linhas do negocio.
 */
CREATE INDEX IF NOT EXISTS
  eventos_produto_negocio_nome_data_idx
ON eventos_produto (
  negocio_id,
  nome,
  created_at DESC
)
WHERE negocio_id IS NOT NULL;

/*
 * O catalogo calcula nota e quantidade somente sobre avaliacoes reais.
 * Este indice evita percorrer agendamentos sem avaliacao para cada card.
 */
CREATE INDEX IF NOT EXISTS
  agendamentos_avaliacoes_negocio_idx
ON agendamentos (
  negocio_id,
  avaliacao
)
WHERE avaliacao IS NOT NULL;

/* Filtros combinados de localidade usados pelo catalogo publico. */
CREATE INDEX IF NOT EXISTS
  negocios_publicos_localidade_idx
ON negocios (
  LOWER(cidade),
  UPPER(estado),
  nome,
  id
)
WHERE ativo = TRUE
  AND publicado = TRUE;

COMMIT;
