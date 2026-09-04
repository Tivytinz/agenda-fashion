const AppError = require(
  "../errors/AppError"
);

const eventoProdutoRepository =
  require(
    "../repositories/eventoProdutoRepository"
  );

const CAMPANHAS_GOOGLE_PROFISSIONAIS_LEGADAS =
  new Set([
    "aquisicao_profissionais",
    "search_aquisicao_profissionais",
    "profissionais_google_ads",
  ]);

const EVENTOS_PERMITIDOS =
  new Set([
    "tela_visualizada",
    "busca_realizada",
    "categoria_selecionada",
    "contato_selecionado",
    "servico_selecionado",
    "profissional_selecionado",
    "negocio_selecionado",
    "perfil_visualizado",
    "agendamento_iniciado",
    "agendamento_concluido",
    "agendamento_cancelado",
    "link_negocio_copiado",
    "link_negocio_compartilhado",
    "link_servico_copiado",
    "link_servico_compartilhado",
    "mensagem_crescimento_visualizada",
    "acao_dashboard_selecionada",
    "proxima_acao_ativacao_visualizada",
    "proxima_acao_ativacao_selecionada",
    "oportunidade_crescimento_visualizada",
    "oportunidade_crescimento_selecionada",
    "copilot_divulgacao_solicitada",
    "copilot_divulgacao_gerada",
    "periodo_dashboard_alterado",
    "upgrade_selecionado",
    "landing_profissionais_visualizada",
    "landing_profissionais_cta_clicado",
    "landing_profissionais_demo_clicada",
    "catalogo_local_visualizado",
    "agenda_configuracao_visualizada",
    "agenda_configuracao_salvamento_tentado",
    "agenda_configuracao_erro",
    "agenda_configurada",
  ]);

const PAGINAS_PERMITIDAS =
  new Set([
    "admin",
    "agenda_geral",
    "agenda_profissional",
    "cadastro_cliente",
    "cadastro_profissional",
    "checkout",
    "configuracao_agenda",
    "criar_negocio",
    "dashboard_dono",
    "dashboard_profissional",
    "escolher_negocio",
    "favoritos",
    "finalizar_agendamento",
    "inicio",
    "landing",
    "login_cliente",
    "login_profissional",
    "meus_agendamentos",
    "minha_assinatura",
    "minha_conta",
    "perfil_negocio",
    "planos",
    "para_profissionais",
    "catalogo_local",
  ]);

const MISSOES_PERMITIDAS =
  new Set([
    "administrar_plataforma",
    "acompanhar_agendamentos",
    "acompanhar_crescimento",
    "confirmar_agendamento",
    "conduzir_atendimentos",
    "criar_conta_cliente",
    "criar_conta_profissional",
    "descobrir_servico",
    "descobrir_compartilhar_agendar",
    "disponibilizar_horarios",
    "entender_proposta",
    "entrar_cliente",
    "entrar_no_negocio",
    "entrar_profissional",
    "escolher_e_agendar",
    "escolher_plano",
    "gerenciar_crescimento",
    "gerenciar_perfil",
    "organizar_dia",
    "organizar_negocio",
    "publicar_negocio",
    "adquirir_profissional",
    "retomar_escolhas",
  ]);

const CHAVES_PROPRIEDADES =
  new Set([
    "acao",
    "agendamento_id",
    "agendamentos_mes",
    "categoria",
    "faixa",
    "origem",
    "papel",
    "periodo",
    "resultados",
    "servico_id",
    "profissional_id",
    "status",
    "posicao",
    "negocio",
    "estado_ativacao",
    "tipo_acao",
    "codigo_oportunidade",
    "categoria_oportunidade",
    "canal_copilot",
    "fonte_copilot",
    "categoria_slug",
    "cidade",
    "estado",
    "termo_presente",
    "tipo_link",
    "servico_nome",
    "metodo",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gclid",
    "gbraid",
    "wbraid",
    "fbclid",
    "msclkid",
    "ttclid",
    "epik",
    "af_source",
    "af_medium",
    "af_content",
    "landing_page",
    "last_utm_source",
    "last_utm_medium",
    "last_utm_campaign",
    "last_utm_content",
    "last_utm_term",
    "last_gclid",
    "last_gbraid",
    "last_wbraid",
    "last_fbclid",
    "last_msclkid",
    "last_ttclid",
    "last_epik",
    "last_af_source",
    "last_af_medium",
    "last_af_content",
    "last_landing_page",
    "attribution_first_at",
    "attribution_last_at",
    "referrer_host",
  ]);

const CHAVES_ID = new Set([
  "agendamento_id",
  "servico_id",
  "profissional_id",
]);

const LIMITES_PROPRIEDADES_TEXTO =
  Object.freeze({
    estado_ativacao: 60,
    tipo_acao: 60,
    codigo_oportunidade: 80,
    categoria_oportunidade: 60,
    canal_copilot: 40,
    fonte_copilot: 40,
    tipo_link: 40,
    servico_nome: 120,
    metodo: 60,
    posicao: 60,
    negocio: 140,
    categoria_slug: 140,
    cidade: 120,
    estado: 40,
    utm_source: 80,
    utm_medium: 80,
    utm_campaign: 140,
    utm_content: 140,
    utm_term: 140,
    gclid: 200,
    gbraid: 200,
    wbraid: 200,
    fbclid: 200,
    msclkid: 200,
    ttclid: 200,
    epik: 200,
    af_source: 80,
    af_medium: 80,
    af_content: 80,
    landing_page: 500,
    last_utm_source: 80,
    last_utm_medium: 80,
    last_utm_campaign: 140,
    last_utm_content: 140,
    last_utm_term: 140,
    last_gclid: 200,
    last_gbraid: 200,
    last_wbraid: 200,
    last_fbclid: 200,
    last_msclkid: 200,
    last_ttclid: 200,
    last_epik: 200,
    last_af_source: 80,
    last_af_medium: 80,
    last_af_content: 80,
    last_landing_page: 500,
    attribution_first_at: 40,
    attribution_last_at: 40,
    referrer_host: 200,
  });

function erroValidacao(
  mensagem
) {
  return new AppError(
    mensagem,
    400
  );
}

function normalizarTexto(
  valor,
  limite
) {
  return String(
    valor ?? ""
  )
    .trim()
    .slice(
      0,
      limite
    );
}

function normalizarInteiroPositivo(
  valor
) {
  const numero =
    Number(valor);

  if (
    !Number.isInteger(numero) ||
    numero <= 0
  ) {
    return null;
  }

  return numero;
}

function normalizarValorPropriedade(
  chave,
  valor
) {
  if (
    typeof valor === "boolean"
  ) {
    return valor;
  }

  if (
    typeof valor === "number" &&
    Number.isFinite(valor)
  ) {
    if (CHAVES_ID.has(chave)) {
      return Number.isSafeInteger(valor) && valor > 0
        ? valor
        : undefined;
    }

    return Math.max(
      Math.min(
        valor,
        1000000
      ),
      -1000000
    );
  }

  if (
    typeof valor === "string"
  ) {
    return normalizarTexto(
      valor,
      LIMITES_PROPRIEDADES_TEXTO[
        chave
      ] || 60
    );
  }

  return undefined;
}

function sanitizarPropriedades(
  propriedades
) {
  if (
    !propriedades ||
    typeof propriedades !==
      "object" ||
    Array.isArray(
      propriedades
    )
  ) {
    return {};
  }

  const resultado = {};

  for (
    const [
      chave,
      valor,
    ] of Object.entries(
      propriedades
    )
  ) {
    if (
      !CHAVES_PROPRIEDADES.has(
        chave
      )
    ) {
      continue;
    }

    const valorNormalizado =
      normalizarValorPropriedade(
        chave,
        valor
      );

    if (
      valorNormalizado !==
        undefined
    ) {
      resultado[chave] =
        valorNormalizado;
    }
  }

  const campanha =
    String(
      resultado.utm_campaign ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    CAMPANHAS_GOOGLE_PROFISSIONAIS_LEGADAS
      .has(campanha)
  ) {
    const temSinalGoogle = [
      resultado.gclid,
      resultado.gbraid,
      resultado.wbraid,
    ].some(
      (valor) => Boolean(String(valor || "").trim())
    );

    [
      "utm_campaign",
      "utm_content",
      "utm_term",
    ].forEach(
      (chave) => {
        delete resultado[chave];
      }
    );

    if (temSinalGoogle) {
      resultado.utm_source = "google";
      resultado.utm_medium = "cpc";
    } else {
      delete resultado.utm_source;
      delete resultado.utm_medium;
    }
  }

  return resultado;
}

async function registrar({
  corpo,
  usuarioId,
}) {
  const nome =
    normalizarTexto(
      corpo?.nome,
      60
    );

  const pagina =
    normalizarTexto(
      corpo?.pagina,
      60
    );

  const missao =
    normalizarTexto(
      corpo?.missao,
      60
    );

  const sessaoId =
    normalizarTexto(
      corpo?.sessao_id,
      64
    );

  if (
    !EVENTOS_PERMITIDOS.has(
      nome
    )
  ) {
    throw erroValidacao(
      "Evento de comportamento inválido."
    );
  }

  if (
    !PAGINAS_PERMITIDAS.has(
      pagina
    )
  ) {
    throw erroValidacao(
      "Página do evento inválida."
    );
  }

  if (
    missao &&
    !MISSOES_PERMITIDAS.has(
      missao
    )
  ) {
    throw erroValidacao(
      "Missão da tela inválida."
    );
  }

  if (
    !/^[A-Za-z0-9_-]{8,64}$/
      .test(
        sessaoId
      )
  ) {
    throw erroValidacao(
      "Sessão de comportamento inválida."
    );
  }

  const registro =
    await eventoProdutoRepository
      .registrar({
        nome,
        pagina,
        missao:
          missao ||
          null,
        sessaoId,
        usuarioId:
          normalizarInteiroPositivo(
            usuarioId
          ),
        negocioId:
          normalizarInteiroPositivo(
            corpo?.negocio_id
          ),
        propriedades:
          sanitizarPropriedades(
            corpo?.propriedades
          ),
      });

  return {
    recebido:
      Boolean(
        registro?.id
      ),
    id:
      registro?.id ||
      null,
  };
}

module.exports = {
  registrar,
  sanitizarPropriedades,
  EVENTOS_PERMITIDOS,
  PAGINAS_PERMITIDAS,
  MISSOES_PERMITIDAS,
  CAMPANHAS_GOOGLE_PROFISSIONAIS_LEGADAS,
  LIMITES_PROPRIEDADES_TEXTO,
};
