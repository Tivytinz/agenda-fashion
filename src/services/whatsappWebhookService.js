const whatsappMensagemRepository = require(
  "../repositories/whatsappMensagemRepository"
);

const whatsappProvider = require(
  "../providers/whatsappProvider"
);
const registrador = require(
  "../utils/registrador"
);

const STATUS_SUPORTADOS =
  new Set([
    "sent",
    "delivered",
    "read",
    "failed",
  ]);

const COMANDOS_OPTOUT_GLOBAL =
  new Set([
    "sair",
    "parar",
    "stop",
    "unsubscribe",
  ]);

const COMANDOS_OPTOUT_MARKETING =
  new Set([
    "parar marketing",
    "cancelar marketing",
    "nao quero receber marketing",
  ]);

const PADROES_INTENCAO_OPTOUT = [
  /\bnao (?:quero|desejo|aceito)\b/,
  /\bnao (?:me )?(?:mande|envie)\b/,
  /\b(?:pare|parar|cancele|cancelar)\b/,
  /\bdescadastr(?:ar|e|o)\b/,
  /\b(?:remova|remover|retire|retirar|tire|tirar|bloqueie|bloquear)\b/,
  /\bquero sair\b/,
];

const PADRAO_CONTEXTO_COMUNICACAO =
  /\b(?:mensagens?|avisos?|notificac(?:ao|oes)|comunicac(?:ao|oes)|whatsapp|contatos?|envios?|lista)\b/;

const PADRAO_CONTEXTO_MARKETING =
  /\b(?:marketing|propagandas?|promoc(?:ao|oes)|ofertas?)\b/;

const PADRAO_RECUSA_OPTOUT =
  /\bnao (?:quero|desejo|pretendo) (?:mais )?(?:parar|cancelar|descadastrar|remover|retirar|bloquear)\b/;

const PADROES_OPTOUT_DIRETO = [
  /^(?:por favor )?(?:me )?descadastr(?:e|ar)(?: do agenda fashion)?$/,
  /^(?:por favor )?(?:eu )?quero sair(?: do agenda fashion)?$/,
  /^(?:por favor )?solicito (?:o )?descadastro(?: do agenda fashion)?$/,
];

const RESPOSTAS_QUEBRA_GELO =
  new Map([
    [
      "como funciona o agenda fashion",
      {
        intencao:
          "COMO_FUNCIONA",
        texto:
          "💅 O Agenda Fashion ajuda profissionais de beleza a criar uma agenda online, divulgar serviços e receber agendamentos automaticamente. A cliente escolhe o serviço, a data e o horário pelo seu link, e você acompanha tudo pelo painel.\n\nConheça: https://app.agendafashion.com.br",
      },
    ],
    [
      "quero criar minha agenda online",
      {
        intencao:
          "CRIAR_AGENDA",
        texto:
          "Que bom ter você aqui! 💗 Você pode começar gratuitamente e criar sua agenda online neste link:\n\nhttps://app.agendafashion.com.br/cadastro?tipo=profissional",
      },
    ],
    [
      "quais sao os planos disponiveis",
      {
        intencao: "PLANOS",
        texto:
          "O Agenda Fashion possui estes planos:\n\n💗 Grátis — R$ 0/mês\n💅 Autônoma — R$ 49,90/mês\n✨ Studio — R$ 99,90/mês\n🏢 Salão — R$ 199,90/mês\n\nCompare os benefícios: https://app.agendafashion.com.br/planos",
      },
    ],
    [
      "preciso de ajuda",
      {
        intencao: "AJUDA",
        texto:
          "Claro! 💗 Envie sua dúvida para contato@agendafashion.com.br e informe, se possível, seu nome e o nome do negócio. Nossa equipe responderá pelo e-mail.",
      },
    ],
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

function extrairMensagensRecebidas(
  payload
) {
  const encontradas = [];

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
        const mensagem of
          alteracao?.value
            ?.messages || []
      ) {
        const texto =
          mensagem?.text?.body ||
          mensagem?.button?.text ||
          mensagem?.button?.payload ||
          mensagem?.interactive
            ?.button_reply?.title ||
          mensagem?.interactive
            ?.button_reply?.id ||
          mensagem?.interactive
            ?.list_reply?.title ||
          mensagem?.interactive
            ?.list_reply?.id ||
          "";

        if (
          mensagem?.id &&
          mensagem?.from &&
          texto
        ) {
          encontradas.push({
            id: mensagem.id,
            from:
              mensagem.from,
            texto,
            timestamp:
              mensagem.timestamp,
            phoneNumberId:
              alteracao?.value
                ?.metadata
                ?.phone_number_id ||
              null,
          });
        }
      }
    }
  }

  return encontradas;
}

function normalizarComando(
  texto
) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function obterEscopoDescadastro(
  texto
) {
  const comando =
    normalizarComando(
      texto
    );

  if (
    PADRAO_RECUSA_OPTOUT
      .test(comando)
  ) {
    return null;
  }

  if (
    COMANDOS_OPTOUT_MARKETING
      .has(comando) ||
    (
      PADRAO_CONTEXTO_MARKETING
        .test(comando) &&
      PADROES_INTENCAO_OPTOUT
        .some(
          (padrao) =>
            padrao.test(
              comando
            )
        )
    )
  ) {
    return "MARKETING";
  }

  if (
    COMANDOS_OPTOUT_GLOBAL
      .has(comando)
  ) {
    return "GLOBAL";
  }

  const pedidoDireto =
    PADROES_OPTOUT_DIRETO
      .some(
        (padrao) =>
          padrao.test(
            comando
          )
      );

  const pedidoComContexto =
    PADRAO_CONTEXTO_COMUNICACAO
      .test(comando) &&
    PADROES_INTENCAO_OPTOUT
      .some(
        (padrao) =>
          padrao.test(
            comando
          )
      );

  if (
    pedidoDireto ||
    pedidoComContexto
  ) {
    return "GLOBAL";
  }

  return null;
}

function ehPedidoDescadastro(
  texto
) {
  return Boolean(
    obterEscopoDescadastro(
      texto
    )
  );
}

function obterIntencaoDescadastro(
  escopo
) {
  return escopo === "GLOBAL"
    ? "GLOBAL_OPTOUT"
    : "MARKETING_OPTOUT";
}

function obterConfirmacaoDescadastro(
  escopo,
  resultado
) {
  const houveAlteracao =
    resultado.usuarios > 0 ||
    resultado.mensagensCanceladas > 0;

  if (escopo === "GLOBAL") {
    return houveAlteracao
      ? "Todas as mensagens automáticas do Agenda Fashion foram desativadas para este número. Para voltar a receber, autorize novamente em sua conta ou em um novo agendamento."
      : "Não existem mensagens automáticas ativas para este número no Agenda Fashion.";
  }

  return resultado.usuarios > 0
    ? "As orientações de marketing do Agenda Fashion foram desativadas. Avisos operacionais de agendamentos seguem a preferência da sua conta."
    : "Não existem orientações de marketing ativas para este número no Agenda Fashion.";
}

function respostasAutomaticasAtivas() {
  return String(
    process.env
      .WHATSAPP_CONVERSATION_AUTOREPLIES_ENABLED ||
    ""
  ).toLowerCase() === "true";
}

function mensagemPertenceAoNumeroConfigurado(
  mensagem
) {
  const numeroConfigurado =
    String(
      process.env
        .WHATSAPP_PHONE_NUMBER_ID ||
      ""
    ).trim();

  if (!numeroConfigurado) {
    return true;
  }

  return (
    String(
      mensagem?.phoneNumberId ||
      ""
    ) === numeroConfigurado
  );
}

function obterRespostaQuebraGelo(
  texto
) {
  return (
    RESPOSTAS_QUEBRA_GELO.get(
      normalizarComando(texto)
    ) || null
  );
}

function metaMessageIdResposta(
  resultado
) {
  return (
    resultado?.messages?.[0]?.id ||
    null
  );
}

function enviarRespostaRegistrada(
  interacao,
  destinatario,
  texto
) {
  Promise.resolve(
    whatsappProvider
      .enviarMensagem(
        destinatario,
        texto
      )
  )
    .then((resultado) =>
      whatsappMensagemRepository
        .marcarInteracaoRespondida(
          interacao.id,
          metaMessageIdResposta(
            resultado
          )
        )
    )
    .catch(async (erro) => {
      try {
        await whatsappMensagemRepository
          .marcarInteracaoFalha(
            interacao.id,
            erro?.message
          );
      } catch (erroRegistro) {
        registrador.aviso(
          "WhatsApp: não foi possível registrar a falha da resposta automática.",
          erroRegistro?.message
        );
      }

      registrador.aviso(
        "WhatsApp: não foi possível enviar a resposta automática.",
        erro?.message
      );
    });
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

async function processarWebhookWhatsapp(
  payload
) {
  const resultadoStatus =
    await processarStatusWhatsapp(
      payload
    );

  const recebidas =
    extrairMensagensRecebidas(
      payload
    );

  let descadastros = 0;
  let respostasQuebraGelo = 0;

  for (
    const mensagem of recebidas
  ) {
    if (
      !mensagemPertenceAoNumeroConfigurado(
        mensagem
      )
    ) {
      continue;
    }

    const escopoDescadastro =
      obterEscopoDescadastro(
        mensagem.texto
      );

    const pedidoDescadastro =
      Boolean(
        escopoDescadastro
      );

    const respostaQuebraGelo =
      obterRespostaQuebraGelo(
        mensagem.texto
      );

    if (
      !pedidoDescadastro &&
      (!respostaQuebraGelo ||
        !respostasAutomaticasAtivas())
    ) {
      continue;
    }

    const intencao =
      pedidoDescadastro
        ? obterIntencaoDescadastro(
            escopoDescadastro
          )
        : respostaQuebraGelo
            .intencao;

    const interacao =
      await whatsappMensagemRepository
        .registrarInteracaoRecebida({
          metaMessageId:
            mensagem.id,
          telefone:
            mensagem.from,
          intencao,
          recebidoEm:
            dataEvento(
              mensagem.timestamp
            ),
        });

    if (!interacao) {
      continue;
    }

    if (!pedidoDescadastro) {
      respostasQuebraGelo += 1;

      enviarRespostaRegistrada(
        interacao,
        mensagem.from,
        respostaQuebraGelo
          .texto
      );

      continue;
    }

    const resultado =
      escopoDescadastro ===
      "GLOBAL"
        ? await whatsappMensagemRepository
            .cancelarTodasComunicacoesPorWhatsapp(
              mensagem.from
            )
        : await whatsappMensagemRepository
            .cancelarMarketingPorWhatsapp(
              mensagem.from
            );

    if (
      resultado.usuarios > 0
    ) {
      descadastros +=
        resultado.usuarios;
    }

    const confirmacao =
      obterConfirmacaoDescadastro(
        escopoDescadastro,
        resultado
      );

    enviarRespostaRegistrada(
      interacao,
      mensagem.from,
      confirmacao
    );
  }

  return {
    ...resultadoStatus,
    mensagensRecebidas:
      recebidas.length,
    descadastros,
    respostasQuebraGelo,
  };
}

module.exports = {
  extrairStatus,
  extrairMensagensRecebidas,
  ehPedidoDescadastro,
  obterEscopoDescadastro,
  obterRespostaQuebraGelo,
  respostasAutomaticasAtivas,
  processarStatusWhatsapp,
  processarWebhookWhatsapp,
};
