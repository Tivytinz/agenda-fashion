const axios = require("axios");

function validarConfiguracao() {
  const {
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_API_VERSION,
  } = process.env;

  if (!WHATSAPP_ACCESS_TOKEN) {
    throw new Error(
      "WHATSAPP_ACCESS_TOKEN não configurado no .env."
    );
  }

  if (!WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error(
      "WHATSAPP_PHONE_NUMBER_ID não configurado no .env."
    );
  }

  if (!WHATSAPP_API_VERSION) {
    throw new Error(
      "WHATSAPP_API_VERSION não configurado no .env."
    );
  }
}

function limparNumero(numero) {
  if (!numero) {
    return "";
  }

  return String(numero).replace(/\D/g, "");
}

function obterDestinatario(numeroRecebido) {
  /*
   * Enquanto estiver usando o ambiente
   * de testes da Meta, o número definido em
   * WHATSAPP_TEST_RECIPIENT será priorizado.
   *
   * Quando essa variável não existir,
   * será usado o número recebido pelo sistema.
   */
  const numero =
    process.env.WHATSAPP_TEST_RECIPIENT ||
    numeroRecebido;

  const numeroLimpo =
    limparNumero(numero);

  if (!numeroLimpo) {
    throw new Error(
      "Nenhum destinatário do WhatsApp foi informado."
    );
  }

  return numeroLimpo;
}

function obterUrlMensagens() {
  const {
    WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_API_VERSION,
  } = process.env;

  return (
    `https://graph.facebook.com/` +
    `${WHATSAPP_API_VERSION}/` +
    `${WHATSAPP_PHONE_NUMBER_ID}/messages`
  );
}

function criarParametroTexto(valor) {
  const texto =
    valor === null ||
    valor === undefined ||
    String(valor).trim() === ""
      ? "-"
      : String(valor).trim();

  return {
    type: "text",
    text: texto,
  };
}

function montarComponentesCorpo(
  parametrosCorpo
) {
  if (
    !Array.isArray(parametrosCorpo) ||
    parametrosCorpo.length === 0
  ) {
    return [];
  }

  return [
    {
      type: "body",

      parameters:
        parametrosCorpo.map(
          criarParametroTexto
        ),
    },
  ];
}

async function enviarRequisicao(payload) {
  validarConfiguracao();

  const {
    WHATSAPP_ACCESS_TOKEN,
  } = process.env;

  const url =
    obterUrlMensagens();

  try {
    const response =
      await axios.post(
        url,
        payload,
        {
          headers: {
            Authorization:
              `Bearer ${WHATSAPP_ACCESS_TOKEN}`,

            "Content-Type":
              "application/json",
          },

          timeout: 15000,
        }
      );

    console.log(
      "WhatsApp enviado com sucesso:"
    );

    console.log(
      JSON.stringify(
        response.data,
        null,
        2
      )
    );

    return response.data;
  } catch (erro) {
    console.error(
      "Erro ao enviar mensagem pelo WhatsApp."
    );

    if (erro.response) {
      console.error(
        "Status HTTP:",
        erro.response.status
      );

      console.error(
        "Resposta da Meta:",
        JSON.stringify(
          erro.response.data,
          null,
          2
        )
      );
    } else if (erro.request) {
      console.error(
        "A Meta não respondeu à solicitação:",
        erro.message
      );
    } else {
      console.error(
        "Erro ao preparar a solicitação:",
        erro.message
      );
    }

    throw erro;
  }
}

async function enviarTemplate({
  numero,
  nomeTemplate,
  codigoIdioma = "pt_BR",
  parametrosCorpo = [],
}) {
  if (!nomeTemplate) {
    throw new Error(
      "O nome do template do WhatsApp é obrigatório."
    );
  }

  const destinatario =
    obterDestinatario(numero);

  const componentes =
    montarComponentesCorpo(
      parametrosCorpo
    );

  const template = {
    name: nomeTemplate,

    language: {
      code: codigoIdioma,
    },
  };

  /*
   * Templates sem variáveis, como hello_world,
   * não precisam da propriedade components.
   */
  if (componentes.length > 0) {
    template.components =
      componentes;
  }

  const payload = {
    messaging_product:
      "whatsapp",

    recipient_type:
      "individual",

    to: destinatario,

    type: "template",

    template,
  };

  return enviarRequisicao(
    payload
  );
}

async function enviarNovoAgendamento(
  numero,
  parametrosCorpo
) {
  const nomeTemplate =
    process.env
      .WHATSAPP_TEMPLATE_NOVO_AGENDAMENTO ||
    "novo_agendamento";

  const codigoIdioma =
    process.env
      .WHATSAPP_TEMPLATE_LANGUAGE ||
    "pt_BR";

  return enviarTemplate({
    numero,
    nomeTemplate,
    codigoIdioma,
    parametrosCorpo,
  });
}

/*
 * Mantido temporariamente para não quebrar
 * arquivos que ainda chamam enviarMensagem().
 *
 * No próximo passo, notificationService.js
 * passará a chamar enviarNovoAgendamento().
 */
async function enviarMensagem(
  numero,
  mensagem
) {
  const destinatario =
    obterDestinatario(numero);

  const texto = String(
    mensagem || ""
  ).trim();

  if (!texto) {
    throw new Error(
      "A mensagem do WhatsApp não pode estar vazia."
    );
  }

  const payload = {
    messaging_product:
      "whatsapp",

    recipient_type:
      "individual",

    to: destinatario,

    type: "text",

    text: {
      preview_url: false,
      body: texto,
    },
  };

  return enviarRequisicao(
    payload
  );
}

module.exports = {
  enviarMensagem,
  enviarTemplate,
  enviarNovoAgendamento,
};