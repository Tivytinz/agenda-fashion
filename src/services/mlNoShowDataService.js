const repository = require(
  "../repositories/mlNoShowRepository"
);
const {
  MINIMO_AMOSTRAS_ROTULADAS,
  MINIMO_POR_CLASSE,
  COBERTURA_MINIMA_DESFECHO,
} = require("../config/mlNoShow");

function inteiro(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 0
    ? numero
    : 0;
}

function avaliarProntidao(dados) {
  const amostrasRotuladas = inteiro(
    dados?.amostras_rotuladas
  );
  const faltas = inteiro(dados?.faltas);
  const realizados = inteiro(dados?.realizados);
  const pendentesVencidos = inteiro(
    dados?.pendentes_vencidos
  );
  const universoDesfecho =
    amostrasRotuladas + pendentesVencidos;
  const coberturaDesfecho = universoDesfecho > 0
    ? amostrasRotuladas / universoDesfecho
    : 0;

  const motivos = [];

  if (amostrasRotuladas < MINIMO_AMOSTRAS_ROTULADAS) {
    motivos.push("amostras_rotuladas_insuficientes");
  }

  if (faltas < MINIMO_POR_CLASSE) {
    motivos.push("faltas_insuficientes");
  }

  if (realizados < MINIMO_POR_CLASSE) {
    motivos.push("realizados_insuficientes");
  }

  if (coberturaDesfecho < COBERTURA_MINIMA_DESFECHO) {
    motivos.push("cobertura_desfecho_insuficiente");
  }

  return {
    pronta_para_treinamento: motivos.length === 0,
    motivos,
    limites: {
      minimo_amostras_rotuladas:
        MINIMO_AMOSTRAS_ROTULADAS,
      minimo_por_classe:
        MINIMO_POR_CLASSE,
      cobertura_minima_desfecho:
        COBERTURA_MINIMA_DESFECHO,
    },
    dados: {
      total_amostras: inteiro(dados?.total_amostras),
      amostras_rotuladas: amostrasRotuladas,
      faltas,
      realizados,
      pendentes_vencidos: pendentesVencidos,
      cobertura_desfecho:
        Number(coberturaDesfecho.toFixed(4)),
      primeiro_rotulo_em:
        dados?.primeiro_rotulo_em || null,
      ultimo_rotulo_em:
        dados?.ultimo_rotulo_em || null,
    },
  };
}


function taxa(parte, total) {
  if (total <= 0) {
    return 0;
  }

  return Number((parte / total).toFixed(4));
}

function mapearMaturidadeGrupo(dados) {
  const amostrasRotuladas = inteiro(
    dados?.amostras_rotuladas
  );
  const faltas = inteiro(dados?.faltas);
  const realizados = inteiro(dados?.realizados);
  const pendentesVencidos = inteiro(
    dados?.pendentes_vencidos
  );
  const universoDesfecho =
    amostrasRotuladas + pendentesVencidos;

  return {
    total_amostras:
      inteiro(dados?.total_amostras),
    amostras_rotuladas:
      amostrasRotuladas,
    faltas,
    realizados,
    pendentes_vencidos:
      pendentesVencidos,
    cobertura_desfecho:
      taxa(
        amostrasRotuladas,
        universoDesfecho
      ),
    taxa_falta:
      taxa(faltas, amostrasRotuladas),
    primeiro_rotulo_em:
      dados?.primeiro_rotulo_em || null,
    ultimo_rotulo_em:
      dados?.ultimo_rotulo_em || null,
  };
}

async function obterDiagnosticoMaturidade() {
  const [
    global,
    resumoNegocios,
    negocios,
    segmentosCliente,
    mensal,
  ] = await Promise.all([
    repository.obterProntidao(),
    repository.obterResumoMaturidadeNegocios(),
    repository.listarMaturidadeNegocios({
      limite: 20,
    }),
    repository.listarMaturidadeSegmentosCliente(),
    repository.listarMaturidadeMensal({
      meses: 12,
    }),
  ]);

  const prontidao =
    avaliarProntidao(global);
  const totalRotuladasNegocios =
    inteiro(
      resumoNegocios?.amostras_rotuladas
    );
  const maiorVolumeRotulado =
    inteiro(
      resumoNegocios?.maior_volume_rotulado
    );

  return {
    coletado_em:
      new Date().toISOString(),
    feature_version: "v1",
    prontidao,
    diagnosticos: {
      negocios: {
        negocios_com_amostras:
          inteiro(
            resumoNegocios
              ?.negocios_com_amostras
          ),
        negocios_com_rotulos:
          inteiro(
            resumoNegocios
              ?.negocios_com_rotulos
          ),
        maior_participacao_rotulada:
          taxa(
            maiorVolumeRotulado,
            totalRotuladasNegocios
          ),
        mais_representados:
          (Array.isArray(negocios)
            ? negocios
            : []
          ).map((linha) => {
            const resumo =
              mapearMaturidadeGrupo(
                linha
              );

            return {
              negocio_id:
                inteiro(
                  linha?.negocio_id
                ),
              ...resumo,
              participacao_rotulada:
                taxa(
                  resumo
                    .amostras_rotuladas,
                  totalRotuladasNegocios
                ),
            };
          }),
      },
      segmentos_cliente:
        (Array.isArray(
          segmentosCliente
        )
          ? segmentosCliente
          : []
        ).map((linha) => ({
          segmento:
            linha?.cliente_tem_conta === true
              ? "com_conta"
              : "visitante",
          ...mapearMaturidadeGrupo(
            linha
          ),
        })),
      mensal:
        (Array.isArray(mensal)
          ? mensal
          : []
        ).map((linha) => ({
          mes:
            String(
              linha?.mes || ""
            ).slice(0, 7),
          ...mapearMaturidadeGrupo(
            linha
          ),
        })),
    },
  };
}

async function coletar({ limite }) {
  const [amostrasCapturadas, amostrasRotuladas] =
    await Promise.all([
      repository.capturarAmostrasPendentes({ limite }),
      repository.rotularAmostrasPendentes(),
    ]);

  const dados = await repository.obterProntidao();

  return {
    amostras_capturadas: amostrasCapturadas,
    amostras_rotuladas_nesta_execucao:
      amostrasRotuladas,
    prontidao: avaliarProntidao(dados),
  };
}

module.exports = {
  coletar,
  avaliarProntidao,
  obterDiagnosticoMaturidade,
  mapearMaturidadeGrupo,
};
