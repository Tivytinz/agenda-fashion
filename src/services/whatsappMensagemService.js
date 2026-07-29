const whatsappMensagemRepository = require(
  "../repositories/whatsappMensagemRepository"
);

const whatsappProvider = require(
  "../providers/whatsappProvider"
);

const CONFIGURACOES_TEMPLATE = {
  NOVO_AGENDAMENTO_PROFISSIONAL: {
    variavel:
      "WHATSAPP_TEMPLATE_NOVO_AGENDAMENTO",
    padrao:
      "novo_agendamento",
  },

  CONFIRMACAO_AGENDAMENTO_CLIENTE: {
    variavel:
      "WHATSAPP_TEMPLATE_CONFIRMACAO_CLIENTE",
    padrao:
      "confirmacao_agendamento_cliente",
  },

  LEMBRETE_AGENDAMENTO_CLIENTE: {
    variavel:
      "WHATSAPP_TEMPLATE_LEMBRETE_CLIENTE",
    padrao:
      "lembrete_agendamento_cliente",
  },

  CANCELAMENTO_AGENDAMENTO_PROFISSIONAL: {
    variavel:
      "WHATSAPP_TEMPLATE_CANCELAMENTO_PROFISSIONAL",
    padrao:
      "cancelamento_agendamento_profissional",
  },

  CANCELAMENTO_AGENDAMENTO_CLIENTE: {
    variavel:
      "WHATSAPP_TEMPLATE_CANCELAMENTO_CLIENTE",
    padrao:
      "cancelamento_agendamento_cliente",
  },
};

let workerEmExecucao =
  false;

let temporizadorWorker =
  null;

function configuracaoBooleana(
  nome,
  valorPadrao = false
) {
  const valor =
    process.env[nome];

  if (
    valor === undefined ||
    valor === null ||
    String(valor).trim() === ""
  ) {
    return valorPadrao;
  }

  return [
    "1",
    "true",
    "sim",
    "yes",
  ].includes(
    String(valor)
      .trim()
      .toLowerCase()
  );
}

function obterInteiroConfiguracao(
  nome,
  valorPadrao,
  {
    minimo = 1,
    maximo =
      Number.MAX_SAFE_INTEGER,
  } = {}
) {
  const valor =
    Number(
      process.env[nome]
    );

  if (
    !Number.isInteger(valor) ||
    valor < minimo ||
    valor > maximo
  ) {
    return valorPadrao;
  }

  return valor;
}

function notificacoesWhatsappAtivas() {
  if (
    process.env.NODE_ENV ===
    "test"
  ) {
    return false;
  }

  return configuracaoBooleana(
    "WHATSAPP_NOTIFICATIONS_ENABLED",
    false
  );
}

function obterAntecedenciaLembrete() {
  return obterInteiroConfiguracao(
    "WHATSAPP_REMINDER_HOURS",
    24,
    {
      minimo: 1,
      maximo: 168,
    }
  );
}

function obterNomeTemplate(
  tipo
) {
  const configuracao =
    CONFIGURACOES_TEMPLATE[tipo];

  if (!configuracao) {
    const erro =
      new Error(
        `Tipo de mensagem do WhatsApp não suportado: ${tipo}.`
      );

    erro.code =
      "WHATSAPP_MESSAGE_TYPE_UNSUPPORTED";

    throw erro;
  }

  return (
    String(
      process.env[
        configuracao.variavel
      ] ||
      configuracao.padrao
    ).trim()
  );
}

function obterCodigoIdioma() {
  return String(
    process.env
      .WHATSAPP_TEMPLATE_LANGUAGE ||
    "pt_BR"
  ).trim();
}

function mensagemErroSegura(
  erro
) {
  const status =
    erro?.response?.status ||
    erro?.status ||
    null;

  const codigo =
    erro?.response
      ?.data
      ?.error
      ?.code ||
    erro?.code ||
    null;

  const mensagem =
    erro?.response
      ?.data
      ?.error
      ?.message ||
    erro?.message ||
    "Erro desconhecido.";

  return [
    status
      ? `HTTP ${status}`
      : null,

    codigo
      ? `código ${codigo}`
      : null,

    String(mensagem)
      .replace(
        /Bearer\s+\S+/gi,
        "Bearer [REMOVIDO]"
      )
      .slice(
        0,
        1500
      ),
  ]
    .filter(Boolean)
    .join(" - ");
}

function obterAtrasoNovaTentativa(
  tentativas
) {
  const expoente =
    Math.max(
      0,
      Number(tentativas) - 1
    );

  const minutos =
    Math.min(
      60,
      2 ** expoente
    );

  return minutos * 60;
}

function obterMetaMessageId(
  resposta
) {
  return (
    resposta
      ?.messages
      ?.[0]
      ?.id ||
    null
  );
}

async function enfileirarNovoAgendamento({
  executor,
  agendamentoId,
}) {
  return whatsappMensagemRepository
    .enfileirarNovoAgendamento(
      executor,
      agendamentoId,
      obterAntecedenciaLembrete()
    );
}

async function enfileirarCancelamento({
  executor,
  agendamentoId,
}) {
  return whatsappMensagemRepository
    .enfileirarCancelamento(
      executor,
      agendamentoId
    );
}

async function processarMensagem(
  mensagem
) {
  const valida =
    await whatsappMensagemRepository
      .mensagemContinuaValida(
        mensagem.id
      );

  if (!valida) {
    await whatsappMensagemRepository
      .marcarCancelada(
        mensagem.id,
        "O estado atual do agendamento não permite o envio."
      );

    return {
      id: mensagem.id,
      status: "CANCELED",
    };
  }

  try {
    const resposta =
      await whatsappProvider
        .enviarTemplate({
          numero:
            mensagem.destinatario,

          nomeTemplate:
            obterNomeTemplate(
              mensagem.tipo
            ),

          codigoIdioma:
            obterCodigoIdioma(),

          parametrosCorpo:
            Array.isArray(
              mensagem.parametros_corpo
            )
              ? mensagem
                  .parametros_corpo
              : [],
        });

    await whatsappMensagemRepository
      .marcarEnviada(
        mensagem.id,
        obterMetaMessageId(
          resposta
        )
      );

    console.info(
      "[WhatsApp] Mensagem aceita pela Meta.",
      {
        mensagem_id:
          mensagem.id,
        agendamento_id:
          mensagem.agendamento_id,
        tipo:
          mensagem.tipo,
      }
    );

    return {
      id: mensagem.id,
      status: "SENT",
    };
  } catch (
    erro
  ) {
    const erroSeguro =
      mensagemErroSegura(
        erro
      );

    await whatsappMensagemRepository
      .marcarFalha(
        mensagem,
        erroSeguro,
        obterAtrasoNovaTentativa(
          mensagem.tentativas
        )
      );

    console.error(
      "[WhatsApp] Falha ao enviar mensagem.",
      {
        mensagem_id:
          mensagem.id,
        agendamento_id:
          mensagem.agendamento_id,
        tipo:
          mensagem.tipo,
        tentativa:
          mensagem.tentativas,
        erro:
          erroSeguro,
      }
    );

    return {
      id: mensagem.id,
      status: "FAILED",
    };
  }
}

async function processarFilaWhatsapp({
  limite,
} = {}) {
  if (
    workerEmExecucao
  ) {
    return {
      ignorado: true,
      processadas: 0,
    };
  }

  workerEmExecucao =
    true;

  const tamanhoLote =
    Number.isInteger(limite) &&
    limite > 0
      ? Math.min(
          limite,
          100
        )
      : obterInteiroConfiguracao(
          "WHATSAPP_WORKER_BATCH_SIZE",
          20,
          {
            minimo: 1,
            maximo: 100,
          }
        );

  let processadas =
    0;

  try {
    await whatsappMensagemRepository
      .cancelarMensagensExpiradas();

    while (
      processadas <
      tamanhoLote
    ) {
      const mensagem =
        await whatsappMensagemRepository
          .reservarProximaMensagem();

      if (!mensagem) {
        break;
      }

      await processarMensagem(
        mensagem
      );

      processadas += 1;
    }

    return {
      ignorado: false,
      processadas,
    };
  } finally {
    workerEmExecucao =
      false;
  }
}

function iniciarWorkerWhatsapp() {
  if (
    !notificacoesWhatsappAtivas()
  ) {
    console.info(
      "[WhatsApp] Worker desativado. Defina WHATSAPP_NOTIFICATIONS_ENABLED=true após aprovar os templates."
    );

    return null;
  }

  if (
    temporizadorWorker
  ) {
    return temporizadorWorker;
  }

  const intervalo =
    obterInteiroConfiguracao(
      "WHATSAPP_WORKER_INTERVAL_MS",
      30000,
      {
        minimo: 5000,
        maximo: 300000,
      }
    );

  const executar = () => {
    processarFilaWhatsapp()
      .catch(
        (erro) => {
          console.error(
            "[WhatsApp] Erro inesperado no worker.",
            {
              mensagem:
                mensagemErroSegura(
                  erro
                ),
            }
          );
        }
      );
  };

  executar();

  temporizadorWorker =
    setInterval(
      executar,
      intervalo
    );

  if (
    typeof temporizadorWorker
      .unref ===
    "function"
  ) {
    temporizadorWorker
      .unref();
  }

  console.info(
    "[WhatsApp] Worker iniciado.",
    {
      intervalo_ms:
        intervalo,
    }
  );

  return temporizadorWorker;
}

function pararWorkerWhatsapp() {
  if (
    temporizadorWorker
  ) {
    clearInterval(
      temporizadorWorker
    );

    temporizadorWorker =
      null;
  }
}

module.exports = {
  enfileirarNovoAgendamento,
  enfileirarCancelamento,
  processarFilaWhatsapp,
  iniciarWorkerWhatsapp,
  pararWorkerWhatsapp,
  notificacoesWhatsappAtivas,
  obterNomeTemplate,
};
