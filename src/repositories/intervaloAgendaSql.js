// Aliases obrigatórios: a (reserva), n_agendamento (negócio original) e
// negocio_contexto (agenda consultada). Nenhum dado identificador externo é exposto.
const INICIO_SQL = `COALESCE(
  a.inicio_previsto_em,
  (a.data::timestamp + a.horario::time) AT TIME ZONE
    COALESCE(NULLIF(BTRIM(n_agendamento.fuso_horario), ''), 'America/Sao_Paulo')
)`;
const FUSO_SQL = `COALESCE(NULLIF(BTRIM(negocio_contexto.fuso_horario), ''), 'America/Sao_Paulo')`;
const INICIO_LOCAL_SQL = `(${INICIO_SQL} AT TIME ZONE ${FUSO_SQL})`;
const FIM_LOCAL_SQL = `((${INICIO_SQL} + make_interval(mins => COALESCE(
  a.duracao_minutos,
  (SELECT duracao_minutos FROM servicos_negocio WHERE id = a.servico_id),
  0
))) AT TIME ZONE ${FUSO_SQL})`;

// Reservas encerradas continuam visíveis na data inicial; reservas ativas que
// começaram antes da janela também ocupam seus pontos até o fim exclusivo.
function periodoAgendaSql(inicioParametro, fimParametro) {
  return `(
  ${INICIO_LOCAL_SQL}::date BETWEEN ${inicioParametro}::date AND ${fimParametro}::date
  OR (a.status IN ('agendado', 'confirmado')
    AND ${INICIO_LOCAL_SQL} < (${fimParametro}::date + 1)
    AND ${FIM_LOCAL_SQL} > ${inicioParametro}::date)
)`;
}
const PERIODO_AGENDA_SQL = periodoAgendaSql("$3", "$4");
const PERIODO_EQUIPE_SQL = periodoAgendaSql("$2", "$3");

module.exports = { FIM_LOCAL_SQL, PERIODO_AGENDA_SQL, PERIODO_EQUIPE_SQL };
