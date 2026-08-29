function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function formatarNumero(valor) {
  return new Intl.NumberFormat(
    "pt-BR",
    { maximumFractionDigits: 2 }
  ).format(Number(valor));
}

function formatarPercentual(valor) {
  if (
    valor === null ||
    valor === undefined ||
    !Number.isFinite(Number(valor))
  ) {
    return "Sem base";
  }

  return `${formatarNumero(valor)}%`;
}

function formatarVariacaoPp(valor) {
  if (
    valor === null ||
    valor === undefined ||
    !Number.isFinite(Number(valor))
  ) {
    return "Sem comparação";
  }

  const numeroValor = Number(valor);
  const prefixo = numeroValor > 0
    ? "+"
    : "";

  return `${prefixo}${formatarNumero(numeroValor)} pp`;
}

function formatarFaixa(faixa = {}) {
  const minimo = faixa.minimo;
  const maximo = faixa.maximo;
  const amplitude = faixa.amplitudePp;

  if (
    minimo === null ||
    minimo === undefined ||
    maximo === null ||
    maximo === undefined
  ) {
    return "Sem base";
  }

  if (Number(minimo) === Number(maximo)) {
    return formatarPercentual(minimo);
  }

  return `${formatarPercentual(minimo)} a ${formatarPercentual(maximo)} (${formatarNumero(amplitude)} pp)`;
}

function formatarSemana(valor) {
  const partes = String(valor || "")
    .split("-");

  if (
    partes.length !== 3 ||
    partes.some((parte) =>
      !/^\d+$/.test(parte)
    )
  ) {
    return null;
  }

  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

function formatarBaseComparacao(diagnostico) {
  const coortes = numero(
    diagnostico.coortesComBase
  );

  if (!coortes) {
    return "Sem base madura";
  }

  const recente = formatarSemana(
    diagnostico.semanaMaisRecenteComBase
  );

  if (coortes === 1) {
    return recente
      ? `Só ${recente}`
      : "Só uma coorte madura";
  }

  const anterior = formatarSemana(
    diagnostico.semanaAnteriorComBase
  );

  if (recente && anterior) {
    return `${recente} vs ${anterior}`;
  }

  return "Comparação disponível";
}

export function ProfessionalRecurrenceStabilityTable({
  diagnosticos = [],
}) {
  const linhas = Array.isArray(diagnosticos)
    ? diagnosticos
    : [];

  return (
    <div className="admin-stat-table-card">
      <div className="admin-stat-table-heading">
        <strong>Variação entre coortes maduras</strong>
        <small>
          Compara apenas coortes que já têm elegíveis em cada janela. A faixa mostra a dispersão observada entre semanas e a variação recente compara a coorte madura mais nova com a anterior. Como o AF ainda não definiu tamanho mínimo de amostra, estes números não são classificados automaticamente como tendência, melhora ou piora.
        </small>
      </div>

      <div className="table-wrap">
        <table className="admin-compact-table">
          <thead>
            <tr>
              <th>Janela</th>
              <th>Coortes com base</th>
              <th>Elegíveis</th>
              <th>Faixa taxa 2º</th>
              <th>Variação recente 2º</th>
              <th>Faixa taxa 3º</th>
              <th>Variação recente 3º</th>
              <th>Base recente</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length ? (
              linhas.map((diagnostico) => (
                <tr key={diagnostico.janelaDias}>
                  <td>D{numero(diagnostico.janelaDias)}</td>
                  <td>{numero(diagnostico.coortesComBase)}</td>
                  <td>{numero(diagnostico.elegiveisTotal)}</td>
                  <td>
                    {formatarFaixa(
                      diagnostico.faixaTaxaSegundo
                    )}
                  </td>
                  <td>
                    {formatarVariacaoPp(
                      diagnostico
                        .variacaoRecenteSegundoPp
                    )}
                  </td>
                  <td>
                    {formatarFaixa(
                      diagnostico.faixaTaxaTerceiro
                    )}
                  </td>
                  <td>
                    {formatarVariacaoPp(
                      diagnostico
                        .variacaoRecenteTerceiroPp
                    )}
                  </td>
                  <td>
                    {formatarBaseComparacao(
                      diagnostico
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8">
                  Ainda não há comparação entre coortes maduras para esta seleção.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
