const FUSO_HORARIO_PADRAO = "America/Sao_Paulo";

function textoFusoHorario(valor) {
  return String(valor ?? "").trim();
}

function fusoHorarioValido(valor) {
  const fusoHorario = textoFusoHorario(valor);

  if (!fusoHorario || fusoHorario.length > 80) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: fusoHorario,
    }).format(new Date(0));

    return true;
  } catch (_erro) {
    return false;
  }
}

function resolverFusoHorario(valor) {
  const fusoHorario = textoFusoHorario(valor);

  return fusoHorarioValido(fusoHorario)
    ? fusoHorario
    : FUSO_HORARIO_PADRAO;
}

function obterDataHoraNoFuso(
  fusoHorario,
  dataReferencia = new Date()
) {
  const fusoResolvido =
    resolverFusoHorario(fusoHorario);

  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fusoResolvido,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(dataReferencia);

  const obterParte = (tipo) =>
    partes.find((parte) => parte.type === tipo)?.value;

  return {
    data: `${obterParte("year")}-${obterParte("month")}-${obterParte("day")}`,
    hora: `${obterParte("hour")}:${obterParte("minute")}`,
    segundo: obterParte("second") || "00",
    fusoHorario: fusoResolvido,
  };
}

module.exports = {
  FUSO_HORARIO_PADRAO,
  fusoHorarioValido,
  resolverFusoHorario,
  obterDataHoraNoFuso,
};
