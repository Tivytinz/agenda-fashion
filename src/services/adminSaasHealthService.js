const adminSaasHealthRepository =
  require(
    "../repositories/adminSaasHealthRepository"
  );

const TOTAL_ETAPAS_ATIVACAO = 5;

const PENDENCIAS_PERMITIDAS =
  new Set([
    "todos",
    "sem_negocio",
    "perfil",
    "descricao",
    "servico",
    "disponibilidade",
    "publicacao",
    "primeiro_agendamento",
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

function cepPublicacaoValido(
  valor
) {
  return /^[0-9]{8}$/.test(
    String(valor || "")
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

  if (!textoPresente(linha.negocio_nome)) {
    pendencias.push({
      codigo: "nome",
      rotulo: "Informar nome do negócio",
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
        .trim()
        .toUpperCase()
    )
  ) {
    pendencias.push({
      codigo: "estado",
      rotulo: "Informar estado",
    });
  }

  const camposObrigatorios = [
    ["bairro", "bairro", "Informar bairro"],
    ["endereco", "endereco", "Informar endereço"],
    ["numero", "numero", "Informar número"],
  ];

  for (
    const [campo, codigo, rotulo]
    of camposObrigatorios
  ) {
    if (!textoPresente(linha[campo])) {
      pendencias.push({
        codigo,
        rotulo,
      });
    }
  }

  if (!cepPublicacaoValido(linha.cep)) {
    pendencias.push({
      codigo: "cep",
      rotulo: "Informar CEP válido",
    });
  }

  if (!textoPresente(linha.localizacao_url)) {
    pendencias.push({
      codigo: "localizacao",
      rotulo: "Informar link do Google Maps",
    });
  }

  if (!linha.possui_servico_ativo) {
    pendencias.push({
      codigo: "servico",
      rotulo: "Cadastrar serviço",
    });
  }

  /*
   * Publicação pertence ao funil de ativação. Se o negócio já cumpre
   * todos os requisitos do runtime e continua fora do catálogo, isso é
   * uma correção interna prioritária — nunca uma tarefa da profissional.
   */
  if (
    !linha.publicado &&
    linha.perfil_basico_completo === true &&
    linha.possui_servico_ativo === true
  ) {
    pendencias.push({
      codigo: "publicacao",
      rotulo: "Reprocessar publicação automática",
      tipo: "sistema",
    });
  }

  /*
   * Disponibilidade padrão é infraestrutura operacional, não etapa de
   * ativação. Mantemos o diagnóstico para correção interna sem alterar
   * percentual, publicação ou comunicação de onboarding.
   */
  if (linha.disponibilidade_inicializada !== true) {
    pendencias.push({
      codigo: "disponibilidade",
      rotulo: "Reprocessar disponibilidade inicial",
      tipo: "sistema",
    });
  }

  if (
    linha.publicado === true &&
    linha.primeiro_agendamento_valido !== true
  ) {
    pendencias.push({
      codigo: "primeiro_agendamento",
      rotulo: "Divulgar perfil para conquistar o 1º agendamento",
    });
  }

  if (!textoPresente(linha.descricao)) {
    pendencias.push({
      codigo: "descricao",
      rotulo: "Adicionar descrição (opcional)",
      tipo: "recomendacao",
    });
  }

  return pendencias;
}

function escolherProximaAcao(
  pendencias
) {
  const acaoUsuario = pendencias.find(
    (item) => !item.tipo
  );

  if (acaoUsuario) {
    return acaoUsuario;
  }

  /*
   * Quando os dois problemas técnicos coexistem, publicação vem primeiro:
   * ela é um marco de ativação; disponibilidade padrão não é.
   */
  const reprocessarPublicacao =
    pendencias.find(
      (item) =>
        item.tipo === "sistema" &&
        item.codigo === "publicacao"
    );

  if (reprocessarPublicacao) {
    return reprocessarPublicacao;
  }

  return pendencias.find(
    (item) => item.tipo === "sistema"
  ) || pendencias.find(
    (item) => item.tipo === "recomendacao"
  ) || pendencias[0] || null;
}

function mapearPerfil(
  linha
) {
  const etapasConcluidas =
    Math.min(
      TOTAL_ETAPAS_ATIVACAO,
      Math.max(
        0,
        numero(
          linha.etapas_concluidas
        )
      )
    );
  const percentual =
    Math.round(
      (
        etapasConcluidas /
        TOTAL_ETAPAS_ATIVACAO
      ) * 100
    );
  const pendencias =
    mapearPendencias(linha);

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
    whatsappAutorizado:
      linha.whatsapp_contato_autorizado === true,
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
      totalEtapas:
        TOTAL_ETAPAS_ATIVACAO,
      percentual,
      etapasRestantes:
        Math.max(
          0,
          TOTAL_ETAPAS_ATIVACAO -
            etapasConcluidas
        ),
    },
    prioridade:
      etapasConcluidas === 4
        ? "alta"
        : etapasConcluidas >= 2 && etapasConcluidas <= 3
          ? "media"
          : "baixa",
    proximaAcao:
      escolherProximaAcao(
        pendencias
      ),
    pendencias,
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
    semDescricao:
      numero(linha.sem_descricao),
    semServico:
      numero(linha.sem_servico),
    disponibilidadeNaoInicializada:
      numero(
        linha.sem_disponibilidade_inicial
      ),
    naoPublicados:
      numero(linha.nao_publicados),
    semPrimeiroAgendamento:
      numero(linha.sem_primeiro_agendamento),
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

  let total = linhas.length > 0
    ? numero(
        linhas[0]
          .total_resultados
      )
    : 0;

  /*
   * COUNT(*) OVER() não produz linha quando
   * a página solicitada ficou além do fim.
   * Nessa situação, recuperamos somente o
   * total para manter a paginação verdadeira.
   */
  if (
    linhas.length === 0 &&
    paginaSegura > 1
  ) {
    total = numero(
      await adminSaasHealthRepository
        .contarPerfisIncompletos({
          busca: buscaSegura,
          pendencia:
            pendenciaSegura,
        })
    );
  }

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
  mapearPendencias,
  escolherProximaAcao,
  mapearPerfil,
};