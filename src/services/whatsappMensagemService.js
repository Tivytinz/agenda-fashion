const whatsappMensagemRepository = require(
  "../repositories/whatsappMensagemRepository"
);

const whatsappProvider = require(
  "../providers/whatsappProvider"
);
const registrador = require("../utils/registrador");
const {
  CONFIGURACOES_TEMPLATE,
  obterNomeTemplate,
} = require(
  "../config/whatsappTemplates"
);

let workerEmExecucao =
  false;

let temporizadorWorker =
  null;

let ultimaVarreduraLembretesNegocioEm =
  0;

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

function lembreteProfissionalAtivo() {
  return configuracaoBooleana(
    "WHATSAPP_PROFESSIONAL_REMINDER_ENABLED",
    false
  );
}

function lembretePrimeiroServicoAtivo() {
  return configuracaoBooleana(
    "WHATSAPP_FIRST_SERVICE_REMINDER_ENABLED",
    false
  );
}

function lembreteDivulgacaoAtivo() {
  return configuracaoBooleana(
    "WHATSAPP_SHARE_REMINDER_ENABLED",
    false
  );
}

function obterHoraLembretesNegocio() {
  return obterInteiroConfiguracao(
    "WHATSAPP_BUSINESS_REMINDER_HOUR",
    10,
    {
      minimo: 0,
      maximo: 23,
    }
  );
}

function obterCodigoIdioma() {
  return String(
    process.env
      .WHATSAPP_TEMPLATE_LANGUAGE ||
    "pt_BR"
  ).trim();
}

function validarConfiguracaoAtivacao() {
  whatsappProvider
    .validarConfiguracao();

  for (
    const nome of [
      "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
      "WHATSAPP_APP_SECRET",
    ]
  ) {
    if (
      !String(
        process.env[nome] ||
        ""
      ).trim()
    ) {
      const erro =
        new Error(
          `${nome} não configurado.`
        );

      erro.code =
        "WHATSAPP_CONFIGURATION_ERROR";

      throw erro;
    }
  }

  for (
    const tipo of
      Object.keys(
        CONFIGURACOES_TEMPLATE
      )
  ) {
    if (
      !obterNomeTemplate(
        tipo
      )
    ) {
      const erro =
        new Error(
          `Template vazio para ${tipo}.`
        );

      erro.code =
        "WHATSAPP_CONFIGURATION_ERROR";

      throw erro;
    }
  }
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

function erroEhRetentavel(
  erro
) {
  const status =
    Number(
      erro?.response?.status ||
      erro?.status
    );

  if (
    Number.isInteger(status)
  ) {
    return (
      [408, 425, 429]
        .includes(status) ||
      status >= 500
    );
  }

  const codigo =
    String(
      erro?.code ||
      ""
    ).toUpperCase();

  if (
    [
      "ECONNABORTED",
      "ECONNRESET",
      "ECONNREFUSED",
      "EAI_AGAIN",
      "ENETUNREACH",
      "ETIMEDOUT",
    ].includes(codigo)
  ) {
    return true;
  }

  return Boolean(
    erro?.request &&
    !erro?.response
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
      obterAntecedenciaLembrete(),
      lembreteProfissionalAtivo()
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

async function enfileirarLembretesDiariosNegocios() {
  const primeiroServicoAtivo =
    lembretePrimeiroServicoAtivo();

  const divulgacaoAtiva =
    lembreteDivulgacaoAtivo();

  if (
    !primeiroServicoAtivo &&
    !divulgacaoAtiva
  ) {
    return [];
  }

  const agora = Date.now();
  const intervaloVarredura =
    obterInteiroConfiguracao(
      "WHATSAPP_BUSINESS_REMINDER_SCAN_INTERVAL_MS",
      300000,
      {
        minimo: 60000,
        maximo: 3600000,
      }
    );

  if (
    agora - ultimaVarreduraLembretesNegocioEm <
    intervaloVarredura
  ) {
    return [];
  }

  const mensagens =
    await whatsappMensagemRepository
    .enfileirarLembretesDiariosNegocios(
      obterHoraLembretesNegocio(),
      primeiroServicoAtivo,
      divulgacaoAtiva
    );

  ultimaVarreduraLembretesNegocioEm =
    agora;

  return mensagens;
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

    registrador.informacao(
      "WhatsApp: mensagem aceita pela Meta.",
      {
        mensagem_id:
          mensagem.id,
        agendamento_id:
          mensagem.agendamento_id,
        negocio_id:
          mensagem.negocio_id,
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

    const retentavel =
      erroEhRetentavel(
        erro
      );

    await whatsappMensagemRepository
      .marcarFalha(
        mensagem,
        erroSeguro,
        obterAtrasoNovaTentativa(
          mensagem.tentativas
        ),
        retentavel
      );

    registrador.erro(
      "WhatsApp: falha ao enviar mensagem.",
      {
        mensagem_id:
          mensagem.id,
        agendamento_id:
          mensagem.agendamento_id,
        negocio_id:
          mensagem.negocio_id,
        tipo:
          mensagem.tipo,
        tentativa:
          mensagem.tentativas,
        retentavel,
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
    await enfileirarLembretesDiariosNegocios();

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
    registrador.informacao(
      "WhatsApp: processador de mensagens desativado. Defina WHATSAPP_NOTIFICATIONS_ENABLED=true para ativá-lo."
    );

    return null;
  }

  if (
    temporizadorWorker
  ) {
    return temporizadorWorker;
  }

  validarConfiguracaoAtivacao();

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
          registrador.erro(
            "WhatsApp: erro inesperado no processador de mensagens.",
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

  registrador.informacao(
    "WhatsApp: processador de mensagens iniciado.",
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
  enfileirarLembretesDiariosNegocios,
  processarFilaWhatsapp,
  iniciarWorkerWhatsapp,
  pararWorkerWhatsapp,
  notificacoesWhatsappAtivas,
  obterNomeTemplate,
  erroEhRetentavel,
  validarConfiguracaoAtivacao,
};
