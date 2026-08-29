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

function formatarMoedaCentavos(valor) {
  if (
    valor === null ||
    valor === undefined ||
    !Number.isFinite(Number(valor))
  ) {
    return "Sem base";
  }

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  ).format(Number(valor) / 100);
}

function formatarValorOuSemBase(valor) {
  if (
    valor === null ||
    valor === undefined ||
    !Number.isFinite(Number(valor))
  ) {
    return "Sem base";
  }

  return String(numero(valor));
}

function rotuloProntidao(leitura = {}) {
  const rotulos = {
    leitura_conjunta_disponivel:
      "Leitura conjunta disponível",
    sem_base_custo:
      "Sem base de custo",
    sem_base_monetizacao:
      "Sem base de monetização",
    maturidade_financeira_desalinhada:
      "Aguardar maturidade alinhada",
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
    base_financeira_inconsistente:
      "Base financeira inconsistente",
    base_financeira_bloqueada:
      "Base financeira bloqueada",
  };

  return rotulos[leitura?.codigo] ||
    leitura?.rotulo ||
    "Leitura não classificada";
}

function resumoMinimoAssinaturas(janela) {
  const minimo = numero(
    janela?.minimoAssinaturasReguaRoas
  );
  const observadas = numero(
    janela?.assinaturasNaMonetizacao
  );

  if (minimo <= 0) {
    return "Sem régua configurada";
  }

  return `${observadas}/${minimo}${
    janela?.atingiuMinimoAssinaturasReguaRoas
      ? " atingido"
      : ""
  }`;
}

function textoRegua(diagnostico = {}) {
  const minimoCadastros = numero(
    diagnostico?.minimoCadastros
  );
  const minimoAssinaturas = numero(
    diagnostico?.minimoAssinaturas
  );

  if (
    minimoCadastros > 0 &&
    minimoAssinaturas > 0
  ) {
    return `Régua operacional atual: ${minimoCadastros} cadastros maduros e ${minimoAssinaturas} assinaturas para a etapa de ROAS. Esses limites são apenas contexto e não liberam decisão financeira sozinhos.`;
  }

  return "O mínimo de assinaturas exibido em cada linha reutiliza a régua já configurada no funil e aparece apenas como contexto. Atingi-lo, sozinho, não libera decisão financeira.";
}

export function ProfessionalRecurrenceFinancialReadinessTable({
  campanhas = [],
  diagnostico = {},
}) {
  const grupos = Array.isArray(campanhas)
    ? campanhas
    : [];
  const linhas = grupos.flatMap((campanha) => {
    const janelas = Array.isArray(
      campanha?.prontidaoFinanceiraRecorrencia
    )
      ? campanha.prontidaoFinanceiraRecorrencia
      : [];

    return janelas.map((janela) => ({
      campanha,
      janela,
    }));
  });

  return (
    <div className="admin-stat-table-card">
      <div className="admin-stat-table-heading">
        <strong>
          Prontidão da leitura financeira conjunta
        </strong>
        <small>
          Cruza somente profissionais oficialmente atribuídos que pertencem aos mesmos dias maduros de gasto. A base precisa estar íntegra em custo, atribuição, maturidade e tamanho de amostra antes de ser considerada comparável.
        </small>
        <small>
          “Leitura conjunta disponível” significa que custo, recorrência e primeiro pagamento podem ser lidos na mesma base madura. Não significa que a campanha deve escalar, manter ou pausar. A decisão de ROAS continua no funil profissional. Resultado zero de recorrência ou assinatura não invalida uma base íntegra.
        </small>
        <small>
          {textoRegua(diagnostico)}
        </small>
      </div>

      <div className="table-wrap">
        <table className="admin-compact-table">
          <thead>
            <tr>
              <th>Campanha</th>
              <th>Janela</th>
              <th>Maturidade</th>
              <th>Investimento maduro</th>
              <th>Base c/ gasto</th>
              <th>2º</th>
              <th>3º</th>
              <th>Assinaturas</th>
              <th>Mín. assin. ROAS</th>
              <th>Prontidão</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length ? (
              linhas.map(({ campanha, janela }) => (
                <tr
                  key={`prontidao-${campanha.chave || campanha.campanhaOficialId}-${janela.janelaDias}`}
                >
                  <td>{rotuloCampanha(campanha)}</td>
                  <td>D{numero(janela.janelaDias)}</td>
                  <td>
                    {numero(
                      janela.diasMaturidadeFinanceira
                    )} dias
                  </td>
                  <td>
                    {formatarMoedaCentavos(
                      janela.investimentoMaduroCentavos
                    )}
                  </td>
                  <td>
                    {formatarValorOuSemBase(
                      janela.profissionaisMadurosComGasto
                    )}
                  </td>
                  <td>
                    {numero(
                      janela.comSegundoNaJanela
                    )}
                  </td>
                  <td>
                    {numero(
                      janela.comTerceiroNaJanela
                    )}
                  </td>
                  <td>
                    {numero(
                      janela.assinaturasNaMonetizacao
                    )}
                  </td>
                  <td>
                    {resumoMinimoAssinaturas(
                      janela
                    )}
                  </td>
                  <td>
                    {rotuloProntidao(
                      janela.leitura
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10">
                  Ainda não há campanhas com base suficiente para diagnosticar a prontidão financeira conjunta nesta seleção.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
