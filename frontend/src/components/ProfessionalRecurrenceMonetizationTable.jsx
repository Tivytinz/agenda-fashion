import {
  ProfessionalRecurrenceFinancialReadinessTable,
} from "./ProfessionalRecurrenceFinancialReadinessTable";
import { toFiniteNumber } from "../utils/format";

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

function formatarPercentual(valor) {
  if (
    valor === null ||
    valor === undefined ||
    !Number.isFinite(Number(valor))
  ) {
    return "Sem base";
  }

  return `${new Intl.NumberFormat(
    "pt-BR",
    { maximumFractionDigits: 2 }
  ).format(Number(valor))}%`;
}

export function ProfessionalRecurrenceMonetizationTable({
  campanhas = [],
  diagnostico = {},
}) {
  const grupos = Array.isArray(campanhas)
    ? campanhas
    : [];
  const linhas = grupos.flatMap((campanha) => {
    const janelas = Array.isArray(
      campanha?.monetizacaoRecorrencia
    )
      ? campanha.monetizacaoRecorrencia
      : [];

    return janelas.map((janela) => ({
      campanha,
      janela,
    }));
  });
  const diasAtivacao = toFiniteNumber(
    diagnostico?.diasMaturacaoAtivacao
  );
  const diasMonetizacao = toFiniteNumber(
    diagnostico?.diasMaturacaoMonetizacao
  );

  return (
    <>
      <div className="admin-stat-table-card">
        <div className="admin-stat-table-heading">
          <strong>
            Recorrência madura e monetização
          </strong>
          <small>
            Mostra a coexistência entre repetição de valor e o primeiro pagamento de um plano pago na mesma coorte madura. O pagamento só conta quando o primeiro pagamento datado permanece CONFIRMED ou RECEIVED e ocorre dentro da janela de monetização.
          </small>
          <small>
            A régua atual usa {diasAtivacao || "a janela configurada de"} dias para ativação e {diasMonetizacao || "a janela configurada de"} dias para monetização. Essa associação não prova que a recorrência causou a assinatura e não é retenção oficial, LTV, payback ou ROAS. No modelo freemium, não pagar nessa janela também não significa ausência de valor do produto.
          </small>
        </div>

        <div className="table-wrap">
          <table className="admin-compact-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Janela</th>
                <th>Dias mínimos</th>
                <th>Base madura</th>
                <th>Assinaturas ≤ janela monetização</th>
                <th>Taxa na base</th>
                <th>2º agendamento</th>
                <th>Assin. entre 2º</th>
                <th>Taxa entre 2º</th>
                <th>3º agendamento</th>
                <th>Assin. entre 3º</th>
                <th>Taxa entre 3º</th>
                <th>Leitura</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length ? (
                linhas.map(({ campanha, janela }) => (
                  <tr
                    key={`${campanha.chave || campanha.campanhaOficialId}-${janela.janelaDias}`}
                  >
                    <td>{rotuloCampanha(campanha)}</td>
                    <td>D{toFiniteNumber(janela.janelaDias)}</td>
                    <td>
                      {toFiniteNumber(
                        janela.diasMaturidadeNecessarios
                      )} dias
                    </td>
                    <td>
                      {toFiniteNumber(
                        janela.profissionaisMaduros
                      )}
                    </td>
                    <td>
                      {toFiniteNumber(
                        janela.assinaturasNaMonetizacao
                      )}
                    </td>
                    <td>
                      {formatarPercentual(
                        janela.taxaAssinaturaBaseMadura
                      )}
                    </td>
                    <td>
                      {toFiniteNumber(
                        janela.comSegundoNaJanela
                      )}
                    </td>
                    <td>
                      {toFiniteNumber(
                        janela.assinaturasEntreSegundo
                      )}
                    </td>
                    <td>
                      {formatarPercentual(
                        janela.taxaAssinaturaEntreSegundo
                      )}
                    </td>
                    <td>
                      {toFiniteNumber(
                        janela.comTerceiroNaJanela
                      )}
                    </td>
                    <td>
                      {toFiniteNumber(
                        janela.assinaturasEntreTerceiro
                      )}
                    </td>
                    <td>
                      {formatarPercentual(
                        janela.taxaAssinaturaEntreTerceiro
                      )}
                    </td>
                    <td>
                      {janela.baseAbaixoReguaOperacional
                        ? `Abaixo da régua operacional (${toFiniteNumber(
                            janela.minimoCadastrosReguaOperacional
                          )} cadastros)`
                        : "Base acima da régua operacional"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="13">
                    Ainda não há campanhas oficiais com coorte madura suficiente para relacionar recorrência e monetização nesta seleção.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProfessionalRecurrenceFinancialReadinessTable
        campanhas={grupos}
      />
    </>
  );
}
