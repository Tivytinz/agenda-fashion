function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function rotuloOrigem(valor) {
  const origem = String(valor || "")
    .trim()
    .toLowerCase();
  const rotulos = {
    google: "Google Ads",
    meta: "Meta Ads",
    pinterest: "Pinterest",
    tiktok: "TikTok",
    microsoft: "Microsoft Ads",
  };

  if (rotulos[origem]) {
    return rotulos[origem];
  }

  if (!origem || origem === "desconhecida") {
    return "Origem não identificada";
  }

  return origem.charAt(0).toUpperCase() +
    origem.slice(1);
}

function rotuloMetodo(valor) {
  const metodos = {
    utm_exata: "UTM exata",
    vinculo_plataforma:
      "Vínculo da plataforma",
    vinculo_unico: "Vínculo único",
  };

  return metodos[valor] || valor;
}

function rotuloMetodos(valores) {
  const metodos = Array.isArray(valores)
    ? valores.filter(Boolean)
    : [];

  if (!metodos.length) {
    return "Sem profissional atribuído";
  }

  return metodos
    .map(rotuloMetodo)
    .join(", ");
}

function rotuloCampanha(item) {
  const campanha = String(
    item?.campanha || ""
  ).trim();

  if (campanha) {
    return campanha;
  }

  const id = String(
    item?.campanhaOficialId || ""
  ).trim();

  return id
    ? `Campanha oficial #${id}`
    : "Campanha oficial";
}

function formatarMoedaCentavos(
  valor,
  fallback = "Sem base"
) {
  if (
    valor === null ||
    valor === undefined ||
    !Number.isFinite(Number(valor))
  ) {
    return fallback;
  }

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  ).format(Number(valor) / 100);
}

function rotuloLeituraCusto(valor) {
  const rotulos = {
    sem_investimento_registrado:
      "Sem gasto registrado",
    investimento_sem_profissional_atribuido:
      "Gasto sem profissional atribuído",
    observado_medicao_incompleta:
      "Observado com atribuição incompleta",
    observado_sem_primeiro_agendamento:
      "Observado, sem 1º agendamento",
    observado:
      "Observado",
  };

  return rotulos[valor] ||
    "Leitura não classificada";
}

function rotuloLeituraCustoMaduro(valor) {
  const rotulos = {
    aguardando_gasto_maduro:
      "Aguardando gasto maduro",
    gasto_maduro_sem_profissional:
      "Gasto maduro sem profissional",
    cobertura_custo_incompleta:
      "Cobertura de custo incompleta",
    origem_sem_evidencia:
      "Origem sem evidência",
    atribuicao_paga_incompleta:
      "Atribuição paga incompleta",
    amostra_madura_pequena:
      "Amostra madura pequena",
    base_madura_comparavel:
      "Base madura comparável",
  };

  return rotulos[valor] ||
    "Leitura não classificada";
}

function resumoJanela(
  grupo,
  janelaDias
) {
  const janelas = Array.isArray(
    grupo?.janelasCandidatas
  )
    ? grupo.janelasCandidatas
    : [];
  const janela = janelas.find(
    (item) =>
      numero(item?.janelaDias) === janelaDias
  );

  if (!janela || numero(janela.elegiveis) <= 0) {
    return "Sem base madura";
  }

  return `${numero(
    janela.taxaSegundoNaJanela
  )}% (${numero(
    janela.comSegundoNaJanela
  )}/${numero(janela.elegiveis)})`;
}

function resumoMedicao(grupos) {
  const medicao = grupos.find(
    (grupo) => grupo?.medicaoCusto
  )?.medicaoCusto;

  if (!medicao) {
    return "Sem diagnóstico de atribuição para esta seleção.";
  }

  const cobertura =
    medicao.coberturaAtribuicaoPaga;
  const coberturaTexto =
    cobertura === null ||
    cobertura === undefined
      ? "sem base paga classificável"
      : `${numero(cobertura)}% de cobertura entre sinais pagos classificáveis`;

  return `${coberturaTexto}; ${numero(
    medicao.pagosSemAtribuicaoOficial
  )} profissionais com sinal pago sem atribuição oficial e ${numero(
    medicao.profissionaisSemEvidencia
  )} sem evidência de origem.`;
}

export function ProfessionalRecurrenceCampaignTable({
  campanhas = [],
}) {
  const grupos = Array.isArray(campanhas)
    ? campanhas
    : [];
  const linhasJanelas =
    grupos.flatMap((grupo) => {
      const janelas = Array.isArray(
        grupo.janelasCandidatas
      )
        ? grupo.janelasCandidatas
        : [];

      return janelas.map((janela) => ({
        grupo,
        janela,
      }));
    });
  const linhasCustosMaduros =
    grupos.flatMap((grupo) => {
      const custos = Array.isArray(
        grupo.custosRecorrenciaMadura
      )
        ? grupo.custosRecorrenciaMadura
        : [];

      return custos.map((custo) => ({
        grupo,
        custo,
      }));
    });

  return (
    <div className="admin-stat-table-card">
      <div className="admin-stat-table-heading">
        <strong>Qualidade por campanha oficial</strong>
        <small>
          A recorrência conta somente profissionais que o backend resolveu como oficialmente atribuídos. Campanhas de aquisição profissional com gasto registrado também podem aparecer com zero profissionais, para que investimento sem vínculo não fique escondido.
        </small>
      </div>

      <div className="table-wrap">
        <table className="admin-compact-table">
          <thead>
            <tr>
              <th>Campanha</th>
              <th>Origem</th>
              <th>Resolução</th>
              <th>Profissionais</th>
              <th>1º agendamento</th>
              <th>Taxa 1º</th>
              <th>2º agendamento</th>
              <th>2º / 1º</th>
              <th>3º agendamento</th>
              <th>3º / 1º</th>
            </tr>
          </thead>
          <tbody>
            {grupos.length ? (
              grupos.map((grupo) => (
                <tr key={grupo.chave}>
                  <td>{rotuloCampanha(grupo)}</td>
                  <td>{rotuloOrigem(grupo.origem)}</td>
                  <td>
                    {rotuloMetodos(
                      grupo.metodosResolucao
                    )}
                  </td>
                  <td>{numero(grupo.profissionais)}</td>
                  <td>
                    {numero(
                      grupo.comPrimeiroAgendamento
                    )}
                  </td>
                  <td>
                    {numero(
                      grupo.taxaPrimeiroSobreProfissionais
                    )}%
                  </td>
                  <td>
                    {numero(
                      grupo.comSegundoAgendamento
                    )}
                  </td>
                  <td>
                    {numero(
                      grupo.taxaSegundoSobrePrimeiro
                    )}%
                  </td>
                  <td>
                    {numero(
                      grupo.comTerceiroAgendamento
                    )}
                  </td>
                  <td>
                    {numero(
                      grupo.taxaTerceiroSobrePrimeiro
                    )}%
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10">
                  Ainda não há campanhas oficiais com profissionais ou investimento nesta seleção.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-stat-table-heading">
        <strong>Recorrência madura por campanha</strong>
        <small>
          D7, D14 e D30 são recalculados dentro de cada campanha oficial. Zero elegíveis significa falta de maturidade da campanha naquela janela, não recorrência zero. Esta visão não calcula CAC, ROAS ou receita.
        </small>
      </div>

      <div className="table-wrap">
        <table className="admin-compact-table">
          <thead>
            <tr>
              <th>Campanha</th>
              <th>Janela</th>
              <th>Elegíveis</th>
              <th>2º na janela</th>
              <th>Taxa 2º</th>
              <th>3º na janela</th>
              <th>Taxa 3º</th>
            </tr>
          </thead>
          <tbody>
            {linhasJanelas.length ? (
              linhasJanelas.map(({ grupo, janela }) => (
                <tr
                  key={`${grupo.chave}-${janela.janelaDias}`}
                >
                  <td>{rotuloCampanha(grupo)}</td>
                  <td>D{numero(janela.janelaDias)}</td>
                  <td>{numero(janela.elegiveis)}</td>
                  <td>
                    {numero(
                      janela.comSegundoNaJanela
                    )}
                  </td>
                  <td>
                    {numero(
                      janela.taxaSegundoNaJanela
                    )}%
                  </td>
                  <td>
                    {numero(
                      janela.comTerceiroNaJanela
                    )}
                  </td>
                  <td>
                    {numero(
                      janela.taxaTerceiroNaJanela
                    )}%
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7">
                  Ainda não há janelas maduras para campanhas oficiais nesta seleção.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-stat-table-heading">
        <strong>Investimento e qualidade observada</strong>
        <small>
          O gasto e a coorte usam o mesmo período e são ligados somente pelo ID canônico da campanha. O custo por profissional e por 1º agendamento é descritivo, não CAC. A recorrência ao lado continua sendo uma leitura de qualidade; o custo de repetição só aparece na tabela madura abaixo.
        </small>
        <small>
          {resumoMedicao(grupos)}
        </small>
      </div>

      <div className="table-wrap">
        <table className="admin-compact-table">
          <thead>
            <tr>
              <th>Campanha</th>
              <th>Investimento</th>
              <th>Dias com gasto</th>
              <th>Prof. oficiais</th>
              <th>Custo observado / prof.</th>
              <th>1º agendamento</th>
              <th>Custo observado / 1º</th>
              <th>D7 2º</th>
              <th>D14 2º</th>
              <th>D30 2º</th>
              <th>Leitura</th>
            </tr>
          </thead>
          <tbody>
            {grupos.length ? (
              grupos.map((grupo) => (
                <tr key={`custo-${grupo.chave}`}>
                  <td>{rotuloCampanha(grupo)}</td>
                  <td>
                    {grupo.leituraCusto ===
                    "sem_investimento_registrado"
                      ? "Sem gasto registrado"
                      : formatarMoedaCentavos(
                          grupo.investimentoCentavos
                        )}
                  </td>
                  <td>{numero(grupo.diasComGasto)}</td>
                  <td>{numero(grupo.profissionais)}</td>
                  <td>
                    {formatarMoedaCentavos(
                      grupo.custoObservadoPorProfissionalCentavos
                    )}
                  </td>
                  <td>
                    {numero(
                      grupo.comPrimeiroAgendamento
                    )}
                  </td>
                  <td>
                    {formatarMoedaCentavos(
                      grupo.custoObservadoPrimeiroAgendamentoCentavos
                    )}
                  </td>
                  <td>{resumoJanela(grupo, 7)}</td>
                  <td>{resumoJanela(grupo, 14)}</td>
                  <td>{resumoJanela(grupo, 30)}</td>
                  <td>
                    {rotuloLeituraCusto(
                      grupo.leituraCusto
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="11">
                  Ainda não há campanhas profissionais oficiais ou investimento para relacionar nesta seleção.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-stat-table-heading">
        <strong>Custo de recorrência com coorte madura</strong>
        <small>
          Esta é a leitura temporalmente alinhada. A base usa apenas dias completos de gasto que já tiveram tempo para a janela de ativação mais D7, D14 ou D30, e somente profissionais oficialmente atribuídos nesses mesmos dias. Primeiro agendamento precisa ocorrer dentro da janela de ativação. O resultado continua sendo custo observado por repetição, não CAC, ROAS ou recomendação automática de orçamento.
        </small>
      </div>

      <div className="table-wrap">
        <table className="admin-compact-table">
          <thead>
            <tr>
              <th>Campanha</th>
              <th>Janela</th>
              <th>Maturidade total</th>
              <th>Investimento maduro</th>
              <th>Dias c/ gasto</th>
              <th>Base madura</th>
              <th>Mad. sem gasto</th>
              <th>1º na ativação</th>
              <th>2º</th>
              <th>Custo / 2º</th>
              <th>3º</th>
              <th>Custo / 3º</th>
              <th>Leitura</th>
            </tr>
          </thead>
          <tbody>
            {linhasCustosMaduros.length ? (
              linhasCustosMaduros.map(
                ({ grupo, custo }) => (
                  <tr
                    key={`custo-maduro-${grupo.chave}-${custo.janelaDias}`}
                  >
                    <td>{rotuloCampanha(grupo)}</td>
                    <td>D{numero(custo.janelaDias)}</td>
                    <td>
                      {numero(custo.diasNecessarios)} dias
                    </td>
                    <td>
                      {numero(
                        custo.investimentoMaduroCentavos
                      ) > 0
                        ? formatarMoedaCentavos(
                            custo.investimentoMaduroCentavos
                          )
                        : "Sem gasto maduro"}
                    </td>
                    <td>
                      {numero(
                        custo.diasMadurosComGasto
                      )}
                    </td>
                    <td>
                      {numero(
                        custo.profissionaisMadurosComGasto
                      )}
                    </td>
                    <td>
                      {numero(
                        custo.profissionaisMadurosSemGasto
                      )}
                    </td>
                    <td>
                      {numero(
                        custo.comPrimeiroNaAtivacao
                      )}
                    </td>
                    <td>
                      {numero(
                        custo.comSegundoNaJanela
                      )}
                    </td>
                    <td>
                      {formatarMoedaCentavos(
                        custo.custoObservadoSegundoMaduroCentavos
                      )}
                    </td>
                    <td>
                      {numero(
                        custo.comTerceiroNaJanela
                      )}
                    </td>
                    <td>
                      {formatarMoedaCentavos(
                        custo.custoObservadoTerceiroMaduroCentavos
                      )}
                    </td>
                    <td>
                      {rotuloLeituraCustoMaduro(
                        custo.leitura
                      )}
                    </td>
                  </tr>
                )
              )
            ) : (
              <tr>
                <td colSpan="13">
                  Ainda não há base financeira madura para relacionar gasto e recorrência nesta seleção.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
