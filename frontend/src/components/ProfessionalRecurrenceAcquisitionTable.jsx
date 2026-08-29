function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function nomeOrigem(valor) {
  const origem = String(valor || "")
    .trim()
    .toLowerCase();
  const nomes = {
    google: "Google",
    meta: "Meta",
    facebook: "Facebook",
    instagram: "Instagram",
    pinterest: "Pinterest",
    tiktok: "TikTok",
    microsoft: "Microsoft",
    organico: "Orgânico",
  };

  if (nomes[origem]) {
    return nomes[origem];
  }

  if (!origem || origem === "desconhecida") {
    return "Origem não identificada";
  }

  return origem.charAt(0).toUpperCase() +
    origem.slice(1);
}

function rotuloEvidencia(classificacao) {
  const rotulos = {
    oficial: "Oficial",
    organico: "Orgânico",
    rastreamento_incompleto:
      "Rastreamento incompleto",
    identidade_nao_oficial:
      "Identidade não oficial",
    sem_evidencia: "Sem evidência",
  };

  return rotulos[classificacao] ||
    "Sem evidência";
}

function rotuloOrigem(item) {
  const classificacao = String(
    item?.classificacaoAtribuicao ||
    "sem_evidencia"
  ).trim().toLowerCase();
  const origem = String(
    item?.origem || ""
  ).trim().toLowerCase();
  const nome = nomeOrigem(origem);

  if (classificacao === "sem_evidencia") {
    return "Sem evidência de origem";
  }

  if (classificacao === "oficial") {
    if (origem === "google") {
      return "Google Ads";
    }
    if (origem === "meta") {
      return "Meta Ads";
    }
    return `${nome} · oficial`;
  }

  if (classificacao === "organico") {
    if (
      origem === "organico" ||
      origem === "desconhecida"
    ) {
      return "Orgânico";
    }
    return `${nome} · orgânico`;
  }

  if (
    classificacao ===
    "rastreamento_incompleto"
  ) {
    return `${nome} · rastreamento incompleto`;
  }

  if (
    classificacao ===
    "identidade_nao_oficial"
  ) {
    return `${nome} · identidade não oficial`;
  }

  return nome;
}

export function ProfessionalRecurrenceAcquisitionTable({
  origens = [],
}) {
  const grupos = Array.isArray(origens)
    ? origens
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
        <strong>Qualidade da aquisição por origem</strong>
        <small>
          Compara profissionais pelo mesmo critério de atribuição usado no backend. Origem oficial, orgânica, rastreamento incompleto, identidade não oficial e ausência de evidência permanecem separados. Recorrência não transforma origem incompleta em atribuição oficial e não libera CAC, ROAS ou orçamento.
        </small>
      </div>

      <div className="table-wrap">
        <table className="admin-compact-table">
          <thead>
            <tr>
              <th>Origem</th>
              <th>Evidência</th>
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
                  <td>{rotuloOrigem(grupo)}</td>
                  <td>
                    {rotuloEvidencia(
                      grupo.classificacaoAtribuicao
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
                <td colSpan="9">
                  Ainda não há profissionais com origem disponível para esta seleção.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-stat-table-heading">
        <strong>Recorrência madura por origem</strong>
        <small>
          D7, D14 e D30 usam somente profissionais elegíveis em cada origem. Zero elegíveis significa que aquela origem ainda não teve tempo suficiente para completar a janela, não recorrência zero.
        </small>
      </div>

      <div className="table-wrap">
        <table className="admin-compact-table">
          <thead>
            <tr>
              <th>Origem</th>
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
                  <td>{rotuloOrigem(grupo)}</td>
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
                  Ainda não há janelas maduras por origem para esta seleção.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
