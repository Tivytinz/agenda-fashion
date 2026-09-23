const AppError = require(
  "../errors/AppError"
);
const contributionEconomicsService =
  require(
    "./contributionEconomicsService"
  );
const repository =
  require(
    "../repositories/adminContributionOperationsRepository"
  );

function exigirSuperadmin(
  superadmin
) {
  if (superadmin !== true) {
    throw new AppError(
      "Operação financeira restrita ao superadministrador.",
      403
    );
  }
}

function idPositivo(
  valor,
  nome
) {
  const numero = Number(valor);

  if (
    !Number.isInteger(numero) ||
    numero <= 0
  ) {
    throw new AppError(
      `${nome} inválido.`,
      400
    );
  }

  return numero;
}

function texto(
  valor,
  {
    nome,
    minimo = 1,
    maximo,
  }
) {
  const normalizado =
    String(valor || "")
      .trim()
      .replace(/\s+/g, " ");

  if (
    normalizado.length < minimo ||
    normalizado.length > maximo
  ) {
    throw new AppError(
      `${nome} inválido.`,
      400
    );
  }

  return normalizado;
}

function motivoObrigatorio(
  valor
) {
  return texto(
    valor,
    {
      nome:
        "Motivo da operação",
      minimo: 4,
      maximo: 240,
    }
  );
}

function codigoFonte(
  valor
) {
  const codigo =
    String(valor || "")
      .trim()
      .toLowerCase();

  if (
    !/^[a-z0-9][a-z0-9_-]{1,79}$/
      .test(codigo)
  ) {
    throw new AppError(
      "Código da fonte inválido. Use letras minúsculas, números, hífen ou underline.",
      400
    );
  }

  return codigo;
}

function booleano(
  valor,
  padrao
) {
  if (
    valor === undefined ||
    valor === null
  ) {
    return padrao;
  }

  if (typeof valor !== "boolean") {
    throw new AppError(
      "Obrigatoriedade da fonte inválida.",
      400
    );
  }

  return valor;
}

function valorPositivo(
  valor
) {
  const numero = Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero <= 0 ||
    numero > 1000000000
  ) {
    throw new AppError(
      "Informe um valor de custo válido.",
      400
    );
  }

  return Number(
    numero.toFixed(2)
  );
}

function mapearFonte(
  item
) {
  return {
    id: Number(item.id),
    codigo: item.codigo,
    nome: item.nome,
    categoria: item.categoria,
    ativa: item.ativa === true,
    obrigatoriaParaMargem:
      item.obrigatoria_para_margem ===
      true,
    inicioCobertura:
      item.inicio_cobertura || null,
    cobertoAte:
      item.coberto_ate || null,
    coberturaStatus:
      item.cobertura_status || null,
    sincronizadoEm:
      item.sincronizado_em || null,
    lancamentos:
      Number(item.lancamentos || 0),
    custoLiquidoObservado:
      Number(
        item.custo_liquido_observado ||
        0
      ),
    createdAt:
      item.created_at || null,
    updatedAt:
      item.updated_at || null,
  };
}

function mapearCusto(
  item
) {
  return {
    id: Number(item.id),
    fonteId:
      Number(item.fonte_id),
    fonteCodigo:
      item.fonte_codigo,
    fonteNome:
      item.fonte_nome,
    negocioId:
      Number(item.negocio_id),
    negocioNome:
      item.negocio_nome,
    chaveOrigem:
      item.chave_origem,
    tipo: item.tipo,
    valor:
      Number(item.valor),
    ocorridoEm:
      item.ocorrido_em,
    custoReferenciadoId:
      item.custo_referenciado_id
        ? Number(
            item.custo_referenciado_id
          )
        : null,
    detalhes:
      item.detalhes || {},
    createdAt:
      item.created_at,
  };
}

function mapearOperacao(
  item
) {
  return {
    id: Number(item.id),
    usuarioId:
      item.usuario_id
        ? Number(item.usuario_id)
        : null,
    fonteId:
      item.fonte_id
        ? Number(item.fonte_id)
        : null,
    fonteCodigo:
      item.fonte_codigo || null,
    negocioId:
      item.negocio_id
        ? Number(item.negocio_id)
        : null,
    custoId:
      item.custo_id
        ? Number(item.custo_id)
        : null,
    acao: item.acao,
    motivo: item.motivo,
    detalhes:
      item.detalhes || {},
    createdAt:
      item.created_at,
  };
}

function converterErroContribuicao(
  erro
) {
  const mensagem =
    String(
      erro?.message || ""
    );

  if (
    mensagem.includes(
      "invalido"
    ) ||
    mensagem.includes(
      "inválido"
    )
  ) {
    return new AppError(
      mensagem,
      400
    );
  }

  if (
    mensagem.includes(
      "inexistente"
    )
  ) {
    return new AppError(
      mensagem,
      404
    );
  }

  if (
    mensagem.includes(
      "replay conflitante"
    ) ||
    mensagem.includes(
      "regressiva"
    ) ||
    mensagem.includes(
      "inconsistente"
    ) ||
    mensagem.includes(
      "referencia de custo"
    )
  ) {
    return new AppError(
      mensagem,
      409
    );
  }

  return erro;
}

async function buscarPainel({
  superadmin,
} = {}) {
  const dados =
    await repository
      .listarPainel();

  return {
    inicioCobertura:
      dados.inicio_cobertura ||
      null,
    podeEditar:
      superadmin === true,
    fontes:
      dados.fontes.map(
        mapearFonte
      ),
    custos:
      dados.custos.map(
        mapearCusto
      ),
    operacoes:
      dados.operacoes.map(
        mapearOperacao
      ),
    metodologia: {
      fonte:
        "Fonte de contribuição representa custo variável factual e atribuível. Nenhuma fonte é criada automaticamente por suposição.",
      correcao:
        "Correções de custo são append-only: um débito não é apagado; o ajuste é registrado como crédito referenciado.",
      cobertura:
        "Ausência de lançamento só pode significar custo zero dentro de cobertura completa declarada para a fonte.",
    },
  };
}

async function criarFonte({
  payload,
  usuarioId,
  superadmin,
}) {
  exigirSuperadmin(
    superadmin
  );

  const normalizado = {
    codigo:
      codigoFonte(
        payload?.codigo
      ),
    nome:
      texto(
        payload?.nome,
        {
          nome:
            "Nome da fonte",
          minimo: 2,
          maximo: 140,
        }
      ),
    categoria:
      texto(
        payload?.categoria,
        {
          nome:
            "Categoria da fonte",
          minimo: 2,
          maximo: 80,
        }
      ),
    obrigatoriaParaMargem:
      booleano(
        payload
          ?.obrigatoriaParaMargem ??
        payload
          ?.obrigatoria_para_margem,
        true
      ),
    motivo:
      motivoObrigatorio(
        payload?.motivo
      ),
    usuarioId:
      idPositivo(
        usuarioId,
        "Usuário"
      ),
  };

  try {
    return await repository
      .executarTransacao(
        async (
          client
        ) => {
          const fonte =
            await repository
              .criarFonte(
                normalizado,
                client
              );

          await repository
            .registrarOperacao(
              {
                usuarioId:
                  normalizado.usuarioId,
                fonteId:
                  Number(fonte.id),
                acao:
                  "CRIAR_FONTE",
                motivo:
                  normalizado.motivo,
                detalhes: {
                  codigo:
                    normalizado.codigo,
                  categoria:
                    normalizado.categoria,
                  obrigatoriaParaMargem:
                    normalizado
                      .obrigatoriaParaMargem,
                },
              },
              client
            );

          return {
            fonte:
              mapearFonte(
                fonte
              ),
          };
        }
      );
  } catch (erro) {
    if (
      erro?.code ===
      "23505"
    ) {
      throw new AppError(
        "Já existe uma fonte de contribuição com este código.",
        409
      );
    }

    throw erro;
  }
}

async function registrarCusto({
  payload,
  usuarioId,
  superadmin,
}) {
  exigirSuperadmin(
    superadmin
  );

  const tipo =
    String(
      payload?.tipo ||
      ""
    )
      .trim()
      .toUpperCase();

  if (
    ![
      "DEBITO",
      "CREDITO",
    ].includes(tipo)
  ) {
    throw new AppError(
      "Tipo de custo inválido.",
      400
    );
  }

  const negocioId =
    idPositivo(
      payload?.negocioId ??
      payload?.negocio_id,
      "Negócio"
    );
  const valor =
    valorPositivo(
      payload?.valor
    );
  const fonte =
    codigoFonte(
      payload?.fonteCodigo ??
      payload?.fonte_codigo
    );
  const motivo =
    motivoObrigatorio(
      payload?.motivo
    );
  const chaveOrigem =
    texto(
      payload?.chaveOrigem ??
      payload?.chave_origem,
      {
        nome:
          "Chave de origem",
        minimo: 1,
        maximo: 160,
      }
    );
  const ator =
    idPositivo(
      usuarioId,
      "Usuário"
    );
  const custoReferenciadoId =
    payload?.custoReferenciadoId ??
    payload?.custo_referenciado_id;

  if (
    tipo === "CREDITO" &&
    custoReferenciadoId == null
  ) {
    throw new AppError(
      "Crédito administrativo precisa referenciar o débito corrigido.",
      400
    );
  }

  return repository
    .executarTransacao(
      async (
        client
      ) => {
        const negocio =
          await repository
            .buscarNegocioPorId(
              negocioId,
              client
            );

        if (!negocio) {
          throw new AppError(
            "Negócio não encontrado.",
            404
          );
        }

        await repository
          .travarChaveCusto(
            {
              fonteCodigo:
                fonte,
              chaveOrigem,
            },
            client
          );

        if (tipo === "CREDITO") {
          const existente =
            await repository
              .buscarCustoPorFonteChave(
                {
                  fonteCodigo:
                    fonte,
                  chaveOrigem,
                },
                client
              );

          if (!existente) {
            const validacao =
              await repository
                .validarCreditoDisponivel(
                  {
                    fonteCodigo:
                      fonte,
                    negocioId,
                    custoReferenciadoId:
                      idPositivo(
                        custoReferenciadoId,
                        "Custo referenciado"
                      ),
                    valor,
                  },
                  client
                );

            if (
              !validacao
                .referenciaValida
            ) {
              throw new AppError(
                "Débito referenciado não pertence à mesma fonte e negócio.",
                409
              );
            }

            if (
              validacao.excede
            ) {
              throw new AppError(
                "O crédito não pode superar o saldo do débito referenciado.",
                409
              );
            }
          }
        }

        let custo;

        try {
          custo =
            await contributionEconomicsService
              .registrarCustoObservado(
                {
                  fonteCodigo:
                    fonte,
                  negocioId,
                  chaveOrigem,
                  tipo,
                  valor,
                  ocorridoEm:
                    payload?.ocorridoEm ??
                    payload?.ocorrido_em,
                  custoReferenciadoId:
                    tipo === "CREDITO"
                      ? idPositivo(
                          custoReferenciadoId,
                          "Custo referenciado"
                        )
                      : null,
                  detalhes: {
                    origem:
                      "admin_wave31",
                    motivo,
                    registradoPorUsuarioId:
                      ator,
                  },
                },
                {
                  executor:
                    client,
                }
              );
        } catch (erro) {
          throw converterErroContribuicao(
            erro
          );
        }

        if (!custo.replay) {
          await repository
            .registrarOperacao(
              {
                usuarioId:
                  ator,
                fonteId:
                  Number(
                    custo.fonte_id
                  ),
                negocioId,
                custoId:
                  Number(custo.id),
                acao:
                  tipo ===
                  "CREDITO"
                    ? "REGISTRAR_CREDITO"
                    : "REGISTRAR_CUSTO",
                motivo,
                detalhes: {
                  chaveOrigem:
                    custo
                      .chave_origem,
                  valor:
                    Number(
                      custo.valor
                    ),
                  ocorridoEm:
                    custo
                      .ocorrido_em,
                  custoReferenciadoId:
                    custo
                      .custo_referenciado_id ||
                    null,
                },
              },
              client
            );
        }

        return {
          custo: {
            id:
              Number(custo.id),
            fonteId:
              Number(
                custo.fonte_id
              ),
            negocioId,
            tipo:
              custo.tipo,
            valor:
              Number(
                custo.valor
              ),
            chaveOrigem:
              custo.chave_origem,
            ocorridoEm:
              custo.ocorrido_em,
            custoReferenciadoId:
              custo
                .custo_referenciado_id
                ? Number(
                    custo
                      .custo_referenciado_id
                  )
                : null,
            replay:
              custo.replay ===
              true,
          },
        };
      }
    );
}

async function registrarCobertura({
  payload,
  usuarioId,
  superadmin,
}) {
  exigirSuperadmin(
    superadmin
  );

  const ator =
    idPositivo(
      usuarioId,
      "Usuário"
    );
  const motivo =
    motivoObrigatorio(
      payload?.motivo
    );
  const fonte =
    codigoFonte(
      payload?.fonteCodigo ??
      payload?.fonte_codigo
    );

  return repository
    .executarTransacao(
      async (
        client
      ) => {
        let cobertura;

        try {
          cobertura =
            await contributionEconomicsService
              .registrarCoberturaFonte(
                {
                  fonteCodigo:
                    fonte,
                  inicioCobertura:
                    payload
                      ?.inicioCobertura ??
                    payload
                      ?.inicio_cobertura,
                  cobertoAte:
                    payload
                      ?.cobertoAte ??
                    payload
                      ?.coberto_ate ??
                    null,
                  status:
                    payload?.status,
                },
                {
                  executor:
                    client,
                }
              );
        } catch (erro) {
          throw converterErroContribuicao(
            erro
          );
        }

        await repository
          .registrarOperacao(
            {
              usuarioId:
                ator,
              fonteId:
                Number(
                  cobertura
                    .fonte_id
                ),
              acao:
                "ATUALIZAR_COBERTURA",
              motivo,
              detalhes: {
                inicioCobertura:
                  cobertura
                    .inicio_cobertura,
                cobertoAte:
                  cobertura
                    .coberto_ate,
                status:
                  cobertura.status,
              },
            },
            client
          );

        return {
          cobertura: {
            fonteId:
              Number(
                cobertura
                  .fonte_id
              ),
            inicioCobertura:
              cobertura
                .inicio_cobertura,
            cobertoAte:
              cobertura
                .coberto_ate,
            status:
              cobertura.status,
            sincronizadoEm:
              cobertura
                .sincronizado_em,
          },
        };
      }
    );
}

module.exports = {
  buscarPainel,
  criarFonte,
  registrarCusto,
  registrarCobertura,
  codigoFonte,
  motivoObrigatorio,
  valorPositivo,
};
