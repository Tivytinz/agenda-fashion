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

const MODELO_ATRIBUICAO = Object.freeze({
  codigo: "first_touch_30d",
  rotulo: "Primeiro contato",
  janelaDias: 30,
});

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
  parte,
  total
) {
  const totalNormalizado =
    numero(total);

  if (
    totalNormalizado <= 0
  ) {
    return 0;
  }

  return Number(
    (
      (
        numero(parte) /
        totalNormalizado
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

  const totalSessoes =
    inteiro(
      resumo?.total_sessoes
    );

  const sessoes =
    inteiro(
      resumo?.sessoes
    );

  const sessoesOrganicas =
    inteiro(
      resumo?.sessoes_organicas
    );

  const sessoesDiretas =
    inteiro(
      resumo?.sessoes_diretas ??
        resumo?.sessoes_autonomas
    );

  const sessoesRastreadasNaoPagas =
    inteiro(
      resumo?.sessoes_rastreadas_nao_pagas ??
        resumo?.sessoes_rastreamento_incompleto
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

  const sessoesConvertidas =
    inteiro(
      resumo
        ?.sessoes_convertidas
    );

  return {
    periodo:
      periodoNormalizado,
    totalSessoes,
    sessoes,
    sessoesPagas:
      sessoes,
    sessoesOrganicas,
    sessoesDiretas,
    sessoesAutonomas:
      sessoesDiretas,
    sessoesRastreadasNaoPagas,
    sessoesRastreamentoIncompleto:
      sessoesRastreadasNaoPagas,
    sessoesSemAtribuicao:
      sessoesDiretas,
    coberturaAtribuicao:
      taxa(
        sessoes +
          sessoesOrganicas +
          sessoesRastreadasNaoPagas,
        totalSessoes
      ),
    campanhas,
    perfisVisualizados,
    agendamentosIniciados,
    sessoesConvertidas,
    agendamentosConcluidos,
    taxaConversao:
      taxa(
        sessoesConvertidas,
        sessoes
      ),
    modeloAtribuicao:
      MODELO_ATRIBUICAO,
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

          const sessoesConvertidas =
            inteiro(
              campanha
                ?.sessoes_convertidas
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
            campanhaOficialId:
              campanha
                ?.campanha_oficial_id
                ? inteiro(
                    campanha
                      .campanha_oficial_id
                  )
                : null,
            objetivo:
              texto(
                campanha
                  ?.campanha_oficial_objetivo
              ) || null,
            oficial:
              campanha
                ?.classificacao_atribuicao ===
                  "oficial" ||
              Boolean(
                campanha
                  ?.campanha_oficial_id
              ),
            campanhaAtiva:
              campanha
                ?.campanha_oficial_id
                ? campanha
                    .campanha_oficial_ativa !==
                  false
                : null,
            classificacaoAtribuicao:
              texto(
                campanha
                  ?.classificacao_atribuicao,
                "identidade_nao_oficial"
              ),
            sessoes,
            sessoesResolvidasPorGclid:
              inteiro(
                campanha
                  ?.sessoes_resolvidas_gclid
              ),
            sessoesResolvidasPorGoogle:
              inteiro(
                campanha
                  ?.sessoes_resolvidas_google_click
              ),
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
            sessoesConvertidas,
            agendamentosConcluidos:
              concluidos,
            taxaConversao:
              taxa(
                sessoesConvertidas,
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
    modeloAtribuicao:
      MODELO_ATRIBUICAO,
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
    modeloAtribuicao:
      MODELO_ATRIBUICAO,
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
          campanhaOficialId:
            conversao
              ?.campanha_oficial_id
              ? inteiro(
                  conversao
                    .campanha_oficial_id
                )
              : null,
          objetivo:
            texto(
              conversao
                ?.campanha_oficial_objetivo
            ) || null,
          oficial:
            conversao
              ?.classificacao_atribuicao ===
                "oficial" ||
            Boolean(
              conversao
                ?.campanha_oficial_id
            ),
          campanhaAtiva:
            conversao
              ?.campanha_oficial_id
              ? conversao
                  .campanha_oficial_ativa !==
                false
              : null,
          classificacaoAtribuicao:
            texto(
              conversao
                ?.classificacao_atribuicao,
              "identidade_nao_oficial"
            ),
          resolvidoPorGclid:
            conversao
              ?.gclid_resolvido === true,
          resolvidoPorGoogle:
            conversao
              ?.google_click_resolvido === true,
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
