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
    return "Método não informado";
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

  return (
    <div className="admin-stat-table-card">
      <div className="admin-stat-table-heading">
        <strong>Qualidade por campanha oficial</strong>
        <small>
          Mostra somente campanhas que o backend conseguiu resolver como oficiais. A recorrência usa a identidade canônica da campanha e não promove tráfego orgânico, incompleto, não oficial ou sem evidência para esta tabela.
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
                  Ainda não há campanhas oficiais com profissionais nesta seleção.
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
    </div>
  );
}
