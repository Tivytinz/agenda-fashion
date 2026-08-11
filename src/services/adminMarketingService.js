const adminMarketingRepository =
  require(
    "../repositories/adminMarketingRepository"
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
      valor || "30"
    )
      .trim()
      .toLocaleLowerCase(
        "pt-BR"
      );

  return (
    PERIODOS.get(periodo) ||
    "30"
  );
}

function numero(
  valor
) {
  const resultado =
    Number(valor);

  return Number.isFinite(
    resultado
  )
    ? resultado
    : 0;
}

function inteiro(
  valor
) {
  return Math.trunc(
    numero(valor)
  );
}

function texto(
  valor,
  padrao = ""
) {
  const resultado =
    String(
      valor ?? ""
    ).trim();

  return resultado || padrao;
}

function data(
  valor
) {
  if (!valor) {
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

function taxa(
  conversoes,
  sessoes
) {
  const totalSessoes =
    numero(sessoes);

  if (
    totalSessoes <= 0
  ) {
    return 0;
  }

  return Number(
    (
      (
        numero(conversoes) /
        totalSessoes
      ) * 100
    ).toFixed(2)
  );
}

async function buscarResumo({
  periodo,
} = {}) {
  const periodoNormalizado =
    normalizarPeriodo(
      periodo
    );

  const resumo =
    await adminMarketingRepository
      .buscarResumo(
        periodoNormalizado
      );

  const sessoes =
    inteiro(
      resumo?.sessoes
    );

  const campanhas =
    inteiro(
      resumo?.campanhas
    );

  const perfisVisualizados =
    inteiro(
      resumo
        ?.perfis_visualizados
    );

  const agendamentosIniciados =
    inteiro(
      resumo
        ?.agendamentos_iniciados
    );

  const agendamentosConcluidos =
    inteiro(
      resumo
        ?.agendamentos_concluidos
    );

  return {
    periodo:
      periodoNormalizado,
    sessoes,
    campanhas,
    perfisVisualizados,
    agendamentosIniciados,
    agendamentosConcluidos,
    taxaConversao:
      taxa(
        agendamentosConcluidos,
        sessoes
      ),
  };
}

async function listarCampanhas({
  periodo,
} = {}) {
  const periodoNormalizado =
    normalizarPeriodo(
      periodo
    );

  const campanhas =
    await adminMarketingRepository
      .listarCampanhas(
        periodoNormalizado
      );

  return {
    periodo:
      periodoNormalizado,
    campanhas:
      (Array.isArray(campanhas)
        ? campanhas
        : []
      ).map(
        (campanha) => {
          const sessoes =
            inteiro(
              campanha?.sessoes
            );

          const concluidos =
            inteiro(
              campanha
                ?.agendamentos_concluidos
            );

          return {
            origem:
              texto(
                campanha?.origem,
                "desconhecida"
              ),
            midia:
              texto(
                campanha?.midia,
                "desconhecida"
              ),
            campanha:
              texto(
                campanha?.campanha,
                "(sem campanha)"
              ),
            sessoes,
            perfisVisualizados:
              inteiro(
                campanha
                  ?.perfis_visualizados
              ),
            agendamentosIniciados:
              inteiro(
                campanha
                  ?.agendamentos_iniciados
              ),
            agendamentosConcluidos:
              concluidos,
            taxaConversao:
              taxa(
                concluidos,
                sessoes
              ),
            primeiraInteracao:
              data(
                campanha
                  ?.primeira_interacao
              ),
            ultimaInteracao:
              data(
                campanha
                  ?.ultima_interacao
              ),
          };
        }
      ),
  };
}

async function listarConversoes({
  periodo,
} = {}) {
  const periodoNormalizado =
    normalizarPeriodo(
      periodo
    );

  const conversoes =
    await adminMarketingRepository
      .listarConversoes(
        periodoNormalizado
      );

  return {
    periodo:
      periodoNormalizado,
    conversoes:
      (Array.isArray(conversoes)
        ? conversoes
        : []
      ).map(
        (conversao) => ({
          eventoId:
            inteiro(
              conversao?.id
            ),
          sessaoId:
            texto(
              conversao?.sessao_id
            ) || null,
          agendamentoId:
            conversao
              ?.agendamento_id
              ? inteiro(
                  conversao
                    .agendamento_id
                )
              : null,
          negocioId:
            conversao?.negocio_id
              ? inteiro(
                  conversao
                    .negocio_id
                )
              : null,
          negocioNome:
            texto(
              conversao
                ?.negocio_nome
            ) || null,
          negocioSlug:
            texto(
              conversao
                ?.negocio_slug
            ) || null,
          servicoId:
            conversao?.servico_id
              ? inteiro(
                  conversao
                    .servico_id
                )
              : null,
          origem:
            texto(
              conversao?.origem,
              "desconhecida"
            ),
          midia:
            texto(
              conversao?.midia,
              "desconhecida"
            ),
          campanha:
            texto(
              conversao?.campanha,
              "(sem campanha)"
            ),
          conteudo:
            texto(
              conversao?.conteudo
            ) || null,
          landingPage:
            texto(
              conversao
                ?.landing_page
            ) || null,
          createdAt:
            data(
              conversao?.created_at
            ),
        })
      ),
  };
}

module.exports = {
  buscarResumo,
  listarCampanhas,
  listarConversoes,
  normalizarPeriodo,
};
