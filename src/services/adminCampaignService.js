const AppError = require(
  "../errors/AppError"
);

const adminCampaignRepository =
  require(
    "../repositories/adminCampaignRepository"
  );

const CANAIS = new Map([
  [
    "meta",
    {
      source: "meta",
      medium: "cpc",
    },
  ],
  [
    "google",
    {
      source: "google",
      medium: "cpc",
    },
  ],
  [
    "pinterest",
    {
      source: "pinterest",
      medium: "cpc",
    },
  ],
  [
    "tiktok",
    {
      source: "tiktok",
      medium: "cpc",
    },
  ],
  [
    "outro",
    null,
  ],
]);

const OBJETIVOS = new Set([
  "profissional",
  "cliente",
]);

const CAMPOS_IDENTIDADE = new Set([
  "canal",
  "utmSource",
  "utm_source",
  "utmMedium",
  "utm_medium",
  "utmCampaign",
  "utm_campaign",
]);

function normalizarId(valor) {
  const id = Number(valor);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      "Campanha inválida.",
      400
    );
  }

  return id;
}

function normalizarNome(valor) {
  const nome = String(
    valor || ""
  )
    .trim()
    .replace(/\s+/g, " ");

  if (
    nome.length < 2 ||
    nome.length > 140
  ) {
    throw new AppError(
      "Informe um nome de campanha entre 2 e 140 caracteres.",
      400
    );
  }

  return nome;
}

function tokenizar(
  valor,
  {
    campo,
    obrigatorio = true,
    limite = 140,
  }
) {
  const texto = String(
    valor ?? ""
  )
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, limite);

  if (
    obrigatorio &&
    !texto
  ) {
    throw new AppError(
      `Informe ${campo}.`,
      400
    );
  }

  return texto || null;
}

function normalizarCanal(valor) {
  const canal = tokenizar(
    valor,
    {
      campo: "o canal da campanha",
      limite: 40,
    }
  );

  if (
    !CANAIS.has(canal)
  ) {
    throw new AppError(
      "Canal inválido. Use Meta, Google, Pinterest, TikTok ou Outro.",
      400
    );
  }

  return canal;
}

function normalizarObjetivo(valor) {
  const objetivo = String(
    valor || ""
  )
    .trim()
    .toLocaleLowerCase("pt-BR");

  if (!OBJETIVOS.has(objetivo)) {
    throw new AppError(
      "Objetivo inválido. Escolha aquisição de profissionais ou aquisição de clientes.",
      400
    );
  }

  return objetivo;
}

function normalizarDestino(valor) {
  const destino = String(
    valor || "/"
  ).trim();

  if (
    !destino.startsWith("/") ||
    destino.startsWith("//") ||
    destino.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(destino)
  ) {
    throw new AppError(
      "O destino precisa ser um caminho interno do Agenda Fashion.",
      400
    );
  }

  let url;

  try {
    url = new URL(
      destino,
      "https://agenda-fashion.local"
    );
  } catch {
    throw new AppError(
      "Destino de campanha inválido.",
      400
    );
  }

  if (
    url.origin !==
      "https://agenda-fashion.local"
  ) {
    throw new AppError(
      "O destino precisa permanecer dentro do Agenda Fashion.",
      400
    );
  }

  [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gclid",
    "fbclid",
  ].forEach(
    (parametro) =>
      url.searchParams.delete(
        parametro
      )
  );

  const query =
    url.searchParams.toString();

  return `${url.pathname}${
    query ? `?${query}` : ""
  }${url.hash}`;
}

function obterBasePublica() {
  const configurada = String(
    process.env.PUBLIC_APP_URL ||
      "https://app.agendafashion.com.br"
  ).trim();

  let url;

  try {
    url = new URL(configurada);
  } catch {
    throw new AppError(
      "PUBLIC_APP_URL está inválida.",
      500
    );
  }

  if (
    ![
      "http:",
      "https:",
    ].includes(url.protocol)
  ) {
    throw new AppError(
      "PUBLIC_APP_URL precisa usar HTTP ou HTTPS.",
      500
    );
  }

  return url;
}

function gerarLinkRastreavel(
  campanha
) {
  const base =
    obterBasePublica();

  const url = new URL(
    campanha.destino_path ||
      campanha.destinoPath ||
      "/",
    base
  );

  url.searchParams.set(
    "utm_source",
    campanha.utm_source ||
      campanha.utmSource
  );
  url.searchParams.set(
    "utm_medium",
    campanha.utm_medium ||
      campanha.utmMedium
  );
  url.searchParams.set(
    "utm_campaign",
    campanha.utm_campaign ||
      campanha.utmCampaign
  );

  const content =
    campanha.utm_content ??
    campanha.utmContent;

  const term =
    campanha.utm_term ??
    campanha.utmTerm;

  if (content) {
    url.searchParams.set(
      "utm_content",
      content
    );
  } else {
    url.searchParams.delete(
      "utm_content"
    );
  }

  if (term) {
    url.searchParams.set(
      "utm_term",
      term
    );
  } else {
    url.searchParams.delete(
      "utm_term"
    );
  }

  return url.toString();
}

function mapearCampanha(
  campanha
) {
  if (!campanha) {
    return null;
  }

  return {
    id:
      Number(campanha.id),
    nome:
      campanha.nome,
    canal:
      campanha.canal,
    objetivo:
      campanha.objetivo ||
      "indefinido",
    utmSource:
      campanha.utm_source,
    utmMedium:
      campanha.utm_medium,
    utmCampaign:
      campanha.utm_campaign,
    utmContent:
      campanha.utm_content || null,
    utmTerm:
      campanha.utm_term || null,
    destinoPath:
      campanha.destino_path,
    ativo:
      campanha.ativo !== false,
    criadoPorUsuarioId:
      campanha.criado_por_usuario_id
        ? Number(
            campanha.criado_por_usuario_id
          )
        : null,
    createdAt:
      campanha.created_at,
    updatedAt:
      campanha.updated_at,
    linkRastreavel:
      gerarLinkRastreavel(
        campanha
      ),
  };
}

function montarNovaCampanha(
  payload,
  usuarioId
) {
  const canal =
    normalizarCanal(
      payload?.canal
    );

  const preset =
    CANAIS.get(canal);

  const nome =
    normalizarNome(
      payload?.nome
    );

  const objetivo =
    normalizarObjetivo(
      payload?.objetivo
    );

  const utmSource =
    tokenizar(
      payload?.utmSource ??
        payload?.utm_source ??
        preset?.source,
      {
        campo:
          "a origem UTM",
        limite: 80,
      }
    );

  const utmMedium =
    tokenizar(
      payload?.utmMedium ??
        payload?.utm_medium ??
        preset?.medium ??
        "cpc",
      {
        campo:
          "a mídia UTM",
        limite: 80,
      }
    );

  const utmCampaign =
    tokenizar(
      payload?.utmCampaign ??
        payload?.utm_campaign ??
        nome,
      {
        campo:
          "o identificador da campanha",
        limite: 140,
      }
    );

  return {
    nome,
    canal,
    objetivo,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent:
      tokenizar(
        payload?.utmContent ??
          payload?.utm_content,
        {
          campo:
            "o conteúdo UTM",
          obrigatorio: false,
          limite: 140,
        }
      ),
    utmTerm:
      tokenizar(
        payload?.utmTerm ??
          payload?.utm_term,
        {
          campo:
            "o termo UTM",
          obrigatorio: false,
          limite: 140,
        }
      ),
    destinoPath:
      normalizarDestino(
        payload?.destinoPath ??
          payload?.destino_path
      ),
    ativo: true,
    criadoPorUsuarioId:
      Number(usuarioId),
  };
}

async function listarCampanhas() {
  const campanhas =
    await adminCampaignRepository
      .listar();

  return {
    campanhas:
      campanhas.map(
        mapearCampanha
      ),
  };
}

async function criarCampanha({
  payload,
  usuarioId,
}) {
  const campanha =
    montarNovaCampanha(
      payload,
      usuarioId
    );

  const existente =
    await adminCampaignRepository
      .buscarPorIdentidade(
        campanha
      );

  if (existente) {
    throw new AppError(
      "Já existe uma campanha com essa origem, mídia e identificador.",
      409
    );
  }

  try {
    const criada =
      await adminCampaignRepository
        .criar(campanha);

    return {
      campanha:
        mapearCampanha(
          criada
        ),
    };
  } catch (erro) {
    if (
      erro?.code === "23505"
    ) {
      throw new AppError(
        "Já existe uma campanha com essa origem, mídia e identificador.",
        409
      );
    }

    throw erro;
  }
}

async function atualizarCampanha({
  id,
  payload,
}) {
  const campanhaId =
    normalizarId(id);

  const atual =
    await adminCampaignRepository
      .buscarPorId(
        campanhaId
      );

  if (!atual) {
    throw new AppError(
      "Campanha não encontrada.",
      404
    );
  }

  if (
    Object.keys(
      payload || {}
    ).some(
      (campo) =>
        CAMPOS_IDENTIDADE.has(
          campo
        )
    )
  ) {
    throw new AppError(
      "Origem, mídia e identificador não podem ser alterados após a criação. Crie uma nova campanha para preservar a atribuição histórica.",
      400
    );
  }

  const ativo =
    payload?.ativo === undefined
      ? atual.ativo !== false
      : payload.ativo;

  if (
    typeof ativo !== "boolean"
  ) {
    throw new AppError(
      "O status da campanha precisa ser verdadeiro ou falso.",
      400
    );
  }

  let objetivo =
    atual.objetivo ||
    "indefinido";

  if (payload?.objetivo !== undefined) {
    const solicitado =
      normalizarObjetivo(
        payload.objetivo
      );

    if (
      objetivo !== "indefinido" &&
      solicitado !== objetivo
    ) {
      throw new AppError(
        "O objetivo da campanha não pode ser alterado depois de definido. Crie uma nova campanha para preservar a leitura histórica dos resultados.",
        400
      );
    }

    objetivo = solicitado;
  }

  const atualizada =
    await adminCampaignRepository
      .atualizar(
        campanhaId,
        {
          nome:
            payload?.nome === undefined
              ? atual.nome
              : normalizarNome(
                  payload.nome
                ),
          objetivo,
          utmContent:
            payload?.utmContent === undefined &&
            payload?.utm_content === undefined
              ? atual.utm_content
              : tokenizar(
                  payload?.utmContent ??
                    payload?.utm_content,
                  {
                    campo:
                      "o conteúdo UTM",
                    obrigatorio: false,
                    limite: 140,
                  }
                ),
          utmTerm:
            payload?.utmTerm === undefined &&
            payload?.utm_term === undefined
              ? atual.utm_term
              : tokenizar(
                  payload?.utmTerm ??
                    payload?.utm_term,
                  {
                    campo:
                      "o termo UTM",
                    obrigatorio: false,
                    limite: 140,
                  }
                ),
          destinoPath:
            payload?.destinoPath === undefined &&
            payload?.destino_path === undefined
              ? atual.destino_path
              : normalizarDestino(
                  payload?.destinoPath ??
                    payload?.destino_path
                ),
          ativo,
        }
      );

  return {
    campanha:
      mapearCampanha(
        atualizada
      ),
  };
}

module.exports = {
  listarCampanhas,
  criarCampanha,
  atualizarCampanha,
  gerarLinkRastreavel,
  normalizarDestino,
  normalizarObjetivo,
  tokenizar,
};
