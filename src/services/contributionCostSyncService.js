const AppError = require(
  "../errors/AppError"
);
const repository = require(
  "../repositories/contributionCostSyncRepository"
);
const providers = require(
  "./contributionCostProviderRegistry"
);
const contributionEconomicsService =
  require(
    "./contributionEconomicsService"
  );
const config = require(
  "../config/contributionCostSync"
);

const LIMITE_ITENS_POR_EXECUCAO =
  1000;
const LIMITE_CURSOR_BYTES =
  16384;
const STATUS_COBERTURA =
  new Set([
    "COMPLETA",
    "INCOMPLETA",
  ]);

function inteiroPositivo(
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
    maximo = 160,
  }
) {
  const normalizado =
    String(valor || "")
      .trim();

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

function booleano(
  valor,
  padrao = false
) {
  if (
    valor === undefined ||
    valor === null
  ) {
    return padrao;
  }

  if (typeof valor !== "boolean") {
    throw new AppError(
      "Valor booleano inválido.",
      400
    );
  }

  return valor;
}

function intervaloMinutos(
  valor
) {
  const numero =
    Number(
      valor ?? 360
    );

  if (
    !Number.isInteger(numero) ||
    numero < 15 ||
    numero > 1440
  ) {
    throw new AppError(
      "O intervalo da sincronização deve ficar entre 15 e 1440 minutos.",
      400
    );
  }

  return numero;
}

function dataIso(
  valor,
  nome
) {
  const normalizado =
    texto(
      valor,
      {
        nome,
        minimo: 10,
        maximo: 10,
      }
    );

  if (
    !/^\d{4}-\d{2}-\d{2}$/
      .test(normalizado)
  ) {
    throw new AppError(
      `${nome} inválida.`,
      502
    );
  }

  const data = new Date(
    `${normalizado}T00:00:00.000Z`
  );

  if (
    Number.isNaN(
      data.getTime()
    ) ||
    data
      .toISOString()
      .slice(0, 10) !==
      normalizado
  ) {
    throw new AppError(
      `${nome} inválida.`,
      502
    );
  }

  return normalizado;
}

function hojeSaoPaulo() {
  const partes =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const mapa =
    Object.fromEntries(
      partes.map(
        (parte) => [
          parte.type,
          parte.value,
        ]
      )
    );

  return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

function objetoSeguro(
  valor,
  nome
) {
  const objeto =
    valor == null
      ? {}
      : valor;

  if (
    typeof objeto !==
      "object" ||
    Array.isArray(objeto)
  ) {
    throw new AppError(
      `${nome} inválido.`,
      502
    );
  }

  const serializado =
    JSON.stringify(objeto);

  if (
    Buffer.byteLength(
      serializado,
      "utf8"
    ) >
    LIMITE_CURSOR_BYTES
  ) {
    throw new AppError(
      `${nome} excedeu o limite seguro.`,
      502
    );
  }

  return objeto;
}

function instante(
  valor,
  nome
) {
  const data =
    new Date(valor);

  if (
    !valor ||
    Number.isNaN(
      data.getTime()
    )
  ) {
    throw new AppError(
      `${nome} inválido.`,
      502
    );
  }

  if (
    data.getTime() >
    Date.now() +
      5 * 60 * 1000
  ) {
    throw new AppError(
      `${nome} não pode estar no futuro.`,
      502
    );
  }

  return data.toISOString();
}

function valorMonetario(
  valor
) {
  const numero = Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero <= 0 ||
    numero >
      1000000000
  ) {
    throw new AppError(
      "O adaptador devolveu valor de custo inválido.",
      502
    );
  }

  return Number(
    numero.toFixed(2)
  );
}

function normalizarItem(
  item
) {
  const tipo =
    texto(
      item?.tipo,
      {
        nome:
          "Tipo do custo",
        maximo: 20,
      }
    ).toUpperCase();

  if (
    ![
      "DEBITO",
      "CREDITO",
    ].includes(tipo)
  ) {
    throw new AppError(
      "O adaptador devolveu tipo de custo inválido.",
      502
    );
  }

  const referencia =
    item?.referenciaChaveOrigem ??
    item?.referencia_chave_origem ??
    null;

  if (
    tipo === "CREDITO" &&
    !referencia
  ) {
    throw new AppError(
      "Crédito automático precisa referenciar a chave externa do débito.",
      502
    );
  }

  return {
    chaveOrigem:
      texto(
        item?.chaveOrigem ??
        item?.chave_origem,
        {
          nome:
            "Chave externa do custo",
          maximo: 160,
        }
      ),
    negocioId:
      inteiroPositivo(
        item?.negocioId ??
        item?.negocio_id,
        "Negócio"
      ),
    tipo,
    valor:
      valorMonetario(
        item?.valor
      ),
    ocorridoEm:
      instante(
        item?.ocorridoEm ??
        item?.ocorrido_em,
        "Instante do custo"
      ),
    referenciaChaveOrigem:
      referencia
        ? texto(
            referencia,
            {
              nome:
                "Referência externa do débito",
              maximo: 160,
            }
          )
        : null,
    detalhes:
      objetoSeguro(
        item?.detalhes,
        "Detalhes do custo"
      ),
  };
}

function normalizarCobertura(
  cobertura
) {
  if (
    cobertura == null
  ) {
    return null;
  }

  if (
    typeof cobertura !==
      "object" ||
    Array.isArray(cobertura)
  ) {
    throw new AppError(
      "Cobertura devolvida pelo adaptador é inválida.",
      502
    );
  }

  const status =
    texto(
      cobertura.status,
      {
        nome:
          "Status de cobertura",
        maximo: 20,
      }
    ).toUpperCase();

  if (
    !STATUS_COBERTURA
      .has(status)
  ) {
    throw new AppError(
      "Status de cobertura devolvido pelo adaptador é inválido.",
      502
    );
  }

  const inicioCobertura =
    dataIso(
      cobertura.inicioCobertura ??
      cobertura.inicio_cobertura,
      "Início da cobertura"
    );
  const fimBruto =
    cobertura.cobertoAte ??
    cobertura.coberto_ate ??
    null;
  const cobertoAte =
    fimBruto == null ||
    fimBruto === ""
      ? null
      : dataIso(
          fimBruto,
          "Fim da cobertura"
        );

  if (
    status === "COMPLETA" &&
    !cobertoAte
  ) {
    throw new AppError(
      "Cobertura completa do adaptador exige data final.",
      502
    );
  }

  if (
    cobertoAte &&
    cobertoAte <
      inicioCobertura
  ) {
    throw new AppError(
      "O adaptador devolveu intervalo de cobertura inválido.",
      502
    );
  }

  if (
    cobertoAte &&
    cobertoAte >
      hojeSaoPaulo()
  ) {
    throw new AppError(
      "O adaptador não pode declarar cobertura futura.",
      502
    );
  }

  return {
    inicioCobertura,
    cobertoAte,
    status,
  };
}

function normalizarColeta(
  resultado
) {
  if (
    !resultado ||
    typeof resultado !==
      "object" ||
    Array.isArray(resultado)
  ) {
    throw new AppError(
      "O adaptador devolveu uma resposta inválida.",
      502
    );
  }

  const itens =
    Array.isArray(
      resultado.itens
    )
      ? resultado.itens
      : [];

  if (
    itens.length >
      LIMITE_ITENS_POR_EXECUCAO
  ) {
    throw new AppError(
      "O adaptador devolveu mais itens que o limite seguro por execução.",
      502
    );
  }

  return {
    itens:
      itens.map(
        normalizarItem
      ),
    cobertura:
      normalizarCobertura(
        resultado.cobertura
      ),
    proximoCursor:
      objetoSeguro(
        resultado.proximoCursor ??
        resultado.proximo_cursor ??
        {},
        "Cursor da sincronização"
      ),
  };
}

function mapearIntegracao(
  item,
  adaptadores
) {
  const adaptador =
    adaptadores.find(
      (entry) =>
        entry.codigo ===
        item.adaptador
    );

  return {
    id: Number(item.id),
    fonteId:
      Number(item.fonte_id),
    fonteCodigo:
      item.fonte_codigo,
    fonteNome:
      item.fonte_nome,
    fonteAtiva:
      item.fonte_ativa ===
      true,
    obrigatoriaParaMargem:
      item
        .obrigatoria_para_margem ===
      true,
    adaptador:
      item.adaptador,
    adaptadorDisponivel:
      adaptador
        ?.disponivel === true,
    ativa:
      item.ativa === true,
    intervaloMinutos:
      Number(
        item.intervalo_minutos
      ),
    ultimaSincronizacaoEm:
      item
        .ultima_sincronizacao_em ||
      null,
    ultimoSucessoEm:
      item.ultimo_sucesso_em ||
      null,
    ultimaFalhaEm:
      item.ultima_falha_em ||
      null,
    ultimoErroCodigo:
      item.ultimo_erro_codigo ||
      null,
    ultimoErroDetalhe:
      item.ultimo_erro_detalhe ||
      null,
  };
}

async function status() {
  const [
    integracoes,
    execucoes,
  ] = await Promise.all([
    repository
      .listarIntegracoes(),
    repository
      .listarExecucoesRecentes(),
  ]);
  const adaptadores =
    providers
      .listarAdaptadores();

  return {
    agendamento:
      config
        .statusAgendamento(),
    adaptadores,
    integracoes:
      integracoes.map(
        (item) =>
          mapearIntegracao(
            item,
            adaptadores
          )
      ),
    execucoes:
      execucoes.map(
        (item) => ({
          id:
            Number(item.id),
          integracaoId:
            Number(
              item.integracao_id
            ),
          adaptador:
            item.adaptador,
          fonteCodigo:
            item.fonte_codigo,
          fonteNome:
            item.fonte_nome,
          status:
            item.status,
          itensRecebidos:
            Number(
              item.itens_recebidos ||
              0
            ),
          itensImportados:
            Number(
              item.itens_importados ||
              0
            ),
          itensReplay:
            Number(
              item.itens_replay ||
              0
            ),
          coberturaInicio:
            item.cobertura_inicio ||
            null,
          coberturaAte:
            item.cobertura_ate ||
            null,
          coberturaStatus:
            item.cobertura_status ||
            null,
          erroCodigo:
            item.erro_codigo ||
            null,
          erroDetalhe:
            item.erro_detalhe ||
            null,
          iniciadoEm:
            item.iniciado_em,
          finalizadoEm:
            item.finalizado_em ||
            null,
        })
      ),
  };
}

function exigirSuperadmin(
  superadmin
) {
  if (superadmin !== true) {
    throw new AppError(
      "Operação de integração financeira restrita ao superadministrador.",
      403
    );
  }
}

async function criarIntegracao({
  payload,
  superadmin,
}) {
  exigirSuperadmin(
    superadmin
  );

  const fonteId =
    inteiroPositivo(
      payload?.fonteId ??
      payload?.fonte_id,
      "Fonte"
    );
  const adaptador =
    providers
      .codigoAdaptador(
        payload?.adaptador
      );
  const provider =
    providers
      .obterAdaptador(
        adaptador
      );

  if (!provider) {
    throw new AppError(
      "Adaptador de custo factual indisponível nesta versão.",
      409
    );
  }

  const fonte =
    await repository
      .buscarFonteAtivaPorId(
        fonteId
      );

  if (!fonte) {
    throw new AppError(
      "Fonte de contribuição inexistente ou inativa.",
      404
    );
  }

  try {
    const integracao =
      await repository
        .criarIntegracao({
          fonteId,
          adaptador,
          intervaloMinutos:
            intervaloMinutos(
              payload
                ?.intervaloMinutos ??
              payload
                ?.intervalo_minutos
            ),
          ativa:
            booleano(
              payload?.ativa,
              false
            ),
        });

    return {
      integracao: {
        id:
          Number(
            integracao.id
          ),
        fonteId:
          Number(
            integracao
              .fonte_id
          ),
        adaptador:
          integracao.adaptador,
        ativa:
          integracao.ativa ===
          true,
        intervaloMinutos:
          Number(
            integracao
              .intervalo_minutos
          ),
      },
    };
  } catch (erro) {
    if (
      erro?.code ===
      "23505"
    ) {
      throw new AppError(
        "Esta fonte já possui uma integração automática.",
        409
      );
    }

    throw erro;
  }
}

async function atualizarIntegracao({
  integracaoId,
  payload,
  superadmin,
}) {
  exigirSuperadmin(
    superadmin
  );

  const id =
    inteiroPositivo(
      integracaoId,
      "Integração"
    );
  const atual =
    await repository
      .buscarIntegracaoPorId(
        id
      );

  if (!atual) {
    throw new AppError(
      "Integração de contribuição não encontrada.",
      404
    );
  }

  const ativa =
    booleano(
      payload?.ativa,
      atual.ativa === true
    );
  const intervalo =
    intervaloMinutos(
      payload
        ?.intervaloMinutos ??
      payload
        ?.intervalo_minutos ??
      atual
        .intervalo_minutos
    );

  if (ativa) {
    if (
      atual.fonte_ativa !==
      true
    ) {
      throw new AppError(
        "Não é possível ativar integração de uma fonte inativa.",
        409
      );
    }

    if (
      !providers
        .obterAdaptador(
          atual.adaptador
        )
    ) {
      throw new AppError(
        "Não é possível ativar integração sem adaptador disponível.",
        409
      );
    }
  }

  const atualizado =
    await repository
      .atualizarIntegracao({
        integracaoId:
          id,
        ativa,
        intervaloMinutos:
          intervalo,
      });

  return {
    integracao: {
      id:
        Number(
          atualizado.id
        ),
      fonteId:
        Number(
          atualizado.fonte_id
        ),
      adaptador:
        atualizado.adaptador,
      ativa:
        atualizado.ativa ===
        true,
      intervaloMinutos:
        Number(
          atualizado
            .intervalo_minutos
        ),
    },
  };
}

function erroSeguro(
  erro
) {
  const controlado =
    erro instanceof AppError;

  return {
    codigo:
      String(
        erro?.code ||
        (
          erro?.statusCode
            ? `http_${erro.statusCode}`
            : "sync_error"
        )
      ).slice(0, 80),
    detalhe:
      (
        controlado
          ? String(
              erro.message ||
              "Falha controlada na sincronização."
            )
          : "Falha interna na sincronização da fonte factual."
      ).slice(0, 240),
  };
}

async function persistirColeta({
  integracao,
  execucao,
  coleta,
}) {
  return repository
    .executarTransacao(
      async (
        client
      ) => {
        let importados = 0;
        let replays = 0;

        for (
          const item
          of coleta.itens
        ) {
          let referenciaId =
            null;

          if (
            item.tipo ===
            "CREDITO"
          ) {
            const debito =
              await repository
                .buscarCustoPorChave(
                  {
                    fonteId:
                      Number(
                        integracao
                          .fonte_id
                      ),
                    chaveOrigem:
                      item
                        .referenciaChaveOrigem,
                  },
                  client
                );

            if (
              !debito ||
              debito.tipo !==
                "DEBITO" ||
              Number(
                debito.negocio_id
              ) !==
                item.negocioId
            ) {
              throw new AppError(
                "Crédito automático referencia débito inexistente para a mesma fonte e negócio.",
                409
              );
            }

            referenciaId =
              Number(
                debito.id
              );

            const existente =
              await repository
                .buscarCustoPorChave(
                  {
                    fonteId:
                      Number(
                        integracao
                          .fonte_id
                      ),
                    chaveOrigem:
                      item
                        .chaveOrigem,
                  },
                  client
                );

            if (!existente) {
              const saldo =
                await repository
                  .buscarSaldoDebito(
                    {
                      fonteId:
                        Number(
                          integracao
                            .fonte_id
                        ),
                      negocioId:
                        item
                          .negocioId,
                      debitoId:
                        referenciaId,
                    },
                    client
                  );

              if (
                saldo == null ||
                item.valor >
                  saldo
              ) {
                throw new AppError(
                  "Crédito automático excede o saldo disponível do débito.",
                  409
                );
              }
            }
          }

          const custo =
            await contributionEconomicsService
              .registrarCustoObservado(
                {
                  fonteCodigo:
                    integracao
                      .fonte_codigo,
                  negocioId:
                    item
                      .negocioId,
                  chaveOrigem:
                    item
                      .chaveOrigem,
                  tipo:
                    item.tipo,
                  valor:
                    item.valor,
                  ocorridoEm:
                    item
                      .ocorridoEm,
                  custoReferenciadoId:
                    referenciaId,
                  detalhes: {
                    ...item
                      .detalhes,
                    origem:
                      "sync_wave32",
                    adaptador:
                      integracao
                        .adaptador,
                    integracaoId:
                      Number(
                        integracao.id
                      ),
                  },
                },
                {
                  executor:
                    client,
                }
              );

          if (
            custo.replay ===
            true
          ) {
            replays += 1;
          } else {
            importados += 1;
          }
        }

        if (
          coleta.cobertura
        ) {
          await contributionEconomicsService
            .registrarCoberturaFonte(
              {
                fonteCodigo:
                  integracao
                    .fonte_codigo,
                inicioCobertura:
                  coleta.cobertura
                    .inicioCobertura,
                cobertoAte:
                  coleta.cobertura
                    .cobertoAte,
                status:
                  coleta.cobertura
                    .status,
              },
              {
                executor:
                  client,
              }
            );
        }

        await repository
          .finalizarSincronizacaoSucesso(
            {
              execucaoId:
                Number(
                  execucao.id
                ),
              integracaoId:
                Number(
                  integracao.id
                ),
              cursorSaida:
                coleta
                  .proximoCursor,
              itensRecebidos:
                coleta.itens
                  .length,
              itensImportados:
                importados,
              itensReplay:
                replays,
              coberturaInicio:
                coleta.cobertura
                  ?.inicioCobertura ||
                null,
              coberturaAte:
                coleta.cobertura
                  ?.cobertoAte ||
                null,
              coberturaStatus:
                coleta.cobertura
                  ?.status ||
                null,
            },
            client
          );

        return {
          importados,
          replays,
        };
      }
    );
}

async function sincronizarIntegracao(
  {
    integracaoId,
  }
) {
  const id =
    inteiroPositivo(
      integracaoId,
      "Integração"
    );

  const lock =
    await repository
      .executarComLockIntegracao(
        id,
        async () => {
          const integracao =
            await repository
              .buscarIntegracaoPorId(
                id
              );

          if (!integracao) {
            throw new AppError(
              "Integração de contribuição não encontrada.",
              404
            );
          }

          if (
            integracao.ativa !==
              true ||
            integracao.fonte_ativa !==
              true
          ) {
            throw new AppError(
              "Integração de contribuição está inativa.",
              409
            );
          }

          const adaptador =
            providers
              .obterAdaptador(
                integracao
                  .adaptador
              );

          if (!adaptador) {
            throw new AppError(
              "Adaptador configurado não está disponível nesta versão.",
              409
            );
          }

          const cursor =
            objetoSeguro(
              integracao.cursor,
              "Cursor persistido"
            );

          const execucao =
            await repository
              .iniciarSincronizacao({
                integracaoId:
                  id,
                cursorEntrada:
                  cursor,
              });

          try {
            const bruto =
              await adaptador
                .coletar({
                  integracaoId:
                    id,
                  fonte: {
                    id:
                      Number(
                        integracao
                          .fonte_id
                      ),
                    codigo:
                      integracao
                        .fonte_codigo,
                    nome:
                      integracao
                        .fonte_nome,
                  },
                  cursor,
                  agora:
                    new Date()
                      .toISOString(),
                });

            const coleta =
              normalizarColeta(
                bruto
              );
            const persistido =
              await persistirColeta({
                integracao,
                execucao,
                coleta,
              });

            return {
              integracaoId:
                id,
              fonteCodigo:
                integracao
                  .fonte_codigo,
              adaptador:
                integracao
                  .adaptador,
              status:
                "sucesso",
              itensRecebidos:
                coleta.itens
                  .length,
              itensImportados:
                persistido
                  .importados,
              itensReplay:
                persistido
                  .replays,
              cobertura:
                coleta.cobertura,
            };
          } catch (erro) {
            const seguro =
              erroSeguro(
                erro
              );

            await repository
              .finalizarSincronizacaoErro({
                execucaoId:
                  Number(
                    execucao.id
                  ),
                integracaoId:
                  id,
                erroCodigo:
                  seguro.codigo,
                erroDetalhe:
                  seguro.detalhe,
              });

            throw erro;
          }
        }
      );

  if (!lock.executado) {
    throw new AppError(
      "Já existe uma sincronização em andamento para esta integração.",
      409
    );
  }

  return lock.resultado;
}

async function sincronizarManual({
  integracaoId,
  superadmin,
}) {
  exigirSuperadmin(
    superadmin
  );

  return sincronizarIntegracao({
    integracaoId,
  });
}

async function sincronizarPendentes() {
  const integracoes =
    await repository
      .listarIntegracoesVencidas();
  const resultados = [];

  for (
    const integracao
    of integracoes
  ) {
    try {
      resultados.push(
        await sincronizarIntegracao({
          integracaoId:
            Number(
              integracao.id
            ),
        })
      );
    } catch (erro) {
      const seguro =
        erroSeguro(
          erro
        );

      resultados.push({
        integracaoId:
          Number(
            integracao.id
          ),
        fonteCodigo:
          integracao
            .fonte_codigo,
        adaptador:
          integracao
            .adaptador,
        status: "erro",
        erroCodigo:
          seguro.codigo,
        erroDetalhe:
          seguro.detalhe,
      });
    }
  }

  return {
    integracoes:
      integracoes.length,
    resultados,
  };
}

module.exports = {
  status,
  criarIntegracao,
  atualizarIntegracao,
  sincronizarIntegracao,
  sincronizarManual,
  sincronizarPendentes,
  normalizarColeta,
  normalizarItem,
  normalizarCobertura,
  intervaloMinutos,
  hojeSaoPaulo,
};
