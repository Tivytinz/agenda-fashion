function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function rotuloCampanha(item) {
  const campanha = String(
    item?.campanha || ""
  ).trim();

  if (campanha) return campanha;

  const id = String(
    item?.campanhaOficialId || ""
  ).trim();

  return id
    ? `Campanha oficial #${id}`
    : "Campanha oficial";
}

function formatarJanelas(valores) {
  const janelas = Array.isArray(valores)
    ? valores
    : [];

  if (!janelas.length) {
    return "Nenhuma";
  }

  return janelas
    .map((janela) => `D${numero(janela)}`)
    .join(", ");
}

function rotuloCategoria(valor) {
  const rotulos = {
    integridade: "Integridade",
    atribuicao: "Atribuição",
    custo: "Custo",
    monetizacao: "Monetização",
    maturidade: "Maturidade",
    amostra: "Amostra",
    dados: "Dados",
  };

  return rotulos[valor] ||
    "Dados";
}

export function ProfessionalRecurrenceFinancialDiagnosisTable({
  diagnostico = {},
}) {
  const campanhas = Array.isArray(
    diagnostico?.campanhas
  )
    ? diagnostico.campanhas
    : [];
  const resumo = diagnostico?.resumo || {};
  const bloqueios = Array.isArray(
    resumo?.bloqueios
  )
    ? resumo.bloqueios
    : [];

  return (
    <div className="admin-stat-table-card">
      <div className="admin-stat-table-heading">
        <strong>
          Diagnóstico executivo da prontidão financeira
        </strong>
        <small>
          Consolida D7, D14 e D30 para mostrar por que a leitura financeira ainda está disponível, parcial ou bloqueada. O bloqueio principal segue precedência técnica de integridade e cobertura antes de maturidade e amostra.
        </small>
        <small>
          Resultado baixo ou zero de recorrência, monetização ou ROAS não vira bloqueio nesta tabela. Ela não ranqueia campanhas e não recomenda escalar, manter ou pausar orçamento.
        </small>
        <small>
          Seleção: {numero(resumo.campanhas)} campanhas; {numero(resumo.comLeituraCompleta)} com leitura completa; {numero(resumo.comLeituraParcial)} com leitura parcial; {numero(resumo.bloqueadas)} bloqueadas.
        </small>
      </div>

      <div className="table-wrap">
        <table className="admin-compact-table">
          <thead>
            <tr>
              <th>Campanha</th>
              <th>Estado</th>
              <th>Janelas disponíveis</th>
              <th>Janelas bloqueadas</th>
              <th>Bloqueio principal</th>
              <th>Janelas afetadas</th>
              <th>Evidência necessária</th>
            </tr>
          </thead>
          <tbody>
            {campanhas.length ? (
              campanhas.map((campanha) => {
                const bloqueio =
                  campanha.bloqueioPrincipal;

                return (
                  <tr key={campanha.chave}>
                    <td>{rotuloCampanha(campanha)}</td>
                    <td>
                      {campanha?.estado?.rotulo ||
                        "Sem diagnóstico"}
                    </td>
                    <td>
                      {formatarJanelas(
                        campanha.janelasDisponiveis
                      )}
                    </td>
                    <td>
                      {formatarJanelas(
                        campanha.janelasBloqueadas
                      )}
                    </td>
                    <td>
                      {bloqueio?.rotulo ||
                        "Nenhum bloqueio técnico"}
                    </td>
                    <td>
                      {formatarJanelas(
                        bloqueio?.janelas
                      )}
                    </td>
                    <td>
                      {bloqueio?.evidenciaFaltante ||
                        "Nenhuma evidência técnica pendente nesta seleção."}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7">
                  Ainda não há campanhas com janelas de prontidão financeira para consolidar nesta seleção.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-stat-table-heading">
        <strong>Bloqueios na seleção</strong>
        <small>
          A contagem de campanhas é deduplicada por bloqueio. “Janelas” mostra quantas combinações campanha × D7/D14/D30 estão afetadas.
        </small>
      </div>

      <div className="table-wrap">
        <table className="admin-compact-table">
          <thead>
            <tr>
              <th>Bloqueio</th>
              <th>Categoria</th>
              <th>Campanhas</th>
              <th>Janelas</th>
              <th>Evidência necessária</th>
            </tr>
          </thead>
          <tbody>
            {bloqueios.length ? (
              bloqueios.map((bloqueio) => (
                <tr key={bloqueio.codigo}>
                  <td>{bloqueio.rotulo}</td>
                  <td>
                    {rotuloCategoria(
                      bloqueio.categoria
                    )}
                  </td>
                  <td>{numero(bloqueio.campanhas)}</td>
                  <td>
                    {numero(
                      bloqueio.ocorrenciasJanelas
                    )}
                  </td>
                  <td>
                    {bloqueio.evidenciaFaltante}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5">
                  Nenhum bloqueio técnico consolidado nesta seleção.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
