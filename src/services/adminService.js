const adminRepository = require(
  "../repositories/adminRepository"
);

const PERIODOS = new Map([
  ["all", "all"],
  ["todos", "all"],

  ["today", "today"],
  ["hoje", "today"],

  ["7", "7"],
  ["7dias", "7"],

  ["30", "30"],
  ["30dias", "30"],

  ["month", "month"],
  ["mes", "month"],
  ["mês", "month"],
]);

function normalizarPeriodo(
  valor
) {
  const periodo =
    String(
      valor || "all"
    )
      .trim()
      .toLocaleLowerCase(
        "pt-BR"
      );

  return (
    PERIODOS.get(periodo) ||
    "all"
  );
}

function converterNumero(
  valor
) {
  const numero =
    Number(valor);

  return Number.isFinite(
    numero
  )
    ? numero
    : 0;
}

function converterInteiro(
  valor
) {
  return Math.trunc(
    converterNumero(valor)
  );
}

function converterBooleano(
  valor,
  padrao = true
) {
  if (
    valor === true ||
    valor === "true" ||
    valor === 1 ||
    valor === "1"
  ) {
    return true;
  }

  if (
    valor === false ||
    valor === "false" ||
    valor === 0 ||
    valor === "0"
  ) {
    return false;
  }

  return padrao;
}

function normalizarTexto(
  valor,
  padrao = ""
) {
  const texto =
    String(
      valor ?? ""
    ).trim();

  return texto || padrao;
}

function normalizarData(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  if (
    valor instanceof Date
  ) {
    return Number.isNaN(
      valor.getTime()
    )
      ? null
      : valor.toISOString();
  }

  return valor;
}

function normalizarLista(
  valor
) {
  return Array.isArray(valor)
    ? valor
    : [];
}

function calcularTaxaConversao({
  totalAgendamentos,
  totalNegocios,
}) {
  const agendamentos =
    converterNumero(
      totalAgendamentos
    );

  const negocios =
    converterNumero(
      totalNegocios
    );

  if (
    negocios <= 0
  ) {
    return 0;
  }

  return Math.round(
    (
      agendamentos /
      negocios
    ) * 100
  );
}

function normalizarNegocio(
  negocio
) {
  const whatsapp =
    normalizarTexto(
      negocio?.whatsapp ??
      negocio
        ?.whatsapp_negocio
    );

  return {
    id:
      converterInteiro(
        negocio?.id
      ),

    nome:
      normalizarTexto(
        negocio?.nome,
        "Negócio sem nome"
      ),

    slug:
      normalizarTexto(
        negocio?.slug
      ) || null,

    cidade:
      normalizarTexto(
        negocio?.cidade
      ) || null,

    bairro:
      normalizarTexto(
        negocio?.bairro
      ) || null,

    setor:
      normalizarTexto(
        negocio?.setor
      ) || null,

    whatsapp:
      whatsapp || null,

    /*
     * Alias temporário para manter
     * compatibilidade com admin.js.
     */
    whatsapp_negocio:
      whatsapp || null,

    foto_url:
      normalizarTexto(
        negocio?.foto_url
      ) || null,

    ativo:
      converterBooleano(
        negocio?.ativo,
        true
      ),

    total_profissionais:
      converterInteiro(
        negocio
          ?.total_profissionais
      ),

    total_servicos:
      converterInteiro(
        negocio
          ?.total_servicos
      ),

    total_agendamentos:
      converterInteiro(
        negocio
          ?.total_agendamentos
      ),

    created_at:
      normalizarData(
        negocio?.created_at
      ),

    updated_at:
      normalizarData(
        negocio?.updated_at
      ),
  };
}

function normalizarAgendamento(
  agendamento
) {
  return {
    id:
      converterInteiro(
        agendamento?.id
      ),

    data:
      agendamento?.data ||
      null,

    horario:
      agendamento?.horario ||
      null,

    status:
      normalizarTexto(
        agendamento?.status,
        "agendado"
      ),

    cliente_id:
      agendamento
        ?.cliente_id
        ? converterInteiro(
            agendamento
              .cliente_id
          )
        : null,

    cliente_nome:
      normalizarTexto(
        agendamento
          ?.cliente_nome,
        "Cliente não informado"
      ),

    cliente_whatsapp:
      normalizarTexto(
        agendamento
          ?.cliente_whatsapp
      ) || null,

    negocio_id:
      agendamento
        ?.negocio_id
        ? converterInteiro(
            agendamento
              .negocio_id
          )
        : null,

    negocio:
      normalizarTexto(
        agendamento?.negocio,
        "Negócio não informado"
      ),

    servico_id:
      agendamento
        ?.servico_id
        ? converterInteiro(
            agendamento
              .servico_id
          )
        : null,

    servico:
      normalizarTexto(
        agendamento?.servico,
        "Serviço não informado"
      ),

    valor:
      converterNumero(
        agendamento?.valor
      ),

    profissional_id:
      agendamento
        ?.profissional_id
        ? converterInteiro(
            agendamento
              .profissional_id
          )
        : null,

    profissional:
      normalizarTexto(
        agendamento
          ?.profissional,
        "Profissional não informado"
      ),

    created_at:
      normalizarData(
        agendamento?.created_at
      ),
  };
}

function normalizarNegocioAgendado(
  negocio
) {
  return {
    id:
      converterInteiro(
        negocio?.id
      ),

    nome:
      normalizarTexto(
        negocio?.nome,
        "Negócio sem nome"
      ),

    slug:
      normalizarTexto(
        negocio?.slug
      ) || null,

    cidade:
      normalizarTexto(
        negocio?.cidade
      ) || null,

    total:
      converterInteiro(
        negocio?.total
      ),

    faturamento:
      converterNumero(
        negocio?.faturamento
      ),
  };
}

function normalizarNegocioVisto(
  negocio
) {
  return {
    id:
      converterInteiro(
        negocio?.id
      ),

    nome:
      normalizarTexto(
        negocio?.nome,
        "Negócio sem nome"
      ),

    slug:
      normalizarTexto(
        negocio?.slug
      ) || null,

    cidade:
      normalizarTexto(
        negocio?.cidade
      ) || null,

    visitas:
      converterInteiro(
        negocio?.visitas
      ),

    cliques_whatsapp:
      converterInteiro(
        negocio
          ?.cliques_whatsapp
      ),

    cliques_maps:
      converterInteiro(
        negocio?.cliques_maps
      ),
  };
}

function normalizarCidade(
  cidade
) {
  return {
    cidade:
      normalizarTexto(
        cidade?.cidade,
        "Não informada"
      ),

    total:
      converterInteiro(
        cidade?.total
      ),
  };
}

function normalizarUsuario(
  usuario
) {
  const papeis =
    normalizarLista(
      usuario
        ?.papeis_negocio
    )
      .map(
        (papel) =>
          normalizarTexto(
            papel
          )
      )
      .filter(Boolean);

  const perfil =
    normalizarTexto(
      usuario?.perfil ??
      usuario?.tipo,
      "usuario"
    );

  return {
    id:
      converterInteiro(
        usuario?.id
      ),

    nome:
      normalizarTexto(
        usuario?.nome,
        "Usuário sem nome"
      ),

    email:
      normalizarTexto(
        usuario?.email
      ),

    whatsapp:
      normalizarTexto(
        usuario?.whatsapp
      ) || null,

    foto_url:
      normalizarTexto(
        usuario?.foto_url
      ) || null,

    ativo:
      converterBooleano(
        usuario?.ativo,
        true
      ),

    papeis_negocio:
      papeis,

    papel_admin:
      normalizarTexto(
        usuario?.papel_admin
      ) || null,

    perfil,

    /*
     * Alias temporário para o frontend
     * administrativo atual.
     *
     * Não representa uma coluna
     * usuarios.tipo.
     */
    tipo:
      perfil,

    created_at:
      normalizarData(
        usuario?.created_at
      ),
  };
}

/*
 * GET /admin/dashboard
 */
async function buscarDashboardAdmin({
  periodo,
} = {}) {
  const periodoNormalizado =
    normalizarPeriodo(
      periodo
    );

  const [
    indicadoresGerais,
    indicadoresHoje,
    metricas,
    funilProduto,
    destaques,
    qualidade,
  ] =
    await Promise.all([
      adminRepository
        .buscarIndicadoresGerais(
          periodoNormalizado
        ),

      adminRepository
        .buscarIndicadoresHoje(),

      adminRepository
        .buscarMetricasPlataforma(
          periodoNormalizado
        ),

      adminRepository
        .buscarFunilProduto(
          periodoNormalizado
        ),

      adminRepository
        .buscarDestaquesPlataforma(),

      adminRepository
        .buscarQualidadeNegocios(),
    ]);

  const totalNegocios =
    converterInteiro(
      indicadoresGerais
        ?.totalNegocios
    );

  const totalClientes =
    converterInteiro(
      indicadoresGerais
        ?.totalClientes
    );

  const totalProfissionais =
    converterInteiro(
      indicadoresGerais
        ?.totalProfissionais
    );

  const totalAgendamentos =
    converterInteiro(
      indicadoresGerais
        ?.totalAgendamentos
    );

  const usuariosHoje =
    converterInteiro(
      indicadoresHoje
        ?.usuariosHoje
    );

  const negociosHoje =
    converterInteiro(
      indicadoresHoje
        ?.negociosHoje
    );

  const agendamentosHoje =
    converterInteiro(
      indicadoresHoje
        ?.agendamentosHoje
    );

  const visitasPlataforma =
    converterInteiro(
      metricas
        ?.visitasPlataforma
    );

  const cliquesWhatsapp =
    converterInteiro(
      metricas
        ?.cliquesWhatsapp
    );

  const cliquesMaps =
    converterInteiro(
      metricas
        ?.cliquesMaps
    );

  const favoritosTotais =
    converterInteiro(
      metricas
        ?.favoritosTotais
    );

  const descobriram =
    converterInteiro(
      funilProduto
        ?.descobriram
    );

  const avaliaram =
    converterInteiro(
      funilProduto
        ?.avaliaram
    );

  const iniciaram =
    converterInteiro(
      funilProduto
        ?.iniciaram
    );

  const concluiram =
    converterInteiro(
      funilProduto
        ?.concluiram
    );

  const acoesDashboard =
    converterInteiro(
      funilProduto
        ?.acoes_dashboard
    );

  const conversaoAgendamento =
    iniciaram > 0
      ? Math.round(
          (
            concluiram /
            iniciaram
          ) *
            100
        )
      : 0;

  const cidadeTop =
    normalizarTexto(
      destaques?.cidadeTop,
      "-"
    );

  const setorTop =
    normalizarTexto(
      destaques?.setorTop,
      "-"
    );

  const negociosSemServico =
    converterInteiro(
      qualidade
        ?.negociosSemServico
    );

  const negociosSemMaps =
    converterInteiro(
      qualidade
        ?.negociosSemMaps
    );

  const negociosSemWhatsapp =
    converterInteiro(
      qualidade
        ?.negociosSemWhatsapp
    );

  const negociosCompletos =
    converterInteiro(
      qualidade
        ?.negociosCompletos
    );

  const taxaConversaoGeral =
    calcularTaxaConversao({
      totalAgendamentos,
      totalNegocios,
    });

  return {
    periodo:
      periodoNormalizado,

    totalNegocios,
    totalClientes,
    totalProfissionais,
    totalAgendamentos,

    usuariosHoje,
    negociosHoje,
    agendamentosHoje,

    taxaConversaoGeral,

    visitasPlataforma,
    cliquesWhatsapp,
    cliquesMaps,
    favoritosTotais,

    cidadeTop,
    setorTop,

    negociosSemServico,
    negociosSemMaps,
    negociosSemWhatsapp,
    negociosCompletos,

    /*
     * Estrutura agrupada para facilitar
     * futuras versões do frontend.
     *
     * Os campos antigos acima continuam
     * disponíveis.
     */
    indicadores: {
      totalNegocios,
      totalClientes,
      totalProfissionais,
      totalAgendamentos,
    },

    hoje: {
      usuariosHoje,
      negociosHoje,
      agendamentosHoje,
    },

    metricas: {
      taxaConversaoGeral,
      visitasPlataforma,
      cliquesWhatsapp,
      cliquesMaps,
      favoritosTotais,
    },

    destaques: {
      cidadeTop,
      setorTop,
    },

    qualidade: {
      negociosSemServico,
      negociosSemMaps,
      negociosSemWhatsapp,
      negociosCompletos,
    },

    comportamento: {
      descobriram,
      avaliaram,
      iniciaram,
      concluiram,
      acoesDashboard,
      conversaoAgendamento,
    },
  };
}

/*
 * GET /admin/negocios
 */
async function listarNegociosAdmin() {
  const negocios =
    await adminRepository
      .listarNegocios();

  return {
    negocios:
      normalizarLista(
        negocios
      ).map(
        normalizarNegocio
      ),
  };
}

/*
 * GET /admin/agendamentos
 */
async function listarAgendamentosAdmin() {
  const agendamentos =
    await adminRepository
      .listarAgendamentosRecentes();

  return {
    agendamentos:
      normalizarLista(
        agendamentos
      ).map(
        normalizarAgendamento
      ),
  };
}

/*
 * GET /admin/marketing
 */
async function buscarMarketingAdmin() {
  const [
    negociosMaisAgendados,
    negociosMaisVistos,
    cidades,
    usuariosRecentes,
  ] =
    await Promise.all([
      adminRepository
        .listarNegociosMaisAgendados(),

      adminRepository
        .listarNegociosMaisVistos(),

      adminRepository
        .listarCidadesTop(),

      adminRepository
        .listarUsuariosRecentes(),
    ]);

  return {
    negociosMaisAgendados:
      normalizarLista(
        negociosMaisAgendados
      ).map(
        normalizarNegocioAgendado
      ),

    negociosMaisVistos:
      normalizarLista(
        negociosMaisVistos
      ).map(
        normalizarNegocioVisto
      ),

    cidades:
      normalizarLista(
        cidades
      ).map(
        normalizarCidade
      ),

    usuariosRecentes:
      normalizarLista(
        usuariosRecentes
      ).map(
        normalizarUsuario
      ),
  };
}

module.exports = {
  buscarDashboardAdmin,
  listarNegociosAdmin,
  listarAgendamentosAdmin,
  buscarMarketingAdmin,
};
