const AppError = require("../errors/AppError");
const adminCampaignRepository = require("../repositories/adminCampaignRepository");
const repository = require("../repositories/marketingCostSyncRepository");
const providers = require("./marketingCostProviderRegistry");
const marketingCostSyncConfig = require("../config/marketingCostSync");

const PROVEDORES = new Set([
  "google_ads",
  "meta_ads",
  "tiktok_ads"
]);
const CANAL_POR_PROVEDOR = Object.freeze({
  google_ads: "google",
  meta_ads: "meta",
  tiktok_ads: "tiktok"
});
const NOME_POR_PROVEDOR = Object.freeze({
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  tiktok_ads: "TikTok Ads"
});
const REPORT_TIME_ZONE = "America/Sao_Paulo";
const MOEDA_SUPORTADA = "BRL";

function normalizarProvedor(valor) {
  const provedor = String(valor || "").trim().toLowerCase();
  if (!PROVEDORES.has(provedor)) {
    throw new AppError("Provedor de custos inválido.", 400);
  }
  return provedor;
}

function dataIso(valor) {
  const texto = String(valor || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw new AppError("Data inválida para sincronização.", 400);
  }
  const data = new Date(`${texto}T00:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto) {
    throw new AppError("Data inválida para sincronização.", 400);
  }
  return texto;
}

function hojeNoFusoRelatorio(data = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(data);

  const valor = (tipo) =>
    partes.find((item) => item.type === tipo)?.value;

  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function periodoPadrao({ dataInicio, dataFim } = {}) {
  const hoje = hojeNoFusoRelatorio();
  const fim = dataFim ? dataIso(dataFim) : hoje;

  if (fim > hoje) {
    throw new AppError(
      "A sincronização não aceita data futura.",
      400
    );
  }

  const inicioDate = new Date(`${fim}T00:00:00Z`);
  inicioDate.setUTCDate(inicioDate.getUTCDate() - 29);
  const inicio = dataInicio ? dataIso(dataInicio) : inicioDate.toISOString().slice(0, 10);
  const diff = (new Date(`${fim}T00:00:00Z`) - new Date(`${inicio}T00:00:00Z`)) / 86400000;
  if (diff < 0 || diff >= 90) {
    throw new AppError("A sincronização aceita períodos de até 90 dias.", 400);
  }
  return { dataInicio: inicio, dataFim: fim };
}

function normalizarTexto(valor, maximo = 240) {
  return String(valor || "").trim().slice(0, maximo);
}

function normalizarIdExterno(valor, maximo = 120) {
  return normalizarTexto(valor, maximo)
    .replace(/^act_/i, "")
    .replace(/\D/g, "");
}

function validarCanalDaCampanha(campanha, provedor) {
  const canalEsperado = CANAL_POR_PROVEDOR[provedor];
  if (campanha?.canal && canalEsperado && campanha.canal !== canalEsperado) {
    throw new AppError(
      `Esta campanha do AF pertence ao canal ${campanha.canal}. Vincule-a ao provedor correspondente.`,
      400
    );
  }
}

function validarMoedaConta(resultado, provedor) {
  const moeda = String(resultado?.moeda || "")
    .trim()
    .toUpperCase();

  if (moeda !== MOEDA_SUPORTADA) {
    const nomeProvedor = NOME_POR_PROVEDOR[provedor] || provedor;
    const moedaExibida = moeda || "não informada";
    throw new AppError(
      `A conta do ${nomeProvedor} usa moeda ${moedaExibida}. O AF só importa custos automáticos em BRL nesta versão.`,
      422
    );
  }

  return moeda;
}

function gastoVinculadoSeguro(item, vinculo, periodo) {
  const dataGasto = dataIso(item?.dataGasto);
  if (
    dataGasto < periodo.dataInicio ||
    dataGasto > periodo.dataFim
  ) {
    throw new AppError(
      "A plataforma devolveu custo fora do período solicitado.",
      502
    );
  }

  const valorCentavos = Number(item?.valorCentavos);
  if (!Number.isInteger(valorCentavos) || valorCentavos < 0) {
    throw new AppError(
      "A plataforma devolveu um valor de custo inválido.",
      502
    );
  }

  if (valorCentavos === 0) {
    return null;
  }

  return {
    campanhaId: Number(vinculo.campanha_id),
    dataGasto,
    valorCentavos
  };
}

function idadeHoras(timestamp, agora = new Date()) {
  if (!timestamp) return null;

  const data = new Date(timestamp);
  if (Number.isNaN(data.getTime())) return null;

  return Math.max(
    0,
    Number(((agora.getTime() - data.getTime()) / 3600000).toFixed(2))
  );
}

function saudeIntegracao(
  item,
  ultimaSincronizacao,
  sincronizacaoAutomatica,
  agora = new Date()
) {
  if (!item?.habilitado) {
    return {
      codigo: "desativado",
      rotulo: "Desativado",
      nivel: "neutro",
      detalhe: "Integração desligada no ambiente.",
      desatualizado: false,
      idadeHoras: null
    };
  }

  if (!item?.configurado) {
    return {
      codigo: "configuracao_incompleta",
      rotulo: "Configuração incompleta",
      nivel: "aviso",
      detalhe:
        item?.provedor === "tiktok_ads" && item?.autorizacao?.disponivel
          ? "Autorize a conta TikTok no painel para concluir a configuração."
          : "A integração está habilitada, mas faltam credenciais obrigatórias.",
      desatualizado: false,
      idadeHoras: null
    };
  }

  if (!ultimaSincronizacao) {
    return {
      codigo: "nao_sincronizado",
      rotulo: "Não sincronizado",
      nivel: "aviso",
      detalhe: "Conta configurada, mas nenhum custo foi sincronizado ainda.",
      desatualizado: false,
      idadeHoras: null
    };
  }

  const status = String(ultimaSincronizacao.status || "")
    .trim()
    .toLowerCase();
  const referencia =
    ultimaSincronizacao.finished_at ||
    ultimaSincronizacao.created_at ||
    null;
  const horas = idadeHoras(referencia, agora);

  if (status === "executando") {
    return {
      codigo: "sincronizando",
      rotulo: "Sincronizando",
      nivel: "informacao",
      detalhe: "Uma sincronização de custos está em andamento.",
      desatualizado: false,
      idadeHoras: horas
    };
  }

  if (status === "erro") {
    return {
      codigo: "erro",
      rotulo: "Erro",
      nivel: "erro",
      detalhe:
        normalizarTexto(
          ultimaSincronizacao.erro_mensagem ||
            "A última sincronização falhou.",
          300
        ),
      desatualizado: false,
      idadeHoras: horas
    };
  }

  if (
    status === "parcial" ||
    Number(ultimaSincronizacao.campanhas_nao_vinculadas || 0) > 0
  ) {
    const semVinculo = Number(
      ultimaSincronizacao.campanhas_nao_vinculadas || 0
    );
    return {
      codigo: "parcial",
      rotulo: "Parcial",
      nivel: "aviso",
      detalhe:
        semVinculo > 0
          ? `${semVinculo} campanha(s) externa(s) ficaram sem vínculo na última sincronização.`
          : "A última sincronização foi concluída apenas parcialmente.",
      desatualizado: false,
      idadeHoras: horas
    };
  }

  const limiteHoras = Number(
    sincronizacaoAutomatica?.limiteDesatualizadoHoras || 24
  );
  const desatualizado =
    horas === null ||
    horas > limiteHoras;

  if (desatualizado) {
    return {
      codigo: "desatualizado",
      rotulo: "Desatualizado",
      nivel: "aviso",
      detalhe:
        horas === null
          ? "A última sincronização não possui horário válido de conclusão."
          : `Última sincronização há ${horas.toFixed(1)}h; limite operacional de ${limiteHoras}h.`,
      desatualizado: true,
      idadeHoras: horas
    };
  }

  const importados = Number(
    ultimaSincronizacao.registros_importados || 0
  );

  return {
    codigo: "saudavel",
    rotulo: "Saudável",
    nivel: "sucesso",
    detalhe: `${importados} registro(s) importado(s) na última sincronização.`,
    desatualizado: false,
    idadeHoras: horas
  };
}

async function statusIntegracoes() {
  const [vinculos, sincronizacoes, statusProvedores] = await Promise.all([
    repository.listarVinculos(),
    repository.listarUltimasSincronizacoes(),
    providers.status()
  ]);
  const sincronizacaoAutomatica =
    marketingCostSyncConfig.statusAgendamento();

  return {
    sincronizacaoAutomatica,
    provedores: statusProvedores.map((item) => {
      const ultimaSincronizacao =
        sincronizacoes.find((s) => s.provedor === item.provedor) || null;

      return {
        ...item,
        vinculos: vinculos.filter((v) => v.provedor === item.provedor).length,
        ultimaSincronizacao,
        saude: saudeIntegracao(
          item,
          ultimaSincronizacao,
          sincronizacaoAutomatica
        )
      };
    }),
    vinculos
  };
}

async function listarCampanhasExternas({ provedor: valorProvedor }) {
  const provedor = normalizarProvedor(valorProvedor);
  const [campanhas, statusProvedores] = await Promise.all([
    providers.listarCampanhas(provedor),
    providers.status()
  ]);
  return {
    provedor,
    contaExternaId: campanhas[0]?.contaExternaId ||
      statusProvedores.find((item) => item.provedor === provedor)?.contaExternaId ||
      null,
    campanhas: campanhas.map((item) => ({
      id: item.campanhaExternaId,
      nome: item.campanhaExternaNome,
      status: item.status || "UNKNOWN",
      tipo: item.tipo || "UNKNOWN"
    }))
  };
}

async function testarIntegracao({ provedor: valorProvedor }) {
  const provedor = normalizarProvedor(valorProvedor);
  const resultado = await providers.testarConexao(provedor);
  const moeda = validarMoedaConta(resultado, provedor);
  return {
    provedor,
    conectado: resultado?.conectado === true,
    contaExternaId: resultado?.contaExternaId || null,
    nomeConta: resultado?.nomeConta || null,
    moeda,
    fusoHorario: resultado?.fusoHorario || null,
    apiVersion: resultado?.apiVersion || null
  };
}

async function vincularCampanha({ payload }) {
  const campanhaId = Number(payload?.campanhaId ?? payload?.campanha_id);
  if (!Number.isInteger(campanhaId) || campanhaId <= 0) {
    throw new AppError("Campanha inválida.", 400);
  }
  const campanha = await adminCampaignRepository.buscarPorId(campanhaId);
  if (!campanha) throw new AppError("Campanha não encontrada.", 404);

  if (campanha.ativo === false) {
    throw new AppError(
      "Campanhas arquivadas não podem receber vínculos de custos.",
      409
    );
  }

  if (!["profissional", "cliente"].includes(campanha.objetivo)) {
    throw new AppError(
      "Classifique o objetivo da campanha antes de vinculá-la a uma plataforma de anúncios.",
      409
    );
  }

  const provedor = normalizarProvedor(payload?.provedor);
  validarCanalDaCampanha(campanha, provedor);

  let campanhaExternaId = normalizarIdExterno(
    payload?.campanhaExternaId ?? payload?.campanha_externa_id
  );
  const nomeProvedor = NOME_POR_PROVEDOR[provedor] || provedor;
  if (!campanhaExternaId) {
    throw new AppError(`Selecione uma campanha real do ${nomeProvedor}.`, 400);
  }

  const diagnostico = await providers.testarConexao(provedor);
  validarMoedaConta(diagnostico, provedor);

  const campanhaExterna = await providers.buscarCampanha(
    provedor,
    campanhaExternaId
  );
  const contaExternaId = normalizarIdExterno(campanhaExterna?.contaExternaId);
  campanhaExternaId = normalizarIdExterno(campanhaExterna?.campanhaExternaId);
  const campanhaExternaNome = normalizarTexto(
    campanhaExterna?.campanhaExternaNome,
    240
  ) || null;

  const contaInformada = normalizarIdExterno(
    payload?.contaExternaId ?? payload?.conta_externa_id
  );
  if (contaInformada && contaInformada !== contaExternaId) {
    throw new AppError(
      `A conta informada não corresponde à conta configurada do ${nomeProvedor}.`,
      400
    );
  }

  if (!contaExternaId || !campanhaExternaId) {
    throw new AppError("A plataforma não devolveu uma conta e campanha válidas.", 502);
  }

  const vinculo = await repository.salvarVinculo({
    campanhaId,
    provedor,
    contaExternaId,
    campanhaExternaId,
    campanhaExternaNome
  });
  return {
    vinculo,
    campanhaExterna: {
      id: campanhaExternaId,
      nome: campanhaExternaNome,
      status: campanhaExterna.status || "UNKNOWN",
      tipo: campanhaExterna.tipo || "UNKNOWN"
    }
  };
}

function erroSeguro(erro) {
  const status = Number(erro?.statusCode || erro?.status || 500);
  const codigo = status >= 400 && status < 600 ? `http_${status}` : "sync_error";
  return {
    codigo,
    mensagem: String(erro?.message || "Falha ao sincronizar custos.").slice(0, 300)
  };
}

async function sincronizar({ provedor: valorProvedor, payload, usuarioId }) {
  const provedor = normalizarProvedor(valorProvedor);
  const periodo = periodoPadrao(payload);
  const bloqueio =
    await repository
      .executarComLockSincronizacao(
        provedor,
        async () => {
          const run =
            await repository
              .iniciarSincronizacao({
                provedor,
                ...periodo,
                usuarioId:
                  Number.isInteger(Number(usuarioId))
                    ? Number(usuarioId)
                    : null
              });

          try {
            const diagnostico =
              await providers
                .testarConexao(provedor);
            validarMoedaConta(
              diagnostico,
              provedor
            );

            const [custos, vinculos] =
              await Promise.all([
                providers.listarCustos(
                  provedor,
                  periodo
                ),
                repository
                  .buscarVinculosPorProvedor(
                    provedor
                  )
              ]);
            const porExterno = new Map(
              vinculos.map((v) => [
                `${String(v.conta_externa_id)}:${String(v.campanha_externa_id)}`,
                v
              ])
            );

            const naoVinculadas =
              new Set();
            const gastosVinculados = [];

            for (const item of custos) {
              const chave =
                `${item.contaExternaId}:${item.campanhaExternaId}`;
              const vinculo =
                porExterno.get(chave);
              if (!vinculo) {
                naoVinculadas.add(chave);
                continue;
              }

              const gasto =
                gastoVinculadoSeguro(
                  item,
                  vinculo,
                  periodo
                );
              if (gasto) {
                gastosVinculados.push(gasto);
              }
            }

            await repository
              .reconciliarGastosAutomaticos({
                provedor,
                dataInicio:
                  periodo.dataInicio,
                dataFim:
                  periodo.dataFim,
                campanhaIds:
                  vinculos.map(
                    (v) =>
                      Number(v.campanha_id)
                  ),
                gastos:
                  gastosVinculados
              });

            const importados =
              gastosVinculados.length;
            const status =
              naoVinculadas.size > 0
                ? "parcial"
                : "sucesso";
            await repository
              .finalizarSincronizacao({
                id: run.id,
                status,
                importados,
                naoVinculadas:
                  naoVinculadas.size
              });
            return {
              provedor,
              status,
              periodo,
              registrosImportados:
                importados,
              campanhasNaoVinculadas:
                naoVinculadas.size
            };
          } catch (erro) {
            const seguro =
              erroSeguro(erro);
            await repository
              .finalizarSincronizacao({
                id: run.id,
                status: "erro",
                importados: 0,
                naoVinculadas: 0,
                erroCodigo:
                  seguro.codigo,
                erroMensagem:
                  seguro.mensagem
              });
            throw erro;
          }
        }
      );

  if (!bloqueio.executado) {
    throw new AppError(
      "Já existe uma sincronização deste provedor em andamento.",
      409
    );
  }

  return bloqueio.resultado;
}

module.exports = {
  statusIntegracoes,
  listarCampanhasExternas,
  testarIntegracao,
  vincularCampanha,
  sincronizar,
  normalizarProvedor,
  periodoPadrao,
  hojeNoFusoRelatorio,
  normalizarIdExterno,
  validarCanalDaCampanha,
  validarMoedaConta,
  gastoVinculadoSeguro,
  idadeHoras,
  saudeIntegracao
};
