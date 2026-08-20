const adminSaasHealthRepository =
  require(
    "../repositories/adminSaasHealthRepository"
  );

const PENDENCIAS_PERMITIDAS =
  new Set([
    "todos",
    "sem_negocio",
    "perfil",
    "servico",
    "agenda",
    "publicacao",
  ]);

const ESTADOS_BRASILEIROS =
  new Set([
    "AC", "AL", "AP", "AM", "BA", "CE", "DF",
    "ES", "GO", "MA", "MT", "MS", "MG", "PA",
    "PB", "PR", "PE", "PI", "RJ", "RN", "RS",
    "RO", "RR", "SC", "SP", "SE", "TO",
  ]);

function numero(
  valor
) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function inteiroEntre(
  valor,
  minimo,
  maximo,
  fallback
) {
  const convertido =
    Number.parseInt(
      valor,
      10
    );

  if (
    !Number.isInteger(convertido) ||
    convertido < minimo ||
    convertido > maximo
  ) {
    return fallback;
  }

  return convertido;
}

function textoPresente(
  valor
) {
  return Boolean(
    String(valor || "").trim()
  );
}

function mapearPendencias(
  linha
) {
  if (!linha.tem_negocio) {
    return [
      {
        codigo: "negocio",
        rotulo: "Criar o negócio",
      },
    ];
  }

  const pendencias = [];
  const areas = Array.isArray(linha.areas)
    ? linha.areas
    : [];

  if (!textoPresente(linha.descricao)) {
    pendencias.push({
      codigo: "descricao",
      rotulo: "Adicionar descrição",
    });
  }

  if (
    areas.length === 0 &&
    !textoPresente(linha.setor)
  ) {
    pendencias.push({
      codigo: "especialidade",
      rotulo: "Selecionar especialidade",
    });
  }

  if (
    !/^[0-9]{10,11}$/.test(
      String(
        linha.negocio_whatsapp ||
        ""
      )
    )
  ) {
    pendencias.push({
      codigo: "whatsapp",
      rotulo: "Informar WhatsApp do negócio",
    });
  }

  if (!textoPresente(linha.cidade)) {
    pendencias.push({
      codigo: "cidade",
      rotulo: "Informar cidade",
    });
  }

  if (
    !ESTADOS_BRASILEIROS.has(
      String(linha.estado || "")
    )
  ) {
    pendencias.push({
      codigo: "estado",
      rotulo: "Informar estado",
    });
  }

  if (!linha.possui_servico_ativo) {
    pendencias.push({
      codigo: "servico",
      rotulo: "Cadastrar serviço",
    });
  }

  if (!linha.agenda_configurada) {
    pendencias.push({
      codigo: "agenda",
      rotulo: "Configurar agenda",
    });
  }

  if (!linha.publicado) {
    pendencias.push({
      codigo: "publicacao",
      rotulo: "Publicar perfil",
    });
  }

  return pendencias;
}

function mapearPerfil(
  linha
) {
  const etapasConcluidas =
    numero(
      linha.etapas_concluidas
    );
  const percentual =
    Math.round(
      (etapasConcluidas / 5) *
        100
    );

  return {
    usuarioId:
      numero(linha.usuario_id),
    nome:
      linha.usuario_nome,
    email:
      linha.email,
    whatsapp:
      linha.usuario_whatsapp ||
      linha.negocio_whatsapp ||
      null,
    cadastroEm:
      linha.cadastro_em,
    ultimoLoginEm:
      linha.ultimo_login_em,
    ultimaAtividadeEm:
      linha.ultima_atividade_em,
    origem:
      linha.utm_source ||
      "organico",
    campanha:
      linha.utm_campaign ||
      null,
    negocio: linha.negocio_id
      ? {
          id:
            numero(linha.negocio_id),
          nome:
            linha.negocio_nome,
          slug:
            linha.negocio_slug,
          cidade:
            linha.cidade,
          estado:
            linha.estado,
          publicado:
            linha.publicado === true,
        }
      : null,
    progresso: {
      etapasConcluidas,
      totalEtapas: 5,
      percentual,
    },
    prioridade:
      etapasConcluidas <= 1
        ? "alta"
        : etapasConcluidas <= 3
          ? "media"
          : "baixa",
    pendencias:
      mapearPendencias(linha),
  };
}

function mapearResumo(
  linha
) {
  return {
    totalProfissionais:
      numero(linha.total_profissionais),
    totalIncompletos:
      numero(linha.total_incompletos),
    semNegocio:
      numero(linha.sem_negocio),
    perfilIncompleto:
      numero(linha.perfil_incompleto),
    semServico:
      numero(linha.sem_servico),
    semAgenda:
      numero(linha.sem_agenda),
    naoPublicados:
      numero(linha.nao_publicados),
    completos:
      numero(linha.completos),
  };
}

async function listarPerfisIncompletos({
  busca,
  limite,
  pagina,
  pendencia,
} = {}) {
  const paginaSegura =
    inteiroEntre(
      pagina,
      1,
      100000,
      1
    );
  const limiteSeguro =
    inteiroEntre(
      limite,
      1,
      100,
      25
    );
  const buscaSegura =
    String(busca || "")
      .trim()
      .slice(0, 120);
  const pendenciaSegura =
    PENDENCIAS_PERMITIDAS.has(
      String(pendencia || "todos")
    )
      ? String(pendencia || "todos")
      : "todos";

  const [
    resumo,
    linhas,
  ] = await Promise.all([
    adminSaasHealthRepository
      .buscarResumo(),
    adminSaasHealthRepository
      .listarPerfisIncompletos({
        busca: buscaSegura,
        pendencia:
          pendenciaSegura,
        limite: limiteSeguro,
        offset:
          (paginaSegura - 1) *
          limiteSeguro,
      }),
  ]);

  const total = linhas.length > 0
    ? numero(
        linhas[0]
          .total_resultados
      )
    : 0;

  return {
    resumo:
      mapearResumo(resumo),
    filtros: {
      busca: buscaSegura,
      pendencia:
        pendenciaSegura,
    },
    perfis:
      linhas.map(mapearPerfil),
    paginacao: {
      pagina: paginaSegura,
      limite: limiteSeguro,
      total,
      totalPaginas:
        total === 0
          ? 0
          : Math.ceil(
              total /
                limiteSeguro
            ),
    },
  };
}

module.exports = {
  listarPerfisIncompletos,
};
