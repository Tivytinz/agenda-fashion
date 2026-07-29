const whatsappMensagemRepository = require(
  "../repositories/whatsappMensagemRepository"
);

const STATUS_SUPORTADOS =
  new Set([
    "sent",
    "delivered",
    "read",
    "failed",
  ]);

function extrairStatus(
  payload
) {
  const encontrados = [];

  for (
    const entrada of
      payload?.entry || []
  ) {
    for (
      const alteracao of
        entrada?.changes || []
    ) {
      if (
        alteracao?.field !==
        "messages"
      ) {
        continue;
      }

      for (
        const status of
          alteracao?.value
            ?.statuses || []
      ) {
        if (
          status?.id &&
          STATUS_SUPORTADOS.has(
            status?.status
          )
        ) {
          encontrados.push(status);
        }
      }
    }
  }

  return encontrados;
}

function dataEvento(
  timestamp
) {
  const segundos =
    Number(timestamp);

  if (
    Number.isFinite(segundos) &&
    segundos > 0
  ) {
    return new Date(
      segundos * 1000
    );
  }

  return new Date();
}

function descricaoErro(
  erro
) {
  if (!erro) {
    return null;
  }

  return [
    erro.title,
    erro.message,
    erro.error_data?.details,
  ]
    .filter(Boolean)
    .join(" - ")
    .slice(0, 2000);
}

async function processarStatusWhatsapp(
  payload
) {
  const statuses =
    extrairStatus(payload);

  let atualizados = 0;

  for (
    const status of statuses
  ) {
    const erro =
      status.errors?.[0] ||
      null;

    const mensagem =
      await whatsappMensagemRepository
        .registrarStatusEntrega({
          metaMessageId:
            status.id,
          status:
            status.status,
          ocorridoEm:
            dataEvento(
              status.timestamp
            ),
          codigoErro:
            erro?.code || null,
          tituloErro:
            descricaoErro(erro),
        });

    if (mensagem) {
      atualizados += 1;
    }
  }

  return {
    eventos:
      statuses.length,
    atualizados,
  };
}

module.exports = {
  extrairStatus,
  processarStatusWhatsapp,
};
