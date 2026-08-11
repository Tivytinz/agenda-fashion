const AppError = require(
  "../errors/AppError"
);

const eventoProdutoRepository =
  require(
    "../repositories/eventoProdutoRepository"
  );

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
    "mensagem_crescimento_visualizada",
    "acao_dashboard_selecionada",
    "periodo_dashboard_alterado",
    "upgrade_selecionado",
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
    "termo_presente",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gclid",
    "fbclid",
    "landing_page",
  ]);

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
      60
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
  EVENTOS_PERMITIDOS,
  PAGINAS_PERMITIDAS,
  MISSOES_PERMITIDAS,
};
