import {
  useEffect,
  useState
} from "react";
import { apiRequest } from "../api/client";
import {
  ProfessionalRecurrenceStabilityTable,
} from "./ProfessionalRecurrenceStabilityTable";
import {
  ProfessionalRecurrenceAcquisitionTable,
} from "./ProfessionalRecurrenceAcquisitionTable";

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function formatarDias(valor) {
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
  ).format(Number(valor))} dias`;
}

function formatarSemanaCadastro(valor) {
  const partes = String(valor || "")
    .split("-");

  if (
    partes.length !== 3 ||
    partes.some((parte) =>
      !/^\d+$/.test(parte)
    )
  ) {
    return "Semana desconhecida";
  }

  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

export function ProfessionalRecurrencePanel({
  period = "30"
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setData(null);
    setError("");

    apiRequest(
      `/admin/marketing/recorrencia-profissionais?periodo=${period}`,
      { signal: controller.signal }
    )
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError) => {
        if (
          active &&
          requestError.name !== "AbortError"
        ) {
          setError(requestError.message);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [period, reloadKey]);

  if (!data && !error) {
    return (
      <section className="panel" aria-busy="true">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Recorrência</p>
            <h2>Depois do primeiro agendamento</h2>
            <p className="muted" role="status">
              Carregando repetição de uso...
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!data && error) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Recorrência</p>
            <h2>Depois do primeiro agendamento</h2>
            <p className="form-error" role="alert">
              {error}
            </p>
            <button
              className="button button-secondary button-small"
              onClick={() =>
                setReloadKey(
                  (current) => current + 1
                )
              }
              type="button"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </section>
    );
  }

  const resumo = data?.resumo || {};
  const tempos = data?.tempos || {};
  const janelasCandidatas =
    Array.isArray(data?.janelasCandidatas)
      ? data.janelasCandidatas
      : [];
  const coortesSemanais =
    Array.isArray(data?.coortesSemanais)
      ? data.coortesSemanais
      : [];
  const estabilidadeCoortes =
    Array.isArray(data?.estabilidadeCoortes)
      ? data.estabilidadeCoortes
      : [];
  const qualidadeAquisicao =
    Array.isArray(data?.qualidadeAquisicao)
      ? data.qualidadeAquisicao
      : [];
  const primeiro = numero(
    resumo.comPrimeiroAgendamento
  );
  const segundo = numero(
    resumo.comSegundoAgendamento
  );
  const terceiro = numero(
    resumo.comTerceiroAgendamento
  );

  let diagnostico =
    "Já existe repetição de uso após o primeiro agendamento. Acompanhe a passagem para o segundo e o terceiro antes de definir retenção temporal.";

  if (primeiro === 0) {
    diagnostico =
      "A coorte ainda não tem primeiro agendamento para avaliar recorrência.";
  } else if (segundo === 0) {
    diagnostico =
      "Os negócios chegaram ao primeiro agendamento, mas ainda não repetiram o valor pela segunda vez.";
  } else if (terceiro === 0) {
    diagnostico =
      "Já existe segundo agendamento, mas a repetição ainda não chegou ao terceiro marco.";
  }

  const etapas = [
    {
      label: "Primeiro agendamento",
      quantidade: primeiro,
      conversao: primeiro ? 100 : 0
    },
    {
      label: "Segundo agendamento",
      quantidade: segundo,
      conversao: numero(
        resumo.taxaSegundoSobrePrimeiro
      )
    },
    {
      label: "Terceiro agendamento",
      quantidade: terceiro,
      conversao: numero(
        resumo.taxaTerceiroSobreSegundo
      )
    }
  ];

  const transicoes = [
    {
      label: "1º → 2º agendamento",
      dados: tempos.primeiroParaSegundo || {}
    },
    {
      label: "2º → 3º agendamento",
      dados: tempos.segundoParaTerceiro || {}
    }
  ];

  const maturidade =
    tempos.maturidadeDesdePrimeiro || {};
  const linhasCoortes =
    coortesSemanais.flatMap((coorte) => {
      const janelas = Array.isArray(
        coorte.janelasCandidatas
      )
        ? coorte.janelasCandidatas
        : [];

      return janelas.map((janela) => ({
        semanaCadastro:
          coorte.semanaCadastro,
        profissionais:
          numero(coorte.profissionais),
        primeiro:
          numero(
            coorte.comPrimeiroAgendamento
          ),
        janela,
      }));
    });

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Recorrência</p>
          <h2>Depois do primeiro agendamento</h2>
          <p className="muted">
            Mede quantos profissionais da coorte chegaram ao primeiro, segundo e terceiro agendamento não cancelado no primeiro negócio em que aparecem como donos.
          </p>
          <p className="muted">{diagnostico}</p>
        </div>
      </div>

      <div className="admin-stat-table-card">
        <div className="admin-stat-table-heading">
          <strong>Repetição de valor</strong>
          <small>
            A conversão compara cada marco com o imediatamente anterior. Agendamentos cancelados não contam. Não é retenção D30 e não confirma atendimento realizado ou receita.
          </small>
        </div>

        <div className="table-wrap">
          <table className="admin-compact-table">
            <thead>
              <tr>
                <th>Marco</th>
                <th>Profissionais</th>
                <th>Conversão do marco anterior</th>
              </tr>
            </thead>
            <tbody>
              {etapas.map((etapa) => (
                <tr key={etapa.label}>
                  <td>{etapa.label}</td>
                  <td>{etapa.quantidade}</td>
                  <td>{etapa.conversao}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-stat-table-card">
        <div className="admin-stat-table-heading">
          <strong>Tempo até repetir o valor</strong>
          <small>
            Os intervalos usam o momento em que cada agendamento foi criado no AF, não a data futura marcada para o atendimento. Mediana e P75 descrevem a amostra observada, sem definir uma janela de retenção.
          </small>
        </div>

        <div className="table-wrap">
          <table className="admin-compact-table">
            <thead>
              <tr>
                <th>Transição</th>
                <th>Amostra</th>
                <th>Mediana</th>
                <th>P75</th>
              </tr>
            </thead>
            <tbody>
              {transicoes.map((transicao) => (
                <tr key={transicao.label}>
                  <td>{transicao.label}</td>
                  <td>{numero(transicao.dados.amostra)}</td>
                  <td>{formatarDias(transicao.dados.medianaDias)}</td>
                  <td>{formatarDias(transicao.dados.p75Dias)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-stat-table-card">
        <div className="admin-stat-table-heading">
          <strong>Janelas maduras de repetição</strong>
          <small>
            D7, D14 e D30 são candidatas de análise, não retenção oficial. Em cada linha, só entram como elegíveis profissionais cujo primeiro agendamento já tem idade suficiente para completar a janela.
          </small>
        </div>

        <div className="table-wrap">
          <table className="admin-compact-table">
            <thead>
              <tr>
                <th>Janela</th>
                <th>Elegíveis</th>
                <th>2º na janela</th>
                <th>Taxa 2º</th>
                <th>3º na janela</th>
                <th>Taxa 3º</th>
              </tr>
            </thead>
            <tbody>
              {janelasCandidatas.map((janela) => (
                <tr key={janela.janelaDias}>
                  <td>D{numero(janela.janelaDias)}</td>
                  <td>{numero(janela.elegiveis)}</td>
                  <td>{numero(janela.comSegundoNaJanela)}</td>
                  <td>{numero(janela.taxaSegundoNaJanela)}%</td>
                  <td>{numero(janela.comTerceiroNaJanela)}</td>
                  <td>{numero(janela.taxaTerceiroNaJanela)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-stat-table-card">
        <div className="admin-stat-table-heading">
          <strong>Recorrência por semana de cadastro</strong>
          <small>
            A semana começa na segunda-feira e usa o cadastro real do usuário em America/Sao_Paulo. As taxas D7, D14 e D30 continuam usando somente profissionais maduros para cada janela, permitindo comparar coortes sem penalizar as mais novas.
          </small>
        </div>

        <div className="table-wrap">
          <table className="admin-compact-table">
            <thead>
              <tr>
                <th>Semana</th>
                <th>Profissionais</th>
                <th>1º agendamento</th>
                <th>Janela</th>
                <th>Elegíveis</th>
                <th>2º</th>
                <th>Taxa 2º</th>
                <th>3º</th>
                <th>Taxa 3º</th>
              </tr>
            </thead>
            <tbody>
              {linhasCoortes.length ? (
                linhasCoortes.map((linha) => (
                  <tr
                    key={`${linha.semanaCadastro}-${linha.janela.janelaDias}`}
                  >
                    <td>
                      {formatarSemanaCadastro(
                        linha.semanaCadastro
                      )}
                    </td>
                    <td>{linha.profissionais}</td>
                    <td>{linha.primeiro}</td>
                    <td>
                      D{numero(
                        linha.janela.janelaDias
                      )}
                    </td>
                    <td>
                      {numero(
                        linha.janela.elegiveis
                      )}
                    </td>
                    <td>
                      {numero(
                        linha.janela
                          .comSegundoNaJanela
                      )}
                    </td>
                    <td>
                      {numero(
                        linha.janela
                          .taxaSegundoNaJanela
                      )}%
                    </td>
                    <td>
                      {numero(
                        linha.janela
                          .comTerceiroNaJanela
                      )}
                    </td>
                    <td>
                      {numero(
                        linha.janela
                          .taxaTerceiroNaJanela
                      )}%
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9">
                    Ainda não há coortes semanais com dados suficientes para esta seleção.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProfessionalRecurrenceStabilityTable
        diagnosticos={estabilidadeCoortes}
      />

      <ProfessionalRecurrenceAcquisitionTable
        origens={qualidadeAquisicao}
      />

      <p className="muted admin-campaign-attribution-note">
        {numero(resumo.taxaTerceiroSobrePrimeiro)}% dos profissionais que chegaram ao primeiro agendamento também chegaram ao terceiro.
      </p>

      <p className="muted admin-campaign-attribution-note">
        Maturidade observada desde o primeiro agendamento: {numero(maturidade.amostra)} profissionais na amostra, mediana de {formatarDias(maturidade.medianaDias)}, P75 de {formatarDias(maturidade.p75Dias)} e intervalo de {formatarDias(maturidade.minimoDias)} a {formatarDias(maturidade.maximoDias)}. Essa idade da amostra ajuda a escolher uma futura janela de retenção sem penalizar coortes novas.
      </p>
    </section>
  );
}
